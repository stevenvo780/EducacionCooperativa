import { escapeHtml, safeUrl } from '@/lib/html-utils';

const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const DRAW_NS = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export type OdfVariant = 'odt' | 'ods' | 'odp';

export interface OdfRenderResult {
  html: string;
  warnings: string[];
}

export function renderOdfContent(xml: string, variant: OdfVariant): OdfRenderResult {
  const warnings: string[] = [];
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { html: '', warnings: ['DOMParser no disponible'] };
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return { html: '<pre>XML inválido</pre>', warnings: ['XML inválido'] };
  }

  const renderInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const local = el.localName;
    if (el.namespaceURI === TEXT_NS) {
      if (local === 'span') return `<span>${renderChildren(el)}</span>`;
      if (local === 'a') {
        const href = safeUrl(el.getAttributeNS(XLINK_NS, 'href'));
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${renderChildren(el)}</a>`;
      }
      if (local === 'line-break') return '<br/>';
      if (local === 'tab') return '    ';
      if (local === 's') {
        const count = parseInt(el.getAttributeNS(TEXT_NS, 'c') ?? '1', 10);
        return ' '.repeat(Number.isFinite(count) ? count : 1);
      }
      if (local === 'note') return `<sup class="odt-note">[nota]</sup>${renderChildren(el)}`;
    }
    return renderChildren(el);
  };

  const renderChildren = (el: Element): string =>
    Array.from(el.childNodes).map(renderInline).join('');

  const renderBlock = (el: Element): string => {
    const local = el.localName;
    if (el.namespaceURI === TEXT_NS) {
      if (local === 'h') {
        const level = clamp(1, 6, parseInt(el.getAttributeNS(TEXT_NS, 'outline-level') ?? '1', 10));
        return `<h${level}>${renderChildren(el)}</h${level}>`;
      }
      if (local === 'p') {
        const styleName = el.getAttributeNS(TEXT_NS, 'style-name') ?? '';
        if (/quot/i.test(styleName)) return `<blockquote>${renderChildren(el)}</blockquote>`;
        return `<p>${renderChildren(el)}</p>`;
      }
      if (local === 'list') {
        const items = childrenOfLocal(el, 'list-item');
        const inner = items.map((it) => `<li>${childrenOfElement(it).map(renderBlock).join('')}</li>`).join('');
        return `<ul>${inner}</ul>`;
      }
    }
    if (el.namespaceURI === TABLE_NS && local === 'table') {
      const rows = childrenOfLocal(el, 'table-row');
      const body = rows.map((r) => {
        const cells = childrenOfLocal(r, 'table-cell');
        return `<tr>${cells.map((c) => `<td>${childrenOfElement(c).map(renderBlock).join('')}</td>`).join('')}</tr>`;
      }).join('');
      return `<table>${body}</table>`;
    }
    if (el.namespaceURI === DRAW_NS && local === 'frame') {
      warnings.push('Imagen embebida no extraída');
      return '<div class="odt-image-placeholder">[imagen]</div>';
    }
    return childrenOfElement(el).map(renderBlock).join('');
  };

  const body = doc.getElementsByTagNameNS(OFFICE_NS, 'body').item(0);
  if (!body) return { html: '', warnings: ['No body en content.xml'] };

  if (variant === 'odt') {
    const text = body.getElementsByTagNameNS(OFFICE_NS, 'text').item(0);
    if (!text) return { html: '', warnings: ['No text container'] };
    return { html: childrenOfElement(text).map(renderBlock).join(''), warnings };
  }

  if (variant === 'ods') {
    const sheets = Array.from(body.getElementsByTagNameNS(TABLE_NS, 'table'));
    const html = sheets.map((sheet) => {
      const name = sheet.getAttributeNS(TABLE_NS, 'name') ?? 'hoja';
      return `<section class="ods-sheet"><h2>${escapeHtml(name)}</h2>${renderBlock(sheet)}</section>`;
    }).join('');
    return { html, warnings };
  }

  // odp
  const slides = Array.from(body.getElementsByTagNameNS(DRAW_NS, 'page'));
  const html = slides.map((slide, i) => {
    const name = slide.getAttributeNS(DRAW_NS, 'name') ?? `Diapositiva ${i + 1}`;
    const frames = Array.from(slide.getElementsByTagNameNS(DRAW_NS, 'frame'));
    const inner = frames.map((f) => childrenOfElement(f).map(renderBlock).join('')).join('');
    return `<section class="odp-slide"><header>${escapeHtml(name)}</header>${inner}</section>`;
  }).join('');
  return { html, warnings };
}

function clamp(min: number, max: number, value: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function childrenOfLocal(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === localName);
}

function childrenOfElement(el: Element): Element[] {
  return Array.from(el.children);
}
