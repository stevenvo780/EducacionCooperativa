/**
 * GET /api/diag — health check sin auth (no expone secretos).
 */
import { NextResponse } from 'next/server';
import { isNasConfigured, getNasBucket, objectExists } from '@/lib/nas-storage';
import { isForgejoConfigured, getForgejoApiUrl, getForgejoOrg } from '@/lib/forgejo';

export const runtime = 'nodejs';

export async function GET() {
    const env = {
        AGORA_USE_NAS: process.env.AGORA_USE_NAS ?? null,
        NAS_S3_ENDPOINT: process.env.NAS_S3_ENDPOINT ?? null,
        NAS_S3_BUCKET: process.env.NAS_S3_BUCKET ?? null,
        NAS_S3_HAS_KEY: Boolean(process.env.NAS_S3_ACCESS_KEY),
        NAS_S3_HAS_SECRET: Boolean(process.env.NAS_S3_SECRET_KEY),
        FORGEJO_API_URL: process.env.FORGEJO_API_URL ?? null,
        FORGEJO_HAS_TOKEN: Boolean(process.env.FORGEJO_ADMIN_TOKEN),
        FORGEJO_ORG: process.env.FORGEJO_ORG ?? null,
        FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL ?? null,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? null
    };

    const nas: Record<string, unknown> = { configured: isNasConfigured(), endpoint: env.NAS_S3_ENDPOINT, bucket: getNasBucket() };
    if (nas.configured) {
        try {
            await objectExists('__diag__/__never__');
            nas.health = 'ok';
        } catch (e) {
            nas.health = 'fail';
            nas.error = (e as Error).message?.slice(0, 200);
        }
    }

    const forgejo: Record<string, unknown> = { configured: isForgejoConfigured(), apiUrl: getForgejoApiUrl(), org: getForgejoOrg() };
    if (forgejo.configured) {
        try {
            const res = await fetch(`${forgejo.apiUrl}/api/v1/version`, {
                headers: { Authorization: `token ${process.env.FORGEJO_ADMIN_TOKEN}` }
            });
            forgejo.status = res.status;
            forgejo.health = res.ok ? 'ok' : 'fail';
        } catch (e) {
            forgejo.health = 'fail';
            forgejo.error = (e as Error).message?.slice(0, 200);
        }
    }

    return NextResponse.json({ env, nas, forgejo, ts: new Date().toISOString() });
}
