'use client';

import React, { useEffect, useRef } from 'react';
import { type LinterDiagnostic } from '@/hooks/useMarkdownLinter';

const LINTER_OVERLAY_CONTAINER_CLASS = 'mdx-linter-overlay-container';

interface LinterPluginProps {
  diagnostics: LinterDiagnostic[];
  editorShellRef: React.RefObject<HTMLDivElement | null>;
  viewMode: 'edit' | 'preview' | 'raw';
}

/**
 * Finds the DOM Text node and offset for a given 1-based line and column in a contenteditable.
 */
function findDOMPosition(root: HTMLElement, line: number, col: number) {
    const paragraphs = Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'));
    const targetPara = paragraphs[line - 1]; // MDXEditor line-to-paragraph mapping is roughly 1-to-1 for simple docs
    if (!targetPara) return null;

    const walker = document.createTreeWalker(targetPara, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let node = walker.nextNode() as Text | null;

    while (node) {
        const len = node.textContent?.length || 0;
        if (currentOffset + len >= col - 1) {
            return { node, offset: Math.max(0, col - 1 - currentOffset) };
        }
        currentOffset += len;
        node = walker.nextNode() as Text | null;
    }
    return null;
}

export function LinterPlugin({ diagnostics, editorShellRef, viewMode }: LinterPluginProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  const rafIdRef = useRef(0);

  // ── Función de decoración que lee diagnósticos desde ref ──
  const decorateRef = useRef<(() => void) | null>(null);

  // ── Efecto de SETUP: contenedor, observer, scroll (no depende de diagnostics) ──
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

    // Ensure overlay container exists
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

    // ── Función de decoración (lee diagnosticsRef.current) ──
    const decorate = () => {
      const container = containerRef.current;
      if (!container || viewMode !== 'edit') return;
      container.innerHTML = '';

      const currentDiags = diagnosticsRef.current;
      if (currentDiags.length === 0) return;

      const editableRect = editable.getBoundingClientRect();

      currentDiags.forEach((d) => {
        const pos = findDOMPosition(editable, d.line, d.column);
        if (!pos) return;

        try {
          const range = document.createRange();
          const startOffset = Math.min(pos.offset, pos.node.textContent?.length || 0);
          const endOffset = d.endColumn
            ? Math.min(pos.offset + (d.endColumn - d.column), pos.node.textContent?.length || 0)
            : Math.min(startOffset + 1, pos.node.textContent?.length || 0);

          range.setStart(pos.node, startOffset);
          range.setEnd(pos.node, endOffset);

          const rects = range.getClientRects();
          if (rects.length === 0) return;

          Array.from(rects).forEach(rect => {
            const isSTRef = d.source === 'ST-Definitions';
            const borderColor = d.severity === 'error' ? '#ef4444' :
                               d.severity === 'warning' ? '#f59e0b' :
                               isSTRef ? '#06b6d4' : '#3b82f6';

            /* ── Visual underline (no pointer events) ── */
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

            /* ── Transparent hit area covering the full text line ── */
            const hitArea = document.createElement('div');
            hitArea.className = 'mdx-linter-marker group pointer-events-auto';
            hitArea.style.position = 'absolute';
            hitArea.style.top = `${rect.top - editableRect.top + editable.scrollTop}px`;
            hitArea.style.left = `${rect.left - editableRect.left + editable.scrollLeft}px`;
            hitArea.style.width = `${rect.width}px`;
            hitArea.style.height = `${rect.height}px`;
            hitArea.style.cursor = 'help';
            hitArea.style.transition = 'opacity 0.2s';

            const tooltip = document.createElement('div');
            tooltip.className = 'absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2.5 z-[100] min-w-[220px] max-w-[320px] pointer-events-none';

            const isSTDef = d.source === 'ST-Definitions';
            const header = document.createElement('div');
            header.className = 'flex items-center gap-2 mb-1';

            const svgRuler = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-400"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>';

            header.innerHTML = isSTDef ? `
              ${svgRuler}
              <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">ST Reference</span>
              <span class="text-[10px] text-slate-500 ml-auto">${d.source}</span>
            ` : `
              <span class="text-[10px] font-bold uppercase tracking-wider ${
                d.severity === 'error' ? 'text-red-400' :
                d.severity === 'warning' ? 'text-amber-400' :
                'text-blue-400'
              }">${d.severity}</span>
              <span class="text-[10px] text-slate-500 ml-auto">${d.source}</span>
            `;

            const msg = document.createElement('div');
            msg.className = 'text-xs text-slate-200 leading-relaxed';
            msg.innerText = d.message;

            tooltip.appendChild(header);
            tooltip.appendChild(msg);

            if (d.suggestion) {
              const sug = document.createElement('div');
              sug.className = 'mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-400 font-medium';
              const svgBulb = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
              sug.innerHTML = `${svgBulb}<span>${d.suggestion}</span>`;
              tooltip.appendChild(sug);
            }

            hitArea.appendChild(tooltip);
            container.appendChild(hitArea);
          });
        } catch {
          // ignore range errors
        }
      });
    };

    decorateRef.current = decorate;

    // Decoración batched vía rAF para evitar layout thrashing
    const scheduleDecorate = () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(decorate);
    };

    // Decoración inicial
    const timer = setTimeout(scheduleDecorate, 300);

    // Re-decorar en mutaciones del contenido (no de nuestro overlay)
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
  }, [editorShellRef, viewMode]); // NO depende de diagnostics

  // ── Efecto de DECORACIÓN: se ejecuta cuando diagnostics cambian ──
  useEffect(() => {
    if (decorateRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => decorateRef.current?.());
    }
  }, [diagnostics]);

  return null;
}
