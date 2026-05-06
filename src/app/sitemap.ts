import type { MetadataRoute } from 'next';

const BASE = 'https://agora.elenxos.com';

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'monthly' | 'weekly' | 'yearly' }> = [
  { path: '/', priority: 1.0, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/docs/st', priority: 0.8, changeFrequency: 'monthly' }
];

const ST_COURSE_SLUGS = [
  'proposicional',
  'primer-orden',
  'modal-k',
  'deontica',
  'epistemica',
  'intuicionista',
  'temporal',
  'aritmetica',
  'aristotelica',
  'belnap',
  'probabilistica'
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${BASE}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority
    })),
    ...ST_COURSE_SLUGS.map((slug) => ({
      url: `${BASE}/docs/st/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6
    }))
  ];
}
