interface DocumentBlobRevisionInput {
  storagePath?: string | null;
  url?: string | null;
  updatedAt?: unknown;
}

const timestampRevision = (value: unknown): string => {
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (!value || typeof value !== 'object') return '';

  const timestamp = value as Record<string, unknown>;
  const seconds = timestamp.seconds ?? timestamp._seconds;
  const nanoseconds = timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0;
  if (typeof seconds === 'number') return `${seconds}:${String(nanoseconds)}`;

  return '';
};

/**
 * Identifica una revisión concreta del blob sin exponer el contentHash interno.
 * El storagePath no cambia cuando un agente sobrescribe un archivo; updatedAt sí.
 */
export const buildDocumentBlobRevisionKey = ({
  storagePath,
  url,
  updatedAt
}: DocumentBlobRevisionInput): string => {
  const location = storagePath || url || '';
  const revision = timestampRevision(updatedAt);
  return revision ? `${location}::${revision}` : location;
};
