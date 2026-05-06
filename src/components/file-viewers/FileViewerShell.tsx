'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import './file-viewers.css';

interface FileViewerShellProps {
  docName: string;
  fileUrl?: string | null;
  onClose?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function FileViewerShell({
  docName,
  fileUrl,
  onClose,
  actions,
  children
}: FileViewerShellProps) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
          )}
          {onClose && <div className="h-4 w-px bg-slate-700" />}
          <span className="truncate text-xs font-medium text-slate-400" title={docName}>
            {docName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {fileUrl && (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              >
                Abrir
              </a>
              <a
                href={fileUrl}
                download
                className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-500"
              >
                Descargar
              </a>
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-slate-900">
        {children}
      </div>
    </div>
  );
}
