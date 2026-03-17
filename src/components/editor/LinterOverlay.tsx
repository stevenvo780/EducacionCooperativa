'use client';

import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import type { Diagnostic as STDiagnostic } from '@stevenvo780/st-lang/api';

type GenericDiagnostic = LinterDiagnostic | STDiagnostic;

interface LinterOverlayProps {
  diagnostics: GenericDiagnostic[];
  content: string;
  lineHeight?: number;
  charWidth?: number;
  paddingTop?: number;
  paddingLeft?: number;
  scrollTop?: number;
  scrollLeft?: number;
}

export function LinterOverlay({
  diagnostics,
  content,
  lineHeight = 24, // MDX raw is 24, ST is 20
  charWidth = 7.8,
  paddingTop = 16,
  paddingLeft = 20,
  scrollTop = 0,
  scrollLeft = 0
}: LinterOverlayProps) {
  const lines = useMemo(() => content.split('\n'), [content]);

  if (diagnostics.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[50]">
      {diagnostics.map((d, i) => {
        const line = d.line ?? 1;
        const col = d.column ?? 1;
        
        // Basic positioning
        const top = (line - 1) * lineHeight + paddingTop - scrollTop + (lineHeight - 2);
        const left = (col - 1) * charWidth + paddingLeft - scrollLeft;
        
        // Calculate width (if endColumn is provided)
        let width = charWidth;
        if ('endColumn' in d && d.endColumn) {
            width = ((d.endColumn as number) - col) * charWidth;
        } else if ('text' in d && typeof d.text === 'string') {
            // Some ST diagnostics might have text or we can infer from line
            width = charWidth * 3; // fallback
        }

        const severityColor = d.severity === 'error' ? 'rgba(239, 68, 68, 0.4)' : 
                             d.severity === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 
                             'rgba(59, 130, 246, 0.4)';

        const borderColor = d.severity === 'error' ? '#ef4444' : 
                           d.severity === 'warning' ? '#f59e0b' : 
                           '#3b82f6';

        return (
          <div
            key={i}
            className="absolute group pointer-events-auto"
            style={{
              top,
              left,
              width: Math.max(width, 4),
              height: 2,
              backgroundColor: borderColor,
              boxShadow: `0 1px 2px ${severityColor}`,
              cursor: 'help'
            }}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded shadow-xl p-2 z-[100] min-w-[200px] max-w-[300px]">
                <div className="flex items-center gap-2 mb-1">
                    {d.severity === 'error' ? <AlertCircle className="w-3 h-3 text-red-400" /> :
                     d.severity === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-400" /> :
                     <Info className="w-3 h-3 text-blue-400" />}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        d.severity === 'error' ? 'text-red-400' :
                        d.severity === 'warning' ? 'text-amber-400' :
                        'text-blue-400'
                    }`}>
                        {d.severity}
                    </span>
                    {'source' in d && <span className="text-[10px] text-slate-500 ml-auto">{d.source}</span>}
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                    {d.message}
                </div>
                {'suggestion' in d && d.suggestion && (
                    <div className="mt-1 text-[11px] text-cyan-400 font-medium">
                        💡 {d.suggestion}
                    </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
