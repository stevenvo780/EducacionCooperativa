'use client';

import { memo, useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentThinkingBlockProps {
  content: string;
  defaultOpen?: boolean;
}

function AgentThinkingBlockImpl({ content, defaultOpen = false }: AgentThinkingBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-1.5 rounded-md border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-violet-200 hover:bg-violet-500/10 transition"
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Brain className="w-3.5 h-3.5" />
          Razonamiento del agente
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 text-xs text-violet-100/90 whitespace-pre-wrap leading-relaxed border-t border-violet-500/15">
          {content}
        </div>
      )}
    </div>
  );
}

export const AgentThinkingBlock = memo(AgentThinkingBlockImpl, (prev, next) => (
  prev.defaultOpen === next.defaultOpen
  && prev.content.length === next.content.length
  && prev.content === next.content
));
