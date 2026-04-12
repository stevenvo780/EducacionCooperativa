import type { LinterSeverity } from '@/lib/markdown-linter/types';

type PrioritizedDiagnostic = {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: LinterSeverity | string;
  source?: string | null;
  text?: string;
};

function getSeverityWeight(severity: PrioritizedDiagnostic['severity']) {
  switch (severity) {
    case 'error':
      return 300;
    case 'warning':
      return 200;
    case 'info':
      return 100;
    default:
      return 0;
  }
}

export function getDiagnosticPriority(diagnostic: PrioritizedDiagnostic) {
  let priority = getSeverityWeight(diagnostic.severity);

  if (diagnostic.source === 'Nota') {
    priority -= 5;
  }

  if (diagnostic.source === 'ST-Definitions') {
    priority -= 20;
  }

  return priority;
}

export function compareDiagnosticsForSharedRange(
  left: PrioritizedDiagnostic,
  right: PrioritizedDiagnostic
) {
  const leftLine = left.line ?? 1;
  const rightLine = right.line ?? 1;
  if (leftLine !== rightLine) return leftLine - rightLine;

  const leftColumn = left.column ?? 1;
  const rightColumn = right.column ?? 1;
  if (leftColumn !== rightColumn) return leftColumn - rightColumn;

  return getDiagnosticPriority(right) - getDiagnosticPriority(left);
}

export function compareDiagnosticsForOverlay(
  left: PrioritizedDiagnostic,
  right: PrioritizedDiagnostic
) {
  const leftLine = left.line ?? 1;
  const rightLine = right.line ?? 1;
  if (leftLine !== rightLine) return leftLine - rightLine;

  const leftColumn = left.column ?? 1;
  const rightColumn = right.column ?? 1;
  if (leftColumn !== rightColumn) return leftColumn - rightColumn;

  return getDiagnosticPriority(left) - getDiagnosticPriority(right);
}

export function compareDiagnosticsByPriority(
  left: PrioritizedDiagnostic,
  right: PrioritizedDiagnostic
) {
  return getDiagnosticPriority(right) - getDiagnosticPriority(left);
}

export function getDiagnosticRangeKey(diagnostic: PrioritizedDiagnostic) {
  const line = diagnostic.line ?? 1;
  const column = diagnostic.column ?? 1;
  const endLine = diagnostic.endLine ?? line;
  const endColumn = diagnostic.endColumn ?? column;
  const text = diagnostic.text ?? '';

  return `${line}:${column}:${endLine}:${endColumn}:${text}`;
}
