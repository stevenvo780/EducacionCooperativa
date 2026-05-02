'use client';

import React from 'react';

interface SemanticPanelColumnProps {
  title: string;
  emptyLabel: string;
  items: Array<{ title: string; subtitle: string; meta: string }>;
}

export function SemanticPanelColumn({ title, emptyLabel, items }: SemanticPanelColumnProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] leading-5 text-slate-500">{emptyLabel}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-2">
              <div className="text-xs font-medium text-slate-200">{item.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-400">{item.subtitle}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.meta}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
