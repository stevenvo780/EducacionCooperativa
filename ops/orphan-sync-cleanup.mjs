#!/usr/bin/env node
/**
 * orphan-sync-cleanup.mjs
 *
 * Detecta docs Firestore con `storagePath` huérfano (blob no existe en MinIO).
 * Estos docs causan un loop infinito en agora-host-sync: el daemon intenta
 * hacer pull, recibe HTTP 404, incrementa failed++ y vuelve a intentar cada 5s.
 *
 * Con el patch defensivo del daemon (ORPHAN_THRESHOLD=3) los paths quedan
 * silenciados en state, pero el doc Firestore sigue corrupto. Este script
 * los identifica para que el operador decida qué hacer.
 *
 * ESTRATEGIA:
 *   1. Lee todos los docs de la collection `documents` filtrados por workspaceId.
 *   2. Para cada doc con `storagePath`, hace HEAD al blob en MinIO vía SSH.
 *      (Se lista el bucket una vez y se cruza en memoria — no 1 SSH por blob.)
 *   3. Reporta los huérfanos en tabla.
 *   4. Con --apply: NO borra nada. Requiere además --destructive-confirmed
 *      para cualquier acción destructiva futura (defensa en profundidad).
 *
 * FLAGS:
 *   --workspace=<wsId>          Filtrar por workspace. Sin este flag procesa todos.
 *   --apply                     Reservado. Sin --destructive-confirmed no hace nada.
 *   --destructive-confirmed     Habilita borrado (hoy no implementado; requiere
 *                               --apply también). Placeholder defensivo.
 *   --minio-alias=<alias>       Alias mc para MinIO (default: adm)
 *   --nas-host=<user@host>      Host SSH del NAS (default: nas@100.98.67.189)
 *   --bucket=<name>             Bucket MinIO (default: agora-blobs)
 *   --verbose                   Mostrar progreso por doc
 *
 * USO:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/stevenvallejo780@gmail.com/adc.json \
 *     node orphan-sync-cleanup.mjs
 *
 *   # Solo un workspace:
 *   ... node orphan-sync-cleanup.mjs --workspace=JhRFIASsH0dkmh7TkCiX
 *
 *   # Cuando el user confirme borrar (placeholder — no implementado aún):
 *   ... node orphan-sync-cleanup.mjs --workspace=X --apply --destructive-confirmed
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'child_process';

// ── Flags ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DESTRUCTIVE = args.includes('--destructive-confirmed');
const VERBOSE = args.includes('--verbose');

const flag = (name) => {
    const match = args.find((a) => a.startsWith(`--${name}=`));
    return match ? match.slice(`--${name}=`.length) : null;
};

const WORKSPACE_ID = flag('workspace');
const MINIO_ALIAS = flag('minio-alias') ?? 'adm';
const NAS_HOST = flag('nas-host') ?? 'nas@100.98.67.189';
const MINIO_BUCKET = flag('bucket') ?? 'agora-blobs';

// ── Firebase ───────────────────────────────────────────────────────────────

if (!getApps().length) {
    initializeApp();
}
const db = getFirestore();

// ── MinIO helpers ──────────────────────────────────────────────────────────

/**
 * Lista todos los blobs del bucket (o un prefijo) vía SSH → mc ls.
 * Devuelve un Set de paths relativos al bucket root.
 */
const listMinioPaths = (prefix = '') => {
    const target = prefix
        ? `${MINIO_ALIAS}/${MINIO_BUCKET}/${prefix}`
        : `${MINIO_ALIAS}/${MINIO_BUCKET}`;
    const cmd = `ssh ${NAS_HOST} "docker exec agora-minio mc ls --recursive '${target}'"`;
    let out;
    try {
        out = execSync(cmd, { encoding: 'utf8', timeout: 60_000 });
    } catch (e) {
        console.error('[orphan-cleanup] Error listando MinIO:', e.message);
        process.exit(1);
    }
    const paths = new Set();
    for (const line of out.split('\n')) {
        // Formato mc ls: "[fecha] [hora]  [size] [path]"
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const blobPath = parts[parts.length - 1];
        if (blobPath) paths.add(blobPath);
    }
    return paths;
};

// ── Firestore helpers ──────────────────────────────────────────────────────

const fetchDocuments = async (wsId) => {
    let query = db.collection('documents');
    if (wsId) query = query.where('workspaceId', '==', wsId);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
    console.log('[orphan-cleanup] Iniciando...');
    if (WORKSPACE_ID) {
        console.log(`[orphan-cleanup] Filtrando por workspace: ${WORKSPACE_ID}`);
    } else {
        console.log('[orphan-cleanup] Procesando TODOS los workspaces (sin --workspace)');
    }

    // 1. Listar blobs MinIO una sola vez
    const prefix = WORKSPACE_ID ? `workspaces/${WORKSPACE_ID}/` : 'workspaces/';
    console.log(`[orphan-cleanup] Listando blobs en MinIO (${MINIO_BUCKET}/${prefix})...`);
    const minioPaths = listMinioPaths(prefix);
    console.log(`[orphan-cleanup] ${minioPaths.size} blobs encontrados en MinIO.`);

    // 2. Leer docs Firestore
    console.log('[orphan-cleanup] Leyendo docs Firestore...');
    const docs = await fetchDocuments(WORKSPACE_ID);
    console.log(`[orphan-cleanup] ${docs.length} docs encontrados en Firestore.`);

    // 3. Cruzar
    const orphans = [];
    for (const doc of docs) {
        const storagePath = doc.storagePath ?? doc.url ?? null;
        if (!storagePath) continue;

        // storagePath puede ser ruta relativa al bucket (workspaces/wsId/...)
        // o URL completa de MinIO firmada — normalizar a relativo.
        let relPath = storagePath;
        if (relPath.startsWith('http')) {
            try {
                const u = new URL(relPath);
                // Path MinIO típico: /agora-blobs/workspaces/...
                relPath = u.pathname.replace(/^\/[^/]+\//, '');
            } catch {
                if (VERBOSE) console.warn(`  [skip] URL malformada: ${doc.id}`);
                continue;
            }
        }

        const exists = minioPaths.has(relPath);
        if (VERBOSE) {
            console.log(`  ${exists ? '✓' : '✗'} ${doc.id} → ${relPath}`);
        }

        if (!exists) {
            orphans.push({
                docId: doc.id,
                name: doc.name ?? doc.title ?? '(sin nombre)',
                workspaceId: doc.workspaceId ?? '?',
                storagePath: relPath,
                updatedAt: doc.updatedAt?.toDate?.()?.toISOString() ?? doc.updatedAt ?? '?',
            });
        }
    }

    // 4. Reporte
    console.log('\n─────────────────────────────────────────────────────────────');
    if (orphans.length === 0) {
        console.log('[orphan-cleanup] No se encontraron docs huérfanos. Todo en orden.');
    } else {
        console.log(`[orphan-cleanup] ${orphans.length} doc(s) huérfanos encontrados:\n`);
        const pad = (s, n) => String(s).padEnd(n);
        console.log(
            pad('docId', 28) +
            pad('workspaceId', 24) +
            pad('name', 30) +
            pad('updatedAt', 26) +
            'storagePath'
        );
        console.log('─'.repeat(130));
        for (const o of orphans) {
            console.log(
                pad(o.docId, 28) +
                pad(o.workspaceId, 24) +
                pad(o.name.slice(0, 29), 30) +
                pad(o.updatedAt, 26) +
                o.storagePath
            );
        }
    }
    console.log('─────────────────────────────────────────────────────────────\n');

    // 5. --apply sin --destructive-confirmed: informar y salir limpio
    if (APPLY && !DESTRUCTIVE) {
        console.log('[orphan-cleanup] --apply recibido pero falta --destructive-confirmed.');
        console.log('  Para acciones destructivas futuras, añadir ambos flags.');
        console.log('  Por ahora el script solo reporta (sin borrar nada).');
    }

    if (APPLY && DESTRUCTIVE) {
        console.log('[orphan-cleanup] --apply + --destructive-confirmed recibidos.');
        console.log('  Borrado no implementado todavía. Saliendo sin modificar nada.');
        console.log('  (Implementar aquí cuando el operador confirme el plan de borrado.)');
    }
};

main().catch((e) => {
    console.error('[orphan-cleanup] Error fatal:', e);
    process.exit(1);
});
