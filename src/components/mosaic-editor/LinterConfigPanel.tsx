'use client';

import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { Settings2, RotateCcw, ChevronDown, ChevronRight, X, PenLine, Layers, Link, BookOpen, Accessibility, RefreshCw, AlignJustify, GraduationCap, Ruler } from 'lucide-react';
import { MarkdownLinterRegistry, type RuleState } from '@/lib/markdown-linter/registry';
import { RULE_CATEGORY_LABELS, type RuleCategory } from '@/lib/markdown-linter/types';

const RULE_CATEGORY_ICONS: Record<RuleCategory, React.ReactNode> = {
  spelling: <PenLine className="w-3 h-3" />,
  structure: <Layers className="w-3 h-3" />,
  links: <Link className="w-3 h-3" />,
  readability: <BookOpen className="w-3 h-3" />,
  accessibility: <Accessibility className="w-3 h-3" />,
  consistency: <RefreshCw className="w-3 h-3" />,
  whitespace: <AlignJustify className="w-3 h-3" />,
  academic: <GraduationCap className="w-3 h-3" />,
  semantic: <Ruler className="w-3 h-3" />
};

// ── Sync with registry ──────────────────────────────────────

function getSnapshot(): RuleState[] {
  return MarkdownLinterRegistry.getAllRuleStates();
}
function subscribe(cb: () => void): () => void {
  return MarkdownLinterRegistry.subscribe(cb);
}
function getEnabledCount(): string {
  return `${MarkdownLinterRegistry.getEnabledCount()}/${MarkdownLinterRegistry.getTotalCount()}`;
}

// ── Component ───────────────────────────────────────────────

export function LinterConfigPanel() {
  const [open, setOpen] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<RuleCategory>>(new Set());

  const ruleStates = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const countLabel = useSyncExternalStore(subscribe, getEnabledCount, getEnabledCount);

  const toggleCategory = useCallback((cat: RuleCategory) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const grouped = React.useMemo(() => {
    const map = new Map<RuleCategory, RuleState[]>();
    for (const state of ruleStates) {
      const cat = state.meta.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(state);
    }
    return map;
  }, [ruleStates]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        title="Configurar reglas de linting"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span>Linter {countLabel}</span>
      </button>
    );
  }

  return (
    <div className="absolute right-2 top-10 z-50 w-80 max-h-[70vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-200">Reglas de Linting</span>
          <span className="text-[10px] text-slate-500">{countLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => MarkdownLinterRegistry.resetToDefaults()}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            title="Restaurar valores por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rules by category */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Array.from(grouped.entries()).map(([category, rules]) => {
          const isCollapsed = collapsedCats.has(category);
          const enabledInCat = rules.filter(r => r.enabled).length;
          const allEnabled = enabledInCat === rules.length;
          const noneEnabled = enabledInCat === 0;

          return (
            <div key={category} className="rounded-lg border border-slate-800 overflow-hidden">
              {/* Category header */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/40 cursor-pointer select-none"
                   onClick={() => toggleCategory(category)}>
                {isCollapsed
                  ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                <span className="text-xs">{RULE_CATEGORY_ICONS[category]}</span>
                <span className="text-xs font-medium text-slate-300 flex-1">{RULE_CATEGORY_LABELS[category]}</span>
                <span className="text-[10px] text-slate-500">{enabledInCat}/{rules.length}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    MarkdownLinterRegistry.setCategoryEnabled(category, !allEnabled);
                  }}
                  className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    allEnabled
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      : noneEnabled
                        ? 'bg-slate-700/50 text-slate-500 hover:bg-slate-700'
                        : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  }`}
                  title={allEnabled ? 'Desactivar todas' : 'Activar todas'}
                >
                  {allEnabled ? 'ON' : noneEnabled ? 'OFF' : 'MIX'}
                </button>
              </div>

              {/* Individual rules */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-800/60">
                  {rules.map(({ meta, enabled }) => (
                    <label
                      key={meta.id}
                      className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => MarkdownLinterRegistry.toggleRule(meta.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-200 leading-tight">{meta.name}</div>
                        <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{meta.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
