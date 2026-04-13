'use client';

import React, { useEffect, useRef, useState } from 'react';
import { type LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import {
  compareDiagnosticsByPriority,
  compareDiagnosticsForSharedRange,
  getDiagnosticRangeKey
} from '@/lib/markdown-linter/diagnostic-priority';

const LINTER_OVERLAY_CONTAINER_CLASS = 'mdx-linter-overlay-container';
const TOOLTIP_CLASS = 'mdx-linter-tooltip';
const TOOLTIP_GUTTER = 2;
const TOOLTIP_BRIDGE_CLASS = 'mdx-linter-tooltip-bridge';
const DECORATION_CLASS = 'mdx-linter-deco';

interface LinterPluginProps {
  diagnostics: LinterDiagnostic[];
  editorShellRef: React.RefObject<HTMLDivElement | null>;
  viewMode: 'edit' | 'preview' | 'raw';
  content: string;
  onApplyFix?: (diag: LinterDiagnostic, replacement: string) => void;
  onAddToDictionary?: (word: string) => void;
  onIgnoreRule?: (ruleId: string, ruleName: string) => void;
  onIgnoreDiagnostic?: (ruleId: string, text: string, ruleName: string) => void;
  interactive?: boolean;
}

// ── DOM text-index helpers ──────────────────────────────────

interface TextNodeSegment {
  node: Text;
  text: string;
  startOffset: number;
  endOffset: number;
}

interface DocumentTextIndex {
  segments: TextNodeSegment[];
  fullText: string;
  fullTextLower: string;
}

function buildDocumentTextIndex(root: HTMLElement): DocumentTextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const segments: TextNodeSegment[] = [];
  let currentOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const text = node.textContent || '';
    if (text.length > 0) {
      segments.push({ node, text, startOffset: currentOffset, endOffset: currentOffset + text.length });
      currentOffset += text.length;
    }
    node = walker.nextNode() as Text | null;
  }

  const fullText = segments.map(({ text }) => text).join('');
  return { segments, fullText, fullTextLower: fullText.toLowerCase() };
}

function resolveTextPosition(segments: TextNodeSegment[], absoluteOffset: number) {
  if (segments.length === 0) return null;
  const clampedOffset = Math.max(0, absoluteOffset);
  for (const segment of segments) {
    if (clampedOffset < segment.endOffset) {
      return { node: segment.node, offset: clampedOffset - segment.startOffset };
    }
  }
  const lastSegment = segments[segments.length - 1];
  return { node: lastSegment.node, offset: lastSegment.text.length };
}

function isWordBoundaryMatch(text: string, startIdx: number, endIdx: number, targetText: string) {
  const wordCharRegex = /[\p{L}\p{N}\p{M}]/u;
  const startsOnWord = wordCharRegex.test(targetText[0] ?? '');
  const endsOnWord = wordCharRegex.test(targetText[targetText.length - 1] ?? '');
  const previousChar = startIdx > 0 ? text[startIdx - 1] : '';
  const nextChar = endIdx < text.length ? text[endIdx] : '';
  if (startsOnWord && previousChar && wordCharRegex.test(previousChar)) return false;
  if (endsOnWord && nextChar && wordCharRegex.test(nextChar)) return false;
  return true;
}

function findDiagnosticRange(
  textIndex: DocumentTextIndex,
  content: string,
  diag: LinterDiagnostic,
  usedPositions: Set<string>,
): Range | null {
  const lines = content.split('\n');
  const lineIdx = diag.line - 1;

  let targetText = diag.text;
  if (!targetText) {
    if (lineIdx < 0 || lineIdx >= lines.length) return null;
    const colStart = diag.column - 1;
    const colEnd = (diag.endColumn ?? diag.column + 1) - 1;
    targetText = lines[lineIdx].substring(colStart, colEnd);
  }

  if (!targetText || !targetText.trim()) return null;

  const hasWordEdges = /[\p{L}\p{N}\p{M}]/u.test(targetText[0] ?? '')
    || /[\p{L}\p{N}\p{M}]/u.test(targetText[targetText.length - 1] ?? '');

  if (textIndex.segments.length === 0) return null;

  const { segments, fullText, fullTextLower } = textIndex;
  const targetTextLower = targetText.toLowerCase();
  let searchFrom = 0;

  while (true) {
    const idx = fullTextLower.indexOf(targetTextLower, searchFrom);
    if (idx === -1) break;
    const endIdx = idx + targetText.length;

    if (hasWordEdges && !isWordBoundaryMatch(fullText, idx, endIdx, targetText)) {
      searchFrom = idx + 1;
      continue;
    }

    const posKey = `${idx}:${endIdx}`;
    if (!usedPositions.has(posKey)) {
      const startPosition = resolveTextPosition(segments, idx);
      const endPosition = resolveTextPosition(segments, endIdx);
      if (startPosition && endPosition) {
        usedPositions.add(posKey);
        try {
          const range = document.createRange();
          range.setStart(startPosition.node, startPosition.offset);
          range.setEnd(endPosition.node, endPosition.offset);
          return range;
        } catch {
          // Invalid range
        }
      }
    }
    searchFrom = idx + 1;
  }
  return null;
}

// ── SVG icons ───────────────────────────────────────────────

const svgPen = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 flex-shrink-0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const svgRuler = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-400"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>';
const svgBulb = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
const svgWrench = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const svgBook = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M12 6v7"/><path d="M9 10h6"/></svg>';
const svgEyeOff = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></svg>';
const svgToggle = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="8" cy="12" r="2"/></svg>';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function groupDiagnosticsByRange(diagnostics: LinterDiagnostic[]) {
  const groups = new Map<string, LinterDiagnostic[]>();

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

// ── Component ───────────────────────────────────────────────

export function LinterPlugin({ diagnostics, editorShellRef, viewMode, content, onApplyFix, onAddToDictionary, onIgnoreRule, onIgnoreDiagnostic, interactive = true }: LinterPluginProps) {
  // Flipped when contenteditable appears asynchronously (MDXEditor mounts late)
  const [editableReady, setEditableReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  const contentRef = useRef(content);
  contentRef.current = content;
  const onApplyFixRef = useRef(onApplyFix);
  onApplyFixRef.current = onApplyFix;
  const onAddToDictionaryRef = useRef(onAddToDictionary);
  onAddToDictionaryRef.current = onAddToDictionary;
  const onIgnoreRuleRef = useRef(onIgnoreRule);
  onIgnoreRuleRef.current = onIgnoreRule;
  const onIgnoreDiagnosticRef = useRef(onIgnoreDiagnostic);
  onIgnoreDiagnosticRef.current = onIgnoreDiagnostic;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  const rafIdRef = useRef(0);
  const decorateRef = useRef<(() => void) | null>(null);
  const hoverHideTimerRef = useRef(0);

  // Persistent tooltip refs — survive across decorate() calls
  const sharedTooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipVisibleRef = useRef(false);
  const pendingDecorateRef = useRef(false);
  // Cooldown: ignore mouseenter right after hiding tooltip to prevent flicker loop
  const hideCooldownRef = useRef(false);
  // True while mouse hovers any marker — prevents decorate() from destroying hit areas
  const hoverActiveRef = useRef(false);

  // ── Tooltip helpers (stable — operate on refs only) ──

  const hideTooltipFull = () => {
    const tooltip = sharedTooltipRef.current;
    if (!tooltip) return;
    tooltip.classList.add('hidden');
    tooltip.classList.remove('flex');
    tooltip.style.pointerEvents = 'none';
    tooltipVisibleRef.current = false;
    hoverActiveRef.current = false;
    // Remove bridges
    containerRef.current?.querySelectorAll(`.${TOOLTIP_BRIDGE_CLASS}`).forEach(el => el.remove());
    // Set cooldown to prevent mouseenter re-trigger on recreated hit areas
    hideCooldownRef.current = true;
    window.setTimeout(() => { hideCooldownRef.current = false; }, 120);
    // Flush deferred decoration after cooldown
    if (pendingDecorateRef.current) {
      pendingDecorateRef.current = false;
      if (decorateRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        window.setTimeout(() => {
          rafIdRef.current = requestAnimationFrame(() => decorateRef.current?.());
        }, 150);
      }
    }
  };

  const cancelHideTooltip = () => {
    if (hoverHideTimerRef.current) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = 0;
    }
  };

  const scheduleHideTooltip = () => {
    cancelHideTooltip();
    hoverHideTimerRef.current = window.setTimeout(hideTooltipFull, 350);
  };

  // ── Dismiss tooltip on click outside ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const target = e.target as HTMLElement;
      if (target.closest(`.${TOOLTIP_CLASS}`) || target.closest('.mdx-linter-marker')) return;
      hideTooltipFull();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
    };
  }, []);

  // ── Setup effect: container, observers, scroll ──
  // IMPORTANT: Does NOT depend on `interactive` (read via ref) to avoid
  // tearing down the entire overlay on every selection change.
  useEffect(() => {
    if (viewMode !== 'edit') {
      if (containerRef.current) containerRef.current.innerHTML = '';
      sharedTooltipRef.current = null;
      return;
    }

    const shell = editorShellRef.current;
    if (!shell) return;

    const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;

    // MDXEditor may mount contenteditable asynchronously after this effect
    // runs. If not found yet, observe the shell until it appears, then
    // re-run the setup logic by forcing a state-based re-trigger.
    if (!editable) {
      const waitObserver = new MutationObserver(() => {
        const el = shell.querySelector('[contenteditable="true"]');
        if (el) {
          waitObserver.disconnect();
          // Re-trigger this effect by toggling a dummy state
          setEditableReady(prev => !prev);
        }
      });
      waitObserver.observe(shell, { childList: true, subtree: true });
      return () => waitObserver.disconnect();
    }

    const scrollParent = editable.parentElement;
    if (!scrollParent) return;

    // scrollParent must be a positioning context so the overlay container
    // (position:absolute) anchors to it instead of a distant ancestor.
    if (getComputedStyle(scrollParent).position === 'static') {
      scrollParent.style.position = 'relative';
    }

    // ── Ensure overlay container ──
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
        existing.style.overflow = 'visible';
        existing.style.pointerEvents = 'none';
        existing.style.zIndex = '20';
        scrollParent.appendChild(existing);
      }
      containerRef.current = existing;
    }

    const container = containerRef.current;

    // ── Create persistent shared tooltip (survives decorate() calls) ──
    if (!sharedTooltipRef.current || !container.contains(sharedTooltipRef.current)) {
      const tooltip = document.createElement('div');
      tooltip.className = `${TOOLTIP_CLASS} absolute hidden flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2.5 z-[100100] min-w-[220px] max-w-[380px]`;
      tooltip.style.pointerEvents = 'none';

      tooltip.addEventListener('mouseenter', () => cancelHideTooltip());

      tooltip.addEventListener('mouseleave', (e: MouseEvent) => {
        const related = e.relatedTarget as Node | null;
        if (related && (
          (related as HTMLElement).closest?.(`.${TOOLTIP_BRIDGE_CLASS}`) ||
          (related as HTMLElement).closest?.('.mdx-linter-marker')
        )) return;
        scheduleHideTooltip();
      });

      container.appendChild(tooltip);
      sharedTooltipRef.current = tooltip;
    }

    const sharedTooltip = sharedTooltipRef.current;

    // ── Tooltip presentation helpers ──

    const positionTooltip = (targetRect: DOMRect) => {
      const spRect = scrollParent.getBoundingClientRect();
      sharedTooltip.classList.remove('hidden');
      sharedTooltip.classList.add('flex');
      sharedTooltip.style.visibility = 'hidden';

      const baseLeft = targetRect.left - spRect.left + scrollParent.scrollLeft;
      const baseTop = targetRect.top - spRect.top + scrollParent.scrollTop;
      const tooltipWidth = sharedTooltip.offsetWidth || 320;
      const tooltipHeight = sharedTooltip.offsetHeight || 180;
      const minLeft = scrollParent.scrollLeft + 8;
      const maxLeft = scrollParent.scrollLeft + Math.max(8, scrollParent.clientWidth - tooltipWidth - 8);
      const left = Math.min(Math.max(minLeft, baseLeft), maxLeft);

      const preferredTop = baseTop - tooltipHeight - TOOLTIP_GUTTER;
      const fallbackTop = baseTop + targetRect.height + TOOLTIP_GUTTER;
      const tooltipAbove = preferredTop >= scrollParent.scrollTop + 8;
      const top = tooltipAbove ? preferredTop : fallbackTop;

      sharedTooltip.style.left = `${left}px`;
      sharedTooltip.style.top = `${top}px`;
      sharedTooltip.style.visibility = 'visible';
      tooltipVisibleRef.current = true;

      // Bridge — covers the gap between hit area and tooltip
      container.querySelectorAll(`.${TOOLTIP_BRIDGE_CLASS}`).forEach(el => el.remove());
      const bridge = document.createElement('div');
      bridge.className = TOOLTIP_BRIDGE_CLASS;
      bridge.style.position = 'absolute';
      bridge.style.pointerEvents = 'auto';
      bridge.style.zIndex = '100099';

      if (tooltipAbove) {
        bridge.style.left = `${left}px`;
        bridge.style.top = `${top + tooltipHeight}px`;
        bridge.style.width = `${tooltipWidth}px`;
        bridge.style.height = `${Math.max(0, baseTop - (top + tooltipHeight))}px`;
      } else {
        bridge.style.left = `${left}px`;
        bridge.style.top = `${baseTop + targetRect.height}px`;
        bridge.style.width = `${tooltipWidth}px`;
        bridge.style.height = `${Math.max(0, top - (baseTop + targetRect.height))}px`;
      }

      bridge.addEventListener('mouseenter', cancelHideTooltip);
      bridge.addEventListener('mouseleave', (e: MouseEvent) => {
        const related = e.relatedTarget as Node | null;
        if (related && (sharedTooltip.contains(related) || (related as HTMLElement).closest?.('.mdx-linter-marker'))) return;
        scheduleHideTooltip();
      });
      container.appendChild(bridge);
    };

    const showSharedTooltip = (diagGroup: LinterDiagnostic[], targetRect: DOMRect, hasReplacements: boolean) => {
      cancelHideTooltip();
      sharedTooltip.innerHTML = '';

      const [diag, ...secondaryDiagnostics] = diagGroup;
      if (!diag) return;

      const isSTDef = diag.source === 'ST-Definitions';
      const isNote = diag.severity === 'info' && diag.source === 'Nota';
      const header = document.createElement('div');
      header.className = 'flex items-center gap-2 mb-1 pr-5';
      if (isNote) {
        header.innerHTML = `${svgPen}<span class="text-[10px] font-bold uppercase tracking-wider text-amber-400">Nota Semántica</span><span class="text-[10px] text-slate-500 ml-auto">Workspace</span>`;
      } else {
        header.innerHTML = isSTDef
          ? `${svgRuler}<span class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">ST Reference</span><span class="text-[10px] text-slate-500 ml-auto">${escapeHtml(diag.source)}</span>`
          : `<span class="text-[10px] font-bold uppercase tracking-wider ${diag.severity === 'error' ? 'text-red-400' : diag.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}">${escapeHtml(diag.severity)}</span><span class="text-[10px] text-slate-500 ml-auto">${escapeHtml(diag.source)}</span>`;
      }

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

      if (secondaryDiagnostics.length > 0) {
        const extraSection = document.createElement('div');
        extraSection.className = 'mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-1';

        const extraLabel = document.createElement('div');
        extraLabel.className = 'text-[10px] text-slate-500 uppercase tracking-wider font-bold';
        extraLabel.textContent = 'Diagnósticos prioritarios relacionados';
        extraSection.appendChild(extraLabel);

        for (const extraDiagnostic of secondaryDiagnostics.slice(0, 2)) {
          const extraItem = document.createElement('div');
          extraItem.className = 'rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1.5';
          extraItem.innerHTML = `
            <div class="text-[10px] font-bold uppercase tracking-wider ${extraDiagnostic.severity === 'error' ? 'text-red-400' : extraDiagnostic.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}">${escapeHtml(extraDiagnostic.severity)}</div>
            <div class="mt-0.5 text-[11px] text-slate-300 leading-relaxed">${escapeHtml(extraDiagnostic.message)}</div>
          `;
          extraSection.appendChild(extraItem);
        }

        if (secondaryDiagnostics.length > 2) {
          const extraCount = document.createElement('div');
          extraCount.className = 'text-[10px] text-slate-500';
          extraCount.textContent = `+${secondaryDiagnostics.length - 2} diagnóstico(s) adicional(es)`;
          extraSection.appendChild(extraCount);
        }

        sharedTooltip.appendChild(extraSection);
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
            hideTooltipFull();
          });
          fixSection.appendChild(btn);
        }
        sharedTooltip.appendChild(fixSection);
      }

      // ── Action buttons: dictionary, ignore diagnostic, disable rule ──
      const isSpelling = diag.ruleId?.startsWith('spelling_') || diag.source === 'Spelling';
      const diagText = diag.text || '';
      const diagRuleId = diag.ruleId || '';
      const diagRuleName = diag.source || '';
      const hasAnyAction = (isSpelling && diagText) || (diagRuleId && diagText) || diagRuleId;

      if (hasAnyAction) {
        const actionsSection = document.createElement('div');
        actionsSection.className = 'mt-2 pt-2 border-t border-slate-700/60 flex flex-col gap-1';
        const actionsLabel = document.createElement('div');
        actionsLabel.className = 'text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5';
        actionsLabel.textContent = 'Acciones';
        actionsSection.appendChild(actionsLabel);

        const makeLinterActionBtn = (icon: string, label: string, colorClass: string, onClick: () => void) => {
          const btn = document.createElement('button');
          btn.className = `flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs bg-slate-700/50 ${colorClass} transition-colors cursor-pointer border border-transparent hover:border-slate-600/50`;
          btn.innerHTML = `${icon} <span class="font-medium truncate">${escapeHtml(label)}</span>`;
          btn.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            hideTooltipFull();
            onClick();
          });
          return btn;
        };

        // "Add to dictionary" for spelling rules
        if (isSpelling && diagText) {
          actionsSection.appendChild(
            makeLinterActionBtn(svgBook, `Añadir "${diagText}" al diccionario`, 'hover:bg-blue-600/20 text-blue-300 hover:text-blue-200', () => {
              onAddToDictionaryRef.current?.(diagText);
            })
          );
        }

        // "Ignore this diagnostic" (suppress text for this rule)
        if (diagRuleId && diagText) {
          const shortText = diagText.length > 30 ? `${diagText.slice(0, 29)}…` : diagText;
          actionsSection.appendChild(
            makeLinterActionBtn(svgEyeOff, `Ignorar "${shortText}"`, 'hover:bg-slate-600/30 text-slate-400 hover:text-slate-200', () => {
              onIgnoreDiagnosticRef.current?.(diagRuleId, diagText, diagRuleName);
            })
          );
        }

        // "Disable rule"
        if (diagRuleId) {
          actionsSection.appendChild(
            makeLinterActionBtn(svgToggle, `Deshabilitar regla: ${diagRuleName}`, 'hover:bg-amber-600/20 text-amber-400 hover:text-amber-300', () => {
              onIgnoreRuleRef.current?.(diagRuleId, diagRuleName);
            })
          );
        }

        sharedTooltip.appendChild(actionsSection);
      }

      sharedTooltip.style.pointerEvents = (hasReplacements || hasAnyAction) ? 'auto' : 'none';
      positionTooltip(targetRect);
    };

    // ── Decorate: clears only decorations, preserves tooltip ──
    const decorate = () => {
      if (!container || viewMode !== 'edit') return;

      // Defer full rebuild while tooltip is visible or mouse hovers a marker
      // to prevent cursor flickering from hit-area destruction/recreation
      if (tooltipVisibleRef.current || hoverActiveRef.current) {
        pendingDecorateRef.current = true;
        return;
      }
      pendingDecorateRef.current = false;

      // Remove all decoration children but keep the persistent tooltip
      const children = Array.from(container.children);
      for (const child of children) {
        if (child === sharedTooltip) continue;
        // Keep bridge only while tooltip is active
        if (child.classList.contains(TOOLTIP_BRIDGE_CLASS) && tooltipVisibleRef.current) continue;
        container.removeChild(child);
      }

      const currentDiags = diagnosticsRef.current;
      if (currentDiags.length === 0) {
        if (tooltipVisibleRef.current) hideTooltipFull();
        return;
      }

      const spRect = scrollParent.getBoundingClientRect();
      const isInteractive = interactiveRef.current;

      const groupedDiags = groupDiagnosticsByRange(currentDiags)
        .sort((left, right) => compareDiagnosticsForSharedRange(left[0], right[0]));
      const usedPositions = new Set<string>();
      const textIndex = buildDocumentTextIndex(editable);

      groupedDiags.forEach((diagGroup) => {
        const [d] = diagGroup;
        if (!d) return;

        const range = findDiagnosticRange(textIndex, contentRef.current, d, usedPositions);
        if (!range) return;

        try {
          const rects = range.getClientRects();
          if (rects.length === 0) return;

          const isSTRef = d.source === 'ST-Definitions';
          const isNote = d.severity === 'info' && d.source === 'Nota';
          const borderColor = d.severity === 'error' ? '#ef4444' :
                             d.severity === 'warning' ? '#f59e0b' :
                             isNote ? '#f59e0b' :
                             isSTRef ? '#06b6d4' : '#3b82f6';
          const hasReplacements = Boolean(d.replacements && d.replacements.length > 0 && onApplyFixRef.current);

          Array.from(rects).forEach(rect => {
            const underline = document.createElement('div');
            underline.className = DECORATION_CLASS;
            underline.style.position = 'absolute';
            underline.style.left = `${rect.left - spRect.left + scrollParent.scrollLeft}px`;
            underline.style.width = `${rect.width}px`;
            underline.style.pointerEvents = 'none';

            if (isSTRef || isNote) {
              underline.style.height = '0px';
              underline.style.borderBottom = `2px dotted ${borderColor}`;
              underline.style.top = `${rect.bottom - spRect.top + scrollParent.scrollTop - 3}px`;
              const bg = document.createElement('div');
              bg.className = DECORATION_CLASS;
              bg.style.position = 'absolute';
              bg.style.top = `${rect.top - spRect.top + scrollParent.scrollTop}px`;
              bg.style.left = `${rect.left - spRect.left + scrollParent.scrollLeft}px`;
              bg.style.width = `${rect.width}px`;
              bg.style.height = `${rect.height}px`;
              bg.style.backgroundColor = isNote ? 'rgba(245, 158, 11, 0.08)' : 'rgba(6, 182, 212, 0.08)';
              bg.style.borderRadius = '2px';
              bg.style.pointerEvents = 'none';
              container.insertBefore(bg, sharedTooltip);
            } else {
              underline.style.height = '2px';
              underline.style.backgroundColor = borderColor;
              underline.style.top = `${rect.bottom - spRect.top + scrollParent.scrollTop - 2}px`;
            }
            container.insertBefore(underline, sharedTooltip);

            // Per-line hit area: each client rect gets its own hit area
            // to avoid a single bounding-box rectangle that bleeds into
            // adjacent content on multi-line diagnostics.
            if (!isInteractive) return;

            const hitArea = document.createElement('div');
            hitArea.className = `mdx-linter-marker ${DECORATION_CLASS} group pointer-events-auto`;
            hitArea.style.position = 'absolute';
            hitArea.style.top = `${rect.top - spRect.top + scrollParent.scrollTop}px`;
            hitArea.style.left = `${rect.left - spRect.left + scrollParent.scrollLeft}px`;
            hitArea.style.width = `${rect.width}px`;
            hitArea.style.height = `${rect.height}px`;
            hitArea.style.cursor = 'pointer';

            hitArea.addEventListener('mouseenter', () => {
              hoverActiveRef.current = true;
              if (hideCooldownRef.current) return;
              cancelHideTooltip();
              // Use live bounding rect so tooltip position is correct
              // after scroll (static DOMRect snapshots go stale).
              showSharedTooltip(diagGroup, hitArea.getBoundingClientRect(), hasReplacements);
            });

            hitArea.addEventListener('mouseleave', (e: MouseEvent) => {
              const related = e.relatedTarget as Node | null;
              if (related && (
                sharedTooltip.contains(related) ||
                (related as HTMLElement).closest?.(`.${TOOLTIP_BRIDGE_CLASS}`)
              )) return;
              hoverActiveRef.current = false;
              scheduleHideTooltip();
            });

            hitArea.addEventListener('click', (ev) => {
              if (!hasReplacements) return;
              ev.stopPropagation();
              ev.preventDefault();
              showSharedTooltip(diagGroup, hitArea.getBoundingClientRect(), true);
            });

            container.insertBefore(hitArea, sharedTooltip);
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

    // Initial decoration with short delay
    const timer = setTimeout(scheduleDecorate, 150);

    let mutationTimer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(scheduleDecorate, 200);
    });
    observer.observe(editable, { childList: true, subtree: true, characterData: true });

    // On scroll: hide tooltip (position becomes stale) and redecorate
    const handleScroll = () => {
      if (tooltipVisibleRef.current) hideTooltipFull();
      scheduleDecorate();
    };
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(scheduleDecorate, 60);
    });
    resizeObserver.observe(editable);
    resizeObserver.observe(scrollParent);
    resizeObserver.observe(shell);

    const handleWindowResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(scheduleDecorate, 100);
    };
    window.addEventListener('resize', handleWindowResize, { passive: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(mutationTimer);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(rafIdRef.current);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      scrollParent.removeEventListener('scroll', handleScroll);
      if (containerRef.current) containerRef.current.innerHTML = '';
      sharedTooltipRef.current = null;
      tooltipVisibleRef.current = false;
      hoverActiveRef.current = false;
      decorateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorShellRef, viewMode, editableReady]); // NO depende de interactive ni diagnostics

  // ── Re-decorate when diagnostics change ──
  useEffect(() => {
    if (decorateRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => decorateRef.current?.());
    }
  }, [diagnostics]);

  return null;
}
