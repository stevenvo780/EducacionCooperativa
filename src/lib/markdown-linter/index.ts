/**
 * API pública del sistema de linting Markdown.
 */

export { type LinterSeverity, type LinterDiagnostic, type LinterRule, type LinterRuleMeta, type RuleCategory, RULE_CATEGORY_LABELS, RULE_CATEGORY_ICONS, getCodeBlockLines, escapeRegex } from './types';
export { ALL_BUILTIN_RULES } from './rules';
export { MarkdownLinterRegistry, type RuleState } from './registry';
