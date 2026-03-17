/**
 * Barrel exports para todas las extensiones CodeMirror del lenguaje ST.
 */

export { stLanguageSupport } from './st-language';
export { stTheme, stLightTheme, stEditorTheme, stHighlightStyle, stEditorThemeLight, stHighlightStyleLight } from './st-theme';
export { stAutocompletion } from './st-autocomplete';
export { stLintExtensions, dispatchDiagnostics } from './st-lint';
export { stHoverTooltip } from './st-hover';
export { stKeymap } from './st-keymap';
export { stRainbowParens } from './st-rainbow-parens';
export { stGotoDef } from './st-goto-def';
export {
  type EditorFeature,
  type EditorConfig,
  type EditorCompartments,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  createCompartments,
  buildCompartmentExtensions,
  reconfigureFeature,
  FEATURE_LABELS,
  ALL_FEATURES
} from './st-editor-config';
