'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, type Transition } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  Terminal,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Cpu,
  AlertCircle
} from 'lucide-react';

export type DistroId = 'fedora' | 'debian' | 'arch' | 'mac';

interface DistroOption {
  id: DistroId;
  label: string;
  short: string;
  engine: 'podman' | 'docker';
  available: boolean;
}

const DISTROS: DistroOption[] = [
  { id: 'fedora', label: 'Fedora / RHEL', short: 'Fedora', engine: 'podman', available: true },
  { id: 'debian', label: 'Ubuntu / Debian', short: 'Ubuntu', engine: 'docker', available: true },
  { id: 'arch', label: 'Arch / Manjaro', short: 'Arch', engine: 'docker', available: true },
  { id: 'mac', label: 'Mac (próximamente)', short: 'Mac', engine: 'docker', available: false }
];

const INSTALL_SCRIPT_URL = 'https://raw.githubusercontent.com/stevenvo780/agora-worker/master/scripts/install-worker.sh';

interface WorkerInstallModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
  isOwner: boolean;
  modalFade?: Transition;
  modalPop?: Transition;
}

const defaultFade: Transition = { duration: 0.15 };
const defaultPop: Transition = { type: 'spring', stiffness: 320, damping: 26 };

const WorkerInstallModal = ({
  open,
  onClose,
  workspaceId,
  workspaceName,
  isOwner,
  modalFade = defaultFade,
  modalPop = defaultPop
}: WorkerInstallModalProps) => {
  const [distro, setDistro] = useState<DistroId>('fedora');
  const [copied, setCopied] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const copy = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  }, []);

  const wsId = workspaceId?.trim() || '<TU_WORKSPACE_ID>';

  const autoScript = useMemo(() => {
    return [
      `curl -sLO ${INSTALL_SCRIPT_URL}`,
      'chmod +x install-worker.sh',
      `WORKER_SECRET=<pedile-al-admin> ./install-worker.sh ${wsId}`
    ].join('\n');
  }, [wsId]);

  const manualPodman = useMemo(() => {
    return [
      '# Fedora / RHEL — Podman',
      'sudo dnf install -y podman',
      'podman pull docker.io/stevenvo780/edu-worker:latest',
      'podman run -d \\',
      `  --name edu-worker-${wsId} \\`,
      '  --network=host \\',
      '  --security-opt label=disable \\',
      `  -e WORKER_TOKEN=${wsId} \\`,
      '  -e WORKER_SECRET=<pedile-al-admin> \\',
      '  -e NEXUS_URL=https://hub.humanizar-dev.cloud \\',
      `  -v $HOME/edu-worker/${wsId}:/workspace \\`,
      '  docker.io/stevenvo780/edu-worker:latest'
    ].join('\n');
  }, [wsId]);

  const manualDocker = useMemo(() => {
    return [
      '# Ubuntu / Debian / Arch — Docker',
      '# Ubuntu/Debian: sudo apt install -y docker.io',
      '# Arch:          sudo pacman -S docker',
      'sudo usermod -aG docker $USER  # logout y login otra vez',
      'docker pull stevenvo780/edu-worker:latest',
      'docker run -d \\',
      `  --name edu-worker-${wsId} \\`,
      '  --network=host \\',
      `  -e WORKER_TOKEN=${wsId} \\`,
      '  -e WORKER_SECRET=<pedile-al-admin> \\',
      '  -e NEXUS_URL=https://hub.humanizar-dev.cloud \\',
      `  -v $HOME/edu-worker/${wsId}:/workspace \\`,
      '  stevenvo780/edu-worker:latest'
    ].join('\n');
  }, [wsId]);

  const manualScript = distro === 'fedora' ? manualPodman : manualDocker;

  if (!open) return null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={modalFade}
        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
      >
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Conectar mi computadora como worker"
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
                <Cpu className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Convertí tu computadora en un worker</h2>
                <p className="mt-1 text-xs leading-relaxed text-surface-400">
                  Conectá tu laptop a tu workspace personal y usá tu propia máquina como terminal de Agora.
                  Workspace: <span className="text-surface-200">{workspaceName ?? 'sin workspace activo'}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-surface-400 hover:bg-surface-800/70 hover:text-white"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {!isOwner && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Solo el owner del workspace puede provisionar workers nuevos. Pedile al admin del workspace
                  que ejecute este flujo o te genere un worker dedicado.
                </p>
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-1 rounded-md border border-surface-700/40 bg-surface-925/40 p-1">
              {DISTROS.map((d) => {
                const active = distro === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!d.available}
                    onClick={() => d.available && setDistro(d.id)}
                    className={`flex-1 min-w-[110px] rounded px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-mandy-500/15 text-white'
                        : d.available
                          ? 'text-surface-300 hover:bg-surface-800/60'
                          : 'cursor-not-allowed text-surface-600'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <section className="space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                  <Terminal className="h-3.5 w-3.5" />
                  Script automático (recomendado)
                </h3>
                <button
                  type="button"
                  onClick={() => void copy('auto', autoScript)}
                  disabled={!isOwner}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied === 'auto' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === 'auto' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="overflow-x-auto rounded bg-surface-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
{autoScript}
              </pre>
              <p className="text-[11px] leading-relaxed text-surface-500">
                El script detecta tu distribución (Fedora→Podman, Ubuntu/Arch→Docker), instala el motor
                de contenedores si hace falta y arranca el worker como servicio. Path por defecto del
                workspace en disco: <code className="rounded bg-surface-900 px-1 text-surface-300">~/edu-worker/{wsId}</code>.
              </p>
            </section>

            <div className="mt-3 flex items-start gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-[11px] text-sky-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <div className="space-y-1">
                <p className="font-medium text-sky-200">¿De dónde sale WORKER_SECRET?</p>
                <p className="text-sky-100/90">
                  Es un secreto global del hub que el admin distribuye por canal seguro (no por la web).
                  Pedíselo al admin de tu instancia o, si auto-hosteás, copialo de tu archivo
                  <code className="mx-1 rounded bg-surface-950 px-1 font-mono text-sky-200">.env</code>
                  del hub (variable <code className="mx-1 rounded bg-surface-950 px-1 font-mono text-sky-200">WORKER_SECRET</code>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="mt-4 flex items-center gap-1 text-[11px] font-medium text-surface-300 hover:text-white"
            >
              {manualOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Ver pasos manuales ({DISTROS.find((d) => d.id === distro)?.engine === 'podman' ? 'Podman' : 'Docker'})
            </button>
            {manualOpen && (
              <section className="mt-2 space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                    Manual — {DISTROS.find((d) => d.id === distro)?.short}
                  </h3>
                  <button
                    type="button"
                    onClick={() => void copy('manual', manualScript)}
                    disabled={!isOwner}
                    className="flex items-center gap-1 rounded bg-surface-700 px-2 py-1 text-[11px] font-medium text-surface-100 hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied === 'manual' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === 'manual' ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded bg-surface-950 p-3 font-mono text-[11px] leading-relaxed text-surface-200">
{manualScript}
                </pre>
              </section>
            )}

            <button
              type="button"
              onClick={() => setTroubleshootOpen((v) => !v)}
              className="mt-4 flex items-center gap-1 text-[11px] font-medium text-surface-300 hover:text-white"
            >
              {troubleshootOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Troubleshooting
            </button>
            {troubleshootOpen && (
              <section className="mt-2 space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3 text-[11px] text-surface-300">
                <details className="rounded border border-surface-700/40 bg-surface-900/40 p-2">
                  <summary className="cursor-pointer text-surface-200">Permission denied al ejecutar docker</summary>
                  <p className="mt-1 leading-relaxed text-surface-400">
                    Agregá tu usuario al grupo docker y reiniciá sesión:
                    <code className="mx-1 rounded bg-surface-950 px-1 font-mono text-surface-200">sudo usermod -aG docker $USER</code>.
                    En Fedora con Podman no hace falta — corre rootless.
                  </p>
                </details>
                <details className="rounded border border-surface-700/40 bg-surface-900/40 p-2">
                  <summary className="cursor-pointer text-surface-200">SELinux bloquea el bind mount (Fedora)</summary>
                  <p className="mt-1 leading-relaxed text-surface-400">
                    Agregá <code className="rounded bg-surface-950 px-1 font-mono text-surface-200">--security-opt label=disable</code>
                    al <code className="rounded bg-surface-950 px-1 font-mono text-surface-200">podman run</code> o etiquetá el
                    directorio con <code className="rounded bg-surface-950 px-1 font-mono text-surface-200">chcon -Rt container_file_t ~/edu-worker</code>.
                  </p>
                </details>
                <details className="rounded border border-surface-700/40 bg-surface-900/40 p-2">
                  <summary className="cursor-pointer text-surface-200">Worker aparece como desconectado</summary>
                  <p className="mt-1 leading-relaxed text-surface-400">
                    Verificá que <code className="rounded bg-surface-950 px-1 font-mono text-surface-200">NEXUS_URL=https://hub.humanizar-dev.cloud</code>
                    sea accesible (<code className="rounded bg-surface-950 px-1 font-mono text-surface-200">curl -I $NEXUS_URL</code>) y
                    que el firewall no bloquee egreso por 443. Revisá logs con
                    <code className="mx-1 rounded bg-surface-950 px-1 font-mono text-surface-200">docker logs edu-worker-{wsId}</code>.
                  </p>
                </details>
                <details className="rounded border border-surface-700/40 bg-surface-900/40 p-2">
                  <summary className="cursor-pointer text-surface-200">&quot;unauthorized&quot; en el handshake</summary>
                  <p className="mt-1 leading-relaxed text-surface-400">
                    Tu WORKER_SECRET no coincide con el del hub. Asegurate de no copiar espacios o
                    saltos de línea al final. Si lo pegás desde shell, usá
                    <code className="mx-1 rounded bg-surface-950 px-1 font-mono text-surface-200">printf &apos;%s&apos; &quot;valor&quot;</code>.
                  </p>
                </details>
              </section>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-surface-700/40 bg-surface-925/40 px-5 py-3">
            <a
              href="https://github.com/stevenvo780/agora-worker#readme"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] text-surface-400 hover:text-surface-200 hover:underline"
            >
              Ver docs completas en GitHub
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-surface-700 px-3 py-1.5 text-[11px] font-medium text-surface-100 hover:bg-surface-600"
            >
              Cerrar
            </button>
          </footer>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
};

export default WorkerInstallModal;
