import type { Metadata } from 'next';
import PublicDocViewer from '@/components/PublicDocViewer';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const backendBase =
        (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') ||
        'https://agora-backend-578238159459.us-central1.run.app';

    let title = 'Documento compartido — Agora';
    try {
        const res = await fetch(`${backendBase}/api/public/${token}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json() as { name?: string };
            if (data.name) title = `${data.name} — Agora`;
        }
    } catch { /* sin metadata dinámica, se usa el title por defecto */ }

    return {
        title,
        robots: { index: false, follow: false }
    };
}

export default async function PublicDocPage({ params }: Props) {
    const { token } = await params;
    return <PublicDocViewer token={token} />;
}
