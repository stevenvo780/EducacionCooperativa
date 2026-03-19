import { normalizePath } from '@/lib/folder-utils';

export const isMarkdownName = (name?: string) => {
  const lower = (name ?? '').toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown') || lower.endsWith('.mkd');
};

export const isMarkdownMime = (mime?: string) => (mime ?? '').toLowerCase().includes('markdown');
export const isImageMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('image/');
export const isVideoMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('video/');
export const isAudioMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('audio/');
export const isPdfMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/pdf';

/**
 * Un-escape LaTeX delimiters that MDXEditor may have escaped, while
 * **preserving** content inside fenced code blocks (``` … ```) and
 * inline code (` … `).
 */
export function unescapeLatex(md: string): string {
  // Split the document into safe (outside code) and protected (inside code) segments.
  // We process ONLY safe segments so code blocks are never mangled.
  const segments: { text: string; isCode: boolean }[] = [];
  const fenceOrInlineCode = /(```[\s\S]*?```|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceOrInlineCode.exec(md)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: md.slice(lastIndex, match.index), isCode: false });
    }
    segments.push({ text: match[0], isCode: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < md.length) {
    segments.push({ text: md.slice(lastIndex), isCode: false });
  }

  return segments.map(({ text, isCode }) => {
    if (isCode) return text;
    // 1. Escaped block math: \$\$…\$\$ → $$…$$
    let result = text.replace(/\\\$\\\$([\s\S]*?)\\\$\\\$/g, '$$$$$$1$$$$');
    // 2. Escaped inline math: \$…\$ → $…$
    result = result.replace(/\\\$((?!\$)[^\n]*?)\\\$/g, '$$$1$$');
    // 3. Other escaped markdown specials
    result = result.replace(/\\([=*_{}[\]()#+\-.!|~<>^`])/g, '$1');
    return result;
  }).join('');
}

export const stripQueryAndHash = (href: string) => href.split('#')[0]?.split('?')[0] ?? href;
export const isExternalMarkdownHref = (href: string) => /^(https?:|mailto:|tel:|data:)/i.test(href);
export const isBrowserNavigationHref = (href: string) => /^(\/editor\/|\/login\b|\/dashboard\b|\/docs\b)/i.test(href);

export const normalizeRelativeMarkdownPath = (value: string) => {
  const parts = value.split('/');
  const normalized: string[] = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join('/');
};

export const ensureMarkdownCandidateNames = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);
  if (/\.(md|markdown|mdown|mkd)$/i.test(trimmed)) {
    candidates.add(trimmed.replace(/\.(md|markdown|mdown|mkd)$/i, ''));
  } else {
    candidates.add(`${trimmed}.md`);
  }
  return Array.from(candidates);
};

export const buildWorkspaceAwarePathCandidates = (value: string) => {
  const cleaned = normalizeRelativeMarkdownPath(value.replace(/^\/+/, ''));
  if (!cleaned) return [];

  const segments = cleaned.split('/').filter(Boolean);
  const candidates = new Set<string>();
  const addCandidate = (candidate: string) => {
    const normalized = normalizeRelativeMarkdownPath(candidate);
    if (!normalized) return;
    ensureMarkdownCandidateNames(normalized).forEach((name) => candidates.add(name));
  };

  addCandidate(cleaned);

  if ((segments[0] === 'workspace' || segments[0] === 'workspaces') && segments.length > 2) {
    addCandidate(segments.slice(2).join('/'));
  }

  if (segments.length > 1) {
    addCandidate(segments.slice(1).join('/'));
  }

  return Array.from(candidates);
};

export const extractWorkspaceSegments = (href: string): { workspaceName: string; targetPath: string } | null => {
  const cleaned = decodeURIComponent(href).replace(/^\/?workspace\//, '');
  const firstSlash = cleaned.indexOf('/');
  if (firstSlash < 1) return null;
  return {
    workspaceName: cleaned.substring(0, firstSlash).trim(),
    targetPath: normalizeRelativeMarkdownPath(cleaned.substring(firstSlash + 1))
  };
};

export const convertWikiLinksToMarkdown = (content: string) => {
  const lines = content.split('\n');
  let insideFence = false;

  return lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      insideFence = !insideFence;
      return line;
    }

    if (insideFence || !line.includes('[[')) {
      return line;
    }

    return line.replace(/\[\[([^\]]+)\]\]/g, (match, rawTarget: string) => {
      const [targetPart, labelPart] = rawTarget.split('|');
      const target = targetPart?.trim();
      const label = labelPart?.trim() || target;
      if (!target) return match;
      return `[${label}](${target})`;
    });
  }).join('\n');
};

export const resolveWorkspaceDocPath = (folder: string, href: string) => {
  const currentFolder = normalizePath(folder);
  const normalizedHref = href.replace(/^\/+/, '');
  return href.startsWith('/')
    ? normalizeRelativeMarkdownPath(normalizedHref)
    : normalizeRelativeMarkdownPath(currentFolder ? `${currentFolder}/${normalizedHref}` : normalizedHref);
};
