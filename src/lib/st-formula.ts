import { formulaToString } from '@stevenvo780/st-lang';
import { parse, type Program, type Statement } from '@/lib/st-api';

const normalizeUnicodeFormulaSyntax = (value: string) => (
  value
    .replace(/□/g, '[]')
    .replace(/◇/g, '<>')
    .replace(/¬/g, '!')
    .replace(/∧/g, '&')
    .replace(/∨/g, '|')
    .replace(/→/g, '->')
    .replace(/↔/g, '<->')
    .replace(/∀\s*([A-Za-z_][A-Za-z0-9_]*)/g, 'forall $1')
    .replace(/∃\s*([A-Za-z_][A-Za-z0-9_]*)/g, 'exists $1')
);

const getClaimStatement = (program: Program | null): Statement | null => (
  program?.statements.find((statement) => statement.kind === 'claim_decl') ?? null
);

export const canonicalizeSTFormula = (formula: string, profile = 'classical.propositional') => {
  const normalized = normalizeUnicodeFormulaSyntax(formula.trim());
  if (!normalized) return '';

  try {
    const parsed = parse(`logic ${profile}\nclaim __canonical = (${normalized})`, '<formula>');
    const claim = getClaimStatement(parsed.program);
    if (parsed.ok && claim?.kind === 'claim_decl' && claim.formula) {
      return formulaToString(claim.formula);
    }
  } catch {
    // Fall back to normalized text below.
  }

  return normalized;
};

export const toClaimExpression = (formula: string) => `(${formula.trim()})`;
