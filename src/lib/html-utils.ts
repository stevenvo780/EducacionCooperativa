const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'data:']);

export function safeUrl(raw: string | null | undefined, fallback = '#'): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed, 'https://placeholder.invalid');
    if (SAFE_URL_PROTOCOLS.has(url.protocol)) {
      if (url.protocol === 'data:' && !/^data:image\//i.test(trimmed)) return fallback;
      return trimmed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
