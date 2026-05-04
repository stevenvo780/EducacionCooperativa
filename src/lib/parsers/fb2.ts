import { escapeHtml, safeUrl } from '@/lib/html-utils';

const XLINK_NS = 'http://www.w3.org/1999/xlink';

export interface Fb2Meta {
  title?: string;
  author?: string;
  annotationHtml?: string;
}

export interface Fb2Render {
  meta: Fb2Meta;
  html: string;
}

export function parseFb2(xmlText: string): Fb2Render {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('FB2 inválido');
  }
  const meta: Fb2Meta = {};
  const title = doc.querySelector('title-info > book-title')?.textContent?.trim();
  if (title) meta.title = title;
  const first = doc.querySelector('title-info > author > first-name')?.textContent?.trim() ?? '';
  const last = doc.querySelector('title-info > author > last-name')?.textContent?.trim() ?? '';
  const authorName = [first, last].filter(Boolean).join(' ');
  if (authorName) meta.author = authorName;
  const annotation = doc.querySelector('title-info > annotation');
  if (annotation) meta.annotationHtml = renderNodes(annotation.children);

  const body = doc.querySelector('FictionBook > body') ?? doc.querySelector('body');
  return {
    meta,
    html: body ? renderNodes(body.children) : ''
  };
}

function renderNodes(children: HTMLCollection): string {
  return Array.from(children).map(renderNode).join('');
}

function renderNode(el: Element): string {
  switch (el.localName.toLowerCase()) {
    case 'section':  return `<section class="fb2-section">${renderNodes(el.children)}</section>`;
    case 'title':    return `<h2>${renderNodes(el.children)}</h2>`;
    case 'subtitle': return `<h3>${renderNodes(el.children)}</h3>`;
    case 'p':        return `<p>${renderInline(el)}</p>`;
    case 'epigraph': return `<aside class="fb2-epigraph">${renderNodes(el.children)}</aside>`;
    case 'cite':     return `<blockquote>${renderNodes(el.children)}</blockquote>`;
    case 'empty-line': return '<br/>';
    case 'image':    return '';
    default:         return renderNodes(el.children);
  }
}

function renderInline(el: Element): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(node.nodeValue ?? '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      const local = child.localName.toLowerCase();
      if (local === 'emphasis' || local === 'em') out += `<em>${renderInline(child)}</em>`;
      else if (local === 'strong') out += `<strong>${renderInline(child)}</strong>`;
      else if (local === 'a') {
        const href = safeUrl(child.getAttributeNS(XLINK_NS, 'href') ?? child.getAttribute('href'));
        out += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${renderInline(child)}</a>`;
      } else {
        out += renderInline(child);
      }
    }
  }
  return out;
}
