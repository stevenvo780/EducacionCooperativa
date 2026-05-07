/**
 * Configuración dinámica del editor ST con Compartments de CM6.
 *
 * Cada feature togglable vive en su propio Compartment para poder
 * habilitarla/deshabilitarla en caliente sin recrear el EditorView.
 */

import { Compartment, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { bracketMatching, foldGutter } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { showMinimap } from '@replit/codemirror-minimap';

import { stAutocompletion } from './st-autocomplete';
import { stLintExtensions } from './st-lint';
import { stHoverTooltip } from './st-hover';
import { stRainbowParens } from './st-rainbow-parens';
import { stTheme, stLightTheme } from './st-theme';
import { stGotoDef } from './st-goto-def';
import { isTouchDeviceProfile } from '@/lib/device-input';

export { isTouchDeviceProfile };

export type EditorFeature =
  | 'minimap'
  | 'lineNumbers'
  | 'activeLine'
  | 'lineWrapping'
  | 'bracketMatching'
  | 'closeBrackets'
  | 'foldGutter'
  | 'rainbowParens'
  | 'autocomplete'
  | 'lint'
  | 'hover'
  | 'lightTheme'
  | 'gotoDef';

export interface EditorConfig {
  minimap: boolean;
  lineNumbers: boolean;
  activeLine: boolean;
  lineWrapping: boolean;
  bracketMatching: boolean;
  closeBrackets: boolean;
  foldGutter: boolean;
  rainbowParens: boolean;
  autocomplete: boolean;
  lint: boolean;
  hover: boolean;
  lightTheme: boolean;
  /**
   * Ctrl+Click / F12 go-to-definition + ctrl-hover underline plugin.
   * En tablet/touch dispara findDefinitions() en cada keystroke por el
   * ViewPlugin update — apagado por default en touch.
   */
  gotoDef: boolean;
}

const STORAGE_KEY = 'st-editor-config';

export const DEFAULT_CONFIG: EditorConfig = {
  minimap: false,
  lineNumbers: true,
  activeLine: true,
  lineWrapping: false,
  bracketMatching: true,
  closeBrackets: true,
  foldGutter: true,
  rainbowParens: true,
  autocomplete: true,
  lint: true,
  hover: true,
  lightTheme: false,
  gotoDef: true
};

export const TOUCH_DEVICE_CONFIG: EditorConfig = {
  ...DEFAULT_CONFIG,
  lineNumbers: false,
  activeLine: false,
  bracketMatching: false,
  foldGutter: false,
  rainbowParens: false,
  autocomplete: false,
  lint: false,
  hover: false,
  gotoDef: false
};

export const ST_NATIVE_INPUT_ATTRIBUTES: Readonly<Record<string, string>> = {
  spellcheck: 'false',
  autocorrect: 'off',
  autocapitalize: 'off',
  autocomplete: 'off',
  translate: 'no',
  'data-enable-grammarly': 'false',
  'data-gramm': 'false'
};

export function getDefaultConfig(): EditorConfig {
  return isTouchDeviceProfile() ? TOUCH_DEVICE_CONFIG : DEFAULT_CONFIG;
}

export function loadConfig(): EditorConfig {
  const baseConfig = getDefaultConfig();
  if (typeof window === 'undefined') return baseConfig;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return baseConfig;
    const parsed = JSON.parse(raw) as Partial<EditorConfig>;
    // En touch devices: NUNCA permitir que localStorage (heredado de desktop)
    // active features pesadas que crashean tablets. lint/hover/autocomplete +
    // foldGutter/rainbowParens son forzados al valor base TOUCH_DEVICE_CONFIG.
    // Crash repro histórico: abrir un .st grande en iPad colgaba el browser
    // por lint corriendo el parser ST en cada keystroke.
    if (isTouchDeviceProfile()) {
      const safeKeys: ReadonlyArray<keyof EditorConfig> = ['lint', 'hover', 'autocomplete', 'foldGutter', 'rainbowParens', 'bracketMatching', 'minimap', 'gotoDef'];
      const merged = { ...baseConfig, ...parsed };
      for (const k of safeKeys) {
        merged[k] = baseConfig[k];
      }
      return merged;
    }
    return { ...baseConfig, ...parsed };
  } catch {
    return baseConfig;
  }
}

export function saveConfig(config: EditorConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export interface EditorCompartments {
  minimap: Compartment;
  lineNumbers: Compartment;
  activeLine: Compartment;
  lineWrapping: Compartment;
  bracketMatching: Compartment;
  closeBrackets: Compartment;
  foldGutter: Compartment;
  rainbowParens: Compartment;
  autocomplete: Compartment;
  lint: Compartment;
  hover: Compartment;
  lightTheme: Compartment;
  gotoDef: Compartment;
}

export function createCompartments(): EditorCompartments {
  return {
    minimap: new Compartment(),
    lineNumbers: new Compartment(),
    activeLine: new Compartment(),
    lineWrapping: new Compartment(),
    bracketMatching: new Compartment(),
    closeBrackets: new Compartment(),
    foldGutter: new Compartment(),
    rainbowParens: new Compartment(),
    autocomplete: new Compartment(),
    lint: new Compartment(),
    hover: new Compartment(),
    lightTheme: new Compartment(),
    gotoDef: new Compartment()
  };
}

function minimapExtension(enabled: boolean): Extension {
  if (!enabled) return [];
  return showMinimap.of({
    create: () => ({ dom: document.createElement('div') }),
    displayText: 'blocks',
    showOverlay: 'always'
  });
}

function lineNumbersExtension(enabled: boolean): Extension {
  return enabled ? [lineNumbers(), highlightActiveLineGutter()] : [];
}

function activeLineExtension(enabled: boolean): Extension {
  return enabled ? highlightActiveLine() : [];
}

function lineWrappingExtension(enabled: boolean): Extension {
  return enabled ? EditorView.lineWrapping : [];
}

export function stInputGuardsExtension(): Extension {
  return EditorView.contentAttributes.of(ST_NATIVE_INPUT_ATTRIBUTES);
}

function bracketMatchingExtension(enabled: boolean): Extension {
  return enabled ? bracketMatching() : [];
}

function closeBracketsExtension(enabled: boolean): Extension {
  return enabled ? closeBrackets() : [];
}

function foldGutterExtension(enabled: boolean): Extension {
  return enabled ? foldGutter() : [];
}

function rainbowParensExtension(enabled: boolean): Extension {
  return enabled ? stRainbowParens() : [];
}

function autocompleteExtension(enabled: boolean): Extension {
  return enabled ? stAutocompletion() : [];
}

function lintExtension(enabled: boolean): Extension {
  return enabled ? stLintExtensions() : [];
}

function hoverExtension(enabled: boolean): Extension {
  return enabled ? stHoverTooltip() : [];
}

function lightThemeExtension(enabled: boolean): Extension {
  return enabled ? stLightTheme() : stTheme();
}

function gotoDefExtension(enabled: boolean): Extension {
  return enabled ? stGotoDef() : [];
}

export function buildCompartmentExtensions(
  compartments: EditorCompartments,
  config: EditorConfig
): Extension[] {
  return [
    compartments.minimap.of(minimapExtension(config.minimap)),
    compartments.lineNumbers.of(lineNumbersExtension(config.lineNumbers)),
    compartments.activeLine.of(activeLineExtension(config.activeLine)),
    compartments.lineWrapping.of(lineWrappingExtension(config.lineWrapping)),
    compartments.bracketMatching.of(bracketMatchingExtension(config.bracketMatching)),
    compartments.closeBrackets.of(closeBracketsExtension(config.closeBrackets)),
    compartments.foldGutter.of(foldGutterExtension(config.foldGutter)),
    compartments.rainbowParens.of(rainbowParensExtension(config.rainbowParens)),
    compartments.autocomplete.of(autocompleteExtension(config.autocomplete)),
    compartments.lint.of(lintExtension(config.lint)),
    compartments.hover.of(hoverExtension(config.hover)),
    compartments.lightTheme.of(lightThemeExtension(config.lightTheme)),
    compartments.gotoDef.of(gotoDefExtension(config.gotoDef))
  ];
}

const FACTORY_MAP: Record<EditorFeature, (enabled: boolean) => Extension> = {
  minimap: minimapExtension,
  lineNumbers: lineNumbersExtension,
  activeLine: activeLineExtension,
  lineWrapping: lineWrappingExtension,
  bracketMatching: bracketMatchingExtension,
  closeBrackets: closeBracketsExtension,
  foldGutter: foldGutterExtension,
  rainbowParens: rainbowParensExtension,
  autocomplete: autocompleteExtension,
  lint: lintExtension,
  hover: hoverExtension,
  lightTheme: lightThemeExtension,
  gotoDef: gotoDefExtension
};

/**
 * Reconfigura una feature individual en el EditorView.
 */
export function reconfigureFeature(
  view: EditorView,
  compartments: EditorCompartments,
  feature: EditorFeature,
  enabled: boolean
): void {
  const compartment = compartments[feature];
  const factory = FACTORY_MAP[feature];
  view.dispatch({
    effects: compartment.reconfigure(factory(enabled))
  });
}

export const FEATURE_LABELS: Record<EditorFeature, string> = {
  minimap: 'Minimap',
  lineNumbers: 'Números de línea',
  activeLine: 'Resaltar línea activa',
  lineWrapping: 'Ajuste de línea',
  bracketMatching: 'Resaltar paréntesis',
  closeBrackets: 'Auto-cerrar paréntesis',
  foldGutter: 'Plegar código',
  rainbowParens: 'Paréntesis arcoíris',
  autocomplete: 'Autocompletado',
  lint: 'Diagnósticos',
  hover: 'Tooltips al hover',
  lightTheme: 'Tema claro',
  gotoDef: 'Ir a definición (Ctrl+click)'
};

export const ALL_FEATURES: EditorFeature[] = [
  'lightTheme',
  'minimap',
  'lineNumbers',
  'activeLine',
  'lineWrapping',
  'bracketMatching',
  'closeBrackets',
  'foldGutter',
  'rainbowParens',
  'autocomplete',
  'lint',
  'hover',
  'gotoDef'
];
