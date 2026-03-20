'use client';

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useMarkdownLinter, type LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

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

  useEffect(() => {
    if (viewMode !== 'edit') {
        if (containerRef.current) containerRef.current.innerHTML = '';
        return;
    }

    const shell = editorShellRef.current;
    if (!shell) return;

    const editable = shell.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!editable) return;

    // Ensure container exists
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

    const decorate = () => {
        if (!containerRef.current || viewMode !== 'edit') return;
        const container = containerRef.current;
        container.innerHTML = '';

        const editableRect = editable.getBoundingClientRect();

        diagnostics.forEach((d, idx) => {
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

                // Create underlines for each rect (handles line breaks)
                Array.from(rects).forEach(rect => {
                    const underline = document.createElement('div');
                    underline.className = 'mdx-linter-marker group pointer-events-auto';

                    const isSTRef = d.source === 'ST-Definitions';
                    const borderColor = d.severity === 'error' ? '#ef4444' :
                                       d.severity === 'warning' ? '#f59e0b' :
                                       isSTRef ? '#06b6d4' : '#3b82f6';

                    underline.style.position = 'absolute';
                    underline.style.top = `${rect.bottom - editableRect.top + editable.scrollTop - 2}px`;
                    underline.style.left = `${rect.left - editableRect.left + editable.scrollLeft}px`;
                    underline.style.width = `${rect.width}px`;
                    underline.style.cursor = 'help';
                    underline.style.transition = 'opacity 0.2s';

                    if (isSTRef) {
                      // Dotted cyan underline + subtle background for ST references
                      underline.style.height = '0px';
                      underline.style.borderBottom = '2px dotted #06b6d4';
                      underline.style.top = `${rect.bottom - editableRect.top + editable.scrollTop - 3}px`;
                      // Also add a soft highlight background
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
                    }

                    // Tooltip Root
                    const tooltip = document.createElement('div');
                    tooltip.className = 'absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded shadow-xl p-2 z-[100] min-w-[200px] max-w-[300px] pointer-events-none';

                    const isSTDef = d.source === 'ST-Definitions';
                    const header = document.createElement('div');
                    header.className = 'flex items-center gap-2 mb-1';
                    header.innerHTML = isSTDef ? `
                        <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">📐 ST Reference</span>
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
                        sug.className = 'mt-1 text-[11px] text-cyan-400 font-medium';
                        sug.innerText = `💡 ${d.suggestion}`;
                        tooltip.appendChild(sug);
                    }

                    underline.appendChild(tooltip);
                    container.appendChild(underline);
                });
            } catch (e) {
                // ignore range errors
            }
        });
    };

    // Initial decoration
    const timer = setTimeout(decorate, 500);

    // Re-decorate on changes or scroll
    const observer = new MutationObserver(() => {
        setTimeout(decorate, 100);
    });
    observer.observe(editable, { childList: true, subtree: true, characterData: true });

    const handleScroll = () => decorate();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
        clearTimeout(timer);
        observer.disconnect();
        scrollParent.removeEventListener('scroll', handleScroll);
        if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [diagnostics, editorShellRef, viewMode]);

  return null;
}
