import {
  DEFAULT_CONFIG,
  ST_NATIVE_INPUT_ATTRIBUTES,
  TOUCH_DEVICE_CONFIG,
  getDefaultConfig,
  isTouchDeviceProfile,
  loadConfig,
  stInputGuardsExtension
} from '@/components/editor/codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

describe('st-editor-config adaptive defaults', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  function setMatchMedia(matches: boolean | Record<string, boolean>) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: typeof matches === 'boolean' ? matches : !!matches[query],
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  }

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    setMatchMedia(false);
  });

  afterAll(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: originalMaxTouchPoints });
  });

  it('uses desktop defaults on wide non-touch viewports', () => {
    expect(isTouchDeviceProfile()).toBe(false);
    expect(getDefaultConfig()).toEqual(DEFAULT_CONFIG);
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('uses lighter defaults on touch tablet profiles without saved settings', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    setMatchMedia(true);

    expect(isTouchDeviceProfile()).toBe(true);
    expect(getDefaultConfig()).toEqual(TOUCH_DEVICE_CONFIG);
    expect(loadConfig()).toEqual(TOUCH_DEVICE_CONFIG);
  });

  it('uses touch defaults on wide touch-only tablets', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1366 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    setMatchMedia({
      '(pointer: coarse)': true,
      '(any-pointer: coarse)': true,
      '(hover: none)': true,
      '(any-hover: none)': true
    });

    expect(isTouchDeviceProfile()).toBe(true);
    expect(getDefaultConfig()).toEqual(TOUCH_DEVICE_CONFIG);
  });

  it('keeps desktop defaults on hybrid laptops with touch and hover', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    setMatchMedia({
      '(pointer: fine)': true,
      '(any-pointer: coarse)': true,
      '(hover: hover)': true,
      '(any-hover: hover)': true
    });

    expect(isTouchDeviceProfile()).toBe(false);
    expect(getDefaultConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('preserves saved preferences on touch devices', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    setMatchMedia(true);

    // En touch devices, las features pesadas (lint, hover, autocomplete,
    // foldGutter, rainbowParens, bracketMatching, minimap, gotoDef) están
    // FORZADAS al baseline TOUCH_DEVICE_CONFIG para evitar crashes en
    // tablets (ver st-editor-config.ts). Sólo prefs ligeras como lightTheme
    // y lineWrapping se preservan desde localStorage.
    localStorage.setItem('st-editor-config', JSON.stringify({ lightTheme: true, lineWrapping: true }));

    expect(loadConfig()).toEqual({
      ...TOUCH_DEVICE_CONFIG,
      lightTheme: true,
      lineWrapping: true
    });
  });

  it('disables native browser writing aids on the ST editor surface', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: '',
        extensions: [stInputGuardsExtension()]
      })
    });

    try {
      for (const [attribute, value] of Object.entries(ST_NATIVE_INPUT_ATTRIBUTES)) {
        expect(view.contentDOM.getAttribute(attribute)).toBe(value);
      }
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});
