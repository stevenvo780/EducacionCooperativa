/**
 * Temas para el editor ST en CodeMirror 6.
 *
 * Tema oscuro inspirado en One Dark / VS Code.
 * Tema claro inspirado en GitHub Light / Solarized Light.
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

interface ColorPalette {
  bg: string;
  bgEditor: string;
  fg: string;
  gutterBg: string;
  gutterFg: string;
  gutterActive: string;
  selection: string;
  cursor: string;
  activeLine: string;
  border: string;
  scrollbar: string;
  tooltipBg: string;
  tooltipBorder: string;
  keyword: string;
  builtin: string;
  operator: string;
  comment: string;
  string: string;
  number: string;
  atom: string;
  identifier: string;
  profile: string;
  punctuation: string;
  paren0: string;
  paren1: string;
  paren2: string;
  paren3: string;
  matchBg: string;
  matchBorder: string;
  diagError: string;
  diagWarning: string;
  diagInfo: string;
  // Light-specific extras
  completionSelected?: string;
  completionLabel?: string;
  hoverExampleBg?: string;
  searchMatchBg?: string;
  searchMatchBorder?: string;
  searchMatchSelectedBg?: string;
  minimapOverlayBg?: string;
  panelButtonBg?: string;
  panelButtonBorder?: string;
}

const darkColors: ColorPalette = {
  bg:          '#020617',
  bgEditor:    '#0f172a',
  fg:          '#e2e8f0',
  gutterBg:    'rgba(15, 23, 42, 0.6)',
  gutterFg:    '#475569',
  gutterActive:'#94a3b8',
  selection:   'rgba(99, 102, 241, 0.3)',
  cursor:      '#e2e8f0',
  activeLine:  'rgba(255, 255, 255, 0.03)',
  border:      '#1e293b',
  scrollbar:   'rgba(148, 163, 184, 0.15)',
  tooltipBg:   '#1e293b',
  tooltipBorder: '#334155',
  keyword:     '#c084fc',
  builtin:     '#60a5fa',
  operator:    '#22d3ee',
  comment:     '#475569',
  string:      '#fbbf24',
  number:      '#fb923c',
  atom:        '#2dd4bf',
  identifier:  '#e2e8f0',
  profile:     '#4ade80',
  punctuation: '#64748b',
  paren0:      '#fbbf24',
  paren1:      '#c084fc',
  paren2:      '#22d3ee',
  paren3:      '#4ade80',
  matchBg:     'rgba(99, 102, 241, 0.12)',
  matchBorder: 'rgba(99, 102, 241, 0.6)',
  diagError:   '#ef4444',
  diagWarning: '#f59e0b',
  diagInfo:    '#3b82f6',
  completionSelected: '#334155',
  completionLabel: '#f1f5f9',
  hoverExampleBg: 'rgba(0,0,0,0.3)',
  searchMatchBg: 'rgba(251, 191, 36, 0.2)',
  searchMatchBorder: 'rgba(251, 191, 36, 0.5)',
  searchMatchSelectedBg: 'rgba(251, 191, 36, 0.35)',
  minimapOverlayBg: 'rgba(99, 102, 241, 0.15)',
  panelButtonBg: 'rgba(99, 102, 241, 0.2)',
  panelButtonBorder: 'rgba(99, 102, 241, 0.4)'
};

const lightColors: ColorPalette = {
  bg:          '#ffffff',
  bgEditor:    '#f8fafc',
  fg:          '#1e293b',
  gutterBg:    '#f1f5f9',
  gutterFg:    '#94a3b8',
  gutterActive:'#475569',
  selection:   'rgba(99, 102, 241, 0.18)',
  cursor:      '#1e293b',
  activeLine:  'rgba(0, 0, 0, 0.03)',
  border:      '#e2e8f0',
  scrollbar:   'rgba(100, 116, 139, 0.25)',
  tooltipBg:   '#ffffff',
  tooltipBorder: '#e2e8f0',
  keyword:     '#7c3aed', // violet-600
  builtin:     '#2563eb', // blue-600
  operator:    '#0891b2', // cyan-600
  comment:     '#94a3b8', // slate-400
  string:      '#d97706', // amber-600
  number:      '#ea580c', // orange-600
  atom:        '#0d9488', // teal-600
  identifier:  '#334155', // slate-700
  profile:     '#16a34a', // green-600
  punctuation: '#94a3b8', // slate-400
  paren0:      '#d97706', // amber-600
  paren1:      '#7c3aed', // violet-600
  paren2:      '#0891b2', // cyan-600
  paren3:      '#16a34a', // green-600
  matchBg:     'rgba(99, 102, 241, 0.1)',
  matchBorder: 'rgba(99, 102, 241, 0.5)',
  diagError:   '#dc2626',
  diagWarning: '#d97706',
  diagInfo:    '#2563eb',
  completionSelected: '#e2e8f0',
  completionLabel: '#1e293b',
  hoverExampleBg: 'rgba(0,0,0,0.05)',
  searchMatchBg: 'rgba(250, 204, 21, 0.3)',
  searchMatchBorder: 'rgba(202, 138, 4, 0.5)',
  searchMatchSelectedBg: 'rgba(250, 204, 21, 0.5)',
  minimapOverlayBg: 'rgba(99, 102, 241, 0.1)',
  panelButtonBg: 'rgba(99, 102, 241, 0.1)',
  panelButtonBorder: 'rgba(99, 102, 241, 0.3)'
};

function buildEditorTheme(c: ColorPalette, isDark: boolean) {
  return EditorView.theme({
    '&': {
      color: c.fg,
      backgroundColor: c.bg,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
      fontSize: '13px',
      height: '100%'
    },
    '.cm-content': {
      caretColor: c.cursor,
      padding: '12px 0',
      lineHeight: '20px',
      fontFamily: 'inherit'
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: c.cursor,
      borderLeftWidth: '2px'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: `${c.selection} !important`
    },
    '.cm-activeLine': {
      backgroundColor: c.activeLine
    },
    '.cm-gutters': {
      backgroundColor: c.gutterBg,
      color: c.gutterFg,
      borderRight: `1px solid ${c.border}`,
      fontFamily: 'inherit',
      fontSize: '11px',
      minWidth: '44px'
    },
    '.cm-activeLineGutter': {
      color: c.gutterActive,
      backgroundColor: 'transparent'
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 0',
      textAlign: 'right',
      minWidth: '28px'
    },
    '.cm-foldPlaceholder': {
      color: c.punctuation,
      backgroundColor: 'transparent',
      border: `1px solid ${c.border}`
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: c.matchBg,
      outline: `1px solid ${c.matchBorder}`,
      borderRadius: '2px'
    },
    '.cm-searchMatch': {
      backgroundColor: c.searchMatchBg ?? 'rgba(251, 191, 36, 0.2)',
      outline: `1px solid ${c.searchMatchBorder ?? 'rgba(251, 191, 36, 0.5)'}`,
      borderRadius: '2px'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: c.searchMatchSelectedBg ?? 'rgba(251, 191, 36, 0.35)'
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
      lineHeight: '20px'
    },
    '.cm-minimap-gutter': {
      backgroundColor: c.bg,
      borderLeft: `1px solid ${c.border}`,
      opacity: '0.85'
    },
    '.cm-minimap-overlay': {
      backgroundColor: c.minimapOverlayBg ?? 'rgba(99, 102, 241, 0.15)',
      borderTop: `1px solid ${c.panelButtonBorder ?? 'rgba(99, 102, 241, 0.4)'}`,
      borderBottom: `1px solid ${c.panelButtonBorder ?? 'rgba(99, 102, 241, 0.4)'}`
    },
    '.cm-scroller::-webkit-scrollbar': {
      width: '8px',
      height: '8px'
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: c.scrollbar,
      borderRadius: '4px'
    },
    '.cm-panels': {
      backgroundColor: c.bgEditor,
      borderBottom: `1px solid ${c.border}`,
      color: c.fg
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${c.border}`
    },
    '.cm-panel input, .cm-panel button': {
      fontFamily: 'inherit',
      fontSize: '12px'
    },
    '.cm-panel input[type=text]': {
      backgroundColor: c.bg,
      color: c.fg,
      border: `1px solid ${c.border}`,
      borderRadius: '4px',
      padding: '2px 6px'
    },
    '.cm-panel button': {
      backgroundColor: c.panelButtonBg ?? 'rgba(99, 102, 241, 0.2)',
      color: c.fg,
      border: `1px solid ${c.panelButtonBorder ?? 'rgba(99, 102, 241, 0.4)'}`,
      borderRadius: '4px',
      padding: '2px 8px',
      cursor: 'pointer'
    },
    '.cm-tooltip': {
      backgroundColor: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      borderRadius: '6px',
      boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0, 0, 0, 0.12)',
      color: c.fg,
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
        backgroundColor: c.completionSelected ?? '#334155',
        color: c.fg
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
      color: c.keyword,
      '&::after': { content: '"K"' }
    },
    '.cm-completionIcon-type': {
      color: c.profile,
      '&::after': { content: '"P"' }
    },
    '.cm-completionIcon-variable': {
      color: c.atom,
      '&::after': { content: '"V"' }
    },
    '.cm-completionIcon-text': {
      color: c.builtin,
      '&::after': { content: '"S"' }
    },
    '.cm-completionLabel': {
      flex: '1',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: c.completionLabel ?? '#f1f5f9'
    },
    '.cm-completionDetail': {
      color: c.punctuation,
      fontSize: '11px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '140px',
      fontStyle: 'italic',
      marginLeft: 'auto'
    },
    '.cm-diagnostic': {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px'
    },
    '.cm-diagnostic-error': {
      borderLeft: `3px solid ${c.diagError}`,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)'
    },
    '.cm-diagnostic-warning': {
      borderLeft: `3px solid ${c.diagWarning}`,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)'
    },
    '.cm-diagnostic-info': {
      borderLeft: `3px solid ${c.diagInfo}`,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.06)'
    },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${c.diagError}`,
      textUnderlineOffset: '3px'
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${c.diagWarning}`,
      textUnderlineOffset: '3px'
    },
    '.cm-lintRange-info': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${c.diagInfo}`,
      textUnderlineOffset: '3px'
    },
    '.cm-st-paren-0': { color: c.paren0, fontWeight: '600' },
    '.cm-st-paren-1': { color: c.paren1, fontWeight: '600' },
    '.cm-st-paren-2': { color: c.paren2, fontWeight: '600' },
    '.cm-st-paren-3': { color: c.paren3, fontWeight: '600' },
    '.cm-st-hover-tooltip': {
      padding: '8px 12px',
      maxWidth: '360px'
    },
    '.cm-st-hover-title': {
      fontWeight: '700',
      fontSize: '13px',
      color: c.keyword,
      marginBottom: '4px'
    },
    '.cm-st-hover-desc': {
      color: c.fg,
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap'
    },
    '.cm-st-hover-example': {
      display: 'block',
      marginTop: '6px',
      padding: '4px 8px',
      backgroundColor: c.hoverExampleBg ?? 'rgba(0,0,0,0.3)',
      borderRadius: '4px',
      fontFamily: 'inherit',
      fontSize: '12px',
      color: c.string
    },
    '.cm-st-hover-category': {
      display: 'inline-block',
      marginTop: '4px',
      fontSize: '10px',
      color: c.punctuation,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    '.cm-st-goto-link': {
      textDecoration: 'underline',
      textDecorationColor: c.builtin,
      cursor: 'pointer',
      color: c.builtin
    }
  }, { dark: isDark });
}

function buildHighlightStyle(c: ColorPalette) {
  return HighlightStyle.define([
    { tag: t.keyword, color: c.keyword, fontWeight: '600' },
    { tag: t.operatorKeyword, color: c.keyword, fontWeight: '600' },
    { tag: t.operator, color: c.operator, fontWeight: '600' },
    { tag: t.lineComment, color: c.comment, fontStyle: 'italic' },
    { tag: t.blockComment, color: c.comment, fontStyle: 'italic' },
    { tag: t.string, color: c.string },
    { tag: t.number, color: c.number },
    { tag: t.atom, color: c.atom, fontWeight: '600' },
    { tag: t.variableName, color: c.identifier },
    { tag: t.typeName, color: c.profile, fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: c.builtin, fontWeight: '500' },
    { tag: t.punctuation, color: c.punctuation },
    { tag: t.paren, color: c.paren0 },
    { tag: t.brace, color: c.paren0 }
  ]);
}

export const stEditorTheme = buildEditorTheme(darkColors, true);
export const stHighlightStyle = buildHighlightStyle(darkColors);

export const stEditorThemeLight = buildEditorTheme(lightColors, false);
export const stHighlightStyleLight = buildHighlightStyle(lightColors);

/**
 * Combined dark theme + syntax highlighting for ST (default).
 */
export function stTheme(): Extension[] {
  return [stEditorTheme, syntaxHighlighting(stHighlightStyle)];
}

/**
 * Combined light theme + syntax highlighting for ST.
 */
export function stLightTheme(): Extension[] {
  return [stEditorThemeLight, syntaxHighlighting(stHighlightStyleLight)];
}
