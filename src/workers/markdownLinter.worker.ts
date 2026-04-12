import { BUILTIN_RULES_BY_ID } from '@/lib/markdown-linter/rules';
import type { LinterDiagnostic } from '@/lib/markdown-linter/types';
import { initSpellEngine, syncPersonalDictionary } from '@/lib/markdown-linter/spell-engine';

// Preload spell engine immediately — dictionaries (~850KB) start downloading
// as soon as the worker is created instead of waiting for the first lint request.
initSpellEngine().catch(() => { /* fail-open: dictionaries will retry on demand */ });

// ── Tipos de mensajes ────────────────────────────────────────

type LintRequestMessage = {
  type: 'lint';
  requestId: number;
  text: string;
  ruleIds: string[];
  personalDictionary: string[];
};

/**
 * Linting incremental: ejecuta reglas de párrafo solo en párrafos cambiados,
 * y reglas de documento completo sobre el texto completo.
 */
type LintIncrementalMessage = {
  type: 'lint-incremental';
  requestId: number;
  /** Párrafos que cambiaron — texto crudo del párrafo (sin offset). */
  changedParagraphs: Array<{ text: string; contentHash: string }>;
  /** IDs de reglas que soportan linting por párrafo (supportsIncremental !== false). */
  paragraphRuleIds: string[];
  /** Texto completo del documento — para reglas de documento completo. */
  fullText: string;
  /** IDs de reglas que necesitan el documento completo (supportsIncremental === false). */
  documentRuleIds: string[];
  personalDictionary: string[];
};

type LintResultMessage = {
  type: 'lint-result';
  requestId: number;
  diagnostics: LinterDiagnostic[];
};

type LintIncrementalResultMessage = {
  type: 'lint-incremental-result';
  requestId: number;
  /** Diagnósticos por párrafo con líneas relativas (1-based dentro del párrafo). */
  paragraphResults: Array<{ contentHash: string; diagnostics: LinterDiagnostic[] }>;
  /** Diagnósticos de reglas de documento completo con líneas absolutas. */
  documentDiagnostics: LinterDiagnostic[];
};

// ── Helpers ──────────────────────────────────────────────────

const sortDiagnostics = (diagnostics: LinterDiagnostic[]) =>
  diagnostics.sort((a, b) => a.line !== b.line ? a.line - b.line : a.column - b.column);

async function ensureSpellEngine(ruleIds: string[], personalDictionary: string[]) {
  syncPersonalDictionary(personalDictionary);
  if (ruleIds.some((id) => id.startsWith('spelling_'))) {
    try { await initSpellEngine(); } catch { /* fail-open */ }
  }
}

function runRulesOnText(text: string, ruleIds: string[]): LinterDiagnostic[] {
  const diagnostics: LinterDiagnostic[] = [];
  for (const ruleId of ruleIds) {
    const rule = BUILTIN_RULES_BY_ID.get(ruleId);
    if (rule) diagnostics.push(...rule.check(text));
  }
  return diagnostics;
}

// ── Handler principal ────────────────────────────────────────

self.onmessage = async (event: MessageEvent<LintRequestMessage | LintIncrementalMessage>) => {
  const message = event.data;
  if (!message) return;

  // ── Linting completo (comportamiento original) ───────────
  if (message.type === 'lint') {
    const { requestId, text, ruleIds, personalDictionary } = message;
    await ensureSpellEngine(ruleIds, personalDictionary);

    const response: LintResultMessage = {
      type: 'lint-result',
      requestId,
      diagnostics: sortDiagnostics(runRulesOnText(text, ruleIds))
    };
    self.postMessage(response);
    return;
  }

  // ── Linting incremental ──────────────────────────────────
  if (message.type === 'lint-incremental') {
    const {
      requestId,
      changedParagraphs,
      paragraphRuleIds,
      fullText,
      documentRuleIds,
      personalDictionary
    } = message;

    await ensureSpellEngine([...paragraphRuleIds, ...documentRuleIds], personalDictionary);

    // Ejecutar reglas de párrafo en cada párrafo cambiado.
    // Los diagnósticos se devuelven con líneas 1-based relativas al párrafo
    // para que el hook pueda cachearlos y ajustar el offset al recomponer.
    const paragraphResults = changedParagraphs.map(({ text, contentHash }) => ({
      contentHash,
      diagnostics: sortDiagnostics(runRulesOnText(text, paragraphRuleIds))
    }));

    // Ejecutar reglas de documento completo sobre el texto completo
    const documentDiagnostics = sortDiagnostics(runRulesOnText(fullText, documentRuleIds));

    const response: LintIncrementalResultMessage = {
      type: 'lint-incremental-result',
      requestId,
      paragraphResults,
      documentDiagnostics
    };
    self.postMessage(response);
  }
};
