import type { AcademicDiagnostic, LintLanguage } from './types';

interface FallacyPattern {
  id: string;
  regex: RegExp;
  message: string;
  suggestion?: string;
  severity?: 'warning' | 'info';
}

const PATTERNS_ES: FallacyPattern[] = [
  {
    id: 'affirming_consequent',
    regex: /si\s+[^.\n,;]{2,80}?\s+entonces\s+[^.\n,;]{2,80}?[.;]\s*[^.\n]{0,40}?[.;]\s*por\s+lo\s+tanto[^.\n]{2,80}?[.?!]/i,
    message: 'Posible falacia de afirmación del consecuente: de "si P entonces Q" y "Q" no se sigue "P".',
    suggestion: 'Verifica que el condicional se aplique en la dirección correcta.'
  },
  {
    id: 'denying_antecedent',
    regex: /si\s+[^.\n,;]{2,80}?\s+entonces\s+[^.\n,;]{2,80}?[.;]\s*no\s+[^.\n]{2,40}?[.;]\s*por\s+lo\s+tanto\s+no\s+[^.\n]{2,80}?[.?!]/i,
    message: 'Posible falacia de negación del antecedente: de "si P entonces Q" y "no P" no se sigue "no Q".',
    suggestion: 'Reformula sin negar el antecedente.'
  },
  {
    id: 'ad_hominem',
    regex: /\b(?:él|ella|este\s+autor|esa\s+persona|el\s+autor)\s+(?:es|son)\s+(?:un[ao]?\s+)?(?:idiota|tonto|ignorante|incompetente|hipócrita|fraude|estúpid[ao])\b/i,
    message: 'Posible ad hominem: se ataca a la persona en lugar del argumento.',
    suggestion: 'Critica la tesis o el método, no al autor.'
  },
  {
    id: 'false_dichotomy',
    regex: /\b(?:o\s+bien)\s+[^,.\n]{2,60}?\s+o\s+(?:bien\s+)?[^,.\n]{2,60}?[.,;]\s*no\s+hay\s+(?:más|otra)\s+(?:opci[oó]n|alternativa)/i,
    message: 'Posible falsa dicotomía: presenta solo dos opciones como exhaustivas.',
    suggestion: 'Considera si existen alternativas intermedias.'
  },
  {
    id: 'straw_man',
    regex: /\b(?:dice|afirma|sostiene|cree)\s+que\s+[^.\n]{4,120}?(?:absurdo|ridículo|imposible|disparate)\b/i,
    message: 'Posible hombre de paja: se atribuye al adversario una versión caricaturizada de su tesis.',
    suggestion: 'Cita textualmente la tesis original antes de criticarla.'
  }
];

const PATTERNS_EN: FallacyPattern[] = [
  {
    id: 'affirming_consequent',
    regex: /if\s+[^.\n,;]{2,80}?\s+then\s+[^.\n,;]{2,80}?[.;]\s*[^.\n]{0,40}?[.;]\s*therefore[^.\n]{2,80}?[.?!]/i,
    message: 'Possible affirming-the-consequent fallacy: from "if P then Q" and "Q", "P" does not follow.',
    suggestion: 'Check that the conditional applies in the correct direction.'
  },
  {
    id: 'denying_antecedent',
    regex: /if\s+[^.\n,;]{2,80}?\s+then\s+[^.\n,;]{2,80}?[.;]\s*not\s+[^.\n]{2,40}?[.;]\s*therefore\s+not\s+[^.\n]{2,80}?[.?!]/i,
    message: 'Possible denying-the-antecedent fallacy.',
    suggestion: 'Rephrase without negating the antecedent.'
  },
  {
    id: 'ad_hominem',
    regex: /\b(?:he|she|this\s+author|that\s+person|the\s+author)\s+is\s+(?:an?\s+)?(?:idiot|fool|ignorant|incompetent|hypocrite|fraud|stupid)\b/i,
    message: 'Possible ad hominem: attacks the person instead of the argument.',
    suggestion: 'Critique the thesis or method, not the author.'
  },
  {
    id: 'false_dichotomy',
    regex: /\beither\s+[^,.\n]{2,60}?\s+or\s+[^,.\n]{2,60}?[.,;]\s*there\s+is\s+no\s+(?:other|further)\s+(?:option|alternative)/i,
    message: 'Possible false dichotomy: only two options are presented as exhaustive.',
    suggestion: 'Consider whether there are intermediate alternatives.'
  },
  {
    id: 'straw_man',
    regex: /\b(?:says|claims|argues|believes)\s+that\s+[^.\n]{4,120}?(?:absurd|ridiculous|impossible|nonsense)\b/i,
    message: 'Possible straw man: the opponent is given a caricatured version of their thesis.',
    suggestion: 'Quote the original thesis verbatim before critiquing it.'
  }
];

export function detectFallacies(text: string, lang: LintLanguage = 'es'): AcademicDiagnostic[] {
  const patterns = lang === 'en' ? PATTERNS_EN : PATTERNS_ES;
  const out: AcademicDiagnostic[] = [];
  const seenRanges = new Set<string>();

  for (const pattern of patterns) {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : `${pattern.regex.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const from = match.index;
      const to = from + match[0].length;
      const key = `${pattern.id}:${from}:${to}`;
      if (seenRanges.has(key)) continue;
      seenRanges.add(key);
      const diag: AcademicDiagnostic = {
        from,
        to,
        severity: pattern.severity ?? 'warning',
        category: 'fallacy',
        message: pattern.message
      };
      if (pattern.suggestion !== undefined) diag.suggestion = pattern.suggestion;
      out.push(diag);
      if (re.lastIndex === match.index) re.lastIndex++;
    }
  }

  return out;
}
