import { escapeHtml } from '@/lib/html-utils';

export interface TeiHeader {
  title?: string;
  author?: string;
  date?: string;
}

export function detectTei(xml: string): boolean {
  return /<TEI\b/.test(xml) || /<teiHeader\b/.test(xml);
}

export function renderTei(doc: Document): string {
  const header = parseTeiHeader(doc);
  const body = doc.querySelector('text > body') ?? doc.querySelector('body');

  let out = '';
  if (header.title || header.author || header.date) {
    out += '<aside class="tei-meta">';
    if (header.title) out += `<div><strong>Título:</strong> ${escapeHtml(header.title)}</div>`;
    if (header.author) out += `<div><strong>Autor:</strong> ${escapeHtml(header.author)}</div>`;
    if (header.date) out += `<div><strong>Fecha:</strong> ${escapeHtml(header.date)}</div>`;
    out += '</aside>';
  }
  if (body) out += renderNodes(Array.from(body.children));
  return out;
}

function parseTeiHeader(doc: Document): TeiHeader {
  return {
    title: doc.querySelector('teiHeader titleStmt > title')?.textContent?.trim(),
    author: doc.querySelector('teiHeader titleStmt > author')?.textContent?.trim(),
    date: doc.querySelector('teiHeader publicationStmt > date')?.textContent?.trim()
  };
}

function renderNodes(elements: Element[]): string {
  return elements.map(renderNode).join('');
}

function renderNode(el: Element): string {
  switch (el.localName.toLowerCase()) {
    case 'div':       return `<section>${renderNodes(Array.from(el.children))}</section>`;
    case 'head':      return `<h2>${renderInline(el)}</h2>`;
    case 'p':         return `<p>${renderInline(el)}</p>`;
    case 'lg':        return `<div class="tei-lg">${renderNodes(Array.from(el.children))}</div>`;
    case 'l':         return `<span class="tei-l">${renderInline(el)}</span>`;
    case 'q':
    case 'quote':     return `<blockquote>${renderInline(el)}</blockquote>`;
    default:          return renderNodes(Array.from(el.children));
  }
}

function renderInline(el: Element): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out += escapeHtml(node.nodeValue ?? '');
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      const local = child.localName.toLowerCase();
      if (local === 'hi') {
        const rend = child.getAttribute('rend') ?? '';
        if (/italic/i.test(rend)) out += `<em>${renderInline(child)}</em>`;
        else if (/bold/i.test(rend)) out += `<strong>${renderInline(child)}</strong>`;
        else out += renderInline(child);
      } else if (local === 'note') {
        out += `<span class="tei-note">[${renderInline(child)}]</span>`;
      } else if (local === 'persname' || local === 'placename') {
        out += `<strong>${renderInline(child)}</strong>`;
      } else {
        out += renderInline(child);
      }
    }
  }
  return out;
}

export function renderGenericXml(root: Element, depth = 0): string {
  if (depth > 10) return '<div>...</div>';
  const tag = `<span class="xml-tag">&lt;${escapeHtml(root.tagName)}&gt;</span>`;
  if (root.children.length === 0) {
    const text = (root.textContent ?? '').trim();
    return text
      ? `<div style="margin-left:${depth * 12}px">${tag} ${escapeHtml(text)}</div>`
      : `<div style="margin-left:${depth * 12}px">${tag}</div>`;
  }
  const inner = Array.from(root.children).map((c) => renderGenericXml(c, depth + 1)).join('');
  return `<div style="margin-left:${depth * 12}px">${tag}${inner}</div>`;
}

export function formatXmlSource(xml: string): string[] {
  const trimmed = xml.replace(/></g, '>\n<').trim();
  return trimmed.split('\n').map((line) => {
    return escapeHtml(line)
      .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span style="color:#60a5fa">$2</span>')
      .replace(/([\w:-]+)=&quot;([^&]*)&quot;/g, '<span style="color:#fcd34d">$1</span>=<span style="color:#86efac">"$2"</span>');
  });
}
