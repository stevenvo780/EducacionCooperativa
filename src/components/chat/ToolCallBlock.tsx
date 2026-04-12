'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Wrench, CheckCircle2, AlertTriangle, FileDiff } from 'lucide-react';
import type { AgentTraceStep } from '@/lib/agora-ai/types';

interface ToolCallBlockProps {
  step: AgentTraceStep;
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallBlock({ step }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const icon = step.type === 'error' ? AlertTriangle : step.type === 'tool_result' ? CheckCircle2 : Wrench;
  const Icon = icon;
  const tone = step.type === 'error'
    ? 'border-mandy-500/20 bg-mandy-500/10 text-mandy-200'
    : step.type === 'tool_result'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
      : 'border-sky-500/20 bg-sky-500/10 text-sky-200';

  const details = useMemo(() => {
    if (step.call) return prettyJson(step.call.args);
    if (step.result?.data) return prettyJson(step.result.data);
    return null;
  }, [step.call, step.result]);

  return (
    <div className={`mt-1.5 rounded-md border overflow-hidden ${tone}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-black/10 transition"
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="w-3.5 h-3.5" />
          {step.title}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="border-t border-white/10 px-2.5 pb-2.5 pt-2 text-[11px] space-y-2">
          {step.content && <p className="whitespace-pre-wrap leading-relaxed">{step.content}</p>}
          {step.call && (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80 mb-1">
                <FileDiff className="w-3 h-3" />
                Parámetros
              </div>
              <pre className="overflow-x-auto rounded bg-black/20 p-2 text-[10px] leading-relaxed">{prettyJson(step.call.args)}</pre>
            </div>
          )}
          {!step.call && details && (
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Resultado</div>
              <pre className="overflow-x-auto rounded bg-black/20 p-2 text-[10px] leading-relaxed">{details}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
