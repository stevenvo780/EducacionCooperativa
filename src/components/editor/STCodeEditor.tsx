'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';

// ── Categorías de tokens para syntax highlighting ───────────

type TokenCategory =
  | 'keyword'
  | 'builtin'
  | 'operator'
  | 'comment'
  | 'string'
  | 'number'
  | 'atom'
  | 'identifier'
  | 'profile'
  | 'punctuation'
  | 'plain';

// ── Regex para tokenización (orden importa: primeros ganan) ─

const KEYWORDS = new Set([
  'logic', 'axiom', 'theorem', 'derive', 'from', 'check', 'prove',
  'countermodel', 'truth_table', 'let', 'passage', 'formalize', 'as',
  'claim', 'support', 'confidence', 'context', 'render'
]);

const BUILTINS = new Set([
  'valid', 'satisfiable', 'equivalent', 'claims'
]);

const PROFILES = new Set([
  'classical.propositional', 'classical.first_order', 'classical.first-order',
  'modal.k', 'modal.s4', 'modal.s5', 'modal.t',
  'paraconsistent.belnap'
]);

// ── Tokenizador de highlighting ─────────────────────────────

interface HighlightToken {
  text: string;
  category: TokenCategory;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tokenizeLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    // ── 1. Comentario (//) ──
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), category: 'comment' });
      return tokens;
    }

    // ── 2. String literal ("...") ──
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      if (j < line.length) j++; // include closing quote
      tokens.push({ text: line.slice(i, j), category: 'string' });
      i = j;
      continue;
    }

    // ── 3. Double bracket literal ([[...]]) ──
    if (line[i] === '[' && line[i + 1] === '[') {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === ']' && line[j + 1] === ']')) j++;
      if (j < line.length - 1) j += 2; else j = line.length;
      tokens.push({ text: line.slice(i, j), category: 'string' });
      i = j;
      continue;
    }

    // ── 4. Operators (multi-char first) ──
    if (line[i] === '<' && line[i + 1] === '-' && line[i + 2] === '>') {
      tokens.push({ text: '<->', category: 'operator' });
      i += 3;
      continue;
    }
    if (line[i] === '-' && line[i + 1] === '>') {
      tokens.push({ text: '->', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '<' && line[i + 1] === '-') {
      tokens.push({ text: '<-', category: 'operator' });
      i += 2;
      continue;
    }
    if ('&|!='.includes(line[i])) {
      tokens.push({ text: line[i], category: 'operator' });
      i++;
      continue;
    }

    // ── 5. Punctuation ──
    if ('(){}[],:#'.includes(line[i])) {
      tokens.push({ text: line[i], category: 'punctuation' });
      i++;
      continue;
    }

    // ── 6. Number ──
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), category: 'number' });
      i = j;
      continue;
    }

    // ── 7. Word (keyword / builtin / profile / identifier / atom) ──
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      // Consume word + dots (for profile paths like classical.propositional)
      while (j < line.length && /[a-zA-Z0-9_.]/.test(line[j])) j++;
      const word = line.slice(i, j);

      // Check profile first (compound with dots)
      if (PROFILES.has(word)) {
        tokens.push({ text: word, category: 'profile' });
      } else {
        // If compound with dots, split on dots
        const parts = word.split('.');
        if (parts.length > 1 && !PROFILES.has(word)) {
          // Emit each part with its own classification, dots as punctuation
          for (let p = 0; p < parts.length; p++) {
            if (p > 0) tokens.push({ text: '.', category: 'punctuation' });
            tokens.push(classifyWord(parts[p]));
          }
        } else {
          tokens.push(classifyWord(word));
        }
      }
      i = j;
      continue;
    }

    // ── 8. Whitespace ──
    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), category: 'plain' });
      i = j;
      continue;
    }

    // ── 9. Anything else ──
    tokens.push({ text: line[i], category: 'plain' });
    i++;
  }

  return tokens;
}

function classifyWord(word: string): HighlightToken {
  const lower = word.toLowerCase();
  if (KEYWORDS.has(lower)) return { text: word, category: 'keyword' };
  if (BUILTINS.has(lower)) return { text: word, category: 'builtin' };
  // Single uppercase letter → propositional atom (P, Q, R...)
  if (/^[A-Z]$/.test(word)) return { text: word, category: 'atom' };
  return { text: word, category: 'identifier' };
}

// ── Renderizar tokens a HTML ────────────────────────────────

const TOKEN_CLASSES: Record<TokenCategory, string> = {
  keyword: 'st-keyword',
  builtin: 'st-builtin',
  operator: 'st-operator',
  comment: 'st-comment',
  string: 'st-string',
  number: 'st-number',
  atom: 'st-atom',
  identifier: 'st-identifier',
  profile: 'st-profile',
  punctuation: 'st-punctuation',
  plain: ''
};

function renderHighlightedLine(line: string): string {
  if (line === '') return '\n';
  const tokens = tokenizeLine(line);
  return `${tokens.map(t => {
    const cls = TOKEN_CLASSES[t.category];
    const escaped = escapeHtml(t.text);
    return cls ? `<span class="${cls}">${escaped}</span>` : escaped;
  }).join('')}\n`;
}

function highlightCode(code: string): string {
  const lines = code.split('\n');
  return lines.map(renderHighlightedLine).join('');
}

// ── Componente STCodeEditor ─────────────────────────────────

interface STCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export default function STCodeEditor({
  value,
  onChange,
  onKeyDown,
  placeholder = '// Escribe tu código ST aquí...',
  className = '',
  readOnly = false
}: STCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(0);

  // ── Highlighted HTML (memoized) ──
  const highlightedHtml = useMemo(() => highlightCode(value), [value]);

  // ── Line count ──
  const lineCount = useMemo(() => {
    const count = value.split('\n').length;
    return Math.max(count, 1);
  }, [value]);

  // ── Active line tracking ──
  const updateActiveLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const text = ta.value.substring(0, ta.selectionStart);
    const line = text.split('\n').length;
    setActiveLine(line);
  }, []);

  // ── Sync scroll between textarea, pre, and gutter ──
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    const pre = preRef.current;
    const gutter = gutterRef.current;
    if (!ta) return;
    if (pre) {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = ta.scrollTop;
    }
  }, []);

  // ── Handle change ──
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      updateActiveLine();
    },
    [onChange, updateActiveLine]
  );

  // ── Handle click/keyup for active line ──
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const handler = () => updateActiveLine();
    ta.addEventListener('click', handler);
    ta.addEventListener('keyup', handler);
    return () => {
      ta.removeEventListener('click', handler);
      ta.removeEventListener('keyup', handler);
    };
  }, [updateActiveLine]);

  // ── Gutter line numbers ──
  const gutterContent = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 1; i <= lineCount; i++) {
      lines.push(
        <div
          key={i}
          className={`st-gutter-line ${i === activeLine ? 'st-gutter-active' : ''}`}
        >
          {i}
        </div>
      );
    }
    return lines;
  }, [lineCount, activeLine]);

  // ── Active line highlight position ──
  const activeLineStyle = useMemo((): React.CSSProperties | null => {
    if (activeLine <= 0) return null;
    // lineHeight = 1.5rem = 24px (matches the font setup)
    const top = (activeLine - 1) * 20;
    return {
      position: 'absolute',
      top,
      left: 0,
      right: 0,
      height: 20,
      background: 'rgba(255,255,255,0.03)',
      pointerEvents: 'none' as const
    };
  }, [activeLine]);

  return (
    <div className={`st-editor-container ${className}`} ref={containerRef}>
      {/* ── Gutter (line numbers) ── */}
      <div className="st-editor-gutter" ref={gutterRef}>
        {gutterContent}
      </div>

      {/* ── Editor area ── */}
      <div className="st-editor-area">
        {/* Active line highlight */}
        {activeLineStyle && <div style={activeLineStyle} />}

        {/* Highlighted overlay (behind textarea) */}
        <pre
          ref={preRef}
          className="st-editor-highlight"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedHtml || `<span class="st-placeholder">${escapeHtml(placeholder)}</span>` }}
        />

        {/* Invisible textarea (on top, captures input) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onScroll={handleScroll}
          className="st-editor-textarea"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          readOnly={readOnly}
          placeholder=""
        />

        {/* Show placeholder when empty */}
        {!value && (
          <div className="st-editor-placeholder">{placeholder}</div>
        )}
      </div>
    </div>
  );
}
