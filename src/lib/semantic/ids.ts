const normalizePart = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
);

export const normalizeSemanticIdPart = (value: string | null | undefined) => (
  normalizePart(String(value ?? ''))
);

export const createSemanticFingerprint = (...parts: Array<string | null | undefined>) => {
  const normalized = parts
    .map((part) => normalizeSemanticIdPart(part))
    .filter(Boolean)
    .join('::');

  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${normalized || 'semantic'}:${(hash >>> 0).toString(36)}`;
};

export const createStableSemanticId = (
  prefix: string,
  ...parts: Array<string | null | undefined>
) => `${prefix}-${createSemanticFingerprint(prefix, ...parts)}`;
