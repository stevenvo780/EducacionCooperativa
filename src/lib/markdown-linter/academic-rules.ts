/**
 * Reglas de escritura académica en español.
 *
 * Todas son funciones puras que operan a nivel de párrafo/línea.
 * Ninguna requiere estado de documento completo → supportsIncremental: true.
 */

import { type LinterRule, type LinterDiagnostic, getCodeBlockLines } from './types';

// ── Utilidades ───────────────────────────────────────────────

function skipLine(line: string): boolean {
  const t = line.trim();
  return /^[#\-*+>|]/.test(t) || t.startsWith('```') || t.startsWith('~~~');
}

// ═══════════════════════════════════════════════════════════
// 1. VOZ PASIVA EXCESIVA (español)
// ═══════════════════════════════════════════════════════════

export const passiveVoiceEsRule: LinterRule = {
  id: 'academic_passive_voice_es',
  name: 'Voz pasiva excesiva (español)',
  description: 'Detecta construcciones pasivas acumuladas. Prefiere la voz activa.',
  category: 'academic',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    // Pasiva perifrástica: fue/fueron/es/son + participio
    const perifrastica = /\b(fue|fueron|es|son|era|eran|ha sido|han sido|había sido|habían sido|será|serán|sería|serían)\s+\w+[ao]s?\b/gi;
    // Pasiva refleja: se + verbo conjugado
    const refleja = /\bse\s+(realiz[oó]|realiz[ae]n|llev[oó]\s+a\s+cabo|efectu[oó]|efectú[ae]n|implement[oó]|implement[ae]n|utiliz[oó]|utiliz[ae]n|observ[oó]|observ[ae]n|determin[oó]|determin[ae]n|obtuvo|obtienen|consid[ae]r[oó])\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      if (skipLine(line)) continue;

      const combined = new RegExp(
        `(${perifrastica.source}|${refleja.source})`,
        'gi'
      );
      let match;
      while ((match = combined.exec(line)) !== null) {
        results.push({
          message: `Construcción pasiva: "${match[0]}"`,
          suggestion: 'Considera reformular en voz activa para mayor claridad y precisión.',
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Academic'
        });
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 2. NOMINALIZACIONES (español)
// ═══════════════════════════════════════════════════════════

const NOMINALIZATIONS: Array<[string, string]> = [
  ['la realización de', 'realizar'],
  ['la implementación de', 'implementar'],
  ['el análisis de', 'analizar'],
  ['la evaluación de', 'evaluar'],
  ['el desarrollo de', 'desarrollar'],
  ['la utilización de', 'utilizar'],
  ['el establecimiento de', 'establecer'],
  ['la identificación de', 'identificar'],
  ['la determinación de', 'determinar'],
  ['la comprensión de', 'comprender'],
  ['la aplicación de', 'aplicar'],
  ['la elaboración de', 'elaborar'],
  ['la obtención de', 'obtener'],
  ['la generación de', 'generar'],
  ['la construcción de', 'construir'],
  ['la definición de', 'definir'],
  ['la presentación de', 'presentar'],
  ['la descripción de', 'describir'],
  ['la demostración de', 'demostrar'],
  ['la verificación de', 'verificar'],
  ['la validación de', 'validar'],
  ['la selección de', 'seleccionar'],
  ['la clasificación de', 'clasificar'],
  ['la comparación de', 'comparar'],
];

export const nominalizationEsRule: LinterRule = {
  id: 'academic_nominalization_es',
  name: 'Nominalizaciones (español)',
  description: 'Detecta construcciones nominales que pueden expresarse con verbos más directos.',
  category: 'academic',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      if (skipLine(line)) continue;

      for (const [phrase, suggestion] of NOMINALIZATIONS) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            message: `Nominalización: "${match[0]}"`,
            suggestion: `Considera usar el verbo directamente: "${suggestion}"`,
            severity: 'info',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Academic'
          });
        }
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 3. CUANTIFICADORES VAGOS (español)
// ═══════════════════════════════════════════════════════════

export const vagueQuantifierEsRule: LinterRule = {
  id: 'academic_vague_quantifier_es',
  name: 'Cuantificadores vagos',
  description: 'Detecta cuantificadores imprecisos como "varios", "muchos", "algunos".',
  category: 'academic',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const quantifierRegex = /\b(varios|varias|muchos|muchas|algunos|algunas|bastantes|pocos|pocas|ciertos|ciertas|numerosos|numerosas|diversas?|diferentes|multitud de|gran cantidad de|buen número de)\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      if (skipLine(line)) continue;

      let match;
      while ((match = quantifierRegex.exec(line)) !== null) {
        results.push({
          message: `Cuantificador vago: "${match[0]}"`,
          suggestion: 'Especifica la cantidad exacta o proporciona un referente verificable (ej: "17 casos", "el 43% de").',
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Academic'
        });
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 4. REDUNDANCIAS LÉXICAS (español)
// ═══════════════════════════════════════════════════════════

const REDUNDANCIES: Array<[string, string]> = [
  ['completamente terminado', 'terminado'],
  ['subir arriba', 'subir'],
  ['bajar abajo', 'bajar'],
  ['entrar adentro', 'entrar'],
  ['salir afuera', 'salir'],
  ['volver a repetir', 'repetir'],
  ['más óptimo', 'óptimo'],
  ['consenso de todos', 'consenso'],
  ['prever con anticipación', 'prever'],
  ['añadir además', 'añadir'],
  ['colaborar juntos', 'colaborar'],
  ['anticiparse por adelantado', 'anticiparse'],
  ['resultado final', 'resultado'],
  ['fecha límite final', 'fecha límite'],
  ['experiencia previa', 'experiencia'],
  ['planificar con antelación', 'planificar'],
  ['erradicar por completo', 'erradicar'],
  ['retroceder hacia atrás', 'retroceder'],
  ['cita textual literal', 'cita textual'],
];

export const lexicalRedundancyEsRule: LinterRule = {
  id: 'academic_lexical_redundancy_es',
  name: 'Redundancias léxicas',
  description: 'Detecta frases redundantes como "completamente terminado" o "subir arriba".',
  category: 'academic',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      if (skipLine(line)) continue;

      for (const [phrase, simplified] of REDUNDANCIES) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            message: `Redundancia léxica: "${match[0]}"`,
            suggestion: `Usa simplemente: "${simplified}"`,
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Academic',
            replacements: [simplified]
          });
        }
      }
    }
    return results;
  }
};

export const ALL_ACADEMIC_RULES: LinterRule[] = [
  passiveVoiceEsRule,
  nominalizationEsRule,
  vagueQuantifierEsRule,
  lexicalRedundancyEsRule
];
