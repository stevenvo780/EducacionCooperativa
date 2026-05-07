import {
  completion as stCompletion,
  gotoDefinition as stGotoDefinition,
  hover as stHover,
  symbols as stSymbols,
  type CompletionItem as STCompletionItem,
  type HoverInfo as STHoverInfo,
  type SourceLocation,
  type SymbolInfo
} from '@/lib/st-api';
import {
  symbolsInWorker,
  hoverInWorker,
  gotoInWorker
} from '@/lib/st-runtime-worker-client';

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

let cachedSymbolHash: string | null = null;
let cachedSymbols: SymbolInfo[] = [];
let cachedStaticCompletions: STCompletionItem[] | null = null;

export function getSemanticSymbols(source: string): SymbolInfo[] {
  const hash = djb2(source);
  if (hash === cachedSymbolHash) return cachedSymbols;

  cachedSymbolHash = hash;
  try {
    cachedSymbols = stSymbols(source);
  } catch {
    cachedSymbols = [];
  }

  return cachedSymbols;
}

export async function getSemanticSymbolsAsync(source: string): Promise<SymbolInfo[]> {
  const hash = djb2(source);
  if (hash === cachedSymbolHash) return cachedSymbols;

  const result = await symbolsInWorker(source);
  if (djb2(source) === hash) {
    cachedSymbolHash = hash;
    cachedSymbols = result;
  }
  return result;
}

export function getSemanticHover(
  source: string,
  line: number,
  column: number,
  file?: string
): STHoverInfo | null {
  try {
    return stHover(source, line, column, file);
  } catch {
    return null;
  }
}

export function getSemanticHoverAsync(
  source: string,
  line: number,
  column: number,
  file?: string
): Promise<STHoverInfo | null> {
  return hoverInWorker(source, line, column, file);
}

export function getSemanticDefinition(
  source: string,
  name: string,
  file?: string
): SourceLocation | null {
  const exactMatch = getSemanticSymbols(source).find((symbol) => symbol.name === name);
  if (exactMatch?.location) return exactMatch.location;

  const suffixMatches = getSemanticSymbols(source).filter((symbol) => symbol.name.endsWith(`.${name}`));
  if (suffixMatches.length === 1 && suffixMatches[0]?.location) {
    return suffixMatches[0].location;
  }

  try {
    return stGotoDefinition(source, name, file) ?? null;
  } catch {
    return null;
  }
}

export async function getSemanticDefinitionAsync(
  source: string,
  name: string,
  file?: string
): Promise<SourceLocation | null> {
  const symbols = await getSemanticSymbolsAsync(source);
  const exactMatch = symbols.find((symbol) => symbol.name === name);
  if (exactMatch?.location) return exactMatch.location;

  const suffixMatches = symbols.filter((symbol) => symbol.name.endsWith(`.${name}`));
  if (suffixMatches.length === 1 && suffixMatches[0]?.location) {
    return suffixMatches[0].location;
  }

  return gotoInWorker(source, name, file);
}

export function getStaticSemanticCompletions(): STCompletionItem[] {
  if (cachedStaticCompletions) return cachedStaticCompletions;

  try {
    cachedStaticCompletions = stCompletion();
  } catch {
    cachedStaticCompletions = [];
  }

  return cachedStaticCompletions;
}
