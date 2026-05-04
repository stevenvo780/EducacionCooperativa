'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { FileCode, Eye, Code as CodeIcon } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, decodeText, urlCacheKey } from '@/components/file-viewers/hooks/useFileResource';
import { detectTei, formatXmlSource, renderGenericXml, renderTei } from '@/lib/parsers/tei';
import { sanitizeHtml } from '@/lib/safe-html';

interface TeiXmlViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface TeiState {
  raw: string;
  isTei: boolean;
}

type Mode = 'render' | 'source';

export default function TeiXmlViewer({ docName, fileUrl, onClose }: TeiXmlViewerProps) {
  const [mode, setMode] = useState<Mode>('render');

  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<TeiState> => {
    const raw = decodeText(buffer);
    return { raw, isTei: detectTei(raw) };
  }, []);

  const state = useFileResource<TeiState>(fileUrl, transform, { cacheKey: urlCacheKey('tei', fileUrl) });

  const actions = state.kind === 'ready' ? (
    <ModeToggle mode={mode} onChange={setMode} />
  ) : null;

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose} actions={actions}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileCode} message="No se pudo cargar el archivo XML." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Procesando XML..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : mode === 'render' ? (
        <RenderedView raw={state.data.raw} isTei={state.data.isTei} />
      ) : (
        <SourceView raw={state.data.raw} />
      )}
    </FileViewerShell>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 p-0.5">
      <button
        type="button"
        onClick={() => onChange('render')}
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${mode === 'render' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
      >
        <Eye className="h-3 w-3" /> Render
      </button>
      <button
        type="button"
        onClick={() => onChange('source')}
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${mode === 'source' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
      >
        <CodeIcon className="h-3 w-3" /> XML
      </button>
    </div>
  );
}

function RenderedView({ raw, isTei }: { raw: string; isTei: boolean }) {
  const html = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const doc = new DOMParser().parseFromString(raw, 'application/xml');
    if (doc.querySelector('parsererror')) return '<pre>XML inválido</pre>';
    const rendered = isTei ? renderTei(doc) : renderGenericXml(doc.documentElement);
    return sanitizeHtml(rendered);
  }, [raw, isTei]);

  return (
    <div className="h-full overflow-auto bg-slate-950">
      <article
        className="xml-rendered mx-auto max-w-[820px] bg-white px-10 py-8 shadow-xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function SourceView({ raw }: { raw: string }) {
  const formatted = useMemo(() => formatXmlSource(raw), [raw]);
  return (
    <div className="h-full overflow-auto bg-slate-950">
      <pre className="px-6 py-4 text-xs leading-relaxed">
        <code className="font-mono text-slate-300">
          <div className="viewer-virtualized">
            {formatted.map((line, i) => (
              <div key={i} className="flex">
                <span className="mr-4 select-none text-right text-slate-600" style={{ minWidth: 32 }}>{i + 1}</span>
                <span className="flex-1 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: line }} />
              </div>
            ))}
          </div>
        </code>
      </pre>
    </div>
  );
}
