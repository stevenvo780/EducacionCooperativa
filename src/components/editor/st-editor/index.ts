export { highlightCode, escapeHtml, tokenizeLine, getTokenAtPosition, extractDynamicCompletions, KEYWORDS, BUILTINS, PROFILES } from './tokenizer';
export type { TokenCategory, HighlightToken, CompletionItem, TokenAtPosition } from './tokenizer';
export { getHoverInfo } from './hover-info';
export type { HoverData } from './hover-info';
export { ST_SNIPPETS, snippetsToCompletionItems } from './snippets';
export type { Snippet } from './snippets';
export {
  handleDuplicateLine,
  handleToggleComment,
  handleMoveLine,
  handleDeleteLine,
  handleIndent,
  handleSmartNewline,
  handleAutoClose,
  handleBackspacePair,
  findMatchingBracket
} from './keybindings';
export type { BracketMatch } from './keybindings';
