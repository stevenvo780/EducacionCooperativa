'use client';

/**
 * STCodeEditor — Editor de código ST basado en CodeMirror 6.
 *
 * Reemplazo total del motor textarea+pre anterior.
 * Mantiene la misma interfaz de props para compatibilidad con STRunner.tsx.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Diagnostic } from '@stevenvo780/st-lang/api';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { bracketMatching, indentOnInput, foldGutter } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

import {
  stLanguageSupport,
  stTheme,
  stAutocompletion,
  stLintExtensions,
  stHoverTooltip,
  stKeymap,
  stRainbowParens,
  dispatchDiagnostics
} from './codemirror';

// ── Props ───────────────────────────────────────────────────

interface STCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  diagnostics?: Diagnostic[];
}

// ── Component ───────────────────────────────────────────────

export default function STCodeEditor({
  value,
  onChange,
  onKeyDown,
  placeholder = '// Escribe tu código ST aquí...',
  className = '',
  readOnly = false,
  diagnostics = []
}: STCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onKeyDownRef = useRef(onKeyDown);

  // Keep refs in sync
  onChangeRef.current = onChange;
  onKeyDownRef.current = onKeyDown;

  // ── Extract onRun and onSave from onKeyDown ──
  // The parent (STRunner) passes onKeyDown that handles Ctrl+Enter (run) and Ctrl+S (save).
  // We extract those as callbacks for CodeMirror keybindings.
  const onRunRef = useRef<(() => void) | undefined>();
  const onSaveRef = useRef<(() => void) | undefined>();

  // We set up a proxy: when CM fires Ctrl+Enter, we synthesize a fake KeyboardEvent
  // and pass it to the parent's onKeyDown to trigger its logic.
  const handleRun = useCallback(() => {
    const handler = onKeyDownRef.current;
    if (!handler) return;
    // Synthesize a minimal event-like object
    const fakeEvent = {
      ctrlKey: true,
      metaKey: false,
      key: 'Enter',
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    handler(fakeEvent);
  }, []);

  const handleSave = useCallback(() => {
    const handler = onKeyDownRef.current;
    if (!handler) return;
    const fakeEvent = {
      ctrlKey: true,
      metaKey: false,
      key: 's',
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    handler(fakeEvent);
  }, []);

  onRunRef.current = handleRun;
  onSaveRef.current = handleSave;

  // ── Create extensions (memoized) ──
  const extensions = useMemo(() => [
    // ── Structural ──
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    foldGutter(),
    cmPlaceholder(placeholder),
    EditorState.readOnly.of(readOnly),
    EditorState.tabSize.of(2),

    // ── ST Language ──
    stLanguageSupport(),
    ...stTheme(),
    stAutocompletion(),
    ...stLintExtensions(),
    stHoverTooltip(),
    stRainbowParens(),

    // ── Keymaps (needs stable refs for run/save) ──
    ...stKeymap(
      () => onRunRef.current?.(),
      () => onSaveRef.current?.(),
    ),

    // ── onChange listener ──
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newValue = update.state.doc.toString();
        onChangeRef.current(newValue);
      }
    })
  ], [placeholder, readOnly]);

  // ── Initialize EditorView ──
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run once on mount (extensions are stable via useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync value from parent → CM (controlled component) ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value
        }
      });
    }
  }, [value]);

  // ── Sync diagnostics → CM lint ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    dispatchDiagnostics(view, diagnostics);
  }, [diagnostics]);

  // Note: readOnly is set in initial extensions via EditorState.readOnly.of().
  // If dynamic toggle is needed in the future, use a Compartment.

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-hidden ${className}`}
    />
  );
}
