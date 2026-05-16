export type AcademicSeverity = 'error' | 'warning' | 'info' | 'hint';

export type AcademicCategory =
  | 'fallacy'
  | 'circular'
  | 'vacuous'
  | 'hedging'
  | 'contradiction';

export interface AcademicDiagnostic {
  from: number;
  to: number;
  severity: AcademicSeverity;
  category: AcademicCategory;
  message: string;
  suggestion?: string;
}

export type LintLanguage = 'es' | 'en';

export interface CitationNode {
  id: string;
  cites: string[];
}

export interface LintOptions {
  citations?: CitationNode[];
  language?: LintLanguage;
  hedgingThreshold?: number;
}
