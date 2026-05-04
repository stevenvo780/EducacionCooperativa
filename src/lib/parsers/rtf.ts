import { escapeHtml } from '@/lib/html-utils';

interface FormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export function rtfToHtml(rtf: string): string {
  let i = 0;
  const len = rtf.length;
  let para = '';
  let out = '';
  const stack: FormattingState[] = [];
  const current: FormattingState = { bold: false, italic: false, underline: false };

  const flushPara = () => {
    if (para.trim()) out += `<p>${para}</p>`;
    para = '';
  };

  const setStyle = (style: keyof FormattingState, on: boolean) => {
    if (current[style] === on) return;
    if (on) para += `<${tagFor(style)}>`;
    else para += `</${tagFor(style)}>`;
    current[style] = on;
  };

  while (i < len) {
    const c = rtf[i] ?? '';
    if (c === '\\') {
      i++;
      const ch = rtf[i] ?? '';
      if (ch === "'") {
        // Hex escape \'XX (single byte, normalmente cp1252 pero usamos
        // fromCharCode que mapea a U+00XX — válido para latin-1 común).
        i++;
        const hex = rtf.slice(i, i + 2);
        i += 2;
        const code = parseInt(hex, 16);
        if (Number.isFinite(code)) para += escapeHtml(String.fromCharCode(code));
      } else if (/[a-zA-Z]/.test(ch)) {
        let cw = '';
        while (i < len && /[a-zA-Z]/.test(rtf[i] ?? '')) { cw += rtf[i]; i++; }
        let param = '';
        if (rtf[i] === '-' || /[0-9]/.test(rtf[i] ?? '')) {
          while (i < len && /[-0-9]/.test(rtf[i] ?? '')) { param += rtf[i]; i++; }
        }
        if (rtf[i] === ' ') i++;
        const isOff = param === '0';
        if (cw === 'par' || cw === 'line') flushPara();
        else if (cw === 'b') setStyle('bold', !isOff);
        else if (cw === 'i') setStyle('italic', !isOff);
        else if (cw === 'ul') setStyle('underline', true);
        else if (cw === 'ulnone') setStyle('underline', false);
        else if (cw === 'tab') para += '    ';
        else if (cw === 'u') {
          const code = parseInt(param || '0', 10);
          if (Number.isFinite(code)) para += escapeHtml(String.fromCharCode(code & 0xffff));
          if (rtf[i] === '?') i++;
        }
      } else if (ch === '*') {
        // Skip destination block.
        let depth = 1;
        i++;
        while (i < len && depth > 0) {
          const t = rtf[i];
          if (t === '\\') { i += 2; continue; }
          if (t === '{') depth++;
          else if (t === '}') depth--;
          i++;
        }
      } else if (ch === '\\' || ch === '{' || ch === '}') {
        para += escapeHtml(ch);
        i++;
      } else {
        i++;
      }
    } else if (c === '{') {
      stack.push({ ...current });
      i++;
    } else if (c === '}') {
      const prev = stack.pop();
      if (prev) {
        if (current.bold && !prev.bold) setStyle('bold', false);
        if (current.italic && !prev.italic) setStyle('italic', false);
        if (current.underline && !prev.underline) setStyle('underline', false);
      }
      i++;
    } else if (c === '\n' || c === '\r') {
      i++;
    } else {
      para += escapeHtml(c);
      i++;
    }
  }
  flushPara();
  return out;
}

function tagFor(style: keyof FormattingState): string {
  switch (style) {
    case 'bold': return 'strong';
    case 'italic': return 'em';
    case 'underline': return 'u';
  }
}
