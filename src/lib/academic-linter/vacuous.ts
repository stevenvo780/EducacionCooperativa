import type { AcademicDiagnostic, LintLanguage } from './types';
import { splitParagraphs, hasCitation } from './text-utils';

const PATTERNS_ES: RegExp[] = [
  /\bes\s+bien\s+sabido\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\bse\s+ha\s+demostrado\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\best[aá]\s+demostrado\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\bestudios\s+(?:recientes\s+)?(?:demuestran|muestran|prueban)\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\bes\s+evidente\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\bnadie\s+(?:duda|niega)\s+que\b[^.\n!?]{4,200}[.!?]/gi,
  /\btodos\s+sabemos\s+que\b[^.\n!?]{4,200}[.!?]/gi
];

const PATTERNS_EN: RegExp[] = [
  /\bit\s+is\s+well\s+known\s+that\b[^.\n!?]{4,200}[.!?]/gi,
  /\bit\s+has\s+been\s+(?:proven|shown|demonstrated)\s+that\b[^.\n!?]{4,200}[.!?]/gi,
  /\b(?:recent\s+)?studies\s+(?:show|prove|demonstrate)\s+that\b[^.\n!?]{4,200}[.!?]/gi,
  /\bit\s+is\s+(?:obvious|evident|clear)\s+that\b[^.\n!?]{4,200}[.!?]/gi,
  /\beveryone\s+knows\s+that\b[^.\n!?]{4,200}[.!?]/gi,
  /\bno\s+one\s+(?:doubts|denies)\s+that\b[^.\n!?]{4,200}[.!?]/gi
];

export function detectVacuousClaims(
  text: string,
  lang: LintLanguage = 'es'
): AcademicDiagnostic[] {
  const patterns = lang === 'en' ? PATTERNS_EN : PATTERNS_ES;
  const out: AcademicDiagnostic[] = [];
  const paragraphs = splitParagraphs(text);

  for (const para of paragraphs) {
    if (hasCitation(para.text)) continue;

    for (const basePattern of patterns) {
      const re = new RegExp(basePattern.source, basePattern.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(para.text)) !== null) {
        const from = para.from + match.index;
        const to = from + match[0].length;
        out.push({
          from,
          to,
          severity: 'warning',
          category: 'vacuous',
          message:
            lang === 'en'
              ? 'Vacuous claim: assertion without citation in this paragraph.'
              : 'Afirmación vacía: aseveración sin cita en este párrafo.',
          suggestion:
            lang === 'en'
              ? 'Add a citation supporting this claim or rephrase as a tentative hypothesis.'
              : 'Añade una cita que respalde esta afirmación o reformúlala como hipótesis tentativa.'
        });
        if (re.lastIndex === match.index) re.lastIndex++;
      }
    }
  }

  return out;
}
