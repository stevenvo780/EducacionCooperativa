import { z } from 'zod';
import { authFetch } from './../services/apiClient';

/** Helper para hacer fetch autenticado y parsear la respuesta con Zod. */
export async function fetchZod<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) {
    let msg = `HTTP error! status: ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody === 'object' && 'error' in errBody) {
        msg = String(errBody.error);
      }
    } catch {
      // Ignorar
    }
    throw new Error(msg);
  }
  const raw = await res.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid API response payload: ${issues}`);
  }
  return parsed.data;
}
