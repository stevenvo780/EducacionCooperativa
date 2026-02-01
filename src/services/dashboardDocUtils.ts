import type { DocItem } from '@/components/dashboard/types';

export const isMarkdownName = (name?: string) => {
  const lower = (name ?? '').toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown') || lower.endsWith('.mkd');
};

export const isMarkdownFile = (file: File) => {
  if (file.type && file.type.toLowerCase().includes('markdown')) return true;
  return isMarkdownName(file.name);
};

export const isMarkdownConvertibleFile = (file: File) => {
  if (isMarkdownFile(file)) return true;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (type.includes('officedocument.wordprocessingml.document') || name.endsWith('.docx')) return true;
  if (type.startsWith('text/')) return true;
  if (name.endsWith('.txt') || name.endsWith('.log')) return true;
  return false;
};

export const isMarkdownDocItem = (doc: DocItem) => {
  if (doc.mimeType && doc.mimeType.toLowerCase().includes('markdown')) return true;
  return isMarkdownName(doc.name);
};

export const getFileExtension = (name: string) => {
  const parts = name.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toUpperCase();
};

export const getDocBadge = (doc: DocItem) => {
  if (doc.type === 'terminal') return 'TERM';
  if (doc.type === 'file') {
    if (isMarkdownDocItem(doc)) return 'MD';
    const ext = getFileExtension(doc.name);
    return ext ? (ext.length > 4 ? ext.slice(0, 4) : ext) : 'FILE';
  }
  return isMarkdownName(doc.name) ? 'MD' : 'DOC';
};
