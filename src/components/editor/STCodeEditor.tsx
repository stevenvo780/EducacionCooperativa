'use client';

/**
 * STCodeEditor — Editor de código ST basado en CodeMirror 6.
 *
 * Usa Compartments para habilitar/deshabilitar features en caliente.
 * Mantiene la misma interfaz de props para compatibilidad con STRunner.tsx.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Diagnostic } from '@stevenvo780/st-lang/api';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { indentOnInput } from '@codemirror/language';
import { closeBracketsKeymap } from '@codemirror/autocomplete';

import {
  stLanguageSupport,
  stKeymap,
  stGotoDef,
  stInputGuardsExtension,
  dispatchDiagnostics,
  type EditorConfig,
  type EditorCompartments,
  createCompartments,
  buildCompartmentExtensions,
  reconfigureFeature,
  type EditorFeature,
  loadConfig,
  isTouchDeviceProfile
} from './codemirror';

interface STCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  diagnostics?: Diagnostic[];
  editorConfig?: EditorConfig;
}

export default function STCodeEditor({
  value,
  onChange,
  onKeyDown,
  placeholder = '// Escribe tu código ST aquí...',
  className = '',
  readOnly = false,
  diagnostics = [],
  editorConfig
}: STCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef<EditorCompartments | null>(null);
  const onChangeRef = useRef(onChange);
  const onKeyDownRef = useRef(onKeyDown);
  const prevConfigRef = useRef<EditorConfig | null>(null);
  const isTouchDevice = useMemo(() => isTouchDeviceProfile(), []);
  const resolvedConfig = useMemo(() => editorConfig ?? loadConfig(), [editorConfig]);

  // Keep refs in sync
  onChangeRef.current = onChange;
  onKeyDownRef.current = onKeyDown;

  const handleRun = useCallback(() => {
    const handler = onKeyDownRef.current;
    if (!handler) return;
    const fakeEvent = {
      ctrlKey: true, metaKey: false, key: 'Enter',
      preventDefault: () => {}, stopPropagation: () => {}
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    handler(fakeEvent);
  }, []);

  const handleSave = useCallback(() => {
    const handler = onKeyDownRef.current;
    if (!handler) return;
    const fakeEvent = {
      ctrlKey: true, metaKey: false, key: 's',
      preventDefault: () => {}, stopPropagation: () => {}
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    handler(fakeEvent);
  }, []);

  const onRunRef = useRef(handleRun);
  const onSaveRef = useRef(handleSave);
  onRunRef.current = handleRun;
  onSaveRef.current = handleSave;

  const fixedExtensions = useMemo(() => [
    drawSelection(),
    dropCursor(),
    ...(isTouchDevice ? [] : [rectangularSelection(), crosshairCursor()]),
    indentOnInput(),
    keymap.of(closeBracketsKeymap),
    stInputGuardsExtension(),
    cmPlaceholder(placeholder),
    EditorState.readOnly.of(readOnly),
    EditorState.tabSize.of(2),

    // ST language (always on) — theme comes from Compartment (lightTheme toggle)
    stLanguageSupport(),
    ...stGotoDef(),

    // Keymaps
    ...stKeymap(
      () => onRunRef.current?.(),
      () => onSaveRef.current?.(),
    ),

    // onChange listener
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    })
  ], [isTouchDevice, placeholder, readOnly]);

  useEffect(() => {
    if (isTouchDevice || !containerRef.current) return;

    const compartments = createCompartments();
    compartmentsRef.current = compartments;

    prevConfigRef.current = resolvedConfig;

    const state = EditorState.create({
      doc: value,
      extensions: [
        ...fixedExtensions,
        ...buildCompartmentExtensions(compartments, resolvedConfig)
      ]
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      compartmentsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isTouchDevice) return;
    const view = viewRef.current;
    const compartments = compartmentsRef.current;
    const prev = prevConfigRef.current;
    const config = editorConfig;
    if (!view || !compartments || !config) return;

    // Find changed features and reconfigure them
    const features = Object.keys(config) as EditorFeature[];
    for (const feature of features) {
      if (!prev || config[feature] !== prev[feature]) {
        reconfigureFeature(view, compartments, feature, config[feature]);
      }
    }
    prevConfigRef.current = config;
  }, [editorConfig, isTouchDevice]);

  useEffect(() => {
    if (isTouchDevice) return;
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value }
      });
    }
  }, [isTouchDevice, value]);

  useEffect(() => {
    if (isTouchDevice) return;
    const view = viewRef.current;
    if (!view) return;
    dispatchDiagnostics(view, diagnostics);
  }, [diagnostics, isTouchDevice]);

  // Android/tablet IMEs are much more reliable with a native textarea than a
  // contenteditable-based code editor. Keep touch-first devices on the stable path.
  if (isTouchDevice) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        wrap={resolvedConfig.lineWrapping ? 'soft' : 'off'}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        translate="no"
        data-enable-grammarly="false"
        data-gramm="false"
        data-st-editor-mode="touch-textarea"
        className={`h-full w-full resize-none overflow-auto bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100 outline-none ${className}`}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-hidden ${className}`}
    />
  );
}
