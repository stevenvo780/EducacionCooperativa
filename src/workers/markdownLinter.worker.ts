import { BUILTIN_RULES_BY_ID } from '@/lib/markdown-linter/rules';
import type { LinterDiagnostic } from '@/lib/markdown-linter/types';
import { initSpellEngine, syncPersonalDictionary } from '@/lib/markdown-linter/spell-engine';

type LintRequestMessage = {
  type: 'lint';
  requestId: number;
  text: string;
  ruleIds: string[];
  personalDictionary: string[];
};

type LintResultMessage = {
  type: 'lint-result';
  requestId: number;
  diagnostics: LinterDiagnostic[];
};

const sortDiagnostics = (diagnostics: LinterDiagnostic[]) => diagnostics.sort((left, right) => {
  if (left.line !== right.line) return left.line - right.line;
  return left.column - right.column;
});

self.onmessage = async (event: MessageEvent<LintRequestMessage>) => {
  const message = event.data;
  if (!message || message.type !== 'lint') return;

  const { requestId, text, ruleIds, personalDictionary } = message;

  syncPersonalDictionary(personalDictionary);

  if (ruleIds.some((ruleId) => ruleId.startsWith('spelling_'))) {
    try {
      await initSpellEngine();
    } catch {
    }
  }

  const diagnostics: LinterDiagnostic[] = [];
  for (const ruleId of ruleIds) {
    const rule = BUILTIN_RULES_BY_ID.get(ruleId);
    if (!rule) continue;
    diagnostics.push(...rule.check(text));
  }

  const response: LintResultMessage = {
    type: 'lint-result',
    requestId,
    diagnostics: sortDiagnostics(diagnostics)
  };

  self.postMessage(response);
};