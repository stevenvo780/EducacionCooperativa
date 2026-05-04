'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Maximize2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';

interface ManuscriptImageViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

const INITIAL: Transform = { scale: 1, translateX: 0, translateY: 0 };
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function ManuscriptImageViewer({ docName, fileUrl, onClose }: ManuscriptImageViewerProps) {
  const [load, setLoad] = useState<LoadState>(fileUrl ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform>(INITIAL);
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  useEffect(() => {
    setLoad(fileUrl ? 'loading' : 'idle');
    setError(null);
    setTransform(INITIAL);
    setRotation(0);
  }, [fileUrl]);

  const zoomBy = useCallback((factor: number) => {
    setTransform((t) => ({ ...t, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor)) }));
  }, []);

  const reset = useCallback(() => setTransform(INITIAL), []);
  const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, [zoomBy]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, tx: transform.translateX, ty: transform.translateY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((t) => ({ ...t, translateX: drag.tx + (e.clientX - drag.x), translateY: drag.ty + (e.clientY - drag.y) }));
  };
  const endDrag = () => { dragRef.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragRef.current = {
        x: e.touches[0]!.clientX, y: e.touches[0]!.clientY,
        tx: transform.translateX, ty: transform.translateY
      };
    } else if (e.touches.length === 2) {
      pinchRef.current = { distance: distance(e.touches[0]!, e.touches[1]!), scale: transform.scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragRef.current) {
      const drag = dragRef.current;
      const t = e.touches[0]!;
      setTransform((cur) => ({ ...cur, translateX: drag.tx + (t.clientX - drag.x), translateY: drag.ty + (t.clientY - drag.y) }));
    } else if (e.touches.length === 2 && pinchRef.current) {
      const newDist = distance(e.touches[0]!, e.touches[1]!);
      const ratio = newDist / pinchRef.current.distance;
      setTransform((cur) => ({
        ...cur,
        scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current!.scale * ratio))
      }));
    }
  };
  const onTouchEnd = () => { dragRef.current = null; pinchRef.current = null; };

  const actions = (
    <>
      <button type="button" onClick={() => zoomBy(1.25)} className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700" title="Zoom in" aria-label="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => zoomBy(0.8)} className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700" title="Zoom out" aria-label="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </button>
      <button type="button" onClick={rotate} className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700" title="Rotar" aria-label="Rotar">
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" onClick={reset} className="rounded border border-slate-700 bg-slate-800 p-1 hover:bg-slate-700" title="Reset" aria-label="Reset zoom">
        <Maximize2 className="h-4 w-4" />
      </button>
      <span className="font-mono text-xs text-slate-400 tabular-nums">{Math.round(transform.scale * 100)}%</span>
    </>
  );

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose} actions={actions}>
      {!fileUrl ? (
        <ViewerEmpty icon={ImageIcon} message="No se pudo cargar la imagen." />
      ) : load === 'error' ? (
        <ViewerError message={error ?? 'Error desconocido'} />
      ) : (
        <div
          className="relative h-full w-full overflow-hidden bg-slate-950 touch-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          {load === 'loading' && (
            <div className="absolute inset-0 z-10">
              <ViewerLoading label="Cargando imagen..." />
            </div>
          )}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center',
              transition: dragRef.current || pinchRef.current ? 'none' : 'transform 0.1s'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen remota arbitraria con zoom propio */}
            <img
              src={fileUrl}
              alt={docName}
              className="max-h-full max-w-full select-none"
              draggable={false}
              onLoad={() => setLoad('ready')}
              onError={() => { setLoad('error'); setError('No se pudo decodificar la imagen'); }}
            />
          </div>
        </div>
      )}
    </FileViewerShell>
  );
}

function distance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
