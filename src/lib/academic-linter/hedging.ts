import type { AcademicDiagnostic, LintLanguage } from './types';
import { splitParagraphs, splitSentences } from './text-utils';

const HEDGES_ES = [
  'quizás',
  'quizas',
  'tal vez',
  'podría',
  'podria',
  'podrían',
  'podrian',
  'posiblemente',
  'es posible',
  'se sugiere',
  'parece',
  'parecería',
  'pareceria',
  'aparentemente',
  'probablemente',
  'tal\\s+vez',
  'puede\\s+ser',
  'puede\\s+que',
  'al\\s+parecer',
  'en\\s+cierto\\s+modo'
];

const HEDGES_EN = [
  'perhaps',
  'maybe',
  'might',
  'could',
  'possibly',
  'it\\s+is\\s+possible',
  'it\\s+seems',
  'apparently',
  'probably',
  'somewhat',
  'arguably',
  'presumably',
  'it\\s+is\\s+suggested',
  'tends\\s+to'
];

function buildHedgeRegex(words: string[]): RegExp {
  const alt = words.map(w => `(?:${w})`).join('|');
  return new RegExp(`\\b(?:${alt})\\b`, 'gi');
}

const RE_ES = buildHedgeRegex(HEDGES_ES);
const RE_EN = buildHedgeRegex(HEDGES_EN);

export function detectHedging(
  text: string,
  lang: LintLanguage = 'es',
  threshold = 0.3
): AcademicDiagnostic[] {
  const re = lang === 'en' ? RE_EN : RE_ES;
  const out: AcademicDiagnostic[] = [];
  const paragraphs = splitParagraphs(text);

  for (const para of paragraphs) {
    const sentences = splitSentences(para.text, para.from);
    if (sentences.length === 0) continue;

    let hedgedCount = 0;
    for (const sentence of sentences) {
      re.lastIndex = 0;
      if (re.test(sentence.text)) {
        hedgedCount++;
      }
    }

    const ratio = hedgedCount / sentences.length;
    if (ratio > threshold && hedgedCount >= 2) {
      const pct = Math.round(ratio * 100);
      const thresholdPct = Math.round(threshold * 100);
      out.push({
        from: para.from,
        to: para.to,
        severity: 'info',
        category: 'hedging',
        message:
          lang === 'en'
            ? `Excessive hedging: ${hedgedCount}/${sentences.length} sentences (${pct}%) use hedging language, above the ${thresholdPct}% threshold.`
            : `Hedging excesivo: ${hedgedCount}/${sentences.length} oraciones (${pct}%) usan lenguaje atenuador, por encima del umbral ${thresholdPct}%.`,
        suggestion:
          lang === 'en'
            ? 'Replace tentative wording with concrete claims where the evidence supports it.'
            : 'Sustituye expresiones tentativas por afirmaciones concretas donde la evidencia lo permita.'
      });
    }
  }

  return out;
}
