'use client';

import React, { useMemo, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, Wrench } from 'lucide-react';
import type { LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import type { Diagnostic as STDiagnostic } from '@stevenvo780/st-lang/api';

type GenericDiagnostic = LinterDiagnostic | STDiagnostic;

// ── Quick-fix definitions ───────────────────────────────────

interface QuickFix {
  label: string;
  /** Text to insert/replace */
  replacement: string;
  /** Range to replace (line, col, endCol) */
  range?: { line: number; col: number; endCol: number };
}

function generateQuickFixes(d: GenericDiagnostic, content: string): QuickFix[] {
  const fixes: QuickFix[] = [];
  const msg = d.message.toLowerCase();
  const line = d.line ?? 1;
  const lines = content.split('\n');
  const lineText = lines[line - 1] ?? '';

  // Suggestion-based fix
  if ('suggestion' in d && d.suggestion) {
    // Try to extract a fixable suggestion
    const sugText = String(d.suggestion);
    if (sugText.includes('→') || sugText.includes('->')) {
      const parts = sugText.split(/→|->/).map(s => s.trim());
      if (parts.length === 2 && parts[1]) {
        fixes.push({ label: `Reemplazar con: ${parts[1]}`, replacement: parts[1] });
      }
    }
  }

  // Missing profile
  if (msg.includes('profile') || msg.includes('perfil')) {
    if (!content.includes('logic ')) {
      fixes.push({
        label: 'Insertar logic classical.propositional',
        replacement: 'logic classical.propositional\n'
      });
    }
  }

  // Typo suggestions for common keywords
  const typoMap: Record<string, string> = {
    'axion': 'axiom', 'theorm': 'theorem', 'theroem': 'theorem',
    'chek': 'check', 'proove': 'prove',
    'satisafiable': 'satisfiable', 'equvalent': 'equivalent',
    'foall': 'forall', 'exsts': 'exists',
    'asume': 'assume', 'inport': 'import', 'exort': 'export',
    'teory': 'theory', 'extens': 'extends', 'prive': 'private',
    'whle': 'while', 'prnt': 'print', 'retur': 'return'
  };

  // Check first word on error line
  const firstWord = lineText.trim().split(/\s/)[0]?.toLowerCase();
  if (firstWord && typoMap[firstWord]) {
    fixes.push({
      label: `¿Quisiste decir "${typoMap[firstWord]}"?`,
      replacement: typoMap[firstWord]
    });
  }

  return fixes;
}

// ── Props ───────────────────────────────────────────────────

interface LinterOverlayProps {
  diagnostics: GenericDiagnostic[];
  content: string;
  lineHeight?: number;
  charWidth?: number;
  paddingTop?: number;
  paddingLeft?: number;
  scrollTop?: number;
  scrollLeft?: number;
  onApplyFix?: (line: number, replacement: string) => void;
}

export function LinterOverlay({
  diagnostics,
  content,
  lineHeight = 24,
  charWidth = 7.8,
  paddingTop = 16,
  paddingLeft = 20,
  scrollTop = 0,
  scrollLeft = 0,
  onApplyFix
}: LinterOverlayProps) {
  const lines = useMemo(() => content.split('\n'), [content]);

  const handleFixClick = useCallback(
    (line: number, replacement: string) => {
      onApplyFix?.(line, replacement);
    },
    [onApplyFix]
  );

  if (diagnostics.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[50]">
      {diagnostics.map((d, i) => {
        const line = d.line ?? 1;
        const col = d.column ?? 1;

        const top = (line - 1) * lineHeight + paddingTop - scrollTop + (lineHeight - 2);
        const left = (col - 1) * charWidth + paddingLeft - scrollLeft;

        let width = charWidth;
        if ('endColumn' in d && d.endColumn) {
          width = ((d.endColumn as number) - col) * charWidth;
        } else if ('text' in d && typeof d.text === 'string') {
          width = charWidth * 3;
        }

        const isSTRef = 'source' in d && d.source === 'ST-Definitions';
        const borderColor = d.severity === 'error' ? '#ef4444'
                           : d.severity === 'warning' ? '#f59e0b'
                           : isSTRef ? '#06b6d4' : '#3b82f6';

        const severityColor = d.severity === 'error' ? 'rgba(239, 68, 68, 0.4)'
                             : d.severity === 'warning' ? 'rgba(245, 158, 11, 0.4)'
                             : isSTRef ? 'rgba(6, 182, 212, 0.15)' : 'rgba(59, 130, 246, 0.4)';

        const quickFixes = generateQuickFixes(d, content);

        return (
          <React.Fragment key={i}>
            {/* Soft background highlight for ST references */}
            {isSTRef && (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: (line - 1) * lineHeight + paddingTop - scrollTop,
                  left,
                  width: Math.max(width, 4),
                  height: lineHeight,
                  backgroundColor: 'rgba(6, 182, 212, 0.06)',
                  borderRadius: '2px'
                }}
              />
            )}
            <div
              className="absolute group pointer-events-auto"
              style={{
                top,
                left,
                width: Math.max(width, 4),
                height: isSTRef ? 0 : 2,
                backgroundColor: isSTRef ? 'transparent' : borderColor,
                borderBottom: isSTRef ? `2px dotted ${borderColor}` : 'none',
                boxShadow: isSTRef ? 'none' : `0 1px 2px ${severityColor}`,
                cursor: 'help'
              }}
            >
            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 z-[100] min-w-[220px] max-w-[320px]">
              <div className="flex items-center gap-2 mb-1">
                {isSTRef ? <span className="text-sm">📐</span> :
                 d.severity === 'error' ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> :
                 d.severity === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" /> :
                 <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isSTRef ? 'text-cyan-400' :
                  d.severity === 'error' ? 'text-red-400' :
                  d.severity === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                  {isSTRef ? 'ST Reference' : d.severity}
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

              {/* Quick-fix buttons */}
              {quickFixes.length > 0 && onApplyFix && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 space-y-1">
                  {quickFixes.map((fix, fi) => (
                    <button
                      key={fi}
                      className="flex items-center gap-1.5 w-full text-left text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded px-1.5 py-0.5 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFixClick(line, fix.replacement);
                      }}
                    >
                      <Wrench className="w-3 h-3 flex-shrink-0" />
                      {fix.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
