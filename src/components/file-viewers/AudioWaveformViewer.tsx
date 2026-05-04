'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Pause, Play } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';

interface AudioWaveformViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface WaveSurferLike {
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  destroy: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const TIME_UPDATE_THROTTLE_MS = 200;

export default function AudioWaveformViewer({ docName, fileUrl, onClose }: AudioWaveformViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurferLike | null>(null);
  const lastUpdateRef = useRef(0);
  const [load, setLoad] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!fileUrl || !containerRef.current) {
      setLoad('idle');
      return;
    }
    let cancelled = false;
    setLoad('loading');
    setError(null);

    (async () => {
      try {
        const { default: WaveSurfer } = await import('wavesurfer.js');
        if (cancelled || !containerRef.current) return;
        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: '#475569',
          progressColor: '#60a5fa',
          cursorColor: '#f8fafc',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 100,
          normalize: true,
          url: fileUrl
        }) as unknown as WaveSurferLike;
        wsRef.current = ws;

        ws.on('ready', () => {
          if (cancelled) return;
          setLoad('ready');
          setTime((t) => ({ ...t, total: ws.getDuration() }));
        });
        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));
        ws.on('finish', () => setIsPlaying(false));
        ws.on('audioprocess', () => {
          const now = performance.now();
          if (now - lastUpdateRef.current < TIME_UPDATE_THROTTLE_MS) return;
          lastUpdateRef.current = now;
          setTime({ current: ws.getCurrentTime(), total: ws.getDuration() });
        });
        ws.on('error', (err: unknown) => {
          if (cancelled) return;
          setLoad('error');
          setError(err instanceof Error ? err.message : String(err));
        });
      } catch (err) {
        if (cancelled) return;
        setLoad('error');
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    })();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        try { wsRef.current.destroy(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [fileUrl]);

  const togglePlay = () => {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.isPlaying()) ws.pause();
    else ws.play();
  };

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={AudioLines} message="No se pudo cargar el audio." />
      ) : (
        <div className="flex h-full flex-col bg-slate-950">
          {load === 'loading' && <ViewerLoading label="Decodificando audio..." />}
          {load === 'error' && <ViewerError message={error ?? 'Error desconocido'} />}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
            <div ref={containerRef} className="w-full max-w-4xl" style={{ minHeight: 100 }} />
            {load === 'ready' && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
                </button>
                <div className="font-mono text-xs tabular-nums text-slate-400">
                  {formatTime(time.current)} / {formatTime(time.total)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </FileViewerShell>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
