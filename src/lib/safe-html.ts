import DOMPurify from 'isomorphic-dompurify';

const BASE_CONFIG = {
  USE_PROFILES: { html: true, svg: true },
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
    'colspan', 'rowspan', 'width', 'height', 'cite', 'lang', 'dir'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/|data:image\/)/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'link'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'autofocus']
};

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, BASE_CONFIG);
}
