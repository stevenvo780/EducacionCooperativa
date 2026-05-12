'use client';

import { useCallback, useEffect } from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import {
  X,
  Sparkles,
  Bot,
  Network,
  KeyRound,
  FilePlus,
  GitBranch,
  Package,
  Cpu,
  Zap,
  Smartphone,
  Database,
  type LucideIcon
} from 'lucide-react';

interface WhatsNewItem {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  description: string;
}

const ITEMS: WhatsNewItem[] = [
  {
    icon: Bot,
    iconClass: 'text-mandy-300 bg-mandy-500/15',
    title: 'Agente IA con memoria persistente',
    description: 'Tus conversaciones se sincronizan en todos tus dispositivos. Conectá tu clave de OpenAI, DeepSeek o Anthropic una sola vez en Settings.'
  },
  {
    icon: Network,
    iconClass: 'text-sky-300 bg-sky-500/15',
    title: 'Grafo de citaciones',
    description: 'La mesa semántica ahora muestra un grafo navegable de cómo se conectan tus documentos. Tab "Grafo".'
  },
  {
    icon: KeyRound,
    iconClass: 'text-emerald-300 bg-emerald-500/15',
    title: 'Claves IA cifradas',
    description: 'Tus API keys se guardan en backend con AES-256-GCM, no en el navegador. Cross-device, seguras.'
  },
  {
    icon: FilePlus,
    iconClass: 'text-amber-300 bg-amber-500/15',
    title: 'Otros formatos de archivo',
    description: 'Crear .py, .yaml, .json, .editorconfig, dotfiles. Botón "Otro formato" en Nuevo archivo.'
  },
  {
    icon: GitBranch,
    iconClass: 'text-purple-300 bg-purple-500/15',
    title: 'Conexión Git externa',
    description: 'Conectá tu workspace con GitHub, GitLab o SSH. Settings → Acceso Git → Importar repo.'
  },
  {
    icon: Package,
    iconClass: 'text-cyan-300 bg-cyan-500/15',
    title: 'Archivos grandes',
    description: 'Subida multipart para archivos >50 MB. Sin más errores de timeout al cargar bases de datos o assets.'
  },
  {
    icon: Cpu,
    iconClass: 'text-rose-300 bg-rose-500/15',
    title: 'Worker propio en Linux',
    description: 'Convertí tu computadora en un worker (Fedora con Podman, Ubuntu o Arch con Docker). Settings → "Mi computadora como worker".'
  },
  {
    icon: Zap,
    iconClass: 'text-yellow-300 bg-yellow-500/15',
    title: 'Editor más rápido',
    description: 'KaTeX, Mermaid, tablas y código sólo cargan si tu documento los usa. Carga inicial 40% más liviana.'
  },
  {
    icon: Smartphone,
    iconClass: 'text-indigo-300 bg-indigo-500/15',
    title: 'PWA instalable',
    description: 'Agora funciona como app nativa en mobile y desktop. Botón "Instalar" en tu browser.'
  },
  {
    icon: Database,
    iconClass: 'text-teal-300 bg-teal-500/15',
    title: 'Backups automáticos',
    description: 'Tus datos se respaldan cada día en GCS + NAS.'
  }
];

export const WHATS_NEW_STORAGE_KEY = 'agora-whats-new-v1.0:dismissed';

interface WhatsNewModalProps {
  open: boolean;
  version?: string;
  onDismiss: () => void;
  modalFade?: Transition;
  modalPop?: Transition;
}

const defaultFade: Transition = { duration: 0.15 };
const defaultPop: Transition = { type: 'spring', stiffness: 320, damping: 26 };

const WhatsNewModal = ({
  open,
  version = 'v1.0',
  onDismiss,
  modalFade = defaultFade,
  modalPop = defaultPop
}: WhatsNewModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={modalFade}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
        onClick={handleDismiss}
      >
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label={`Novedades ${version}`}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={modalPop}
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-surface-700/60 bg-surface-900 shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-700/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mandy-500/15 text-mandy-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Novedades {version}</h2>
                <p className="mt-1 text-xs text-surface-400">
                  Lo nuevo en este release. Echá un vistazo antes de seguir.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-surface-400 hover:bg-surface-800/70 hover:text-white"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <ul className="space-y-2">
              {ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-3 rounded-lg border border-surface-700/40 bg-surface-925/40 p-3"
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.iconClass}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-surface-100">{item.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-surface-400">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-surface-700/40 bg-surface-925/40 px-5 py-3">
            <a
              href="/changelog"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] text-surface-400 hover:text-surface-200 hover:underline"
            >
              Ver detalle completo
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded bg-mandy-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-mandy-500"
            >
              Entendido, no mostrar más
            </button>
          </footer>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
};

export default WhatsNewModal;
