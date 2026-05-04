'use client';

import React, { useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, decodeText } from '@/components/file-viewers/hooks/useFileResource';
import { parseBibtex, type BibEntry } from '@/lib/parsers/bibtex';
import { escapeHtml } from '@/lib/html-utils';

interface SourceTextViewerProps {
  docName: string;
  fileUrl: string | null;
  language?: 'latex' | 'bibtex' | 'plain';
  onClose?: () => void;
}

const MAX_BYTES = 2 * 1024 * 1024;

export default function SourceTextViewer({ docName, fileUrl, language = 'plain', onClose }: SourceTextViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }) => decodeText(buffer), []);
  const state = useFileResource<string>(fileUrl, transform, { maxBytes: MAX_BYTES });

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={FileText} message="No se pudo cargar el archivo." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Cargando..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : language === 'bibtex' ? (
        <BibtexView text={state.data} />
      ) : (
        <PlainSourceView text={state.data} language={language} />
      )}
    </FileViewerShell>
  );
}

function PlainSourceView({ text, language }: { text: string; language: string }) {
  const highlighted = useMemo(() => highlightLines(text, language), [text, language]);
  return (
    <div className="h-full overflow-auto bg-slate-950">
      <pre className="min-w-full px-6 py-4 text-xs leading-relaxed">
        <code className="font-mono text-slate-200">
          <div className="viewer-virtualized">
            {highlighted.map((line, i) => (
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

function BibtexView({ text }: { text: string }) {
  const entries = useMemo(() => parseBibtex(text), [text]);
  if (entries.length === 0) return <PlainSourceView text={text} language="bibtex" />;
  return (
    <div className="h-full overflow-auto bg-slate-950 px-6 py-6">
      <div className="mx-auto flex max-w-[920px] flex-col gap-3">
        <div className="text-xs text-slate-500">{entries.length} entradas</div>
        <div className="viewer-virtualized flex flex-col gap-3">
          {entries.map((entry, i) => <BibEntryCard key={i} entry={entry} />)}
        </div>
      </div>
    </div>
  );
}

function BibEntryCard({ entry }: { entry: BibEntry }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-300">
          {entry.type}
        </span>
        <code className="text-sm font-mono text-blue-300">{entry.key}</code>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
        {entry.fields.map((f, j) => (
          <React.Fragment key={j}>
            <dt className="font-mono text-slate-500">{f.name}</dt>
            <dd className="text-slate-200">{f.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function highlightLines(text: string, language: string): string[] {
  const lines = text.split('\n');
  if (language === 'latex') {
    return lines.map((line) => escapeHtml(line)
      .replace(/(%.*$)/g, '<span style="color:#64748b">$1</span>')
      .replace(/(\\[a-zA-Z]+\*?)/g, '<span style="color:#60a5fa">$1</span>')
      .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>')
      .replace(/(\$[^$]*\$)/g, '<span style="color:#a78bfa">$1</span>')
    );
  }
  if (language === 'bibtex') {
    return lines.map((line) => escapeHtml(line)
      .replace(/(@\w+)/g, '<span style="color:#34d399">$1</span>')
      .replace(/(\w+)\s*=/g, '<span style="color:#60a5fa">$1</span>=')
      .replace(/(\{[^{}]*\})/g, '<span style="color:#fcd34d">$1</span>')
    );
  }
  return lines.map(escapeHtml);
}
