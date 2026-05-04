'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { BookMarked, CheckSquare, Eye, FileCode2, Library, Maximize2, Minimize2, Settings2, Sparkles } from 'lucide-react';
import type { ViewMode } from '@/components/mosaic-editor/types';

interface EditorUtilityMenuProps {
  anchor: {
    id: string;
    x: number;
    y: number;
  };
  isFullscreen: boolean;
  showToolsPanel: boolean;
  showSnippetGallery: boolean;
  viewMode: ViewMode;
  onClose: () => void;
  onToggleToolsPanel: () => void;
  onOpenSemanticDesk: () => void;
  onResetToolbar: () => void;
  onToggleFullscreen: () => void;
  onToggleSnippetGallery: () => void;
  onToggleRawMode: () => void;
  onTogglePreviewMode: () => void;
  onScanPendings: () => void;
}

export function EditorUtilityMenu({
  anchor,
  isFullscreen,
  showToolsPanel,
  showSnippetGallery,
  viewMode,
  onClose,
  onToggleToolsPanel,
  onOpenSemanticDesk,
  onResetToolbar,
  onToggleFullscreen,
  onToggleSnippetGallery,
  onToggleRawMode,
  onTogglePreviewMode,
  onScanPendings
}: EditorUtilityMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y, maxHeight: 420 });
  const [isPositionReady, setIsPositionReady] = useState(false);

  useEffect(() => {
    setIsPositionReady(false);
  }, [anchor.id]);

  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const computePosition = () => {
      if (!menuRef.current) return;
      const gutter = 12;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const menuWidth = menuRef.current.offsetWidth || 296;
      const menuHeight = menuRef.current.offsetHeight || 420;
      const left = Math.min(Math.max(gutter, anchor.x), viewportWidth - menuWidth - gutter);
      const top = Math.min(Math.max(gutter, anchor.y), viewportHeight - menuHeight - gutter);

      setPosition({
        left,
        top,
        maxHeight: Math.max(220, viewportHeight - gutter * 2)
      });
      setIsPositionReady(true);
    };

    computePosition();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(computePosition);
    observer.observe(menuRef.current);
    window.addEventListener('resize', computePosition);
    window.visualViewport?.addEventListener('resize', computePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computePosition);
      window.visualViewport?.removeEventListener('resize', computePosition);
    };
  }, [anchor.id, anchor.x, anchor.y, viewMode, showSnippetGallery, showToolsPanel, isFullscreen]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const content = (
    <div
      ref={menuRef}
      className="fixed z-[100000] w-[296px] rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-2xl shadow-black/60 backdrop-blur"
      style={{
        left: position.left,
        top: position.top,
        maxHeight: position.maxHeight,
        overflowY: 'auto',
        visibility: isPositionReady ? 'visible' : 'hidden'
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            <Settings2 className="h-3.5 w-3.5" /> Utilidades
          </div>
          <p className="text-xs leading-5 text-slate-400">Accesos rápidos del editor para cuando no hay una selección activa.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-200">Cerrar</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <UtilityButton icon={<Settings2 className="h-3.5 w-3.5" />} label={showToolsPanel ? 'Ocultar herramientas' : 'Editar herramientas'} onClick={onToggleToolsPanel} />
        <UtilityButton icon={<BookMarked className="h-3.5 w-3.5" />} label="Mesa semántica" onClick={onOpenSemanticDesk} />
        <UtilityButton icon={<CheckSquare className="h-3.5 w-3.5" />} label="Escanear pendientes" onClick={onScanPendings} />
        <UtilityButton icon={<Sparkles className="h-3.5 w-3.5" />} label="Restaurar barra" onClick={onResetToolbar} />
        <UtilityButton icon={<Library className="h-3.5 w-3.5" />} label={showSnippetGallery ? 'Ocultar snippets' : 'Galería de snippets'} onClick={onToggleSnippetGallery} />
        <UtilityButton icon={isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />} label={isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'} onClick={onToggleFullscreen} />
        <UtilityButton icon={<FileCode2 className="h-3.5 w-3.5" />} label={viewMode === 'raw' ? 'Volver a editor visual' : 'Abrir modo raw'} onClick={onToggleRawMode} />
        <UtilityButton icon={<Eye className="h-3.5 w-3.5" />} label={viewMode === 'preview' ? 'Volver a edición' : 'Abrir vista previa'} onClick={onTogglePreviewMode} />
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(content, document.body);
}

function UtilityButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-900"
    >
      <span className="text-blue-300">{icon}</span>
      <span className="leading-5">{label}</span>
    </button>
  );
}
