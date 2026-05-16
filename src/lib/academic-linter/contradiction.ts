import type { AcademicDiagnostic, LintLanguage } from './types';
import { splitSentences, normalizeClaim } from './text-utils';

interface NegationPattern {
  prefix: RegExp;
  strip: (sentence: string) => string;
}

const ES_PATTERNS: NegationPattern[] = [
  {
    prefix: /^\s*no\s+es\s+cierto\s+que\s+/i,
    strip: s => s.replace(/^\s*no\s+es\s+cierto\s+que\s+/i, '')
  },
  {
    prefix: /^\s*no\s+es\s+(?:verdad|verdadero)\s+que\s+/i,
    strip: s => s.replace(/^\s*no\s+es\s+(?:verdad|verdadero)\s+que\s+/i, '')
  },
  {
    prefix: /\bno\s+/i,
    strip: s => s.replace(/\bno\s+/i, '')
  }
];

const EN_PATTERNS: NegationPattern[] = [
  {
    prefix: /^\s*it\s+is\s+not\s+(?:true|the\s+case)\s+that\s+/i,
    strip: s => s.replace(/^\s*it\s+is\s+not\s+(?:true|the\s+case)\s+that\s+/i, '')
  },
  {
    prefix: /\bdoes\s+not\s+/i,
    strip: s => s.replace(/\bdoes\s+not\s+/i, '')
  },
  {
    prefix: /\bdo\s+not\s+/i,
    strip: s => s.replace(/\bdo\s+not\s+/i, '')
  },
  {
    prefix: /\bis\s+not\s+/i,
    strip: s => s.replace(/\bis\s+not\s+/i, 'is ')
  },
  {
    prefix: /\bare\s+not\s+/i,
    strip: s => s.replace(/\bare\s+not\s+/i, 'are ')
  },
  {
    prefix: /\bnot\s+/i,
    strip: s => s.replace(/\bnot\s+/i, '')
  }
];

interface ClaimRecord {
  span: { from: number; to: number };
  raw: string;
  positive: string;
  isNegation: boolean;
}

function shortKey(claim: string): string {
  return normalizeClaim(claim).split(/\s+/).slice(0, 6).join(' ');
}

export function detectContradictions(
  text: string,
  lang: LintLanguage = 'es'
): AcademicDiagnostic[] {
  const patterns = lang === 'en' ? EN_PATTERNS : ES_PATTERNS;
  const sentences = splitSentences(text);
  if (sentences.length < 2) return [];

  const claims: ClaimRecord[] = [];
  for (const s of sentences) {
    const normalized = normalizeClaim(s.text);
    if (normalized.length < 3) continue;

    let positive = normalized;
    let isNegation = false;
    for (const p of patterns) {
      if (p.prefix.test(s.text)) {
        positive = normalizeClaim(p.strip(s.text));
        isNegation = true;
        break;
      }
    }

    if (positive.length < 3) continue;
    claims.push({
      span: { from: s.from, to: s.to },
      raw: s.text,
      positive,
      isNegation
    });
  }

  const out: AcademicDiagnostic[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];
      if (!a || !b) continue;
      if (a.isNegation === b.isNegation) continue;

      const keyA = shortKey(a.positive);
      const keyB = shortKey(b.positive);
      if (keyA.length === 0 || keyB.length === 0) continue;
      if (keyA !== keyB) continue;

      const pairKey = `${Math.min(a.span.from, b.span.from)}:${Math.max(a.span.to, b.span.to)}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const negative = a.isNegation ? a : b;
      const positive = a.isNegation ? b : a;

      const from = Math.min(positive.span.from, negative.span.from);
      const to = Math.max(positive.span.to, negative.span.to);

      out.push({
        from,
        to,
        severity: 'error',
        category: 'contradiction',
        message:
          lang === 'en'
            ? `Literal contradiction between "${positive.raw}" and "${negative.raw}".`
            : `Contradicción literal entre "${positive.raw}" y "${negative.raw}".`,
        suggestion:
          lang === 'en'
            ? 'Resolve the contradiction or explicitly distinguish the contexts of each claim.'
            : 'Resuelve la contradicción o distingue explícitamente los contextos de cada afirmación.'
      });
    }
  }

  return out;
}
