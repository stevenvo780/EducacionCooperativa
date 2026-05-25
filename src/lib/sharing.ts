/**
 * Helpers para generar y resolver enlaces públicos de documentos.
 * El endpoint vive en AgoraBack; el frontend lo invoca via apiUrl().
 */
import { authFetch, apiUrl } from '@/services/apiClient';
import { getErrorMessage } from '@/lib/error-utils';

export interface ShareLinkResult {
    token: string;
    expiresAt: string;
    url: string;
}

export const createShareLink = async (docId: string): Promise<ShareLinkResult> => {
    const res = await authFetch(apiUrl(`/api/documents/${docId}/share`), { method: 'POST' });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = await res.json() as { error?: string };
            if (body.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
    }
    const data = await res.json() as { token: string; expiresAt: string };
    const origin =
        typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://agora.elenxos.com').replace(/\/+$/, '');
    return {
        token: data.token,
        expiresAt: data.expiresAt,
        url: `${origin}/public/${data.token}`
    };
};

export const fetchPublicDoc = async (
    token: string,
    backendBase: string
): Promise<{ id: string; name?: string; type?: string; content?: string }> => {
    const url = `${backendBase}/api/public/${token}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = await res.json() as { error?: string };
            if (body.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
    }
    return res.json() as Promise<{ id: string; name?: string; type?: string; content?: string }>;
};

export { getErrorMessage };
