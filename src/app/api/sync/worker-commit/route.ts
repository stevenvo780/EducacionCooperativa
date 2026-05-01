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
import { objectExists, deleteObject, isNasConfigured } from '@/lib/nas-storage';
import { enforceStorageQuota } from '@/lib/plan-guard';
import { isPersonalWorkspaceId, PERSONAL_WORKSPACE_ID } from '@/types/workspace';
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

const TEXT_EXT = new Set([
    '.md', '.markdown', '.txt', '.log', '.json', '.yaml', '.yml', '.toml', '.ini',
    '.csv', '.tsv', '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs',
    '.sh', '.bash', '.zsh', '.fish', '.env', '.conf', '.cfg', '.diff', '.patch',
    '.st', '.sql', '.gitattributes', '.gitconfig', '.editorconfig'
]);

const inferType = (name: string, mimeType?: string): { type: string; mimeType: string } => {
    const lower = name.toLowerCase();
    // Dotfiles tipo .syncignore, .gitignore, .env, .npmrc — son texto plano.
    if (lower.startsWith('.') && lower.indexOf('.', 1) === -1) {
        return { type: 'text', mimeType: mimeType ?? 'text/plain' };
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { type: 'text', mimeType: mimeType ?? 'text/markdown' };
    if (lower.endsWith('.json')) return { type: 'text', mimeType: mimeType ?? 'application/json' };
    const dotIdx = lower.lastIndexOf('.');
    const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';
    if (TEXT_EXT.has(ext)) return { type: 'text', mimeType: mimeType ?? 'text/plain' };
    return { type: 'file', mimeType: mimeType ?? 'application/octet-stream' };
};

export async function POST(req: NextRequest) {
    try {
        if (!isNasConfigured()) return NextResponse.json({ error: 'NAS not configured' }, { status: 503 });
        const ctx = verifyWorkerAuth(req);
        if (!ctx) return NextResponse.json({ error: 'Worker auth required' }, { status: 401 });
        const isPersonal = isPersonalWorkspaceId(ctx.workspaceId);
        if (isPersonal && !ctx.userId) {
            return NextResponse.json({ error: 'Personal workspace requires X-Worker-Uid' }, { status: 400 });
        }

        const body = await req.json() as { repoPath?: unknown; contentHash?: unknown; size?: unknown; mimeType?: unknown };
        const repoPath = sanitizeRepoPath(body.repoPath);
        const contentHash = typeof body.contentHash === 'string' ? body.contentHash : null;
        const size = typeof body.size === 'number' ? body.size : null;
        if (!repoPath || !contentHash) {
            return NextResponse.json({ error: 'repoPath and contentHash required' }, { status: 400 });
        }

        const storagePath = isPersonal
            ? `users/${ctx.userId}/${repoPath}`
            : `workspaces/${ctx.workspaceId}/${repoPath}`;
        if (!(await objectExists(storagePath))) {
            return NextResponse.json({ error: 'Blob not found in NAS — upload first' }, { status: 412 });
        }

        const { folder, name } = splitRepoPath(repoPath);
        const { type: inferredType, mimeType: inferredMime } = inferType(name, typeof body.mimeType === 'string' ? body.mimeType : undefined);

        // Buscar doc existente. Personal: por (ownerId, name, folder); Shared: por (workspaceId, name, folder).
        const existingQuery = isPersonal
            ? adminDb.collection('documents')
                .where('ownerId', '==', ctx.userId)
                .where('workspaceId', '==', PERSONAL_WORKSPACE_ID)
                .where('name', '==', name)
                .where('folder', '==', folder)
            : adminDb.collection('documents')
                .where('workspaceId', '==', ctx.workspaceId)
                .where('name', '==', name)
                .where('folder', '==', folder);
        const existingSnap = await existingQuery.limit(1).get();

        // Owner para cuota — en personal es el propio uid; en shared es ownerId del workspace.
        let wsOwner = ctx.userId ?? '';
        if (!isPersonal) {
            const wsSnapEarly = await adminDb.collection('workspaces').doc(ctx.workspaceId).get();
            wsOwner = (wsSnapEarly.data() as { ownerId?: string } | undefined)?.ownerId ?? '';
        }
        if (!wsOwner) {
            await deleteObject(storagePath).catch(() => undefined);
            return NextResponse.json({ error: 'Owner not resolvable' }, { status: 500 });
        }
        if (size && size > 0) {
            // Para updates, descontar el size del doc existente (no double-count).
            const oldSize = existingSnap.empty ? 0 : Number((existingSnap.docs[0].data() as { size?: number }).size ?? 0);
            const delta = Math.max(0, size - oldSize);
            const quotaResp = await enforceStorageQuota(wsOwner, delta);
            if (quotaResp) {
                await deleteObject(storagePath).catch(() => undefined);
                return quotaResp;
            }
        }

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
            const ref = await adminDb.collection('documents').add({
                name,
                folder,
                type: inferredType,
                mimeType: inferredMime,
                workspaceId: isPersonal ? PERSONAL_WORKSPACE_ID : ctx.workspaceId,
                ownerId: wsOwner,
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
