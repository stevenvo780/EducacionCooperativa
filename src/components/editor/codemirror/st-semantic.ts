import {
  completion as stCompletion,
  gotoDefinition as stGotoDefinition,
  hover as stHover,
  symbols as stSymbols,
  type CompletionItem as STCompletionItem,
  type HoverInfo as STHoverInfo,
  type SourceLocation,
  type SymbolInfo
} from '@stevenvo780/st-lang/api';

let cachedSymbolSource: string | null = null;
let cachedSymbols: SymbolInfo[] = [];
let cachedStaticCompletions: STCompletionItem[] | null = null;

export function getSemanticSymbols(source: string): SymbolInfo[] {
  if (source === cachedSymbolSource) return cachedSymbols;

  cachedSymbolSource = source;
  try {
    cachedSymbols = stSymbols(source);
  } catch {
    cachedSymbols = [];
  }

  return cachedSymbols;
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

export function getSemanticDefinition(
  source: string,
  name: string,
  file?: string
): SourceLocation | null {
  const exactMatch = getSemanticSymbols(source).find((symbol) => symbol.name === name);
  if (exactMatch?.location) return exactMatch.location;

  const suffixMatches = getSemanticSymbols(source).filter((symbol) => symbol.name.endsWith(`.${name}`));
  if (suffixMatches.length === 1 && suffixMatches[0].location) {
    return suffixMatches[0].location;
  }

  try {
    return stGotoDefinition(source, name, file) ?? null;
  } catch {
    return null;
  }
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
