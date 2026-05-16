import type { AcademicDiagnostic, LintOptions } from './types';
import { detectFallacies } from './fallacies';
import { detectCircularReasoning } from './circular';
import { detectVacuousClaims } from './vacuous';
import { detectHedging } from './hedging';
import { detectContradictions } from './contradiction';

export type {
  AcademicDiagnostic,
  AcademicCategory,
  AcademicSeverity,
  CitationNode,
  LintLanguage,
  LintOptions
} from './types';

export {
  detectFallacies,
  detectCircularReasoning,
  detectVacuousClaims,
  detectHedging,
  detectContradictions
};

export function lintAcademic(
  text: string,
  opts: LintOptions = {}
): AcademicDiagnostic[] {
  const lang = opts.language ?? 'es';
  const threshold = opts.hedgingThreshold ?? 0.3;

  const diagnostics: AcademicDiagnostic[] = [
    ...detectFallacies(text, lang),
    ...detectVacuousClaims(text, lang),
    ...detectHedging(text, lang, threshold),
    ...detectContradictions(text, lang),
    ...detectCircularReasoning(opts.citations)
  ];

  diagnostics.sort((a, b) => a.from - b.from || a.to - b.to);
  return diagnostics;
}
