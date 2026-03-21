'use client';

import React, { useMemo } from 'react';
import { CodeMirrorEditor, type CodeBlockEditorDescriptor, type CodeBlockEditorProps } from '@mdxeditor/editor';
import MermaidDiagram from '@/components/MermaidDiagram';

function normalizeMermaidCode(code: string) {
  return code.replace(/^\s+|\s+$/g, '');
}

function MermaidCodeBlockEditor(props: CodeBlockEditorProps) {
  const normalized = useMemo(() => normalizeMermaidCode(props.code), [props.code]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/80 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          Mermaid
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 normal-case tracking-normal">{props.language || 'mermaid'}</span>
        </div>
        <span className="text-[10px] text-slate-500">Edición + preview</span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.2fr)]">
        <div className="border-b border-slate-800 lg:border-b-0 lg:border-r">
          <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Código</div>
          <div className="mermaid-code-editor-shell">
            <CodeMirrorEditor {...props} />
          </div>
        </div>
        <div className="bg-slate-950/60">
          <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Vista previa</div>
          <div className="px-3 pb-3">
            {normalized ? (
              <MermaidDiagram chart={normalized} />
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/80 text-sm text-slate-500">
                Escribe un diagrama Mermaid para previsualizarlo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const mermaidCodeBlockDescriptor: CodeBlockEditorDescriptor = {
  priority: 100,
  match: (language) => (language ?? '').toLowerCase() === 'mermaid',
  Editor: MermaidCodeBlockEditor
};
