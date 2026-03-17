'use client';

import React, { useEffect, useRef } from 'react';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

export interface ContextMenuSection {
  actions: ContextMenuAction[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  sections: ContextMenuSection[];
  onClose: () => void;
}

export function ContextMenu({ x, y, sections, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Ajustar posicion para no salirse de pantalla
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  }, [x, y]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const nonEmptySections = sections.filter(s => s.actions.length > 0);
  if (nonEmptySections.length === 0) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {nonEmptySections.map((section, si) => (
          <React.Fragment key={si}>
            {si > 0 && <div className="border-t border-surface-700 my-1" />}
            {section.actions.map((action, ai) => (
              <button
                key={ai}
                onClick={() => { action.onClick(); onClose(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-700 transition-colors ${
                  action.destructive ? 'text-red-400' : 'text-slate-200'
                }`}
              >
                {action.icon && (
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {action.icon}
                  </span>
                )}
                {action.label}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
