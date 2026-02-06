'use client';

import { useState } from 'react';
import { ArrowLeft, Terminal, Server, Download, Settings, Users, RefreshCw, Shield, HardDrive, BookOpen, ChevronDown, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative my-3">
      {label && <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 font-semibold">{label}</div>}
      <div className="bg-surface-950 border border-surface-700/50 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800/50 border-b border-surface-700/30">
          <span className="text-[10px] text-surface-500 font-mono">bash</span>
          <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-emerald-400 transition">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="p-3 text-sm text-emerald-300 overflow-x-auto font-mono leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );
}

function Section({ id, icon: Icon, title, children, defaultOpen = false }: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="border border-surface-700/40 rounded-xl overflow-hidden bg-surface-800/30 backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-700/30 transition"
      >
        <div className="p-2 rounded-lg bg-mandy-500/10 border border-mandy-500/20">
          <Icon className="w-5 h-5 text-mandy-400" />
        </div>
        <span className="flex-1 text-lg font-semibold text-surface-100">{title}</span>
        {open ? <ChevronDown className="w-5 h-5 text-surface-500" /> : <ChevronRight className="w-5 h-5 text-surface-500" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 text-surface-300 text-sm leading-relaxed border-t border-surface-700/30 pt-4">{children}</div>}
    </section>
  );
}

function CommandRef({ cmd, desc, example }: { cmd: string; desc: string; example?: string }) {
  return (
    <div className="border border-surface-700/40 rounded-lg p-4 bg-surface-800/40">
      <div className="flex items-start gap-3">
        <code className="text-mandy-400 font-bold text-sm whitespace-nowrap">{cmd}</code>
        <p className="text-surface-400 text-sm flex-1">{desc}</p>
      </div>
      {example && <CopyBlock code={example} />}
    </div>
  );
}

export default function DocsPage() {
  const sections = [
    { id: 'overview', label: 'Visión General' },
    { id: 'install', label: 'Instalación' },
    { id: 'commands', label: 'Comandos' },
    { id: 'config', label: 'Configuración' },
    { id: 'architecture', label: 'Arquitectura' },
    { id: 'persistence', label: 'Persistencia' },
    { id: 'troubleshooting', label: 'Solución de Problemas' },
    { id: 'shared', label: 'Espacios Compartidos' },
    { id: 'security', label: 'Seguridad' },
    { id: 'updates', label: 'Actualización' }
  ];

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-900/90 backdrop-blur border-b border-surface-700/50">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-6 py-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-surface-700/50 transition text-surface-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-mandy-400" />
            <h1 className="text-lg font-bold text-white">Documentación — Edu Worker</h1>
          </div>
          <div className="flex-1" />
          <span className="text-xs bg-mandy-500/20 text-mandy-400 px-2 py-0.5 rounded-full border border-mandy-500/30 font-mono">v1.0.10</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-48 shrink-0 sticky top-20 self-start space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-surface-500 font-bold mb-3">Contenido</p>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="block text-sm text-surface-400 hover:text-mandy-400 py-1 transition">
              {s.label}
            </a>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Hero */}
          <div className="bg-gradient-to-br from-mandy-500/10 via-surface-800/50 to-surface-900 border border-mandy-500/20 rounded-2xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">Edu Worker</h2>
            <p className="text-surface-400 max-w-2xl leading-relaxed">
              Edu Worker es el componente que ejecuta terminales de trabajo aisladas en contenedores Docker.
              Cada espacio de trabajo obtiene su propio contenedor con acceso a herramientas de IA (Codex, Gemini),
              sincronización en tiempo real con Firebase y terminal interactiva vía web.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Docker</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Ubuntu/Debian</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Firebase</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Socket.io</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">xterm.js</span>
            </div>
          </div>

          {/* Sections */}
          <Section id="overview" icon={Server} title="Visión General" defaultOpen={true}>
            <p>El sistema tiene 3 componentes principales:</p>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-emerald-400 text-sm mb-1">🌐 Frontend</h4>
                <p className="text-xs text-surface-400">Next.js en Vercel. Editor, terminal web (xterm.js), explorador de archivos.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-blue-400 text-sm mb-1">🔗 Hub</h4>
                <p className="text-xs text-surface-400">Node.js + Socket.io. Coordina workers, sesiones de terminal, y retransmite output.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-mandy-400 text-sm mb-1">⚙️ Worker</h4>
                <p className="text-xs text-surface-400">Contenedor Docker con Ubuntu. Ejecuta comandos, sincroniza archivos con Firebase.</p>
              </div>
            </div>
            <p className="mt-3">
              El <strong className="text-white">worker</strong> se instala en cualquier máquina Linux con Docker.
              Se conecta al Hub vía Socket.io, recibe comandos de la terminal web, y sincroniza el directorio <code className="text-mandy-300">/workspace</code> con Firebase Storage.
            </p>
            <div className="bg-surface-950/50 border border-surface-700/30 rounded-lg p-4 mt-3 font-mono text-xs text-surface-400 leading-loose">
              <span className="text-blue-400">Browser</span> → <span className="text-emerald-400">Hub (Socket.io)</span> → <span className="text-mandy-400">Worker (Docker)</span> → <span className="text-amber-400">Firebase Storage</span>
            </div>
          </Section>

          <Section id="install" icon={Download} title="Instalación">
            <h4 className="font-bold text-white">Requisitos</h4>
            <ul className="list-disc list-inside space-y-1 text-surface-400">
              <li>Ubuntu 20.04+ / Debian 11+</li>
              <li>Docker instalado (<code className="text-mandy-300">docker.io</code> o <code className="text-mandy-300">docker-ce</code>)</li>
              <li>Acceso a internet (para descargar la imagen Docker)</li>
              <li>Al menos 2 GB de RAM disponible</li>
            </ul>

            <h4 className="font-bold text-white mt-5">Instalación rápida (una línea)</h4>
            <CopyBlock
              label="Descargar e instalar"
              code={`curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb`}
            />

            <h4 className="font-bold text-white mt-5">Instalación paso a paso</h4>
            <CopyBlock label="1. Descargar el paquete" code="curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb" />
            <CopyBlock label="2. Instalar" code="sudo apt install -y /tmp/edu-worker.deb" />
            <CopyBlock label="3. Agregar un workspace" code={`sudo edu-worker-manager add <workspace-id> --name "Mi Espacio"`} />
            <CopyBlock label="4. Verificar" code="sudo edu-worker-manager status" />

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-3 flex gap-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <div>
                <p className="text-amber-300 text-sm font-semibold">Nota sobre credenciales</p>
                <p className="text-amber-200/70 text-xs mt-1">
                  El archivo <code>/etc/edu-worker/worker.env</code> contiene las claves de Firebase y del Hub.
                  El instalador lo configura con valores por defecto. Si necesitas cambiarlos, edita ese archivo y luego <code>sudo edu-worker-manager restart all</code>.
                </p>
              </div>
            </div>
          </Section>

          <Section id="commands" icon={Terminal} title="Referencia de Comandos">
            <p>Todos los comandos se ejecutan con <code className="text-mandy-300">sudo edu-worker-manager &lt;comando&gt;</code>.</p>
            <div className="space-y-3 mt-3">
              <CommandRef
                cmd="add <id> [opciones]"
                desc="Registra un nuevo workspace y arranca su contenedor. Crea la configuración en /etc/edu-worker/workers.d/ y el directorio de datos."
                example={`# Workspace compartido
sudo edu-worker-manager add Vt9HeKs --name "Griego"

# Workspace personal
sudo edu-worker-manager add myUserId --personal --name "Mi Espacio"

# O con --type
sudo edu-worker-manager add myUserId --type personal --name "Mi Espacio"`}
              />
              <CommandRef
                cmd="remove <id>"
                desc="Detiene el contenedor, lo elimina, y borra la configuración. Los datos del workspace se conservan en disco."
                example="sudo edu-worker-manager remove Vt9HeKs"
              />
              <CommandRef
                cmd="start <id|all>"
                desc="Inicia el contenedor de un workspace (o todos). Si el contenedor ya existe, lo recrea."
                example={`sudo edu-worker-manager start Vt9HeKs
sudo edu-worker-manager start all`}
              />
              <CommandRef
                cmd="stop <id|all>"
                desc="Detiene el contenedor de un workspace (o todos) sin eliminarlo."
                example="sudo edu-worker-manager stop all"
              />
              <CommandRef
                cmd="restart <id|all>"
                desc="Detiene y vuelve a iniciar el contenedor. Útil tras cambios de configuración."
                example="sudo edu-worker-manager restart all"
              />
              <CommandRef
                cmd="update [id|all]"
                desc="Descarga la última versión de la imagen Docker y reinicia los contenedores. Equivale a docker pull + restart."
                example="sudo edu-worker-manager update all"
              />
              <CommandRef
                cmd="resync <id|all>"
                desc="Fuerza una re-sincronización completa reiniciando el worker sin descargar nueva imagen."
                example="sudo edu-worker-manager resync all"
              />
              <CommandRef
                cmd="status"
                desc="Muestra el estado de todos los workers: ID, nombre, tipo (personal/shared), estado (running/stopped), y si el listener de RTDB está activo."
                example="sudo edu-worker-manager status"
              />
              <CommandRef
                cmd="ids"
                desc="Lista los workspace IDs registrados con sus nombres y tipo. Útil para copiar IDs."
                example="sudo edu-worker-manager ids"
              />
              <CommandRef
                cmd="logs <id> [-f]"
                desc="Muestra los logs del contenedor. Con -f sigue en tiempo real (como tail -f)."
                example={`sudo edu-worker-manager logs Vt9HeKs
sudo edu-worker-manager logs Vt9HeKs -f`}
              />
            </div>
          </Section>

          <Section id="config" icon={Settings} title="Configuración">
            <h4 className="font-bold text-white">Archivos de configuración</h4>
            <div className="space-y-3 mt-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <code className="text-mandy-400 text-sm">/etc/edu-worker/worker.env</code>
                <p className="text-xs text-surface-400 mt-2">Configuración global. Variables de entorno compartidas por todos los workers:</p>
                <CopyBlock code={`# Secreto para autenticación entre worker y hub
WORKER_SECRET=<hash>

# Configuración de Firebase (JSON compacto)
FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","databaseURL":"..."}

# Bucket de Firebase Storage (opcional, se infiere del config)
FIREBASE_BUCKET=mi-proyecto.firebasestorage.app

# URL del Hub (servidor central Socket.io)
NEXUS_URL=http://mi-hub:3010

# Ruta base para datos persistentes
BASE_MOUNT_PATH=/home/usuario/edu-worker

# Imagen Docker a usar
WORKER_IMAGE=stevenvo780/edu-worker:latest`} />
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <code className="text-mandy-400 text-sm">/etc/edu-worker/workers.d/*.conf</code>
                <p className="text-xs text-surface-400 mt-2">Un archivo por workspace. Creado automáticamente con <code>add</code>:</p>
                <CopyBlock code={`WORKSPACE_ID="Vt9HeKs"
WORKSPACE_NAME="Griego"
WORKSPACE_TYPE="shared"
WORKER_TOKEN="Vt9HeKs"
MOUNT_PATH="/home/usuario/edu-worker/workspaces/Vt9HeKs"`} />
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <code className="text-mandy-400 text-sm">/etc/edu-worker/serviceAccountKey.json</code>
                <p className="text-xs text-surface-400 mt-2">Credenciales de servicio de Firebase. Usado por el sync agent dentro del contenedor para sincronizar archivos.</p>
              </div>
            </div>
          </Section>

          <Section id="architecture" icon={Server} title="Arquitectura del Worker">
            <h4 className="font-bold text-white">Dentro del contenedor</h4>
            <p className="mt-2">Cada contenedor Docker ejecuta:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-400 mt-2">
              <li><strong className="text-white">sync_agent.js</strong> — Observa cambios en <code className="text-mandy-300">/workspace</code> con chokidar, sincroniza a Firebase Storage, y escucha cambios remotos via Firestore/RTDB</li>
              <li><strong className="text-white">Socket.io client</strong> — Se conecta al Hub, recibe comandos de terminal (<code className="text-mandy-300">execute</code>), envía output de vuelta</li>
              <li><strong className="text-white">node-pty</strong> — Crea pseudo-terminales para ejecutar bash con PTY real (soporta colores, vim, htop, etc.)</li>
            </ul>

            <h4 className="font-bold text-white mt-5">Flujo de una sesión de terminal</h4>
            <div className="bg-surface-950/50 border border-surface-700/30 rounded-lg p-4 mt-2 text-xs font-mono space-y-1 text-surface-400">
              <p><span className="text-blue-400">1.</span> Usuario crea sesión → Hub genera ID → Worker crea PTY (bash)</p>
              <p><span className="text-blue-400">2.</span> Usuario escribe → Hub reenvía → Worker ejecuta en PTY</p>
              <p><span className="text-blue-400">3.</span> PTY produce output → Worker envía → Hub retransmite → xterm.js</p>
              <p><span className="text-blue-400">4.</span> Archivos cambian en /workspace → sync_agent detecta → sube a Firebase</p>
              <p><span className="text-blue-400">5.</span> Otro usuario cambia archivo en web → Firebase → RTDB notifica → sync_agent descarga</p>
            </div>

            <h4 className="font-bold text-white mt-5">Estructura de red</h4>
            <p className="text-surface-400 mt-2">
              El worker usa <code className="text-mandy-300">--network=host</code> para conectarse al Hub directamente.
              No se exponen puertos adicionales. La comunicación es 100% outbound (el worker inicia la conexión).
            </p>
          </Section>

          <Section id="persistence" icon={HardDrive} title="Persistencia de Datos">
            <p>El worker monta dos volúmenes desde el host al contenedor:</p>
            <div className="space-y-3 mt-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <code className="text-emerald-400 text-sm">/workspace</code>
                  <span className="text-xs text-surface-500">→</span>
                  <code className="text-surface-400 text-xs">BASE_MOUNT_PATH/workspaces/&lt;id&gt;</code>
                </div>
                <p className="text-xs text-surface-400 mt-2">Archivos del workspace. Se sincronizan con Firebase Storage. Es la carpeta de trabajo principal.</p>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <code className="text-emerald-400 text-sm">/home/estudiante</code>
                  <span className="text-xs text-surface-500">→</span>
                  <code className="text-surface-400 text-xs">BASE_MOUNT_PATH/home/&lt;id&gt;</code>
                </div>
                <p className="text-xs text-surface-400 mt-2">Home completo del usuario. Persiste entre reinicios. Incluye:</p>
                <ul className="list-disc list-inside text-xs text-surface-500 mt-1 space-y-0.5">
                  <li><code>.codex/</code> — Configuración de OpenAI Codex</li>
                  <li><code>.gemini/</code> — Configuración de Google Gemini</li>
                  <li><code>.ssh/</code> — Llaves SSH</li>
                  <li><code>.gitconfig</code> — Configuración de Git</li>
                  <li><code>.npm/</code>, <code>.cache/</code> — Cachés de paquetes</li>
                  <li><code>.bash_history</code> — Historial de comandos</li>
                  <li>Cualquier herramienta instalada en el futuro</li>
                </ul>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mt-3 flex gap-3">
              <span className="text-emerald-400 text-lg">💡</span>
              <p className="text-emerald-200/80 text-xs">
                <strong className="text-emerald-300">Al reiniciar o actualizar un worker</strong>, todo el home y el workspace se preservan.
                Solo se recrea el contenedor con la imagen más reciente.
              </p>
            </div>
          </Section>

          <Section id="troubleshooting" icon={RefreshCw} title="Solución de Problemas">
            <div className="space-y-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm">Worker aparece como &quot;offline&quot; en la web</h5>
                <ol className="list-decimal list-inside text-xs text-surface-400 mt-2 space-y-1">
                  <li>Verifica que el contenedor esté corriendo: <code className="text-mandy-300">sudo edu-worker-manager status</code></li>
                  <li>Revisa logs: <code className="text-mandy-300">sudo edu-worker-manager logs &lt;id&gt; -f</code></li>
                  <li>Busca errores de conexión al Hub (timeout, ECONNREFUSED)</li>
                  <li>Verifica que <code className="text-mandy-300">NEXUS_URL</code> en worker.env sea correcto</li>
                  <li>Reinicia: <code className="text-mandy-300">sudo edu-worker-manager restart &lt;id&gt;</code></li>
                </ol>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm">Archivos no se sincronizan</h5>
                <ol className="list-decimal list-inside text-xs text-surface-400 mt-2 space-y-1">
                  <li>Verifica en logs que el sync agent esté activo: busca &quot;✅ Listener de RTDB activo&quot;</li>
                  <li>Fuerza resync: <code className="text-mandy-300">sudo edu-worker-manager resync &lt;id&gt;</code></li>
                  <li>Si sigue fallando, revisa <code className="text-mandy-300">serviceAccountKey.json</code> y <code className="text-mandy-300">FIREBASE_CONFIG</code></li>
                </ol>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm">Error: &quot;WORKER_SECRET not set&quot;</h5>
                <p className="text-xs text-surface-400 mt-2">
                  Asegúrate de ejecutar con <code className="text-mandy-300">sudo</code>. El archivo <code>/etc/edu-worker/worker.env</code>
                  tiene permisos 600 y solo es legible por root.
                </p>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm">Terminal funciona pero no envía output</h5>
                <ol className="list-decimal list-inside text-xs text-surface-400 mt-2 space-y-1">
                  <li>Puede ser un problema de red entre worker y Hub</li>
                  <li>Verifica en la consola del navegador (F12) que no hay errores de WebSocket</li>
                  <li>El Hub debe ser accesible desde la máquina del worker en el puerto configurado</li>
                </ol>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm">Container se reinicia constantemente</h5>
                <ol className="list-decimal list-inside text-xs text-surface-400 mt-2 space-y-1">
                  <li>Revisa logs: <code className="text-mandy-300">docker logs edu-worker-&lt;id&gt; --tail 50</code></li>
                  <li>Causa común: <code>serviceAccountKey.json</code> inválido o vacío</li>
                  <li>Otra causa: imagen Docker corrupta → <code className="text-mandy-300">sudo edu-worker-manager update &lt;id&gt;</code></li>
                </ol>
              </div>
            </div>
          </Section>

          <Section id="shared" icon={Users} title="Espacios Compartidos">
            <p>
              Los workspaces compartidos permiten que múltiples usuarios trabajen en el mismo espacio.
              Un administrador crea el workspace desde la web y comparte el ID.
            </p>

            <h4 className="font-bold text-white mt-4">Configurar worker para workspace compartido</h4>
            <CopyBlock code={`# El workspace-id se obtiene desde la web (botón Copiar ID en el menú de workspaces)
sudo edu-worker-manager add AbC123dEf --name "Proyecto Filosofía"`} />

            <h4 className="font-bold text-white mt-4">Terminal compartida</h4>
            <p className="text-surface-400">
              Cuando hay una sesión de terminal activa, todos los miembros del workspace la ven en tiempo real.
              El sistema funciona como <strong className="text-white">tmux</strong>:
            </p>
            <ul className="list-disc list-inside text-surface-400 mt-2 space-y-1">
              <li>El <strong className="text-white">creador</strong> de la sesión controla el tamaño de la terminal</li>
              <li>Los <strong className="text-white">espectadores</strong> tienen su propio viewport (pueden redimensionar su ventana sin afectar al creador)</li>
              <li>Todos pueden escribir comandos</li>
              <li>El output se transmite en tiempo real a todos</li>
            </ul>
          </Section>

          <Section id="security" icon={Shield} title="Seguridad">
            <div className="space-y-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-white text-sm">Aislamiento</h5>
                <p className="text-xs text-surface-400 mt-1">
                  Cada workspace corre en su propio contenedor Docker con usuario no-root (<code className="text-mandy-300">estudiante</code>, uid 1000).
                  No tiene acceso al sistema host ni a otros contenedores.
                </p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-white text-sm">Autenticación</h5>
                <p className="text-xs text-surface-400 mt-1">
                  El worker se autentica con el Hub usando un <code className="text-mandy-300">WORKER_SECRET</code> compartido.
                  Las acciones de terminal requieren un token JWT de Firebase válido.
                </p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-white text-sm">Permisos de archivo</h5>
                <p className="text-xs text-surface-400 mt-1">
                  <code className="text-mandy-300">/etc/edu-worker/worker.env</code> y <code className="text-mandy-300">serviceAccountKey.json</code> tienen permisos 600 (solo root).
                  Los comandos de <code className="text-mandy-300">edu-worker-manager</code> requieren sudo.
                </p>
              </div>
            </div>
          </Section>

          <Section id="updates" icon={RefreshCw} title="Actualización">
            <h4 className="font-bold text-white">Actualizar el paquete .deb</h4>
            <CopyBlock code={`curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb
sudo apt install -y /tmp/edu-worker.deb`} />
            <p className="text-surface-400 text-xs mt-1">Esto actualiza <code>edu-worker-manager</code> y los scripts. No toca los contenedores activos.</p>

            <h4 className="font-bold text-white mt-5">Actualizar la imagen Docker (los contenedores)</h4>
            <CopyBlock code="sudo edu-worker-manager update all" />
            <p className="text-surface-400 text-xs mt-1">
              Descarga la última versión de <code className="text-mandy-300">stevenvo780/edu-worker:latest</code> y reinicia todos los contenedores.
              Los datos persisten (home y workspace se montan desde el host).
            </p>

            <h4 className="font-bold text-white mt-5">Actualización completa</h4>
            <CopyBlock code={`# 1. Actualizar el paquete
curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb

# 2. Actualizar la imagen Docker y reiniciar
sudo edu-worker-manager update all

# 3. Verificar
sudo edu-worker-manager status`} />
          </Section>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-surface-700/40 text-center text-xs text-surface-500">
            <p>Edu Worker v1.0.10 — Agora Collaborative Learning Platform</p>
            <p className="mt-1">
              <a href="https://github.com/stevenvo780/EducacionCooperativa" target="_blank" rel="noopener noreferrer" className="text-mandy-400 hover:text-mandy-300 transition inline-flex items-center gap-1">
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
