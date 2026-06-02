'use client';

import React from 'react';
import ReactDOM from 'react-dom';
import { Grid3x3 } from 'lucide-react';
import { TABLE_MAX_COLS, TABLE_MAX_ROWS } from './constants';

export function ToolbarShortcutButton({
  title,
  icon,
  onClick,
  disabled = false
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded px-1.5 transition ${
        disabled
          ? 'text-slate-600 cursor-not-allowed'
          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
      }`}
      title={disabled ? `${title} (deshabilitado)` : title}
      aria-label={disabled ? `${title} (deshabilitado)` : title}
    >
      {icon}
    </button>
  );
}

export function TableGridPicker({
  onInsert,
  portalContainer
}: {
  onInsert: (rows: number, cols: number) => void;
  portalContainer?: Element | DocumentFragment | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [hoverRow, setHoverRow] = React.useState(0);
  const [hoverCol, setHoverCol] = React.useState(0);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700 hover:text-white"
        title="Insertar tabla"
      >
        <Grid3x3 className="h-3.5 w-3.5" />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          className="table-grid-popover"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
        >
          <div className="rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-2xl shadow-black/60">
            <div className="mb-3 text-center text-sm font-semibold text-slate-200">
              {hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : 'Tamaño de tabla'}
            </div>
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${TABLE_MAX_COLS}, 1fr)` }}
              onMouseLeave={() => {
                setHoverRow(0);
                setHoverCol(0);
              }}
            >
              {Array.from({ length: TABLE_MAX_ROWS * TABLE_MAX_COLS }, (_, idx) => {
                const row = Math.floor(idx / TABLE_MAX_COLS) + 1;
                const col = (idx % TABLE_MAX_COLS) + 1;
                const active = row <= hoverRow && col <= hoverCol;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`h-[28px] w-[28px] rounded border-2 transition-all duration-100 ${
                      active
                        ? 'border-blue-400 bg-blue-500/50 scale-105'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-400'
                    }`}
                    onMouseEnter={() => {
                      setHoverRow(row);
                      setHoverCol(col);
                    }}
                    onClick={() => {
                      onInsert(row, col);
                      setOpen(false);
                      setHoverRow(0);
                      setHoverCol(0);
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-3 text-center text-xs text-slate-400">
              Máx {TABLE_MAX_ROWS}×{TABLE_MAX_COLS}
            </div>
          </div>
        </div>,
        portalContainer ?? document.body
      )}
    </>
  );
}
