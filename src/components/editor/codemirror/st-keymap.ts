/**
 * Keybindings personalizados para el editor ST en CodeMirror 6.
 *
 * Combina los keymaps estándar de CodeMirror con atajos específicos de ST.
 */

import { keymap, KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
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

// ── All keymaps combined ────────────────────────────────────

/**
 * Todas las extensiones de keymap para el editor ST.
 */
export function stKeymap(onRun?: () => void, onSave?: () => void) {
  return [
    keymap.of([
      ...stKeybindings(onRun, onSave),
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
