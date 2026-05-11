'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SIZE_DEBOUNCE_MS = 50;

type Size = { width: number; height: number };

export const useElementSize = <T extends HTMLElement>() => {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const initialRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSizeRef = useRef<Size>({ width: 0, height: 0 });
  const lastAppliedRef = useRef<Size>({ width: 0, height: 0 });
  const nodeRef = useRef<T | null>(null);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    }
    if (initialRafRef.current !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(initialRafRef.current);
      }
      initialRafRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    rafRef.current = null;
    const next = pendingSizeRef.current;
    if (
      next.width === lastAppliedRef.current.width &&
      next.height === lastAppliedRef.current.height
    ) {
      return;
    }
    lastAppliedRef.current = next;
    setSize(next);
  }, []);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    cancelPending();
    nodeRef.current = node;

    if (node === null) return;

    const measureAndApply = () => {
      initialRafRef.current = null;
      if (nodeRef.current !== node) return;
      const rect = node.getBoundingClientRect();
      const next: Size = { width: rect.width, height: rect.height };
      pendingSizeRef.current = next;
      if (
        next.width === lastAppliedRef.current.width &&
        next.height === lastAppliedRef.current.height
      ) {
        return;
      }
      lastAppliedRef.current = next;
      setSize(next);
    };

    if (typeof requestAnimationFrame === 'undefined') {
      measureAndApply();
    } else {
      initialRafRef.current = requestAnimationFrame(measureAndApply);
    }

    if (typeof ResizeObserver === 'undefined') return;

    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      pendingSizeRef.current = {
        width: entry.contentRect.width,
        height: entry.contentRect.height
      };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (typeof requestAnimationFrame === 'undefined') {
          flush();
          return;
        }
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flush);
      }, SIZE_DEBOUNCE_MS);
    });
    observerRef.current.observe(node);
  }, [cancelPending, flush]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      cancelPending();
    };
  }, [cancelPending]);

  return [ref, size] as const;
};
