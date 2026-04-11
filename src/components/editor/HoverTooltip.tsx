'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getTokenAtPosition, getHoverInfo, type HoverData } from './st-editor';

interface HoverTooltipProps {
  code: string;
  /** Ref to the <pre> overlay element */
  preRef: React.RefObject<HTMLPreElement | null>;
  lineHeight: number;
  charWidth: number;
  paddingTop: number;
  paddingLeft: number;
  scrollTop: number;
  scrollLeft: number;
  /** Extra X offset (e.g. gutter width) */
  gutterWidth: number;
}

interface TooltipState {
  data: HoverData;
  x: number;
  y: number;
  tokenText: string;
}

export function HoverTooltip({
  code,
  preRef,
  lineHeight,
  charWidth,
  paddingTop,
  paddingLeft,
  scrollTop,
  scrollLeft,
  gutterWidth: _gutterWidth
}: HoverTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const pre = preRef.current;
      if (!pre) return;

      const rect = pre.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft - paddingLeft;
      const y = e.clientY - rect.top + scrollTop - paddingTop;

      const line = Math.floor(y / lineHeight) + 1;
      const col = Math.floor(x / charWidth);

      if (line < 1 || col < 0) {
        setTooltip(null);
        return;
      }

      const token = getTokenAtPosition(code, line, col);
      if (!token) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setTooltip(null), 200);
        return;
      }

      const hoverData = getHoverInfo(token.text, token.category);
      if (!hoverData) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setTooltip(null), 200);
        return;
      }

      // Clear any pending hide
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // Position tooltip above the token
      const tooltipX = token.start * charWidth + paddingLeft - scrollLeft;
      const tooltipY = (line - 1) * lineHeight + paddingTop - scrollTop - 4;

      setTooltip({
        data: hoverData,
        x: tooltipX,
        y: tooltipY,
        tokenText: token.text
      });
    },
    [code, preRef, lineHeight, charWidth, paddingTop, paddingLeft, scrollTop, scrollLeft]
  );

  const handleMouseLeave = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setTooltip(null), 300);
  }, []);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    pre.addEventListener('mousemove', handleMouseMove);
    pre.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      pre.removeEventListener('mousemove', handleMouseMove);
      pre.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [preRef, handleMouseMove, handleMouseLeave]);

  if (!tooltip) return null;

  const categoryColors: Record<string, string> = {
    keyword: 'text-violet-400 bg-violet-400/10',
    alias: 'text-violet-300 bg-violet-300/10',
    operator: 'text-cyan-400 bg-cyan-400/10',
    builtin: 'text-blue-400 bg-blue-400/10',
    profile: 'text-green-400 bg-green-400/10'
  };

  const colorClass = categoryColors[tooltip.data.category ?? 'keyword'] ?? 'text-slate-300 bg-slate-700';

  return (
    <div
      ref={tooltipRef}
      className="absolute z-[200] pointer-events-none"
      style={{
        left: Math.max(0, tooltip.x),
        top: 0,
        transform: `translateY(${tooltip.y}px) translateY(-100%)`
      }}
    >
      <div className="bg-slate-900 border border-slate-600/80 rounded-lg shadow-2xl p-2.5 max-w-[340px] min-w-[180px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${colorClass}`}>
            {tooltip.data.category ?? 'info'}
          </span>
          <span className="text-xs font-bold text-slate-100 font-mono">
            {tooltip.data.title}
          </span>
        </div>

        {/* Description */}
        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
          {tooltip.data.description}
        </p>

        {/* Example */}
        {tooltip.data.example && (
          <div className="mt-1.5 bg-slate-800/80 rounded px-2 py-1 border border-slate-700/50">
            <pre className="text-[10px] text-indigo-300 font-mono whitespace-pre-wrap leading-4">
              {tooltip.data.example}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
