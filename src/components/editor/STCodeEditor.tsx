'use client';

/**
 * STCodeEditor — Editor de código ST basado en CodeMirror 6.
 *
 * Usa Compartments para habilitar/deshabilitar features en caliente.
 * Mantiene la misma interfaz de props para compatibilidad con STRunner.tsx.
 *
 * Modo colaborativo: si recibe `collab` con un Y.Doc + Awareness, sincroniza
 * el contenido vía y-codemirror.next y muestra los cursores remotos.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Diagnostic } from '@stevenvo780/st-lang/api';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
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
import { buildCollabExtension } from './codemirror/yCollabExtension';
import { AGORA_EVENTS, dispatchAgoraEvent, subscribeAgoraEvent } from '@/lib/agora-events';

interface STCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  diagnostics?: Diagnostic[];
  editorConfig?: EditorConfig;
  /** Modo colaborativo: Yjs es la fuente de verdad. */
  collab?: { ydoc: Y.Doc; awareness: Awareness };
}

export default function STCodeEditor({
  value,
  onChange,
  onKeyDown,
  placeholder = '// Escribe tu código ST aquí...',
  className = '',
  readOnly = false,
  diagnostics = [],
  editorConfig,
  collab
}: STCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef<EditorCompartments | null>(null);
  const onChangeRef = useRef(onChange);
  const onKeyDownRef = useRef(onKeyDown);
  const prevConfigRef = useRef<EditorConfig | null>(null);
  const isTouchDevice = useMemo(() => isTouchDeviceProfile(), []);
  const resolvedConfig = useMemo(() => editorConfig ?? loadConfig(), [editorConfig]);

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

    stLanguageSupport(),
    ...stGotoDef(),

    ...stKeymap(
      () => onRunRef.current?.(),
      () => onSaveRef.current?.(),
    ),

    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    })
  ], [isTouchDevice, placeholder, readOnly]);

  // Reconstruimos el view cuando cambia la presencia de colab.
  const collabKey = collab ? `${collab.ydoc.clientID}` : 'local';

  useEffect(() => {
    if (isTouchDevice || !containerRef.current) return;

    const compartments = createCompartments();
    compartmentsRef.current = compartments;

    prevConfigRef.current = resolvedConfig;

    // En colab Yjs maneja el contenido inicial; pasamos doc vacío para que
    // y-codemirror.next haga el bind.
    const initialDoc = collab ? '' : value;
    const collabExt = collab ? [buildCollabExtension(collab.ydoc, collab.awareness)] : [];

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        ...fixedExtensions,
        ...buildCompartmentExtensions(compartments, resolvedConfig),
        ...collabExt
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
  }, [collabKey]);

  useEffect(() => {
    if (isTouchDevice) return;
    const view = viewRef.current;
    const compartments = compartmentsRef.current;
    const prev = prevConfigRef.current;
    const config = editorConfig;
    if (!view || !compartments || !config) return;

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
    if (collab) return; // En colab Yjs es la fuente de verdad.
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value }
      });
    }
  }, [isTouchDevice, value, collab]);

  useEffect(() => {
    if (isTouchDevice) return;
    const view = viewRef.current;
    if (!view) return;
    dispatchDiagnostics(view, diagnostics);
  }, [diagnostics, isTouchDevice]);

  const lastBridgeSigRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sig = diagnostics.length === 0
      ? 'empty'
      : `${diagnostics.length}:${diagnostics[0]?.severity ?? ''}:${(diagnostics[0]?.message ?? '').slice(0, 40)}`;
    if (lastBridgeSigRef.current === sig) return;
    lastBridgeSigRef.current = sig;
    dispatchAgoraEvent(AGORA_EVENTS.stDiagnostics, { diagnostics });
  }, [diagnostics]);

  useEffect(() => {
    if (isTouchDevice) return;
    return subscribeAgoraEvent(AGORA_EVENTS.jumpToLine, (detail) => {
      const view = viewRef.current;
      if (!view || !detail) return;
      const total = view.state.doc.lines;
      const line = Math.max(1, Math.min(total, detail.line));
      const lineInfo = view.state.doc.line(line);
      const col = detail.column ? Math.min(lineInfo.length, Math.max(0, detail.column - 1)) : 0;
      const pos = lineInfo.from + col;
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    });
  }, [isTouchDevice]);

  if (isTouchDevice) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full h-full bg-slate-950 text-slate-200 font-mono text-sm p-3 outline-none resize-none ${className}`}
        spellCheck={false}
      />
    );
  }

  return <div ref={containerRef} className={`h-full w-full ${className}`} />;
}
