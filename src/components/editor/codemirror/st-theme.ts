/**
 * Tema oscuro para el editor ST en CodeMirror 6.
 *
 * Colores inspirados en One Dark / VS Code, coincidiendo con los colores
 * del editor textarea anterior (globals.css .st-* classes).
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// ── Color palette ───────────────────────────────────────────

const colors = {
  bg:          '#020617', // slate-950
  bgEditor:    '#0f172a', // slate-900
  fg:          '#e2e8f0', // slate-200
  gutterBg:    'rgba(15, 23, 42, 0.6)',
  gutterFg:    '#475569', // slate-600
  gutterActive:'#94a3b8', // slate-400
  selection:   'rgba(99, 102, 241, 0.3)',
  cursor:      '#e2e8f0', // slate-200
  activeLine:  'rgba(255, 255, 255, 0.03)',
  border:      '#1e293b', // slate-800
  scrollbar:   'rgba(148, 163, 184, 0.15)',
  tooltipBg:   '#1e293b', // slate-800
  tooltipBorder: '#334155', // slate-700

  keyword:     '#c084fc', // purple-400
  builtin:     '#60a5fa', // blue-400
  operator:    '#22d3ee', // cyan-400
  comment:     '#475569', // slate-600
  string:      '#fbbf24', // amber-400
  number:      '#fb923c', // orange-400
  atom:        '#2dd4bf', // teal-400
  identifier:  '#e2e8f0', // slate-200
  profile:     '#4ade80', // green-400
  punctuation: '#64748b', // slate-500
  paren0:      '#fbbf24', // amber-400
  paren1:      '#c084fc', // purple-400
  paren2:      '#22d3ee', // cyan-400
  paren3:      '#4ade80', // green-400
  matchBg:     'rgba(99, 102, 241, 0.12)',
  matchBorder: 'rgba(99, 102, 241, 0.6)',
  diagError:   '#ef4444',
  diagWarning: '#f59e0b',
  diagInfo:    '#3b82f6'
};

// ── Editor theme (structural / chrome) ──────────────────────

export const stEditorTheme = EditorView.theme({
  '&': {
    color: colors.fg,
    backgroundColor: colors.bg,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
    fontSize: '13px',
    height: '100%'
  },
  '.cm-content': {
    caretColor: colors.cursor,
    padding: '12px 0',
    lineHeight: '20px',
    fontFamily: 'inherit'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: colors.cursor,
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: `${colors.selection} !important`
  },
  '.cm-activeLine': {
    backgroundColor: colors.activeLine
  },
  '.cm-gutters': {
    backgroundColor: colors.gutterBg,
    color: colors.gutterFg,
    borderRight: `1px solid ${colors.border}`,
    fontFamily: 'inherit',
    fontSize: '11px',
    minWidth: '44px'
  },
  '.cm-activeLineGutter': {
    color: colors.gutterActive,
    backgroundColor: 'transparent'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 0',
    textAlign: 'right',
    minWidth: '28px'
  },
  '.cm-foldPlaceholder': {
    color: colors.punctuation,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border}`
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: colors.matchBg,
    outline: `1px solid ${colors.matchBorder}`,
    borderRadius: '2px'
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    outline: '1px solid rgba(251, 191, 36, 0.5)',
    borderRadius: '2px'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(251, 191, 36, 0.35)'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
    lineHeight: '20px'
  },
  // ── Minimap styles ────────────────────────────────────────
  '.cm-minimap-gutter': {
    backgroundColor: colors.bg,
    borderLeft: `1px solid ${colors.border}`,
    opacity: '0.85'
  },
  '.cm-minimap-overlay': {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderTop: '1px solid rgba(99, 102, 241, 0.4)',
    borderBottom: '1px solid rgba(99, 102, 241, 0.4)'
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
    height: '8px'
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: colors.scrollbar,
    borderRadius: '4px'
  },
  '.cm-panels': {
    backgroundColor: colors.bgEditor,
    borderBottom: `1px solid ${colors.border}`,
    color: colors.fg
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: `1px solid ${colors.border}`
  },
  '.cm-panel input, .cm-panel button': {
    fontFamily: 'inherit',
    fontSize: '12px'
  },
  '.cm-panel input[type=text]': {
    backgroundColor: colors.bg,
    color: colors.fg,
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    padding: '2px 6px'
  },
  '.cm-panel button': {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: colors.fg,
    border: `1px solid rgba(99, 102, 241, 0.4)`,
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer'
  },
  // ── Tooltips (hover, autocomplete, lint) ──
  '.cm-tooltip': {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    color: colors.fg,
    fontSize: '12px',
    fontFamily: 'inherit'
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      maxHeight: '200px',
      fontFamily: 'inherit',
      fontSize: '12px'
    },
    '& > ul > li': {
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#334155',
      color: colors.fg
    }
  },
  '.cm-completionIcon': {
    width: '18px',
    height: '18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '700',
    flexShrink: '0'
  },
  '.cm-completionIcon-keyword': {
    color: colors.keyword,
    '&::after': { content: '"K"' }
  },
  '.cm-completionIcon-type': {
    color: colors.profile,
    '&::after': { content: '"P"' }
  },
  '.cm-completionIcon-variable': {
    color: colors.atom,
    '&::after': { content: '"V"' }
  },
  '.cm-completionIcon-text': {
    color: colors.builtin,
    '&::after': { content: '"S"' }
  },
  '.cm-completionLabel': {
    flex: '1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#f1f5f9'
  },
  '.cm-completionDetail': {
    color: colors.punctuation,
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '140px',
    fontStyle: 'italic',
    marginLeft: 'auto'
  },
  // ── Lint diagnostics ──
  '.cm-diagnostic': {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px'
  },
  '.cm-diagnostic-error': {
    borderLeft: `3px solid ${colors.diagError}`,
    backgroundColor: 'rgba(239, 68, 68, 0.08)'
  },
  '.cm-diagnostic-warning': {
    borderLeft: `3px solid ${colors.diagWarning}`,
    backgroundColor: 'rgba(245, 158, 11, 0.08)'
  },
  '.cm-diagnostic-info': {
    borderLeft: `3px solid ${colors.diagInfo}`,
    backgroundColor: 'rgba(59, 130, 246, 0.08)'
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: `underline wavy ${colors.diagError}`,
    textUnderlineOffset: '3px'
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: `underline wavy ${colors.diagWarning}`,
    textUnderlineOffset: '3px'
  },
  '.cm-lintRange-info': {
    backgroundImage: 'none',
    textDecoration: `underline wavy ${colors.diagInfo}`,
    textUnderlineOffset: '3px'
  },
  // ── Rainbow parens (via custom tags) ──
  '.cm-st-paren-0': { color: colors.paren0, fontWeight: '600' },
  '.cm-st-paren-1': { color: colors.paren1, fontWeight: '600' },
  '.cm-st-paren-2': { color: colors.paren2, fontWeight: '600' },
  '.cm-st-paren-3': { color: colors.paren3, fontWeight: '600' },
  // ── Hover tooltip custom ──
  '.cm-st-hover-tooltip': {
    padding: '8px 12px',
    maxWidth: '360px'
  },
  '.cm-st-hover-title': {
    fontWeight: '700',
    fontSize: '13px',
    color: colors.keyword,
    marginBottom: '4px'
  },
  '.cm-st-hover-desc': {
    color: colors.fg,
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap'
  },
  '.cm-st-hover-example': {
    display: 'block',
    marginTop: '6px',
    padding: '4px 8px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    color: colors.string
  },
  '.cm-st-hover-category': {
    display: 'inline-block',
    marginTop: '4px',
    fontSize: '10px',
    color: colors.punctuation,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }
}, { dark: true });

// ── Syntax highlighting style ───────────────────────────────

export const stHighlightStyle = HighlightStyle.define([
  // Mapped from our StreamLanguage token names
  { tag: t.keyword, color: colors.keyword, fontWeight: '600' },
  { tag: t.operatorKeyword,color: colors.keyword, fontWeight: '600' },
  { tag: t.operator, color: colors.operator, fontWeight: '600' },
  { tag: t.lineComment, color: colors.comment, fontStyle: 'italic' },
  { tag: t.blockComment, color: colors.comment, fontStyle: 'italic' },
  { tag: t.string, color: colors.string },
  { tag: t.number, color: colors.number },
  { tag: t.atom, color: colors.atom, fontWeight: '600' },
  { tag: t.variableName, color: colors.identifier },
  { tag: t.typeName, color: colors.profile, fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: colors.builtin, fontWeight: '500' },
  { tag: t.punctuation, color: colors.punctuation },
  { tag: t.paren, color: colors.paren0 },
  { tag: t.brace, color: colors.paren0 }
]);

/**
 * Combined theme + syntax highlighting for ST.
 */
export function stTheme() {
  return [stEditorTheme, syntaxHighlighting(stHighlightStyle)];
}
