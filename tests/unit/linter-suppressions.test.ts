/**
 * Tests for linter suppression system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'agora:linter-suppressions';

describe('LinterSuppressions', () => {
  beforeEach(() => {
    // Clear localStorage and module cache so each test gets a fresh module
    localStorage.removeItem(STORAGE_KEY);
    vi.resetModules();
  });

  it('isSuppressed returns false when no suppressions exist', async () => {
    const { isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    expect(isSuppressed('spelling_typos', 'test')).toBe(false);
  });

  it('addSuppression + isSuppressed works', async () => {
    const { addSuppression, isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'kubernetes');
    expect(isSuppressed('spelling_typos', 'kubernetes')).toBe(true);
    expect(isSuppressed('spelling_typos', 'docker')).toBe(false);
  });

  it('suppressions are case-insensitive', async () => {
    const { addSuppression, isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'Kubernetes');
    expect(isSuppressed('spelling_typos', 'kubernetes')).toBe(true);
    expect(isSuppressed('spelling_typos', 'KUBERNETES')).toBe(true);
  });

  it('removeSuppression works', async () => {
    const { addSuppression, removeSuppression, isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'kubernetes');
    expect(isSuppressed('spelling_typos', 'kubernetes')).toBe(true);
    removeSuppression('spelling_typos', 'kubernetes');
    expect(isSuppressed('spelling_typos', 'kubernetes')).toBe(false);
  });

  it('getSuppressions returns all entries', async () => {
    const { addSuppression, getSuppressions } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'alpha');
    addSuppression('readability_long_sentence', 'beta');
    const all = getSuppressions();
    expect(all).toHaveLength(2);
    expect(all[0].ruleId).toBe('spelling_typos');
    expect(all[1].ruleId).toBe('readability_long_sentence');
  });

  it('clearAllSuppressions removes everything', async () => {
    const { addSuppression, clearAllSuppressions, getSuppressions } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'alpha');
    addSuppression('spelling_typos', 'beta');
    clearAllSuppressions();
    expect(getSuppressions()).toHaveLength(0);
  });

  it('persists to localStorage', async () => {
    const { addSuppression } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'test');
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ruleId).toBe('spelling_typos');
  });

  it('loads from localStorage on first access', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { ruleId: 'spelling_typos', text: 'preloaded' }
    ]));
    const { isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    expect(isSuppressed('spelling_typos', 'preloaded')).toBe(true);
  });

  it('does not add duplicate suppressions', async () => {
    const { addSuppression, getSuppressions } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'test');
    addSuppression('spelling_typos', 'test');
    addSuppression('spelling_typos', 'TEST');
    expect(getSuppressions()).toHaveLength(1);
  });

  it('isSuppressed returns false for undefined ruleId or text', async () => {
    const { addSuppression, isSuppressed } = await import('@/lib/markdown-linter/suppressions');
    addSuppression('spelling_typos', 'test');
    expect(isSuppressed(undefined, 'test')).toBe(false);
    expect(isSuppressed('spelling_typos', undefined)).toBe(false);
  });

  it('subscribe notifies on changes', async () => {
    const { addSuppression, subscribeSuppression } = await import('@/lib/markdown-linter/suppressions');
    const listener = vi.fn();
    const unsub = subscribeSuppression(listener);
    addSuppression('spelling_typos', 'test');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    addSuppression('spelling_typos', 'test2');
    expect(listener).toHaveBeenCalledTimes(1); // no more calls after unsub
  });
});
