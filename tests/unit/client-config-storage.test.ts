import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearClientConfig,
  loadClientConfig,
  saveClientConfig
} from '@/lib/clientConfigStorage';

const STORAGE_OPTIONS = {
  storageKey: 'test-client-config',
  defaults: {
    provider: 'ollama',
    apiKey: '',
    model: '',
    endpoint: ''
  },
  sensitiveKeys: ['apiKey'] as const
};

describe('clientConfigStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('persists sensitive fields in session storage only', () => {
    saveClientConfig(STORAGE_OPTIONS, {
      provider: 'openai',
      apiKey: 'sk-secret',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.example.com'
    });

    expect(window.localStorage.getItem(STORAGE_OPTIONS.storageKey)).toContain('"provider":"openai"');
    expect(window.localStorage.getItem(STORAGE_OPTIONS.storageKey)).not.toContain('sk-secret');
    expect(window.sessionStorage.getItem(`${STORAGE_OPTIONS.storageKey}:session`)).toContain('sk-secret');
  });

  it('loads public and sensitive config as one object', () => {
    window.localStorage.setItem(STORAGE_OPTIONS.storageKey, JSON.stringify({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      endpoint: 'https://proxy.example.com'
    }));
    window.sessionStorage.setItem(`${STORAGE_OPTIONS.storageKey}:session`, JSON.stringify({
      apiKey: 'secret-session-key'
    }));

    expect(loadClientConfig(STORAGE_OPTIONS)).toEqual({
      provider: 'gemini',
      apiKey: 'secret-session-key',
      model: 'gemini-2.0-flash',
      endpoint: 'https://proxy.example.com'
    });
  });

  it('clears both storage locations', () => {
    saveClientConfig(STORAGE_OPTIONS, {
      provider: 'anthropic',
      apiKey: 'secret',
      model: 'claude',
      endpoint: 'https://api.example.com'
    });

    clearClientConfig(STORAGE_OPTIONS);

    expect(window.localStorage.getItem(STORAGE_OPTIONS.storageKey)).toBeNull();
    expect(window.sessionStorage.getItem(`${STORAGE_OPTIONS.storageKey}:session`)).toBeNull();
  });
});
