import type { ProofStep, Formula, Valuation } from '@stevenvo780/st-lang';

export interface DebugSnapshot {
  step: number;
  formula: string;
  justification: string;
  premises: number[];
  source?: string;
  result?: string;
  assignments?: Valuation;
}

export interface DebugExample {
  id: string;
  name: string;
  description: string;
  profile: string;
  snapshots: DebugSnapshot[];
}

export function proofStepToSnapshot(ps: ProofStep, result?: string): DebugSnapshot {
  return {
    step: ps.stepNumber,
    formula: formulaToStr(ps.formula),
    justification: ps.justification,
    premises: ps.premises,
    source: ps.source,
    result
  };
}

function formulaToStr(f: Formula): string {
  if (!f) return '';
  switch (f.kind) {
    case 'atom': return f.name ?? '?';
    case 'true': return '⊤';
    case 'false': return '⊥';
    case 'not': return `¬${wrap(f.args?.[0])}`;
    case 'and': return (f.args ?? []).map(wrap).join(' ∧ ');
    case 'or': return (f.args ?? []).map(wrap).join(' ∨ ');
    case 'implies': return `${wrap(f.args?.[0])} → ${wrap(f.args?.[1])}`;
    case 'biconditional': return `${wrap(f.args?.[0])} ↔ ${wrap(f.args?.[1])}`;
    case 'forall': return `∀${f.variable ?? '_'}. ${wrap(f.args?.[0])}`;
    case 'exists': return `∃${f.variable ?? '_'}. ${wrap(f.args?.[0])}`;
    case 'predicate': return `${f.name ?? '?'}(${(f.terms ?? []).join(', ')})`;
    case 'equals': return `${wrap(f.args?.[0])} = ${wrap(f.args?.[1])}`;
    case 'modal_necessity': return `□${wrap(f.args?.[0])}`;
    case 'modal_possibility': return `◇${wrap(f.args?.[0])}`;
    case 'nand': return `${wrap(f.args?.[0])} ↑ ${wrap(f.args?.[1])}`;
    case 'nor': return `${wrap(f.args?.[0])} ↓ ${wrap(f.args?.[1])}`;
    case 'xor': return `${wrap(f.args?.[0])} ⊕ ${wrap(f.args?.[1])}`;
    case 'number': return String(f.value ?? 0);
    default: return f.name ?? f.kind;
  }
}

function wrap(f?: Formula): string {
  if (!f) return '?';
  const s = formulaToStr(f);
  const compound = ['and', 'or', 'implies', 'biconditional', 'nand', 'nor', 'xor'];
  return compound.includes(f.kind) ? `(${s})` : s;
}
