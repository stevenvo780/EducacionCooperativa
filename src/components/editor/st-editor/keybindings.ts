/**
 * Keybindings para el editor ST (funciones puras que operan sobre HTMLTextAreaElement).
 *
 * Cada handler devuelve `true` si consumió el evento (para preventDefault).
 */

// ── Helpers ─────────────────────────────────────────────────

function getLineRange(text: string, pos: number): { start: number; end: number; lineText: string } {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  let end = text.indexOf('\n', pos);
  if (end === -1) end = text.length;
  return { start, end, lineText: text.slice(start, end) };
}

function setTextareaValue(
  ta: HTMLTextAreaElement,
  newValue: string,
  cursorStart: number,
  cursorEnd?: number,
  onChange?: (v: string) => void
) {
  // Use native setter to trigger React's onChange
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  nativeInputValueSetter?.call(ta, newValue);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  onChange?.(newValue);
  requestAnimationFrame(() => {
    ta.selectionStart = cursorStart;
    ta.selectionEnd = cursorEnd ?? cursorStart;
  });
}

// ── Duplicate Line (Ctrl+D) ────────────────────────────────

export function handleDuplicateLine(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void
): boolean {
  const { value, selectionStart } = ta;
  const { start: _start, end, lineText } = getLineRange(value, selectionStart);
  const newValue = `${value.slice(0, end)}\n${lineText}${value.slice(end)}`;
  const newCursor = selectionStart + lineText.length + 1;
  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Toggle Line Comment (Ctrl+/) ───────────────────────────

export function handleToggleComment(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void
): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  const lines = value.split('\n');

  // Find lines in selection
  let charCount = 0;
  let startLine = 0;
  let endLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= selectionStart && startLine === 0) startLine = i;
    if (charCount + lines[i].length >= selectionEnd) { endLine = i; break; }
    charCount += lines[i].length + 1;
  }
  if (endLine < startLine) endLine = startLine;

  // Check if all selected lines are commented
  const selectedLines = lines.slice(startLine, endLine + 1);
  const allCommented = selectedLines.every(l => /^\s*\/\//.test(l));

  let offsetDelta = 0;
  for (let i = startLine; i <= endLine; i++) {
    if (allCommented) {
      // Remove comment
      const match = lines[i].match(/^(\s*)\/\/\s?/);
      if (match) {
        lines[i] = lines[i].slice(0, match[1].length) + lines[i].slice(match[0].length);
        offsetDelta -= match[0].length - match[1].length;
      }
    } else {
      // Add comment
      lines[i] = `// ${lines[i]}`;
      offsetDelta += 3;
    }
  }

  const newValue = lines.join('\n');
  const newCursor = Math.max(0, selectionEnd + offsetDelta);
  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Move Line Up/Down (Alt+↑/↓) ───────────────────────────

export function handleMoveLine(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void,
  direction: 'up' | 'down'
): boolean {
  const { value, selectionStart } = ta;
  const lines = value.split('\n');

  // Find current line index
  let charCount = 0;
  let currentLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= selectionStart) { currentLine = i; break; }
    charCount += lines[i].length + 1;
  }

  if (direction === 'up' && currentLine === 0) return true;
  if (direction === 'down' && currentLine >= lines.length - 1) return true;

  const swapWith = direction === 'up' ? currentLine - 1 : currentLine + 1;
  const temp = lines[currentLine];
  lines[currentLine] = lines[swapWith];
  lines[swapWith] = temp;

  const newValue = lines.join('\n');

  // Calculate new cursor position
  let newCharCount = 0;
  for (let i = 0; i < swapWith; i++) newCharCount += lines[i].length + 1;
  const colOffset = selectionStart - charCount;
  const newCursor = newCharCount + Math.min(colOffset, lines[swapWith].length);

  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Delete Line (Ctrl+Shift+K) ─────────────────────────────

export function handleDeleteLine(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void
): boolean {
  const { value, selectionStart } = ta;
  const { start, end } = getLineRange(value, selectionStart);

  // Delete line including the newline
  let deleteEnd = end;
  if (deleteEnd < value.length) deleteEnd++; // include \n
  else if (start > 0) { /* last line: eat preceding \n */ }

  const newValue = value.slice(0, start) + value.slice(deleteEnd);
  const newCursor = Math.min(start, newValue.length);
  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Indent / Dedent (Ctrl+] / Ctrl+[) ─────────────────────

export function handleIndent(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void,
  direction: 'indent' | 'dedent'
): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  const lines = value.split('\n');
  const INDENT = '  '; // 2 spaces

  // Find lines in selection
  let charCount = 0;
  let startLine = 0;
  let endLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (charCount <= selectionStart && charCount + lines[i].length >= selectionStart) startLine = i;
    if (charCount <= selectionEnd && charCount + lines[i].length >= selectionEnd) { endLine = i; break; }
    charCount += lines[i].length + 1;
  }

  let offsetDelta = 0;
  for (let i = startLine; i <= endLine; i++) {
    if (direction === 'indent') {
      lines[i] = `${INDENT}${lines[i]}`;
      offsetDelta += 2;
    } else {
      if (lines[i].startsWith(INDENT)) {
        lines[i] = lines[i].slice(2);
        offsetDelta -= 2;
      } else if (lines[i].startsWith(' ')) {
        lines[i] = lines[i].slice(1);
        offsetDelta -= 1;
      }
    }
  }

  const newValue = lines.join('\n');
  const newCursor = Math.max(0, selectionEnd + offsetDelta);
  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Smart Indentation (Enter key) ──────────────────────────

export function handleSmartNewline(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void
): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  const { lineText } = getLineRange(value, selectionStart);

  // Current indentation
  const indentMatch = lineText.match(/^(\s*)/);
  const currentIndent = indentMatch ? indentMatch[1] : '';

  // Increase indent after block openers and proof headers
  const trimmed = lineText.trim();
  let newIndent = currentIndent;
  if (trimmed.endsWith('{') || /^(assume|asumir|show|demostrar)\b/.test(trimmed)) {
    newIndent = `${currentIndent}  `;
  }
  // Decrease indent for } qed
  if (trimmed === '} qed' || trimmed === '}') {
    newIndent = currentIndent.length >= 2 ? currentIndent.slice(2) : '';
  }

  const insertion = `\n${newIndent}`;
  const newValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
  const newCursor = selectionStart + insertion.length;
  setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
  return true;
}

// ── Auto-close brackets ────────────────────────────────────

const BRACKET_PAIRS: Record<string, string> = {
  '(': ')',
  '{': '}',
  '[': ']',
  '"': '"'
};

const CLOSE_BRACKETS = new Set([')', '}', ']', '"']);

export function handleAutoClose(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void,
  char: string
): boolean {
  const { value, selectionStart, selectionEnd } = ta;

  // If selection exists, wrap it
  if (selectionStart !== selectionEnd) {
    const selected = value.slice(selectionStart, selectionEnd);
    const close = BRACKET_PAIRS[char];
    if (close) {
      const newValue = value.slice(0, selectionStart) + char + selected + close + value.slice(selectionEnd);
      const newCursor = selectionStart + 1 + selected.length;
      setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
      return true;
    }
    return false;
  }

  // If typing a close bracket that's already there, just skip it
  if (CLOSE_BRACKETS.has(char) && value[selectionStart] === char) {
    setTextareaValue(ta, value, selectionStart + 1, selectionStart + 1, onChange);
    return true;
  }

  // Auto-insert closing bracket
  const close = BRACKET_PAIRS[char];
  if (close) {
    // For quotes, only auto-close if not already inside a string
    if (char === '"') {
      const before = value.slice(0, selectionStart);
      const quoteCount = (before.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) return false; // inside a string
    }
    const newValue = value.slice(0, selectionStart) + char + close + value.slice(selectionEnd);
    const newCursor = selectionStart + 1;
    setTextareaValue(ta, newValue, newCursor, newCursor, onChange);
    return true;
  }

  return false;
}

// ── Backspace: delete pair ─────────────────────────────────

export function handleBackspacePair(
  ta: HTMLTextAreaElement,
  onChange: (v: string) => void
): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  if (selectionStart !== selectionEnd || selectionStart === 0) return false;

  const before = value[selectionStart - 1];
  const after = value[selectionStart];
  if (BRACKET_PAIRS[before] === after) {
    const newValue = value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1);
    setTextareaValue(ta, newValue, selectionStart - 1, selectionStart - 1, onChange);
    return true;
  }
  return false;
}

// ── Bracket matching (find matching pair) ──────────────────

export interface BracketMatch {
  openPos: number; // absolute position in code
  closePos: number;
  depth: number;
}

const OPEN_TO_CLOSE: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
const CLOSE_TO_OPEN: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

export function findMatchingBracket(code: string, pos: number): BracketMatch | null {
  const ch = code[pos];
  if (!ch) return null;

  // Forward search (opening bracket)
  if (OPEN_TO_CLOSE[ch]) {
    const close = OPEN_TO_CLOSE[ch];
    let depth = 0;
    for (let i = pos; i < code.length; i++) {
      if (code[i] === ch) depth++;
      if (code[i] === close) {
        depth--;
        if (depth === 0) return { openPos: pos, closePos: i, depth: 0 };
      }
    }
    return null;
  }

  // Backward search (closing bracket)
  if (CLOSE_TO_OPEN[ch]) {
    const open = CLOSE_TO_OPEN[ch];
    let depth = 0;
    for (let i = pos; i >= 0; i--) {
      if (code[i] === ch) depth++;
      if (code[i] === open) {
        depth--;
        if (depth === 0) return { openPos: i, closePos: pos, depth: 0 };
      }
    }
    return null;
  }

  return null;
}
