/**
 * POST /api/sync/worker-commit
 * Body: { repoPath: string, contentHash: string, size: number, mimeType?: string }
 *
 * El worker ya subió el blob al storagePath = `workspaces/<wsId>/<repoPath>`.
 * Esta ruta:
 *   1) Busca el doc Firestore por (workspaceId, name, folder). Si existe → UPDATE
 *      (bumpea version, contentHash, size, syncState). Si no → CREATE con
 *      ownerId derivado del workspace owner.
 *   2) Verifica que el blob exista en MinIO.
 *   3) Emite ping RTDB para que el cliente web refresque.
 *
 * Auth: HMAC worker (sólo para workspaces compartidos por ahora).
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { verifyWorkerAuth } from '@/lib/worker-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { objectExists, isNasConfigured } from '@/lib/nas-storage';
import { isPersonalWorkspaceId } from '@/types/workspace';
import { emitPing } from '@/lib/nas-events';
import { getErrorMessage } from '@/lib/error-utils';

const sanitizeRepoPath = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const cleaned = input.replace(/^\/+/, '').trim();
    if (!cleaned) return null;
    if (cleaned.split('/').some((seg) => seg === '..' || seg === '')) return null;
    return cleaned;
};

const splitRepoPath = (repoPath: string): { folder: string; name: string } => {
    const idx = repoPath.lastIndexOf('/');
    if (idx === -1) return { folder: 'No estructurado', name: repoPath };
    return { folder: repoPath.slice(0, idx), name: repoPath.slice(idx + 1) };
};

const inferType = (name: string, mimeType?: string): { type: string; mimeType: string } => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { type: 'text', mimeType: mimeType ?? 'text/markdown' };
    if (lower.endsWith('.txt') || lower.endsWith('.log')) return { type: 'text', mimeType: mimeType ?? 'text/plain' };
    if (lower.endsWith('.json')) return { type: 'text', mimeType: mimeType ?? 'application/json' };
    if (lower.endsWith('.st')) return { type: 'text', mimeType: mimeType ?? 'text/plain' };
    return { type: 'file', mimeType: mimeType ?? 'application/octet-stream' };
};

export async function POST(req: NextRequest) {
    try {
        if (!isNasConfigured()) return NextResponse.json({ error: 'NAS not configured' }, { status: 503 });
        const ctx = verifyWorkerAuth(req);
        if (!ctx) return NextResponse.json({ error: 'Worker auth required' }, { status: 401 });
        if (isPersonalWorkspaceId(ctx.workspaceId)) {
            return NextResponse.json({ error: 'Personal workspace not supported via worker auth' }, { status: 400 });
        }

        const body = await req.json() as { repoPath?: unknown; contentHash?: unknown; size?: unknown; mimeType?: unknown };
        const repoPath = sanitizeRepoPath(body.repoPath);
        const contentHash = typeof body.contentHash === 'string' ? body.contentHash : null;
        const size = typeof body.size === 'number' ? body.size : null;
        if (!repoPath || !contentHash) {
            return NextResponse.json({ error: 'repoPath and contentHash required' }, { status: 400 });
        }

        const storagePath = `workspaces/${ctx.workspaceId}/${repoPath}`;
        if (!(await objectExists(storagePath))) {
            return NextResponse.json({ error: 'Blob not found in NAS — upload first' }, { status: 412 });
        }

        const { folder, name } = splitRepoPath(repoPath);
        const { type: inferredType, mimeType: inferredMime } = inferType(name, typeof body.mimeType === 'string' ? body.mimeType : undefined);

        // Buscar doc existente por (workspaceId, name, folder).
        const existingSnap = await adminDb.collection('documents')
            .where('workspaceId', '==', ctx.workspaceId)
            .where('name', '==', name)
            .where('folder', '==', folder)
            .limit(1)
            .get();

        let docId: string;
        let version = 1;
        let created = false;

        if (!existingSnap.empty) {
            const ref = existingSnap.docs[0].ref;
            const cur = existingSnap.docs[0].data() as { version?: number };
            const currentVersion = typeof cur.version === 'number' ? cur.version : 0;
            version = currentVersion + 1;
            await ref.update({
                contentHash,
                size: size ?? FieldValue.delete(),
                version,
                baseVersion: currentVersion,
                syncState: 'synced',
                lastWriter: `worker:${ctx.workspaceId}`,
                storagePath,
                storageBackend: 'minio',
                mimeType: inferredMime,
                updatedAt: FieldValue.serverTimestamp()
            });
            docId = ref.id;
        } else {
            // Owner del workspace para asignar al doc nuevo.
            const wsSnap = await adminDb.collection('workspaces').doc(ctx.workspaceId).get();
            const wsData = wsSnap.data() as { ownerId?: string } | undefined;
            const ownerId = wsData?.ownerId ?? '';
            if (!ownerId) {
                return NextResponse.json({ error: 'Workspace ownerId not found' }, { status: 500 });
            }
            const ref = await adminDb.collection('documents').add({
                name,
                folder,
                type: inferredType,
                mimeType: inferredMime,
                workspaceId: ctx.workspaceId,
                ownerId,
                storagePath,
                storageBackend: 'minio',
                contentHash,
                size: size ?? null,
                version: 1,
                baseVersion: 0,
                syncState: 'synced',
                lastWriter: `worker:${ctx.workspaceId}`,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            docId = ref.id;
            created = true;
        }

        await emitPing({
            scope: 'document',
            op: created ? 'created' : 'updated',
            workspaceId: ctx.workspaceId,
            docId,
            path: storagePath,
            folder,
            version,
            contentHash,
            sender: `worker:${ctx.workspaceId}`
        }).catch(() => undefined);

        return NextResponse.json({ docId, version, contentHash, created });
    } catch (e) {
        console.error('[sync/worker-commit] error:', getErrorMessage(e));
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}
