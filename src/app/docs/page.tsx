'use client';

import { useState } from 'react';
import {
  ArrowLeft, Terminal, Server, Download, Settings, Users,
  Shield, HardDrive, BookOpen, ChevronDown, ChevronRight, Copy, Check,
  ExternalLink, PenTool, Layout, LayoutGrid, WifiOff, FileSpreadsheet,
  KanbanSquare, Sparkles, Network, Quote, BookmarkPlus, Briefcase,
  Zap, FlaskConical, Monitor, Key, Crown,
  FolderPlus, Globe, Lock, Layers,
  Bot, FileWarning, Wand2, GitMerge, FileText, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { ST_RUNTIME_VERSION } from '@/lib/st-runtime-manifest';
import { ELENXOS_BRAND } from '@/lib/branding';

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
      <div className="bg-surface-950 border border-surface-700/50 rounded-lg overflow-hidden font-mono">
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800/50 border-b border-surface-700/30">
          <span className="text-[10px] text-surface-500">terminal</span>
          <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-emerald-400 transition">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="p-3 text-sm text-emerald-300 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
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
    <section id={id} className="border border-surface-700/40 rounded-xl overflow-hidden bg-surface-800/30 backdrop-blur transition-all duration-300 hover:border-surface-600/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-700/30 transition"
      >
        <div className="p-2 rounded-lg bg-mandy-500/10 border border-mandy-500/20">
          <Icon className="w-5 h-5 text-mandy-400" />
        </div>
        <span className="flex-1 text-lg font-bold text-surface-100">{title}</span>
        {open ? <ChevronDown className="w-5 h-5 text-surface-500" /> : <ChevronRight className="w-5 h-5 text-surface-500" />}
      </button>
      {open && (
        <div className="px-5 pb-6 space-y-5 text-surface-300 text-sm leading-relaxed border-t border-surface-700/30 pt-5 animate-in fade-in slide-in-from-top-2">
          {children}
        </div>
      )}
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
    { id: 'overview', label: 'Arquitectura' },
    { id: 'workspaces', label: 'Gestión de Espacios' },
    { id: 'explorer', label: 'Explorador de Archivos' },
    { id: 'editor', label: 'Editor Semántico' },
    { id: 'snippets', label: 'Galería de Snippets' },
    { id: 'terminal', label: 'Terminal Multi-sesión' },
    { id: 'kanban', label: 'Tableros Kanban' },
    { id: 'spreadsheet', label: 'Hojas de Cálculo' },
    { id: 'file-viewers', label: 'Visores de Archivos' },
    { id: 'agora-ai', label: 'Agora AI Chat' },
    { id: 'linter', label: 'Linter Académico' },
    { id: 'formalizador', label: 'Formalizador LLM' },
    { id: 'semantic', label: 'Navegador Semántico' },
    { id: 'st-lang', label: 'Centro ST' },
    { id: 'ui-layout', label: 'Productividad (Layout)' },
    { id: 'offline', label: 'PWA & Offline' },
    { id: 'security', label: 'Seguridad & Planes' },
    { id: 'worker', label: 'Edu Worker (Deep)' }
  ];

  return (
    <div className="min-h-[100dvh] bg-surface-900 text-surface-200 selection:bg-mandy-500/30">
      <header className="sticky top-0 z-50 bg-surface-900/90 backdrop-blur border-b border-surface-700/50">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-3">
          <Link href="/dashboard" aria-label="Volver al dashboard" title="Volver al dashboard" className="p-2 rounded-lg hover:bg-surface-700/50 transition text-surface-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-mandy-600 to-violet-600 shadow-lg shadow-mandy-900/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Manual Maestro Ágora</h1>
          </div>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 border border-surface-700 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Versión {ST_RUNTIME_VERSION}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-surface-500 font-bold mb-4 px-2">Tabla de Contenidos</p>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 py-2 px-2 rounded-lg hover:bg-surface-800/50 transition-all group">
              <div className="w-1 h-1 rounded-full bg-surface-700 group-hover:bg-mandy-500 transition-colors" />
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex-1 space-y-6 min-w-0">
          <div className="bg-gradient-to-br from-mandy-600/20 via-surface-800/50 to-surface-900 border border-mandy-500/30 rounded-3xl p-10 mb-10 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Bienvenido al Futuro del Aprendizaje Colaborativo</h2>
              <p className="text-surface-300 max-w-3xl text-base leading-relaxed">
                La Plataforma Ágora no es solo un editor; es un ecosistema distribuido que combina IA, lógica formal, ejecución remota y gestión semántica de la información.
                Este manual detalla cada funcionalidad para convertirte en un experto en el uso de la herramienta.
              </p>
              <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-mandy-500/20 bg-surface-900/70 px-4 py-2 text-xs text-surface-300">
                <span className="font-semibold text-mandy-300">{ELENXOS_BRAND.name}</span>
                <span>{ELENXOS_BRAND.ownershipDisclaimer}</span>
                <a
                  href={ELENXOS_BRAND.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-mandy-400 hover:text-mandy-300 transition"
                >
                  elenxos.com
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-blue-400" /> Web PWA</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-emerald-400" /> Multi-Worker</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-400" /> Lógica ST</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-mandy-400" /> E2E Sincronizado</span>
              </div>
            </div>
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-mandy-500/10 blur-[100px] rounded-full" />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-violet-500/10 blur-[100px] rounded-full" />
          </div>

          <Section id="overview" icon={Server} title="Arquitectura Distribuida" defaultOpen={true}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h3 className="font-bold text-emerald-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <Monitor className="w-4 h-4" /> Frontend (Next.js)
                </h3>
                <p className="text-xs text-surface-400 leading-relaxed">Núcleo de la experiencia de usuario. Gestiona el editor visual, la lógica offline, y la interfaz de mosaicos adaptable.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h3 className="font-bold text-blue-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <ExternalLink className="w-4 h-4" /> Nexus Hub (Node)
                </h3>
                <p className="text-xs text-surface-400 leading-relaxed">Servidor central de tiempo real. Coordina las conexiones WebSocket entre el navegador y los Workers Docker distribuidos.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h3 className="font-bold text-mandy-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <HardDrive className="w-4 h-4" /> Edu Worker (Docker)
                </h3>
                <p className="text-xs text-surface-400 leading-relaxed">Contenedores aislados que ejecutan procesos de terminal y sincronizan archivos locales con Firebase en tiempo real.</p>
              </div>
            </div>
            <div className="bg-surface-950/50 rounded-xl p-4 border border-surface-700/30">
              <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Flujo de Datos</p>
              <p className="text-xs text-surface-400">
                Tu navegador se comunica con <span className="text-emerald-400 font-semibold">Vercel</span> para el UI, con <span className="text-blue-400 font-semibold">Firebase</span> para autenticación y persistencia, y con el <span className="text-mandy-400 font-semibold">Nexus Hub</span> para el control operativo de terminales remotas.
              </p>
            </div>
          </Section>

          <Section id="workspaces" icon={Users} title="Espacios de Trabajo & Gestión de Equipos">
            <div className="space-y-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3">Tipos de Espacios</h5>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-blue-400 font-bold text-xs uppercase mb-1">Personal</p>
                    <p className="text-xs text-surface-400">Privado, ligado a tu UID. Los archivos se sincronizan en tu propio almacenamiento. Solo tú puedes instalar un Worker para este espacio.</p>
                  </div>
                  <div className="p-4 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-mandy-400 font-bold text-xs uppercase mb-1">Compartido (Shared)</p>
                    <p className="text-xs text-surface-400">Diseñado para equipos. Tiene un ID único (ej: <code className="text-surface-300">Vt9HeKs</code>). Permite múltiples miembros, administración de roles e invitaciones.</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3">Colaboración en Tiempo Real</h5>
                <ul className="list-disc list-inside space-y-2 text-xs text-surface-400">
                  <li><strong className="text-surface-200">Invitaciones:</strong> Envía invitaciones por correo. Los usuarios verán un indicador de notificación en su barra superior.</li>
                  <li><strong className="text-surface-200">Miembros:</strong> Consulta quién tiene acceso y el administrador puede eliminar miembros desde el modal de &quot;Equipo&quot;.</li>
                  <li><strong className="text-surface-200">Sincronización:</strong> Cualquier cambio en la estructura de archivos es notificado instantáneamente a todos los miembros activos.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="explorer" icon={FolderPlus} title="Explorador de Archivos Profesional">
            <div className="space-y-4">
              <p className="text-surface-400">El explorador de la barra lateral es una herramienta poderosa para organizar proyectos complejos.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-emerald-400 text-xs uppercase mb-3">Navegación & Organización</h5>
                  <ul className="list-disc list-inside space-y-2 text-[11px] text-surface-400">
                    <li><strong className="text-surface-200">Drag & Drop:</strong> Arrastra archivos a carpetas para moverlos. Incluso puedes soltar archivos desde tu PC para subirlos directamente a una carpeta específica.</li>
                    <li><strong className="text-surface-200">Favoritos (Star):</strong> Fija archivos clave. Aparecerán en una sección especial arriba del árbol, con botones para reordenarlos.</li>
                    <li><strong className="text-surface-200">Menú Contextual:</strong> Click derecho en cualquier archivo para Renombrar, Duplicar, Descargar o Eliminar.</li>
                  </ul>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-blue-400 text-xs uppercase mb-3">Funciones Avanzadas</h5>
                  <ul className="list-disc list-inside space-y-2 text-[11px] text-surface-400">
                    <li><strong className="text-surface-200">Búsqueda Semántica (Ctrl+P):</strong> No solo busca por nombre; abre un modal que te permite navegar por todo el workspace rápidamente.</li>
                    <li><strong className="text-surface-200">Subida de Carpetas:</strong> El botón de subida permite seleccionar una carpeta completa de tu sistema operativo y recrear su estructura en la nube.</li>
                    <li><strong className="text-surface-200">Renombrado Inline:</strong> Edita nombres de archivos directamente en la barra lateral sin diálogos molestos.</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          <Section id="editor" icon={PenTool} title="Editor Semántico de Conocimiento">
            <div className="space-y-5">
              <p className="text-surface-400">Nuestro editor Markdown es un híbrido entre un editor de código y una herramienta de investigación.</p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-mandy-400 text-sm mb-3">Selección Semántica (El Menú Inteligente)</h5>
                <p className="text-xs text-surface-400 mb-4">Cuando seleccionas texto con el mouse, aparece un menú contextual especializado:</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 flex flex-col items-center text-center">
                    <Sparkles className="w-5 h-5 text-blue-400 mb-2" />
                    <span className="text-[10px] font-bold uppercase text-surface-200">Definir Concepto</span>
                    <p className="text-[10px] text-surface-500 mt-1">Crea una entrada en la base de conocimientos vinculada a este texto.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 flex flex-col items-center text-center">
                    <Briefcase className="w-5 h-5 text-emerald-400 mb-2" />
                    <span className="text-[10px] font-bold uppercase text-surface-200">Enviar a Tarea</span>
                    <p className="text-[10px] text-surface-500 mt-1">Convierte el fragmento seleccionado en una tarjeta en el tablero Kanban.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 flex flex-col items-center text-center">
                    <Quote className="w-5 h-5 text-amber-400 mb-2" />
                    <span className="text-[10px] font-bold uppercase text-surface-200">Marcar Evidencia</span>
                    <p className="text-[10px] text-surface-500 mt-1">Guarda citas textuales para usarlas como pruebas en investigaciones.</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-900/80 rounded text-[10px] text-surface-400 border border-surface-700/50"><BookmarkPlus className="w-3 h-3" /> Fijar Fragmento</span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-900/80 rounded text-[10px] text-surface-400 border border-surface-700/50"><Network className="w-3 h-3" /> Relacionar con Concepto</span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-900/80 rounded text-[10px] text-surface-400 border border-surface-700/50"><ExternalLink className="w-3 h-3" /> Enlazar a Documento Interno</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-2"><Layout className="w-4 h-4 text-violet-400" /> Modos de Trabajo</h5>
                  <ul className="space-y-3 text-[11px] text-surface-400">
                    <li><strong className="text-surface-200 italic">Modo Edición:</strong> Interfaz WYSIWYG (lo que ves es lo que obtienes) tipo Notion/Obsidian.</li>
                    <li><strong className="text-surface-200 italic">Modo Raw (Código):</strong> Edición directa del Markdown para usuarios avanzados.</li>
                    <li><strong className="text-surface-200 italic">Modo Preview:</strong> Visualización final con renderizado de LaTeX y diagramas Mermaid.</li>
                  </ul>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-slate-400" /> Barra de Opciones (3 Puntos)</h5>
                  <p className="text-[11px] text-surface-400 leading-relaxed mb-2">
                    Haz click en los <strong className="text-white">...</strong> para acceder a configuraciones de visibilidad. Puedes ocultar grupos de botones (Historial, Inline, Estructura, Listas, Snippets, Avanzado) para simplificar la interfaz.
                  </p>
                  <p className="text-[11px] text-surface-400 italic">¡La configuración se guarda por editor!</p>
                </div>
              </div>
            </div>
          </Section>

          <Section id="snippets" icon={LayoutGrid} title="Gestión de Snippets (Plantillas)">
            <div className="space-y-4">
              <p className="text-surface-400">La Galería de Snippets te permite insertar estructuras predefinidas de texto, fórmulas o diagramas con un solo click.</p>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-blue-400 text-sm mb-3">Características de la Galería</h5>
                <ul className="list-disc list-inside space-y-2 text-xs text-surface-400">
                  <li><strong className="text-surface-200">Categorías Inteligentes:</strong> Clasifica tus snippets en Matemáticas, Diagramas, Estructura, Código o General.</li>
                  <li><strong className="text-surface-200">Editor Integrado:</strong> Crea y edita tus propios snippets con vista previa en tiempo real.</li>
                  <li><strong className="text-surface-200">Auto-Semilla:</strong> Al entrar por primera vez, la plataforma precarga snippets de utilidad para aprender a usar LaTeX y Mermaid.</li>
                  <li><strong className="text-surface-200">Búsqueda Instantánea:</strong> Filtra por título o descripción mientras escribes.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="terminal" icon={Terminal} title="Terminal Multi-sesión & Workers">
            <div className="space-y-5">
              <p className="text-surface-400">Ágora ofrece una integración profunda con terminales Linux reales ejecutándose en contenedores Docker.</p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-mandy-400 text-sm mb-3">Operativa de Sesiones (Estilo Tmux)</h5>
                <p className="text-xs text-surface-400 mb-4">A diferencia de otras nubes, nuestras terminales son persistentes y compartibles:</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-black/40 rounded border border-surface-700/30">
                    <p className="text-white font-bold text-xs mb-1 flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-indigo-400" /> Multi-sesión</p>
                    <p className="text-[10px] text-surface-500">Crea múltiples terminales en el mismo espacio. Puedes tener un servidor corriendo en una y editar archivos en otra.</p>
                  </div>
                  <div className="p-4 bg-black/40 rounded border border-surface-700/30">
                    <p className="text-white font-bold text-xs mb-1 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-emerald-400" /> Colaboración Activa</p>
                    <p className="text-[10px] text-surface-500">Cualquier miembro del equipo puede unirse a una sesión activa. Verán lo que escribes y podrán interactuar en la misma consola.</p>
                  </div>
                </div>
                <ul className="mt-4 list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li><strong className="text-surface-200">Renombrado:</strong> Haz click derecho o usa el menú de la sesión para darle un nombre (ej: &quot;Backend Log&quot;).</li>
                  <li><strong className="text-surface-200">Re-conexión:</strong> Si cierras la pestaña o refrescas, la terminal sigue viva en el Worker. Al volver a abrirla, recuperas el estado.</li>
                  <li><strong className="text-surface-200">Drag & Drop:</strong> Puedes arrastrar una sesión de terminal desde la cabecera hacia el área de mosaicos para abrirla en una ventana específica.</li>
                </ul>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-400" /> Estado del Worker</h5>
                <p className="text-xs text-surface-400 leading-relaxed">
                  En la cabecera verás un pequeño punto de color junto al ícono de terminal:
                  <br /><span className="text-emerald-400">● Verde:</span> El Worker Docker está conectado y listo.
                  <br /><span className="text-amber-400">● Naranja:</span> Buscando conexión o reconectando.
                  <br /><span className="text-red-400">● Rojo:</span> El Worker está fuera de línea. Necesitas arrancarlo en tu servidor.
                </p>
              </div>
            </div>
          </Section>

          <Section id="kanban" icon={KanbanSquare} title="Tableros Kanban Colaborativos">
            <div className="space-y-4">
              <p className="text-surface-400">Cada espacio de trabajo tiene un tablero Kanban integrado para la gestión de proyectos y tareas.</p>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-amber-400 text-sm mb-3">Funcionalidades del Tablero</h5>
                <ul className="list-disc list-inside space-y-2 text-xs text-surface-400">
                  <li><strong className="text-surface-200">Gestión de Columnas:</strong> Organiza tareas en &quot;Por hacer&quot;, &quot;En proceso&quot; y &quot;Finalizado&quot; mediante Drag & Drop.</li>
                  <li><strong className="text-surface-200">Tarjetas Detalladas:</strong> Cada tarjeta soporta títulos y se vincula automáticamente con el usuario que la creó.</li>
                  <li><strong className="text-surface-200">Integración con el Editor:</strong> Esta es la función estrella. Selecciona texto en un documento Markdown, elige &quot;Enviar a Tarea&quot; y se creará una tarjeta con ese texto como título y un enlace de vuelta al documento.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="spreadsheet" icon={FileSpreadsheet} title="Visualizador de Datos (Hojas de Cálculo)">
            <div className="space-y-4">
              <p className="text-surface-400">Ágora permite la lectura profesional de archivos de datos sin necesidad de Excel o Google Sheets.</p>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-blue-400 text-sm mb-3">Capacidades del Visor</h5>
                <ul className="list-disc list-inside space-y-2 text-xs text-surface-400">
                  <li><strong className="text-surface-200">Formatos:</strong> Soporte nativo para <code className="text-surface-300">.xlsx</code>, <code className="text-surface-300">.csv</code>, y <code className="text-surface-300">.tsv</code>.</li>
                  <li><strong className="text-surface-200">Multi-hoja:</strong> Navega entre diferentes pestañas de un archivo Excel mediante la barra inferior.</li>
                  <li><strong className="text-surface-200">Alto Rendimiento:</strong> Paginación automática que permite abrir archivos con miles de filas sin ralentizar el navegador.</li>
                  <li><strong className="text-surface-200">Búsqueda & Orden:</strong> Filtra filas instantáneamente buscando palabras clave o ordena columnas alfabéticamente/numéricamente.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="file-viewers" icon={FileText} title="Visores de Archivos">
            <div className="space-y-4">
              <p className="text-surface-400">Abre documentos directamente en la plataforma sin descargarlos ni instalar aplicaciones externas.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-mandy-400 text-xs uppercase mb-3">Formatos soportados</h5>
                  <ul className="space-y-2 text-[11px] text-surface-400">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-400 shrink-0" /><strong className="text-surface-200">PDF</strong> — Renderizado nativo con pdf.js. Navega páginas, zoom y scroll fluido.</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-400 shrink-0" /><strong className="text-surface-200">PowerPoint (.pptx)</strong> — Visualización de slides sin Microsoft Office.</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-400 shrink-0" /><strong className="text-surface-200">Hojas de cálculo (.xlsx/.csv)</strong> — Con paginación y búsqueda (sección anterior).</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-400 shrink-0" /><strong className="text-surface-200">Imágenes / Video / Audio</strong> — Reproducción directa en el panel.</li>
                  </ul>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-blue-400 text-xs uppercase mb-3">Cómo usarlo</h5>
                  <ul className="list-disc list-inside space-y-2 text-[11px] text-surface-400">
                    <li>Haz click en cualquier archivo en el explorador para abrirlo en el panel principal.</li>
                    <li>Puedes abrirlo en un panel del mosaico y seguir editando otro documento a la vez.</li>
                    <li>Los archivos se cargan desde Firebase Storage con URLs firmadas de corta duración para mayor seguridad.</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          <Section id="agora-ai" icon={Bot} title="Agora AI Chat — Asistente Multi-Proveedor">
            <div className="space-y-5">
              <p className="text-surface-400">
                Agora integra un chat de inteligencia artificial directamente en tu workspace, con soporte para los principales modelos del mercado y acceso al contexto de tus propios documentos.
              </p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3">Proveedores de IA soportados</h5>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-emerald-400 font-bold text-xs mb-1">OpenAI (ChatGPT)</p>
                    <p className="text-[11px] text-surface-500">Modelo por defecto: <code className="text-surface-300">gpt-4o-mini</code>. Requiere tu propia API key.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-mandy-400 font-bold text-xs mb-1">Anthropic (Claude)</p>
                    <p className="text-[11px] text-surface-500">Modelo por defecto: <code className="text-surface-300">claude-3-5-haiku</code>. Requiere tu propia API key.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-blue-400 font-bold text-xs mb-1">Google Gemini</p>
                    <p className="text-[11px] text-surface-500">Modelo por defecto: <code className="text-surface-300">gemini-2.0-flash</code>. Requiere tu propia API key.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded-lg border border-surface-700/30">
                    <p className="text-amber-400 font-bold text-xs mb-1">Ollama (local)</p>
                    <p className="text-[11px] text-surface-500">Conexión directa desde el navegador a tu instancia local. Sin API key ni servidor intermediario.</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 border-l-4 border-l-violet-500">
                <h5 className="font-bold text-white text-sm mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Contexto automático del workspace</h5>
                <p className="text-xs text-surface-400 leading-relaxed">
                  Cuando chateas dentro de un workspace, el asistente recibe automáticamente el contenido de tus documentos, los conceptos semánticos definidos y los fragmentos marcados. El modelo &quot;sabe&quot; de qué trata tu proyecto sin que tengas que copiar y pegar nada.
                </p>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-amber-400 text-xs uppercase mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Privacidad de las API keys</h5>
                <p className="text-xs text-surface-400 leading-relaxed">
                  Las claves de IA se almacenan <strong className="text-white">cifradas en el servidor</strong> (vault AES-256-GCM por usuario en <code className="text-surface-300">users/&#123;uid&#125;/agentSecrets</code>). Nunca se exponen al cliente ni se guardan en <code className="text-surface-300">localStorage</code>.
                </p>
              </div>
            </div>
          </Section>

          <Section id="linter" icon={FileWarning} title="Linter Académico en Tiempo Real">
            <div className="space-y-5">
              <p className="text-surface-400">
                El editor analiza tu documento mientras escribes y señala problemas de estilo, ortografía, estructura académica y citas bibliográficas. Piensa en él como un corrector gramatical especializado en escritura académica en español.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-emerald-400 text-xs uppercase mb-3">Reglas de estructura</h5>
                  <ul className="space-y-1.5 text-[11px] text-surface-400">
                    <li><span className="text-surface-200 font-semibold">Encabezados:</span> jerarquía, H1 único, espacios correctos</li>
                    <li><span className="text-surface-200 font-semibold">Links:</span> URLs desnudas, links vacíos, espacios</li>
                    <li><span className="text-surface-200 font-semibold">Párrafos:</span> longitud excesiva, oraciones muy largas</li>
                    <li><span className="text-surface-200 font-semibold">Tablas:</span> formato GFM, columnas desalineadas</li>
                    <li><span className="text-surface-200 font-semibold">Código:</span> bloques sin lenguaje, fences sin cerrar</li>
                    <li><span className="text-surface-200 font-semibold">Imágenes:</span> texto alternativo faltante</li>
                    <li><span className="text-surface-200 font-semibold">Notas al pie:</span> referencias huérfanas</li>
                    <li><span className="text-surface-200 font-semibold">Frontmatter:</span> YAML malformado</li>
                  </ul>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-mandy-400 text-xs uppercase mb-3">Reglas académicas</h5>
                  <ul className="space-y-1.5 text-[11px] text-surface-400">
                    <li><span className="text-surface-200 font-semibold">Ortografía ES:</span> errores tipográficos, palabras duplicadas, acentuación</li>
                    <li><span className="text-surface-200 font-semibold">Estilo:</span> voz pasiva excesiva, nominalizaciones</li>
                    <li><span className="text-surface-200 font-semibold">Precisión:</span> cuantificadores vagos (varios, algunos, muchos)</li>
                    <li><span className="text-surface-200 font-semibold">Redundancia:</span> léxico repetitivo en el mismo párrafo</li>
                  </ul>
                  <h5 className="font-bold text-blue-400 text-xs uppercase mb-3 mt-4">Reglas de citas APA</h5>
                  <ul className="space-y-1.5 text-[11px] text-surface-400">
                    <li><span className="text-surface-200 font-semibold">Formato:</span> APA malformado, DOI incorrecto</li>
                    <li><span className="text-surface-200 font-semibold">Bibliografía:</span> sección faltante, citas huérfanas</li>
                    <li><span className="text-surface-200 font-semibold">Arcaísmos:</span> ibid. / op.cit. en lugar de referencias completas</li>
                  </ul>
                </div>
              </div>

              <div className="bg-surface-950/50 border border-surface-700/30 rounded-xl p-4">
                <p className="text-[11px] text-surface-500 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  Los subrayados de error aparecen directamente en el texto. Pasa el cursor sobre ellos para ver la descripción del problema y la sugerencia de corrección.
                </p>
              </div>
            </div>
          </Section>

          <Section id="formalizador" icon={Wand2} title="Formalizador LLM — Texto a Lógica Formal">
            <div className="space-y-5">
              <p className="text-surface-400">
                Convierte texto en lenguaje natural a código ST (lógica formal) usando inteligencia artificial. Útil para formalizar argumentos filosóficos, científicos o jurídicos.
              </p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3">Cómo funciona</h5>
                <ol className="list-decimal list-inside space-y-2 text-xs text-surface-400">
                  <li>Escribe o pega un texto en lenguaje natural (argumento, definición, hipótesis).</li>
                  <li>Selecciona el <strong className="text-surface-200">perfil lógico</strong> (clásica proposicional, primer orden, modal, intuicionista, etc.).</li>
                  <li>El formalizador envía el texto a un LLM y recibe código ST estructurado.</li>
                  <li>El resultado pasa por el <strong className="text-surface-200">linter ST</strong> automáticamente para validar la sintaxis.</li>
                  <li>Puedes insertar el código resultante directamente en tu documento ST.</li>
                </ol>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-violet-400 text-xs uppercase mb-3">Resultado del análisis</h5>
                  <ul className="space-y-1.5 text-[11px] text-surface-400">
                    <li><span className="text-surface-200 font-semibold">Código ST:</span> fórmulas generadas por el modelo</li>
                    <li><span className="text-surface-200 font-semibold">Confianza:</span> porcentaje calculado según errores y advertencias</li>
                    <li><span className="text-surface-200 font-semibold">Átomos / Fórmulas:</span> conteo de elementos extraídos</li>
                    <li><span className="text-surface-200 font-semibold">Diagnósticos:</span> errores y advertencias del linter ST</li>
                    <li><span className="text-surface-200 font-semibold">Trazabilidad:</span> indica si fue inferido por LLM o por reglas</li>
                  </ul>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="font-bold text-amber-400 text-xs uppercase mb-3">Modelos compatibles</h5>
                  <ul className="space-y-1.5 text-[11px] text-surface-400">
                    <li>Cualquier modelo compatible con la API de <strong className="text-surface-200">Ollama</strong></li>
                    <li><strong className="text-surface-200">Open WebUI</strong> (compatible con OpenAI)</li>
                    <li>Modelo recomendado: <code className="text-surface-300">autologic-formalizer</code> (fine-tuned para ST)</li>
                  </ul>
                  <p className="text-[11px] text-surface-500 mt-3 italic">El servidor también puede usar un endpoint centralizado configurado por el administrador.</p>
                </div>
              </div>
            </div>
          </Section>

          <Section id="semantic" icon={GitMerge} title="Navegador Semántico — Mapa de Conocimiento">
            <div className="space-y-5">
              <p className="text-surface-400">
                El Navegador Semántico es una capa de gestión de conocimiento que vive encima de tus documentos. Te permite extraer conceptos, marcar evidencias, definir relaciones y construir un grafo del conocimiento de tu workspace.
              </p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3">Entidades que puedes crear</h5>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-blue-400 font-bold text-[10px] uppercase mb-1">Concepto</p>
                    <p className="text-[10px] text-surface-500">Término clave con definición propia</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-emerald-400 font-bold text-[10px] uppercase mb-1">Evidencia</p>
                    <p className="text-[10px] text-surface-500">Fragmento que respalda una afirmación</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-amber-400 font-bold text-[10px] uppercase mb-1">Afirmación (Claim)</p>
                    <p className="text-[10px] text-surface-500">Tesis o proposición a demostrar</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-violet-400 font-bold text-[10px] uppercase mb-1">Definición</p>
                    <p className="text-[10px] text-surface-500">Enunciado formal de un término</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-mandy-400 font-bold text-[10px] uppercase mb-1">Fuente</p>
                    <p className="text-[10px] text-surface-500">Referencia bibliográfica ligada a un fragmento</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30 text-center">
                    <p className="text-slate-400 font-bold text-[10px] uppercase mb-1">Pasaje</p>
                    <p className="text-[10px] text-surface-500">Fragmento de texto destacado para análisis</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-xs uppercase mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-blue-400" /> Relaciones entre entidades</h5>
                <div className="flex flex-wrap gap-2">
                  {['soporta', 'contradice', 'implica', 'depende-de', 'define', 'ejemplo-de', 'evidencia-para', 'evidencia-contra', 'reformula', 'cuestiona', 'relacionado-con'].map(r => (
                    <span key={r} className="px-2 py-1 rounded bg-surface-900/60 border border-surface-700/40 text-[10px] text-surface-400 font-mono">{r}</span>
                  ))}
                </div>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-xs uppercase mb-3">Modos de experiencia</h5>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30">
                    <p className="text-emerald-400 font-bold text-[10px] uppercase mb-1">Asistido</p>
                    <p className="text-[10px] text-surface-500">La IA sugiere conceptos y relaciones automáticamente mientras editas.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30">
                    <p className="text-amber-400 font-bold text-[10px] uppercase mb-1">Híbrido</p>
                    <p className="text-[10px] text-surface-500">Combina sugerencias automáticas con marcado manual.</p>
                  </div>
                  <div className="p-3 bg-surface-900/50 rounded border border-surface-700/30">
                    <p className="text-mandy-400 font-bold text-[10px] uppercase mb-1">Experto</p>
                    <p className="text-[10px] text-surface-500">Control total manual. Ideal para investigadores avanzados.</p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-surface-500">El estado semántico de cada workspace se sincroniza en la nube y es accesible por todos los miembros con los permisos correspondientes.</p>
            </div>
          </Section>

          <Section id="st-lang" icon={FlaskConical} title="Lenguaje ST (Lógica Formal)">
            <div className="space-y-5">
              <p className="text-surface-400 text-base">
                El <strong className="text-white">lenguaje ST</strong> es nuestra joya tecnológica para la computación simbólica y lógica formal.
              </p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 border-l-4 border-l-indigo-500">
                <h5 className="font-bold text-white text-sm mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> STRunner Refinado</h5>
                <p className="text-xs text-surface-400 leading-relaxed">
                  La herramienta STRunner (ícono de Rayo) ha sido rediseñada. Ahora el panel de salida es <strong className="text-white">completamente redimensionable</strong> arrastrando el borde superior de las pestañas de resultados. Además, puedes ocultarlo por completo para trabajar cómodamente en scripts largos.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 space-y-4">
                  <h4 className="font-bold text-white">Nuevo Centro ST</h4>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Ahora ST tiene una <strong className="text-white">vista dedicada</strong> dentro de Ágora con manual ampliado del lenguaje, perfiles lógicos, un script canónico por sistema, clase <code className="text-surface-200">Meta</code>, metalógica aplicada y un flujo de validación reproducible contra el paquete oficial.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="px-3 py-1 rounded-full bg-surface-900/70 border border-surface-700/40 text-surface-300">11 perfiles documentados</span>
                    <span className="px-3 py-1 rounded-full bg-surface-900/70 border border-surface-700/40 text-surface-300">13 scripts canónicos verificados</span>
                    <span className="px-3 py-1 rounded-full bg-surface-900/70 border border-surface-700/40 text-surface-300">Text Layer incluido</span>
                    <span className="px-3 py-1 rounded-full bg-surface-900/70 border border-surface-700/40 text-surface-300">Variables, funciones y theory-class</span>
                  </div>
                  <p className="text-[11px] text-surface-500">
                    Autoría y derechos de la documentación ST: <span className="text-surface-300 font-semibold">Steven Vallejo Ortiz</span>.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/docs/st" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-mandy-500 text-white text-sm font-bold hover:bg-mandy-400 transition">
                      <FlaskConical className="w-4 h-4" /> Abrir centro ST
                    </Link>
                    <a href="/downloads/st/01-clasica-proposicional.st" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600/50 text-surface-200 text-sm font-bold hover:border-mandy-500/40 hover:text-white transition">
                      <Download className="w-4 h-4" /> Descargar script completo
                    </a>
                  </div>
                </div>

                <div className="bg-surface-950/50 border border-surface-700/30 rounded-xl p-5">
                  <h5 className="text-emerald-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><Check className="w-4 h-4" /> Validación rápida</h5>
                  <p className="text-[11px] text-surface-500 italic mb-3">
                    Los ejemplos del Centro ST se comprueban con un script reproducible dentro del repo.
                  </p>
                  <CopyBlock code={`npm run validate:st-docs`} />
                  <div className="space-y-2 mt-3 text-[11px] text-surface-400">
                    <p><strong className="text-surface-200">Ruta sugerida:</strong> clásica → primer orden → modal → intuicionista → perfiles avanzados.</p>
                    <p><strong className="text-surface-200">Ideal para:</strong> clases, tutoriales internos, pruebas de consistencia y formalización documental.</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section id="ui-layout" icon={Layout} title="Productividad & Layout Adaptable">
            <div className="space-y-4">
              <p className="text-surface-400">Ágora se adapta a tu flujo de trabajo, no al revés.</p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-emerald-400 text-sm mb-3">Maximizar a Pantalla Completa</h5>
                <p className="text-xs text-surface-400 leading-relaxed">
                  Cualquier panel (Editor, Tablero, Terminal) tiene un botón de <strong className="text-white">Expandir</strong> en su barra de herramientas.
                  Esto activa la API Fullscreen nativa, ocultando todo lo demás del navegador para que te enfoques únicamente en esa tarea. Útil para presentaciones o sesiones de código intensas.
                </p>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-purple-400 text-sm mb-3">Modo Zen (Escritura Pura)</h5>
                <p className="text-xs text-surface-400 leading-relaxed mb-3">
                  Actívalo con el ícono de <strong className="text-white">Zen</strong> en la cabecera. Automáticamente:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-surface-500">
                  <li>Oculta la barra lateral de archivos.</li>
                  <li>Colapsa la cabecera superior.</li>
                  <li>Maximiza el área de mosaicos.</li>
                </ul>
                <p className="text-xs text-surface-400 mt-2 italic">Puedes salir pulsando el mismo botón o los controles flotantes que aparecen en los bordes.</p>
              </div>
            </div>
          </Section>

          <Section id="offline" icon={WifiOff} title="Soporte PWA & Trabajo Offline">
            <div className="space-y-4 text-surface-400">
              <p>Diseñado para investigadores en campo o con conexiones inestables.</p>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-blue-400 text-sm mb-3">Cómo funciona el modo desconectado</h5>
                <ul className="list-disc list-inside space-y-3 text-xs">
                  <li><strong className="text-surface-200">Indicador de Estado:</strong> Un sensor en tiempo real te avisa si estás &quot;En línea&quot; o &quot;Sin conexión&quot; en la cabecera.</li>
                  <li><strong className="text-surface-200">Persistencia Local:</strong> Todos tus documentos y tareas se guardan en <code className="text-surface-300">IndexedDB</code> (almacenamiento interno del navegador).</li>
                  <li><strong className="text-surface-200">Sincronización Inteligente:</strong> Al recuperar el Wi-Fi, el hook <code className="text-mandy-300">useOfflineSync</code> detecta los cambios pendientes y los sube a Firebase, fusionando el trabajo realizado sin que tengas que hacer nada.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="security" icon={Shield} title="Seguridad, Perfil & Planes">
            <div className="space-y-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" /> Planes y Almacenamiento</h5>
                <p className="text-xs text-surface-400 leading-relaxed mb-3">
                  Controla tu consumo desde el menú de usuario. El sistema rastrea el tamaño de tus archivos en <strong className="text-white">Firebase Storage</strong> y te muestra una barra de progreso con tu límite actual.
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-surface-950/50 rounded border border-surface-700/30 flex items-center justify-between">
                    <span className="text-[10px] text-surface-500 font-bold uppercase">Gratuito</span>
                    <span className="text-[10px] text-surface-300 font-mono">50 MB · Sin terminales</span>
                  </div>
                  <div className="p-3 bg-surface-950/50 rounded border border-blue-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-blue-400 font-bold uppercase">Básico · $30.000/mes</span>
                    <span className="text-[10px] text-surface-300 font-mono">1 GB · Kanban · Workspaces colaborativos</span>
                  </div>
                  <div className="p-3 bg-surface-950/50 rounded border border-mandy-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-mandy-400 font-bold uppercase">Pro · $80.000/mes</span>
                    <span className="text-[10px] text-surface-300 font-mono">1 GB · Terminales ilimitadas · Worker completo</span>
                  </div>
                  <div className="p-3 bg-surface-950/50 rounded border border-amber-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1"><Crown className="w-3 h-3" /> Enterprise · $240.000/mes</span>
                    <span className="text-[10px] text-surface-300 font-mono">10 GB · Máquina dedicada · Soporte personalizado</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Key className="w-4 h-4 text-mandy-400" /> Seguridad de Cuenta</h5>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-2">
                  <li>Autenticación segura mediante Firebase Auth.</li>
                  <li>Opción de <strong className="text-surface-200">Cambio de Contraseña</strong> integrada en el menú de perfil con validación de seguridad.</li>
                  <li>Cierre de sesión global para invalidar tokens en todos los dispositivos.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="worker" icon={HardDrive} title="Edu Worker: Guía Profunda para Operadores">
            <div className="space-y-5">
              <p className="text-surface-400">El Worker es el motor que hace posible la ejecución remota de comandos.</p>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-xs uppercase mb-3">Instalación del Gestor CLI</h5>
                <p className="text-xs text-surface-400 mb-3">En un servidor Ubuntu/Debian, ejecuta el instalador automatizado:</p>
                <CopyBlock code="curl -fsSL https://agora.elenxos.com/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb" />
              </div>

              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                <h5 className="font-bold text-white text-xs uppercase mb-3">Referencia de Comandos CLI</h5>
                <div className="space-y-3">
                  <CommandRef cmd="edu-worker-manager add <id>" desc="Crea un nuevo contenedor para un espacio. Usa --personal para tu espacio privado." />
                  <CommandRef cmd="edu-worker-manager status" desc="Muestra tabla de contenedores activos y salud de la sincronización." />
                  <CommandRef cmd="edu-worker-manager update all" desc="Descarga la última imagen Docker y recrea todos los entornos sin perder datos." />
                  <CommandRef cmd="edu-worker-manager logs <id>" desc="Útil para depurar problemas de conexión con el Hub o Firebase." />
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex gap-4">
                <Shield className="w-8 h-8 text-amber-400 shrink-0" />
                <div>
                  <p className="text-amber-300 text-sm font-bold">Aislamiento Total</p>
                  <p className="text-amber-200/70 text-xs mt-1 leading-relaxed">
                    Cada Worker corre como un usuario no privilegiado dentro de un contenedor Docker con sistema de archivos montado de forma segura.
                    Tus credenciales de SSH y Git se guardan en volúmenes persistentes que sobreviven a las actualizaciones del software.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <div className="mt-16 pt-8 border-t border-surface-700/40 text-center space-y-4">
            <div className="flex justify-center gap-6">
              <a href={ELENXOS_BRAND.supportUrl} className="text-surface-500 hover:text-white transition text-xs font-medium uppercase tracking-widest">Soporte</a>
              <a href={ELENXOS_BRAND.homeUrl} target="_blank" rel="noopener noreferrer" className="text-surface-500 hover:text-white transition text-xs font-medium uppercase tracking-widest">Elenxos</a>
              <a href={ELENXOS_BRAND.projectsUrl} target="_blank" rel="noopener noreferrer" className="text-surface-500 hover:text-white transition text-xs font-medium uppercase tracking-widest">Proyectos</a>
              <a href="https://github.com/stevenvo780/EducacionCooperativa" target="_blank" rel="noopener noreferrer" className="text-mandy-400 hover:text-mandy-300 transition text-xs font-medium uppercase tracking-widest flex items-center gap-1">
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[10px] text-surface-600 font-medium">Plataforma Ágora © {new Date().getFullYear()} · Producto de {ELENXOS_BRAND.name}.</p>
            <p className="text-[10px] text-surface-500 font-medium">Elenxos construye herramientas digitales que transforman la educación.</p>
            <p className="text-[10px] text-surface-500 font-medium">Documentación y derechos de autor: Steven Vallejo Ortiz.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
