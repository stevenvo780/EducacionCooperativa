export interface BibField {
  name: string;
  value: string;
}

export interface BibEntry {
  type: string;
  key: string;
  fields: BibField[];
}

export function parseBibtex(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const fields: BibField[] = [];
    const fieldRe = /(\w+)\s*=\s*[\{"]([\s\S]*?)[\}"](?=\s*,|\s*$)/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(match[3] ?? '')) !== null) {
      fields.push({ name: (fm[1] ?? '').toLowerCase(), value: (fm[2] ?? '').replace(/\s+/g, ' ').trim() });
    }
    entries.push({ type: (match[1] ?? '').toLowerCase(), key: match[2] ?? '', fields });
  }
  return entries;
}
