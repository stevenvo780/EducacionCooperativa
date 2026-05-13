/**
 * fix-folder-rename-pdf.mjs
 *
 * Diagnóstico y reparación del desync de folder rename en workspace JhRFIASsH0dkmh7TkCiX:
 * - Docs Firestore con field `folder = "FilosofiaDeLasNeurociencias/pdf"` (nombre viejo)
 * - Blobs MinIO ya están en `Contenidos/pdf/` (nombre nuevo)
 * - El campo `storagePath` en la mayoría apunta a Contenidos/pdf/ correctamente
 *
 * PROBLEMA: el campo `folder` aún dice "FilosofiaDeLasNeurociencias/pdf"
 * SOLUCIÓN: Actualizar `folder` a "Contenidos/pdf" (o "Contenidos/pdf/Material complementario")
 *
 * ESTRATEGIA para verificar blobs:
 * - Se obtiene la lista completa de blobs MinIO una vez via SSH (no 1 SSH por blob)
 * - El match se hace en memoria por storagePath completo
 *
 * FLAGS:
 *   --dry-run   (default) Solo reporta cambios sin aplicar
 *   --apply     Aplica los cambios en Firestore
 *
 * USO desde ops/:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/stevenvallejo780@gmail.com/adc.json \
 *     node fix-folder-rename-pdf.mjs
 *   ... --apply
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { execSync } from 'child_process';

const APPLY = process.argv.includes('--apply');
const WORKSPACE_ID = 'JhRFIASsH0dkmh7TkCiX';
const OLD_FOLDER = 'FilosofiaDeLasNeurociencias/pdf';
const NEW_FOLDER_BASE = 'Contenidos/pdf';
const NEW_FOLDER_SUBDIR = 'Contenidos/pdf/Material complementario';

const MINIO_BUCKET = 'agora-blobs';
const MINIO_PREFIX = `workspaces/${WORKSPACE_ID}/Contenidos/pdf/`;
const MINIO_ALIAS = 'adm';
const NAS_HOST = 'nas@100.98.67.189';

console.log(`\n=== fix-folder-rename-pdf ===`);
console.log(`Modo: ${APPLY ? 'APPLY (mutante)' : 'DRY-RUN (solo lectura)'}`);
console.log(`Workspace: ${WORKSPACE_ID}`);
console.log(`Folder viejo: ${OLD_FOLDER}`);
console.log(`Folder nuevo base: ${NEW_FOLDER_BASE}\n`);

// --- Init Firebase Admin ---
if (!getApps().length) {
  initializeApp(); // usa applicationDefault (GOOGLE_APPLICATION_CREDENTIALS)
}
const db = getFirestore();

/**
 * Obtiene lista completa de blobs en Contenidos/pdf/ desde MinIO via SSH.
 * Retorna un Set de storagePaths completos (sin bucket prefix).
 * Ejemplo: "workspaces/JhRFIASsH0dkmh7TkCiX/Contenidos/pdf/12b - Miller....pdf"
 */
function fetchMinioBlobs() {
  console.log(`[MinIO] Obteniendo lista de blobs en ${MINIO_PREFIX}...`);
  const mcAlias = `mc alias set ${MINIO_ALIAS} http://localhost:9000 agora-admin VzafdO1uPRF0ikP1PS4np6iHT1q5JtHX6aoCaHet >/dev/null 2>&1`;
  const mcLs = `mc ls --recursive --json ${MINIO_ALIAS}/${MINIO_BUCKET}/${MINIO_PREFIX}`;

  let raw;
  try {
    raw = execSync(
      `ssh ${NAS_HOST} 'docker exec agora-minio sh -c "${mcAlias} && ${mcLs}"'`,
      { timeout: 30000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    console.error(`[MinIO] Error al obtener blobs: ${err.message}`);
    return new Set();
  }

  const blobs = new Set();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.status === 'success' && obj.key) {
        // key es relativo al prefix, ej: "12b - Miller....pdf" o "Material complementario/Foo.pdf"
        const fullPath = `${MINIO_PREFIX}${obj.key}`;
        blobs.add(fullPath);
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  console.log(`[MinIO] Blobs encontrados: ${blobs.size}`);
  return blobs;
}

/**
 * Determina el nuevo folder basado en el storagePath del doc.
 */
function computeNewFolder(storagePath) {
  if (!storagePath) return NEW_FOLDER_BASE;
  if (storagePath.includes('/Material complementario/')) {
    return NEW_FOLDER_SUBDIR;
  }
  return NEW_FOLDER_BASE;
}

async function main() {
  // --- Paso 1: Obtener lista de blobs MinIO ---
  const minioBlobs = fetchMinioBlobs();

  // --- Paso 2: Query docs Firestore con folder viejo ---
  console.log(`\n[Firestore] Consultando docs con folder="${OLD_FOLDER}"...`);
  const snap = await db.collection('documents')
    .where('workspaceId', '==', WORKSPACE_ID)
    .where('folder', '==', OLD_FOLDER)
    .get();

  const docs = snap.docs;
  console.log(`[Firestore] Encontrados: ${docs.length} docs\n`);

  const results = {
    total: docs.length,
    folders: 0,
    matches: 0,
    orphans: 0,
    applied: 0,
    errors: 0,
  };

  const orphanList = [];
  const matchList = [];
  const folderDocList = [];

  // --- Paso 3: Clasificar docs ---
  console.log(`[Análisis] Clasificando docs...`);
  for (const docSnap of docs) {
    const data = docSnap.data();
    const docId = docSnap.id;
    const filename = data.name ?? 'NO_NAME';
    const storagePath = data.storagePath ?? null;

    // Doc de carpeta virtual (sin storagePath)
    if (!storagePath) {
      results.folders++;
      folderDocList.push({ docId, filename });
      console.log(`  [FOLDER] ${docId}  name="${filename}"  — carpeta virtual, sin storagePath`);
      continue;
    }

    // El storagePath ya apunta a Contenidos/pdf/... — verificar blob existe en MinIO
    // storagePath tiene formato: "workspaces/JhRFIASsH0dkmh7TkCiX/Contenidos/pdf/..."
    const blobExists = minioBlobs.has(storagePath);
    const newFolder = computeNewFolder(storagePath);

    if (blobExists) {
      results.matches++;
      matchList.push({ docId, filename, storagePath, newFolder, currentFolder: OLD_FOLDER });
      console.log(`  [MATCH]  ${docId}  name="${filename.slice(0, 55)}"  folder → "${newFolder}"`);
    } else {
      results.orphans++;
      orphanList.push({ docId, filename, storagePath, newFolder });
      console.log(`  [ORPHAN] ${docId}  name="${filename.slice(0, 55)}"  storagePath="${storagePath}"  — blob NO en MinIO`);
    }
  }

  // --- Resumen de diagnóstico ---
  console.log(`\n=== Diagnóstico ===`);
  console.log(`  Total docs con folder viejo:      ${results.total}`);
  console.log(`  Carpetas virtuales (sin blob):    ${results.folders}`);
  console.log(`  Con blob en MinIO (matches):      ${results.matches}`);
  console.log(`  Sin blob en MinIO (huérfanos):    ${results.orphans}`);

  if (orphanList.length > 0) {
    console.log(`\n  Huérfanos (NO se tocarán):`);
    for (const o of orphanList) {
      console.log(`    - ${o.docId}: "${o.filename}"`);
      console.log(`      storagePath: ${o.storagePath}`);
    }
  }

  if (folderDocList.length > 0) {
    console.log(`\n  Carpetas virtuales (NO se tocan):`);
    for (const f of folderDocList) {
      console.log(`    - ${f.docId}: "${f.filename}"`);
    }
  }

  if (!APPLY) {
    console.log(`\n=== DRY-RUN ===`);
    console.log(`No se aplicaron cambios. Cambios que se aplicarían (solo matches):`);
    for (const m of matchList) {
      console.log(`  UPDATE ${m.docId}: folder "${OLD_FOLDER}" → "${m.newFolder}"`);
    }
    console.log(`\nEjecutar con --apply para aplicar los cambios.`);
    return;
  }

  // --- Paso 4: Aplicar cambios ---
  console.log(`\n=== Aplicando cambios (${matchList.length} docs) ===`);
  const batch = db.batch();
  let batchCount = 0;
  let committed = 0;

  for (const m of matchList) {
    const ref = db.collection('documents').doc(m.docId);
    batch.update(ref, {
      folder: m.newFolder,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batchCount++;

    // Firestore batch limit = 500 ops
    if (batchCount >= 499) {
      await batch.commit();
      committed += batchCount;
      console.log(`  Committed batch: ${batchCount} docs`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    try {
      await batch.commit();
      committed += batchCount;
      console.log(`  Committed final batch: ${batchCount} docs`);
      results.applied = committed;
    } catch (err) {
      console.error(`  ERROR al commitear batch: ${err.message}`);
      results.errors++;
    }
  } else {
    results.applied = committed;
  }

  console.log(`\n  Docs actualizados: ${results.applied}`);
  console.log(`  Errores: ${results.errors}`);

  // --- Paso 5: Verificación post-apply (sample 5 docs) ---
  console.log(`\n=== Verificación post-apply (sample 5 docs) ===`);
  const sampleIds = matchList.slice(0, 5).map(m => m.docId);
  for (const id of sampleIds) {
    const verifySnap = await db.collection('documents').doc(id).get();
    const verifyData = verifySnap.data();
    const currentFolder = verifyData?.folder ?? 'NO_FOLDER';
    const expectedFolders = [NEW_FOLDER_BASE, NEW_FOLDER_SUBDIR];
    const ok = expectedFolders.includes(currentFolder);
    console.log(`  ${ok ? 'OK' : 'FAIL'} ${id}: folder="${currentFolder}"`);
  }

  // --- Paso 6: Verificación final ---
  console.log(`\n=== Verificación final: docs restantes con folder viejo ===`);
  const verifySnap = await db.collection('documents')
    .where('workspaceId', '==', WORKSPACE_ID)
    .where('folder', '==', OLD_FOLDER)
    .get();
  console.log(`  Docs aún con folder viejo: ${verifySnap.size}`);
  if (verifySnap.size === 0) {
    console.log(`  Desync resuelto completamente.`);
  } else {
    console.log(`  Atención: ${verifySnap.size} docs aún con folder viejo:`);
    for (const d of verifySnap.docs) {
      const dd = d.data();
      console.log(`    - ${d.id}: name="${dd.name}" storagePath="${dd.storagePath ?? 'NO_STORAGE_PATH'}"`);
    }
  }

  console.log(`\n=== Fix completado ===`);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
