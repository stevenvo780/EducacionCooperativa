'use client';

import {
  KanbanSquare,
  FlaskConical,
  BookMarked,
  Zap,
  Plus,
  Bot,
  BookOpen,
  Globe,
  type LucideIcon
} from 'lucide-react';

interface ToolItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}

interface ToolsGalleryProps {
  onOpenBoard: () => void;
  onOpenStRunner: () => void;
  onOpenSemanticBrowser: () => void;
  onOpenFormalizer: () => void;
  onOpenSnippetsGallery: () => void;
  onOpenAgoraAI: () => void;
  isBoardOpen?: boolean;
  isStRunnerOpen?: boolean;
  isSemanticBrowserOpen?: boolean;
  isFormalizerOpen?: boolean;
  isAgoraAIOpen?: boolean;
}

export default function ToolsGallery({
  onOpenBoard,
  onOpenStRunner,
  onOpenSemanticBrowser,
  onOpenFormalizer,
  onOpenSnippetsGallery,
  onOpenAgoraAI,
  isBoardOpen,
  isStRunnerOpen,
  isSemanticBrowserOpen,
  isFormalizerOpen,
  isAgoraAIOpen
}: ToolsGalleryProps) {
  const tools: ToolItem[] = [
    {
      id: 'board',
      label: 'Tablero',
      description: 'Kanban del espacio',
      icon: KanbanSquare,
      accentClass: 'text-mandy-300',
      onClick: onOpenBoard,
      active: isBoardOpen
    },
    {
      id: 'st',
      label: 'ST Logic',
      description: 'Pruebas formales',
      icon: FlaskConical,
      accentClass: 'text-indigo-300',
      onClick: onOpenStRunner,
      active: isStRunnerOpen
    },
    {
      id: 'semantic',
      label: 'Semántica',
      description: 'Mesa semántica',
      icon: BookMarked,
      accentClass: 'text-blue-300',
      onClick: onOpenSemanticBrowser,
      active: isSemanticBrowserOpen
    },
    {
      id: 'formalizer',
      label: 'Formalizar',
      description: 'NL → ST asistido',
      icon: Zap,
      accentClass: 'text-cyan-300',
      onClick: onOpenFormalizer,
      active: isFormalizerOpen
    },
    {
      id: 'snippets',
      label: 'Snippets',
      description: 'Galería reusable',
      icon: Plus,
      accentClass: 'text-amber-300',
      onClick: onOpenSnippetsGallery
    },
    {
      id: 'agora-ai',
      label: 'Agora AI',
      description: 'Chat con contexto',
      icon: Bot,
      accentClass: 'text-sky-300',
      onClick: onOpenAgoraAI,
      active: isAgoraAIOpen
    }
  ];

  const externals: ToolItem[] = [
    {
      id: 'docs',
      label: 'Documentación',
      description: 'Guías y referencias',
      icon: BookOpen,
      accentClass: 'text-surface-300',
      href: '/docs'
    },
    {
      id: 'elenxos',
      label: 'Elenxos',
      description: 'Sitio del ecosistema',
      icon: Globe,
      accentClass: 'text-surface-300',
      href: 'https://www.elenxos.com/'
    }
  ];

  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <header className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        Herramientas
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <Section title="Espacio">
          {tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </Section>
        <Section title="Recursos">
          {externals.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-surface-500">{title}</h3>
      <ul className="grid grid-cols-1 gap-1">{children}</ul>
    </section>
  );
}

function ToolCard({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;
  const inner = (
    <span className={`flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left text-xs transition ${
      tool.active
        ? 'border-mandy-500/30 bg-mandy-500/10 text-mandy-100'
        : 'text-surface-200 hover:border-surface-700/60 hover:bg-surface-800/60'
    }`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-800/80 ${tool.accentClass}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{tool.label}</span>
        <span className="truncate text-[10px] text-surface-500">{tool.description}</span>
      </span>
    </span>
  );

  if (tool.href) {
    return (
      <li>
        <a href={tool.href} target={tool.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener">
          {inner}
        </a>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={tool.onClick} className="block w-full">
        {inner}
      </button>
    </li>
  );
}
