import {
  DEFAULT_CONFIG,
  TOUCH_DEVICE_CONFIG,
  getDefaultConfig,
  isTouchDeviceProfile,
  loadConfig
} from '@/components/editor/codemirror';

describe('st-editor-config adaptive defaults', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  function setMatchMedia(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches,
        media: '',
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

  it('preserves saved preferences on touch devices', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    setMatchMedia(true);

    localStorage.setItem('st-editor-config', JSON.stringify({ lint: true, autocomplete: true }));

    expect(loadConfig()).toEqual({
      ...TOUCH_DEVICE_CONFIG,
      lint: true,
      autocomplete: true
    });
  });
});
