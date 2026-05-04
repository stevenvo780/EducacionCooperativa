'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Captions } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';
import { useFileResource, decodeText } from '@/components/file-viewers/hooks/useFileResource';
import { formatSubtitleDuration, formatSubtitleTime, parseSubtitle, type SubtitleCue, type SubtitleFormat } from '@/lib/parsers/subtitle';
import { getFileExtension } from '@/lib/document-format';

interface SubtitleViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface SubtitleResult {
  cues: SubtitleCue[];
  format: SubtitleFormat;
}

export default function SubtitleViewer({ docName, fileUrl, onClose }: SubtitleViewerProps) {
  const transform = useCallback(async ({ buffer }: { buffer: ArrayBuffer }): Promise<SubtitleResult> => {
    const ext = getFileExtension(docName);
    const format: SubtitleFormat = ext === 'vtt' ? 'vtt' : ext === 'sbv' ? 'sbv' : 'srt';
    const cues = parseSubtitle(decodeText(buffer), format);
    if (cues.length === 0) throw new Error('Sin cues parseables');
    return { cues, format };
  }, [docName]);

  const state = useFileResource<SubtitleResult>(fileUrl, transform);

  const totalDurationMs = state.kind === 'ready'
    ? state.data.cues.reduce((acc, c) => acc + (c.endMs - c.startMs), 0)
    : 0;

  return (
    <FileViewerShell
      docName={docName}
      fileUrl={fileUrl}
      onClose={onClose}
      actions={state.kind === 'ready' ? (
        <span className="text-xs text-slate-400">
          {state.data.cues.length} cues · {formatSubtitleDuration(totalDurationMs)} · {state.data.format.toUpperCase()}
        </span>
      ) : null}
    >
      {!fileUrl ? (
        <ViewerEmpty icon={Captions} message="No se pudo cargar el archivo." />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <ViewerLoading label="Procesando subtítulos..." />
      ) : state.kind === 'error' ? (
        <ViewerError message={state.error} />
      ) : (
        <CueList cues={state.data.cues} />
      )}
    </FileViewerShell>
  );
}

function CueList({ cues }: { cues: SubtitleCue[] }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const transcript = useMemo(() => cues.map((c) => c.text).join(' '), [cues]);

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
        >
          {showTranscript ? 'Ver cues' : 'Ver transcripción'}
        </button>
      </div>
      {showTranscript ? (
        <div className="flex-1 overflow-auto px-6 py-6">
          <article className="mx-auto max-w-[820px] text-sm leading-relaxed text-slate-200">
            {transcript}
          </article>
        </div>
      ) : (
        <ul className="viewer-virtualized flex-1 overflow-auto divide-y divide-slate-800">
          {cues.map((cue) => (
            <li key={cue.index} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2.5 hover:bg-slate-900/40">
              <div className="font-mono text-xs text-slate-500">
                {formatSubtitleTime(cue.startMs)}<br/>
                <span className="text-slate-600">→ {formatSubtitleTime(cue.endMs)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm text-slate-200">{cue.text}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
