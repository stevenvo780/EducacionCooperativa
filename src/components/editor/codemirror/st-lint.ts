/**
 * Lint extension para ST en CodeMirror 6.
 *
 * Recibe diagnósticos del componente padre (STRunner) y los convierte
 * en diagnósticos de CodeMirror para mostrar:
 * - Subrayado ondulado en el código
 * - Panel de lint (diagnostics gutter)
 * - Tooltips al hover sobre errores
 */

import { Diagnostic as CMDiagnostic, setDiagnostics, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import type { Diagnostic as STDiagnostic } from '@stevenvo780/st-lang/api';

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
      cmDiags.push({
        from: line.from,
        to: line.to,
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

// ── Export ───────────────────────────────────────────────────

/**
 * Extensiones de lint para ST.
 * Solo el lintGutter (marcadores visuales en el margen).
 * Los diagnósticos se empujan directamente via dispatchDiagnostics().
 */
export function stLintExtensions() {
  return [
    lintGutter()
  ];
}

/**
 * Empuja diagnósticos directamente al state de CodeMirror.
 * Usa setDiagnostics (push inmediato) en vez de linter() (polling),
 * para que los problemas aparezcan al instante sin desfase de 1 tecla.
 */
export function dispatchDiagnostics(view: EditorView, diagnostics: STDiagnostic[]) {
  const cmDiags = convertDiagnostics(view.state.doc, diagnostics);
  view.dispatch(setDiagnostics(view.state, cmDiags));
}
