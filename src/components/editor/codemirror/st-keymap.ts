/**
 * Keybindings personalizados para el editor ST en CodeMirror 6.
 *
 * Combina los keymaps estándar de CodeMirror con atajos específicos de ST,
 * incluyendo: Ctrl+/ (comentar), Ctrl+D (duplicar), Ctrl+Shift+K (borrar línea),
 * Alt+↑/↓ (mover línea), Ctrl+G (ir a línea).
 */

import { keymap, KeyBinding } from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  toggleComment,
  toggleBlockComment,
  copyLineUp,
  copyLineDown,
  moveLineUp,
  moveLineDown,
  deleteLine,
  selectLine,
  indentMore,
  indentLess,
  cursorMatchingBracket
} from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, gotoLine } from '@codemirror/search';
import { completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';

// ── Custom ST keybindings ───────────────────────────────────

/**
 * Crea keybindings personalizados para ST.
 * @param onRun   Callback para ejecutar código (Ctrl+Enter)
 * @param onSave  Callback para guardar (Ctrl+S), si aplica
 */
export function stKeybindings(
  onRun?: () => void,
  onSave?: () => void,
): KeyBinding[] {
  const bindings: KeyBinding[] = [];

  if (onRun) {
    bindings.push({
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run: () => { onRun(); return true; },
      preventDefault: true
    });
  }

  if (onSave) {
    bindings.push({
      key: 'Ctrl-s',
      mac: 'Cmd-s',
      run: () => { onSave(); return true; },
      preventDefault: true
    });
  }

  return bindings;
}

// ── Extended keybindings (editor roadmap 1.2) ───────────────

const extendedKeymap: KeyBinding[] = [
  // Comentar/descomentar
  { key: 'Ctrl-/', mac: 'Cmd-/', run: toggleComment, preventDefault: true },
  { key: 'Ctrl-Shift-/', mac: 'Cmd-Shift-/', run: toggleBlockComment, preventDefault: true },

  // Mover línea arriba/abajo
  { key: 'Alt-ArrowUp', run: moveLineUp, preventDefault: true },
  { key: 'Alt-ArrowDown', run: moveLineDown, preventDefault: true },

  // Copiar/duplicar línea
  { key: 'Ctrl-d', mac: 'Cmd-d', run: copyLineDown, preventDefault: true },
  { key: 'Shift-Alt-ArrowUp', run: copyLineUp, preventDefault: true },
  { key: 'Shift-Alt-ArrowDown', run: copyLineDown, preventDefault: true },

  // Eliminar línea
  { key: 'Ctrl-Shift-k', mac: 'Cmd-Shift-k', run: deleteLine, preventDefault: true },

  // Seleccionar línea
  { key: 'Ctrl-l', mac: 'Cmd-l', run: selectLine, preventDefault: true },

  // Ir a línea
  { key: 'Ctrl-g', mac: 'Cmd-g', run: gotoLine, preventDefault: true },

  // Indentar / desindentar
  { key: 'Ctrl-]', mac: 'Cmd-]', run: indentMore, preventDefault: true },
  { key: 'Ctrl-[', mac: 'Cmd-[', run: indentLess, preventDefault: true },

  // Ir a paréntesis opuesto
  { key: 'Ctrl-Shift-\\', run: cursorMatchingBracket, preventDefault: true }
];

// ── All keymaps combined ────────────────────────────────────

/**
 * Todas las extensiones de keymap para el editor ST.
 */
export function stKeymap(onRun?: () => void, onSave?: () => void) {
  return [
    keymap.of([
      ...stKeybindings(onRun, onSave),
      ...extendedKeymap,
      indentWithTab,
      ...completionKeymap,
      ...lintKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...defaultKeymap
    ]),
    history(),
    highlightSelectionMatches()
  ];
}
