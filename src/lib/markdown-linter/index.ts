/**
 * API pública del sistema de linting Markdown.
 */

export { type LinterSeverity, type LinterDiagnostic, type LinterRule, type LinterRuleMeta, type RuleCategory, RULE_CATEGORY_LABELS, getCodeBlockLines, escapeRegex } from './types';
export { ALL_BUILTIN_RULES } from './rules';
export { MarkdownLinterRegistry, type RuleState } from './registry';
export { addSuppression, removeSuppression, getSuppressions, clearAllSuppressions, isSuppressed, type LinterSuppression } from './suppressions';
