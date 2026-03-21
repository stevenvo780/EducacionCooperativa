'use client';

import React, { useEffect, useRef, useState } from 'react';
import { type LinterDiagnostic } from '@/hooks/useMarkdownLinter';

const LINTER_OVERLAY_CONTAINER_CLASS = 'mdx-linter-overlay-container';
const TOOLTIP_CLASS = 'mdx-linter-tooltip';
const TOOLTIP_GUTTER = 8;

interface LinterPluginProps {
  diagnostics: LinterDiagnostic[];
  editorShellRef: React.RefObject<HTMLDivElement | null>;
  viewMode: 'edit' | 'preview' | 'raw';
  content: string;
  onApplyFix?: (diag: LinterDiagnostic, replacement: string) => void;
  interactive?: boolean;
}

/**
 * Finds a Range in the DOM for a diagnostic by searching for its actual text content.
 * This is robust against code blocks, LaTeX, Mermaid, etc. that break line-based mapping.
 */
function findDiagnosticRange(
  root: HTMLElement,
  content: string,
  diag: LinterDiagnostic,
  usedPositions: Set<string>,
): Range | null {
  const lines = content.split('\n');
  const lineIdx = diag.line - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  const colStart = diag.column - 1;
  const colEnd = (diag.endColumn ?? diag.column + 1) - 1;
  const targetText = lines[lineIdx].substring(colStart, colEnd);
  if (!targetText || !targetText.trim()) return null;

  // Walk all text nodes and search for targetText
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const text = node.textContent || '';
    let searchFrom = 0;

    while (true) {
      // Case-insensitive search to handle capitalization differences
      const idx = text.toLowerCase().indexOf(targetText.toLowerCase(), searchFrom);
      if (idx === -1) break;

      // Build a unique key for this occurrence to avoid duplicates
      // Use the DOM node + character index as identifier
      const nodeId = (node as unknown as { __linterId?: number }).__linterId ??
        ((node as unknown as { __linterId: number }).__linterId = Math.random());
      const posKey = `${nodeId}:${idx}`;

      if (!usedPositions.has(posKey)) {
        usedPositions.add(posKey);
        try {
          const range = document.createRange();
          const endIdx = Math.min(idx + targetText.length, text.length);
          range.setStart(node, idx);
          range.setEnd(node, endIdx);
          return range;
        } catch {
          // Invalid range
        }
      }
      searchFrom = idx + 1;
    }
    node = walker.nextNode() as Text | null;
  }
  return null;
}

// ── SVG icons ───────────────────────────────────────────────

const svgRuler = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-400"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>';
const svgBulb = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
const svgWrench = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const svgX = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function dismissAllTooltips(container: HTMLElement) {
  container.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('flex');
    (el as HTMLDivElement).style.pointerEvents = 'none';
  });
}

function showTooltip(tooltip: HTMLDivElement, allowInteraction: boolean) {
  tooltip.classList.remove('hidden');
  tooltip.classList.add('flex');
  tooltip.style.pointerEvents = allowInteraction ? 'auto' : 'none';
}

function hideTooltip(tooltip: HTMLDivElement) {
  tooltip.classList.add('hidden');
  tooltip.classList.remove('flex');
  tooltip.style.pointerEvents = 'none';
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function LinterPlugin({ diagnostics, editorShellRef, viewMode, content, onApplyFix, interactive = true }: LinterPluginProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  const contentRef = useRef(content);
  contentRef.current = content;
  const onApplyFixRef = useRef(onApplyFix);
  onApplyFixRef.current = onApplyFix;
  const rafIdRef = useRef(0);
  const decorateRef = useRef<(() => void) | null>(null);
  const hoverHideTimerRef = useRef(0);
  const [hasActiveTextSelection, setHasActiveTextSelection] = useState(false);

  useEffect(() => {
    const updateSelectionState = () => {
      const shell = editorShellRef.current;
      if (!shell) {
        setHasActiveTextSelection(false);
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLTextAreaElement && shell.contains(activeElement)) {
        setHasActiveTextSelection((activeElement.selectionStart ?? 0) !== (activeElement.selectionEnd ?? 0));
        return;
      }

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        setHasActiveTextSelection(false);
        return;
      }

      const range = domSelection.getRangeAt(0);
      setHasActiveTextSelection(shell.contains(range.commonAncestorContainer));
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
  }, [editorShellRef]);

  const linterInteractive = interactive && !hasActiveTextSelection;

  // ── Dismiss tooltip on click outside ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const target = e.target as HTMLElement;
      if (target.closest(`.${TOOLTIP_CLASS}`) || target.closest('.mdx-linter-marker')) return;
      dismissAllTooltips(container);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverHideTimerRef.current) {
        window.clearTimeout(hoverHideTimerRef.current);
      }
    };
  }, []);

  // ── Efecto de SETUP: contenedor, observer, scroll ──
  useEffect(() => {
    if (viewMode !== 'edit') {
      if (containerRef.current) containerRef.current.innerHTML = '';
      return;
    }

    const shell = editorShellRef.current;
    if (!shell) return;

    const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!editable) return;

    const scrollParent = editable.parentElement;
    if (!scrollParent) return;

    if (!containerRef.current) {
      let existing = scrollParent.querySelector(`.${LINTER_OVERLAY_CONTAINER_CLASS}`) as HTMLDivElement | null;
      if (!existing) {
        existing = document.createElement('div');
        existing.className = LINTER_OVERLAY_CONTAINER_CLASS;
        existing.style.position = 'absolute';
        existing.style.top = '0';
        existing.style.left = '0';
        existing.style.width = '100%';
        existing.style.height = '0';
        existing.style.pointerEvents = 'none';
        existing.style.zIndex = '20';
        scrollParent.appendChild(existing);
      }
      containerRef.current = existing;
    }

    // ── Decoración ──
    const decorate = () => {
      const container = containerRef.current;
      if (!container || viewMode !== 'edit') return;
      container.innerHTML = '';

      const currentDiags = diagnosticsRef.current;
      if (currentDiags.length === 0) return;

      const editableRect = editable.getBoundingClientRect();
      const sharedTooltip = document.createElement('div');
      sharedTooltip.className = `${TOOLTIP_CLASS} absolute hidden flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2.5 z-[100100] min-w-[220px] max-w-[380px]`;
      sharedTooltip.style.pointerEvents = 'none';

      const scheduleHideTooltip = () => {
        if (hoverHideTimerRef.current) {
          window.clearTimeout(hoverHideTimerRef.current);
        }
        hoverHideTimerRef.current = window.setTimeout(() => hideTooltip(sharedTooltip), 90);
      };

      const positionTooltip = (targetRect: DOMRect) => {
        showTooltip(sharedTooltip, sharedTooltip.style.pointerEvents === 'auto');
        sharedTooltip.style.visibility = 'hidden';

        const baseLeft = targetRect.left - editableRect.left + editable.scrollLeft;
        const baseTop = targetRect.top - editableRect.top + editable.scrollTop;
        const tooltipWidth = sharedTooltip.offsetWidth || 320;
        const tooltipHeight = sharedTooltip.offsetHeight || 180;
        const minLeft = editable.scrollLeft + 8;
        const maxLeft = editable.scrollLeft + Math.max(8, scrollParent.clientWidth - tooltipWidth - 8);
        const left = Math.min(Math.max(minLeft, baseLeft), maxLeft);

        const preferredTop = baseTop - tooltipHeight - TOOLTIP_GUTTER;
        const fallbackTop = baseTop + targetRect.height + TOOLTIP_GUTTER;
        const top = preferredTop >= editable.scrollTop + 8 ? preferredTop : fallbackTop;

        sharedTooltip.style.left = `${left}px`;
        sharedTooltip.style.top = `${top}px`;
        sharedTooltip.style.visibility = 'visible';
      };

      const showSharedTooltip = (diag: LinterDiagnostic, targetRect: DOMRect, hasReplacements: boolean) => {
        if (hoverHideTimerRef.current) {
          window.clearTimeout(hoverHideTimerRef.current);
          hoverHideTimerRef.current = 0;
        }

        sharedTooltip.innerHTML = '';

        const isSTDef = diag.source === 'ST-Definitions';
        const header = document.createElement('div');
        header.className = 'flex items-center gap-2 mb-1 pr-5';
        header.innerHTML = isSTDef ? `
          ${svgRuler}
          <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">ST Reference</span>
          <span class="text-[10px] text-slate-500 ml-auto">${escapeHtml(diag.source)}</span>
        ` : `
          <span class="text-[10px] font-bold uppercase tracking-wider ${
            diag.severity === 'error' ? 'text-red-400' :
            diag.severity === 'warning' ? 'text-amber-400' :
            'text-blue-400'
          }">${escapeHtml(diag.severity)}</span>
          <span class="text-[10px] text-slate-500 ml-auto">${escapeHtml(diag.source)}</span>
        `;

        const msg = document.createElement('div');
        msg.className = 'text-xs text-slate-200 leading-relaxed';
        msg.textContent = diag.message;

        sharedTooltip.appendChild(header);
        sharedTooltip.appendChild(msg);

        if (diag.suggestion) {
          const sug = document.createElement('div');
          sug.className = 'mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-400 font-medium';
          sug.innerHTML = `${svgBulb}<span>${escapeHtml(diag.suggestion)}</span>`;
          sharedTooltip.appendChild(sug);
        }

        if (hasReplacements && diag.replacements) {
          const fixSection = document.createElement('div');
          fixSection.className = 'mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-1';

          const fixLabel = document.createElement('div');
          fixLabel.className = 'text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1';
          fixLabel.innerHTML = `${svgWrench} <span>Correcciones rápidas</span>`;
          fixSection.appendChild(fixLabel);

          for (const replacement of diag.replacements) {
            const btn = document.createElement('button');
            btn.className = 'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs bg-slate-700/50 hover:bg-blue-600/30 text-slate-200 hover:text-blue-300 transition-colors cursor-pointer border border-transparent hover:border-blue-500/30';
            const displayText = replacement === '' ? '(eliminar)' : replacement;
            btn.innerHTML = `<span class="text-blue-400 font-mono text-[11px] font-bold shrink-0">→</span> <span class="font-medium truncate">${escapeHtml(displayText)}</span>`;
            btn.addEventListener('click', (event) => {
              event.stopPropagation();
              event.preventDefault();
              onApplyFixRef.current?.(diag, replacement);
              hideTooltip(sharedTooltip);
            });
            fixSection.appendChild(btn);
          }

          sharedTooltip.appendChild(fixSection);
        }

        sharedTooltip.style.pointerEvents = hasReplacements ? 'auto' : 'none';
        showTooltip(sharedTooltip, hasReplacements);
        positionTooltip(targetRect);
      };

      sharedTooltip.addEventListener('mouseenter', () => {
        if (hoverHideTimerRef.current) {
          window.clearTimeout(hoverHideTimerRef.current);
          hoverHideTimerRef.current = 0;
        }
      });

      sharedTooltip.addEventListener('mouseleave', () => {
        scheduleHideTooltip();
      });

      container.appendChild(sharedTooltip);

      // Sort diagnostics by position for consistent text-search matching
      const sortedDiags = [...currentDiags].sort((a, b) =>
        a.line !== b.line ? a.line - b.line : a.column - b.column
      );
      const usedPositions = new Set<string>();

      sortedDiags.forEach((d) => {
        const range = findDiagnosticRange(editable, contentRef.current, d, usedPositions);
        if (!range) return;

        try {
          const rects = range.getClientRects();
          if (rects.length === 0) return;

          Array.from(rects).forEach(rect => {
            const isSTRef = d.source === 'ST-Definitions';
            const borderColor = d.severity === 'error' ? '#ef4444' :
                               d.severity === 'warning' ? '#f59e0b' :
                               isSTRef ? '#06b6d4' : '#3b82f6';

            /* ── Visual underline ── */
            const underline = document.createElement('div');
            underline.style.position = 'absolute';
            underline.style.left = `${rect.left - editableRect.left + editable.scrollLeft}px`;
            underline.style.width = `${rect.width}px`;
            underline.style.pointerEvents = 'none';

            if (isSTRef) {
              underline.style.height = '0px';
              underline.style.borderBottom = '2px dotted #06b6d4';
              underline.style.top = `${rect.bottom - editableRect.top + editable.scrollTop - 3}px`;
              const bg = document.createElement('div');
              bg.style.position = 'absolute';
              bg.style.top = `${rect.top - editableRect.top + editable.scrollTop}px`;
              bg.style.left = `${rect.left - editableRect.left + editable.scrollLeft}px`;
              bg.style.width = `${rect.width}px`;
              bg.style.height = `${rect.height}px`;
              bg.style.backgroundColor = 'rgba(6, 182, 212, 0.08)';
              bg.style.borderRadius = '2px';
              bg.style.pointerEvents = 'none';
              container.appendChild(bg);
            } else {
              underline.style.height = '2px';
              underline.style.backgroundColor = borderColor;
              underline.style.top = `${rect.bottom - editableRect.top + editable.scrollTop - 2}px`;
            }
            container.appendChild(underline);

            if (!linterInteractive) {
              return;
            }

            /* ── Hit area ── */
            const hitArea = document.createElement('div');
            hitArea.className = 'mdx-linter-marker group pointer-events-auto';
            hitArea.style.position = 'absolute';
            hitArea.style.top = `${rect.top - editableRect.top + editable.scrollTop}px`;
            hitArea.style.left = `${rect.left - editableRect.left + editable.scrollLeft}px`;
            hitArea.style.width = `${rect.width}px`;
            hitArea.style.height = `${rect.height}px`;
            hitArea.style.transition = 'opacity 0.2s';

            const hasReplacements = d.replacements && d.replacements.length > 0 && onApplyFixRef.current;
            hitArea.style.cursor = hasReplacements ? 'pointer' : 'help';

            hitArea.addEventListener('mouseenter', () => {
              if (hoverHideTimerRef.current) {
                window.clearTimeout(hoverHideTimerRef.current);
                hoverHideTimerRef.current = 0;
              }
              dismissAllTooltips(container);
              showSharedTooltip(d, rect, Boolean(hasReplacements));
            });

            hitArea.addEventListener('mouseleave', () => {
              scheduleHideTooltip();
            });

            hitArea.addEventListener('click', (e) => {
              if (!hasReplacements) {
                return;
              }
              e.stopPropagation();
              e.preventDefault();
              showSharedTooltip(d, rect, true);
            });

            container.appendChild(hitArea);
          });
        } catch {
          // ignore range errors
        }
      });
    };

    decorateRef.current = decorate;

    const scheduleDecorate = () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(decorate);
    };

    const timer = setTimeout(scheduleDecorate, 300);

    let mutationTimer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(scheduleDecorate, 150);
    });
    observer.observe(editable, { childList: true, subtree: true, characterData: true });

    const handleScroll = () => scheduleDecorate();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(mutationTimer);
      cancelAnimationFrame(rafIdRef.current);
      observer.disconnect();
      scrollParent.removeEventListener('scroll', handleScroll);
      if (containerRef.current) containerRef.current.innerHTML = '';
      decorateRef.current = null;
    };
  }, [editorShellRef, linterInteractive, viewMode]); // NO depende de diagnostics

  // ── Efecto de DECORACIÓN: se ejecuta cuando diagnostics cambian ──
  useEffect(() => {
    if (decorateRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => decorateRef.current?.());
    }
  }, [diagnostics]);

  return null;
}
