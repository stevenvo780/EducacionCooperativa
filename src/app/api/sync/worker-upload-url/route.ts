/**
 * POST /api/sync/worker-upload-url
 * Body: { repoPath: string, contentType?: string }
 * Devuelve un signed PUT URL para subir el blob a MinIO. Auth HMAC worker.
 *
 * El repoPath es relativo al workspace (sin prefijo `workspaces/<wsId>/`).
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { verifyWorkerAuth } from '@/lib/worker-auth';
import { presignPut, isNasConfigured } from '@/lib/nas-storage';
import { isPersonalWorkspaceId } from '@/types/workspace';
import { getErrorMessage } from '@/lib/error-utils';

const PUT_TTL = 15 * 60;

const sanitizeRepoPath = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const cleaned = input.replace(/^\/+/, '').trim();
    if (!cleaned) return null;
    if (cleaned.split('/').some((seg) => seg === '..' || seg === '')) return null;
    return cleaned;
};

export async function POST(req: NextRequest) {
    try {
        if (!isNasConfigured()) return NextResponse.json({ error: 'NAS not configured' }, { status: 503 });
        const ctx = verifyWorkerAuth(req);
        if (!ctx) return NextResponse.json({ error: 'Worker auth required' }, { status: 401 });
        if (isPersonalWorkspaceId(ctx.workspaceId)) {
            return NextResponse.json({ error: 'Personal workspace not supported via worker auth' }, { status: 400 });
        }

        const body = await req.json() as { repoPath?: unknown; contentType?: unknown };
        const repoPath = sanitizeRepoPath(body.repoPath);
        if (!repoPath) return NextResponse.json({ error: 'Invalid repoPath' }, { status: 400 });

        const storagePath = `workspaces/${ctx.workspaceId}/${repoPath}`;
        const contentType = typeof body.contentType === 'string' ? body.contentType : undefined;
        const url = await presignPut(storagePath, PUT_TTL, contentType);

        return NextResponse.json({ storagePath, signedUrl: url, ttlSeconds: PUT_TTL });
    } catch (e) {
        console.error('[sync/worker-upload-url] error:', getErrorMessage(e));
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}
