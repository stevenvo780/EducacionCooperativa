'use client';

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Lightbulb, Ruler, Wrench, PenLine } from 'lucide-react';
import type { LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import type { Diagnostic as STDiagnostic } from '@stevenvo780/st-lang/api';
import {
  compareDiagnosticsByPriority,
  compareDiagnosticsForOverlay,
  getDiagnosticRangeKey
} from '@/lib/markdown-linter/diagnostic-priority';

type GenericDiagnostic = LinterDiagnostic | STDiagnostic;

function groupDiagnosticsByRange(diagnostics: GenericDiagnostic[]) {
  const groups = new Map<string, GenericDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const key = getDiagnosticRangeKey(diagnostic);
    const group = groups.get(key);
    if (group) {
      group.push(diagnostic);
    } else {
      groups.set(key, [diagnostic]);
    }
  }

  return Array.from(groups.values()).map((group) => group.sort(compareDiagnosticsByPriority));
}

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
  interactive?: boolean;
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
  onApplyFix,
  interactive = true
}: LinterOverlayProps) {
  const _lines = useMemo(() => content.split('\n'), [content]);
  const orderedDiagnosticGroups = useMemo(
    () => groupDiagnosticsByRange(diagnostics).sort((left, right) => compareDiagnosticsForOverlay(left[0], right[0])),
    [diagnostics]
  );
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null);
  const [hoverTooltipKey, setHoverTooltipKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const [hasActiveTextSelection, setHasActiveTextSelection] = useState(false);

  useEffect(() => {
    const updateSelectionState = () => {
      const overlay = overlayRef.current;
      const parent = overlay?.parentElement;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLTextAreaElement && parent?.contains(activeElement)) {
        setHasActiveTextSelection((activeElement.selectionStart ?? 0) !== (activeElement.selectionEnd ?? 0));
        return;
      }
      setHasActiveTextSelection(false);
    };

    updateSelectionState();
    document.addEventListener('selectionchange', updateSelectionState);
    window.addEventListener('mouseup', updateSelectionState, true);
    window.addEventListener('keyup', updateSelectionState, true);

    return () => {
      document.removeEventListener('selectionchange', updateSelectionState);
      window.removeEventListener('mouseup', updateSelectionState, true);
      window.removeEventListener('keyup', updateSelectionState, true);
    };
  }, []);

  const linterInteractive = interactive && !hasActiveTextSelection;

  const handleFixClick = useCallback(
    (line: number, replacement: string) => {
      onApplyFix?.(line, replacement);
      setOpenTooltipKey(null);
      setHoverTooltipKey(null);
    },
    [onApplyFix]
  );

  useEffect(() => {
    if (!linterInteractive) {
      setOpenTooltipKey(null);
      setHoverTooltipKey(null);
    }
  }, [linterInteractive]);

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current !== null) {
        window.clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      if (event.target instanceof Node && overlay.contains(event.target)) return;
      setOpenTooltipKey(null);
      setHoverTooltipKey(null);
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, []);

  if (diagnostics.length === 0) return null;

  return (
    <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden z-[100050]">
      {orderedDiagnosticGroups.map((diagnosticGroup, i) => {
        const [d, ...secondaryDiagnostics] = diagnosticGroup;
        if (!d) return null;

        const tooltipKey = `${getDiagnosticRangeKey(d)}:${i}`;
        const quickFixes = generateQuickFixes(d, content);
        const supportsPinnedTooltip = quickFixes.length > 0 && Boolean(onApplyFix);
        const isTooltipOpen = linterInteractive && (openTooltipKey === tooltipKey || (hoverTooltipKey === tooltipKey && openTooltipKey === null));
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
        const isNote = d.severity === 'info' && 'source' in d && d.source === 'Nota';
        const borderColor = d.severity === 'error' ? '#ef4444'
                           : d.severity === 'warning' ? '#f59e0b'
                           : isNote ? '#f59e0b'
                           : isSTRef ? '#06b6d4' : '#3b82f6';

        const severityColor = d.severity === 'error' ? 'rgba(239, 68, 68, 0.4)'
                             : d.severity === 'warning' ? 'rgba(245, 158, 11, 0.4)'
                             : isNote ? 'rgba(245, 158, 11, 0.15)'
                             : isSTRef ? 'rgba(6, 182, 212, 0.15)' : 'rgba(59, 130, 246, 0.4)';

        return (
          <React.Fragment key={i}>
            {/* Soft background highlight for ST references */}
            {(isSTRef || isNote) && (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: (line - 1) * lineHeight + paddingTop - scrollTop,
                  left,
                  width: Math.max(width, 4),
                  height: lineHeight,
                  backgroundColor: isNote ? 'rgba(245, 158, 11, 0.08)' : 'rgba(6, 182, 212, 0.06)',
                  borderRadius: '2px'
                }}
              />
            )}
            {/* Visual underline — no pointer events */}
            <div
              className="absolute pointer-events-none"
              style={{
                top,
                left,
                width: Math.max(width, 4),
                height: (isSTRef || isNote) ? 0 : 2,
                backgroundColor: (isSTRef || isNote) ? 'transparent' : borderColor,
                borderBottom: (isSTRef || isNote) ? `2px dotted ${borderColor}` : 'none',
                boxShadow: (isSTRef || isNote) ? 'none' : `0 1px 2px ${severityColor}`
              }}
            />
            {/* Transparent hit area covering full text line */}
            <div
              className={linterInteractive ? 'absolute group pointer-events-auto' : 'absolute pointer-events-none'}
              style={{
                top: (line - 1) * lineHeight + paddingTop - scrollTop,
                left,
                width: Math.max(width, 4),
                height: lineHeight,
                cursor: linterInteractive ? (supportsPinnedTooltip ? 'pointer' : 'help') : 'default'
              }}
              onMouseEnter={() => {
                if (!linterInteractive || openTooltipKey) return;
                if (hoverCloseTimerRef.current !== null) {
                  window.clearTimeout(hoverCloseTimerRef.current);
                  hoverCloseTimerRef.current = null;
                }
                setHoverTooltipKey(tooltipKey);
              }}
              onMouseLeave={(e) => {
                if (!linterInteractive || openTooltipKey) return;
                // Don't hide if moving into the tooltip (child of this same div)
                const related = e.relatedTarget as Node | null;
                if (related && e.currentTarget.contains(related)) return;
                if (hoverCloseTimerRef.current !== null) {
                  window.clearTimeout(hoverCloseTimerRef.current);
                }
                hoverCloseTimerRef.current = window.setTimeout(() => {
                  setHoverTooltipKey((current) => current === tooltipKey ? null : current);
                }, 350);
              }}
              onMouseDown={(event) => {
                if (!linterInteractive || !supportsPinnedTooltip) return;
                event.preventDefault();
                event.stopPropagation();
                if (hoverCloseTimerRef.current !== null) {
                  window.clearTimeout(hoverCloseTimerRef.current);
                  hoverCloseTimerRef.current = null;
                }
                setOpenTooltipKey((current) => current === tooltipKey ? null : tooltipKey);
                setHoverTooltipKey(null);
              }}
            >
            {/* Tooltip */}
            <div
              className={linterInteractive ? 'absolute bottom-full left-0 mb-0.5 flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 z-[100100] min-w-[220px] max-w-[320px]' : 'hidden'}
              style={{ display: isTooltipOpen ? 'flex' : 'none' }}
              onMouseEnter={() => {
                if (hoverCloseTimerRef.current !== null) {
                  window.clearTimeout(hoverCloseTimerRef.current);
                  hoverCloseTimerRef.current = null;
                }
              }}
              onMouseLeave={(e) => {
                if (openTooltipKey === tooltipKey) return;
                // Don't hide if moving back to the hit area parent
                const related = e.relatedTarget as Node | null;
                if (related && e.currentTarget.parentElement?.contains(related)) return;
                hoverCloseTimerRef.current = window.setTimeout(() => {
                  setHoverTooltipKey((current) => current === tooltipKey ? null : current);
                }, 350);
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-1">
                {isNote ? <PenLine className="w-3 h-3 text-amber-400 flex-shrink-0" /> :
                 isSTRef ? <Ruler className="w-3 h-3 text-cyan-400 flex-shrink-0" /> :
                 d.severity === 'error' ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> :
                 d.severity === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" /> :
                 <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isNote ? 'text-amber-400' :
                  isSTRef ? 'text-cyan-400' :
                  d.severity === 'error' ? 'text-red-400' :
                  d.severity === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                  {isNote ? 'Nota Semántica' : isSTRef ? 'ST Reference' : d.severity}
                </span>
                {'source' in d && <span className="text-[10px] text-slate-500 ml-auto">{isNote ? 'Workspace' : d.source}</span>}
              </div>
              <div className="text-xs text-slate-200 leading-relaxed">
                {d.message}
              </div>
              {'suggestion' in d && d.suggestion && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-400 font-medium">
                  <Lightbulb className="w-3 h-3 shrink-0 mt-px" />
                  <span>{d.suggestion}</span>
                </div>
              )}
              {secondaryDiagnostics.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Diagnósticos prioritarios relacionados
                  </div>
                  {secondaryDiagnostics.slice(0, 2).map((secondaryDiagnostic, secondaryIndex) => (
                    <div
                      key={secondaryIndex}
                      className="rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1.5"
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${
                        secondaryDiagnostic.severity === 'error' ? 'text-red-400' :
                        secondaryDiagnostic.severity === 'warning' ? 'text-amber-400' :
                        'text-blue-400'
                      }`}>
                        {secondaryDiagnostic.severity}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-300 leading-relaxed">
                        {secondaryDiagnostic.message}
                      </div>
                    </div>
                  ))}
                  {secondaryDiagnostics.length > 2 && (
                    <div className="text-[10px] text-slate-500">
                      +{secondaryDiagnostics.length - 2} diagnóstico(s) adicional(es)
                    </div>
                  )}
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
