/**
 * Lint extension para ST en CodeMirror 6.
 *
 * Recibe diagnósticos del componente padre (STRunner) y los convierte
 * en diagnósticos de CodeMirror para mostrar:
 * - Subrayado ondulado en el código
 * - Panel de lint (diagnostics gutter)
 * - Tooltips al hover sobre errores
 */

import { Diagnostic as CMDiagnostic, setDiagnostics, linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { Diagnostic as STDiagnostic } from '@stevenvo780/st-lang/api';

// ── Effect para actualizar diagnostics desde React ──────────

export const setSTDiagnostics = StateEffect.define<STDiagnostic[]>();

// ── StateField que guarda los diagnostics actuales ──────────

export const stDiagnosticsField = StateField.define<STDiagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSTDiagnostics)) {
        return effect.value;
      }
    }
    return value;
  }
});

// ── Convertir ST diagnostics → CM diagnostics ──────────────

function stToCMSeverity(severity: string): 'error' | 'warning' | 'info' {
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function convertDiagnostics(doc: { toString: () => string; line: (n: number) => { from: number; to: number } }, diags: STDiagnostic[]): CMDiagnostic[] {
  const text = doc.toString();
  const cmDiags: CMDiagnostic[] = [];

  for (const d of diags) {
    const lineNum = Math.max(1, Math.min(d.line ?? 1, text.split('\n').length));
    try {
      const line = doc.line(lineNum);
      const from = line.from;
      const to = line.to;

      cmDiags.push({
        from,
        to,
        severity: stToCMSeverity(d.severity),
        message: d.message,
        source: 'st-lang'
      });
    } catch {
      // line out of range — skip
    }
  }

  return cmDiags;
}

// ── Linter source que lee del field ─────────────────────────

function stLintSource(view: EditorView): CMDiagnostic[] {
  const stDiags = view.state.field(stDiagnosticsField);
  return convertDiagnostics(view.state.doc, stDiags);
}

// ── Export ───────────────────────────────────────────────────

/**
 * Extensiones de lint para ST.
 * Incluye el field para almacenar diagnostics, el linter, y el gutter.
 */
export function stLintExtensions() {
  return [
    stDiagnosticsField,
    linter(stLintSource, { delay: 0 }),
    lintGutter()
  ];
}

/**
 * Helper para dispatchar nuevos diagnostics a la vista CM.
 */
export function dispatchDiagnostics(view: EditorView, diagnostics: STDiagnostic[]) {
  view.dispatch({
    effects: setSTDiagnostics.of(diagnostics)
  });
}
