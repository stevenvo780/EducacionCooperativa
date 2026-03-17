'use client';

import { useState } from 'react';
import {
  ArrowLeft, Terminal, Server, Download, Settings, Users, RefreshCw,
  Shield, HardDrive, BookOpen, ChevronDown, ChevronRight, Copy, Check,
  ExternalLink, Columns, PenTool, Layout, LayoutGrid, WifiOff, FileSpreadsheet,
  KanbanSquare, Sparkles, Network, Quote, BookmarkPlus, Briefcase,
  Zap, FlaskConical, Monitor, Key, LogOut, Crown, Trash2, Plus,
  FolderPlus, Upload, Search, User, Globe, Lock, Layers
} from 'lucide-react';
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
    { id: 'st-lang', label: 'Lógica ST' },
    { id: 'ui-layout', label: 'Productividad (Layout)' },
    { id: 'offline', label: 'PWA & Offline' },
    { id: 'security', label: 'Seguridad & Planes' },
    { id: 'worker', label: 'Edu Worker (Deep)' }
  ];

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200 selection:bg-mandy-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-900/90 backdrop-blur border-b border-surface-700/50">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-surface-700/50 transition text-surface-400 hover:text-white">
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
            Versión 2.5.0
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-surface-500 font-bold mb-4 px-2">Tabla de Contenidos</p>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 py-2 px-2 rounded-lg hover:bg-surface-800/50 transition-all group">
              <div className="w-1 h-1 rounded-full bg-surface-700 group-hover:bg-mandy-500 transition-colors" />
              {s.label}
            </a>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Hero */}
          <div className="bg-gradient-to-br from-mandy-600/20 via-surface-800/50 to-surface-900 border border-mandy-500/30 rounded-3xl p-10 mb-10 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Bienvenido al Futuro del Aprendizaje Colaborativo</h2>
              <p className="text-surface-300 max-w-3xl text-base leading-relaxed">
                La Plataforma Ágora no es solo un editor; es un ecosistema distribuido que combina IA, lógica formal, ejecución remota y gestión semántica de la información.
                Este manual detalla cada funcionalidad para convertirte en un experto en el uso de la herramienta.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-blue-400" /> Web PWA</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-emerald-400" /> Multi-Worker</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-400" /> Lógica ST</span>
                <span className="text-[11px] font-bold bg-surface-700/80 px-4 py-2 rounded-xl text-surface-200 border border-surface-600/50 flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-mandy-400" /> E2E Sincronizado</span>
              </div>
            </div>
            {/* Visual fluff */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-mandy-500/10 blur-[100px] rounded-full" />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-violet-500/10 blur-[100px] rounded-full" />
          </div>

          {/* Sections */}
          <Section id="overview" icon={Server} title="Arquitectura Distribuida" defaultOpen={true}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h4 className="font-bold text-emerald-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <Monitor className="w-4 h-4" /> Frontend (Next.js)
                </h4>
                <p className="text-xs text-surface-400 leading-relaxed">Núcleo de la experiencia de usuario. Gestiona el editor visual, la lógica offline, y la interfaz de mosaicos adaptable.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h4 className="font-bold text-blue-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <ExternalLink className="w-4 h-4" /> Nexus Hub (Node)
                </h4>
                <p className="text-xs text-surface-400 leading-relaxed">Servidor central de tiempo real. Coordina las conexiones WebSocket entre el navegador y los Workers Docker distribuidos.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5 hover:bg-surface-800/80 transition group">
                <h4 className="font-bold text-mandy-400 text-sm mb-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <HardDrive className="w-4 h-4" /> Edu Worker (Docker)
                </h4>
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

              <h4 className="font-bold text-white mt-5">Tutorial de Lógica Proposicional</h4>
              <div className="space-y-4 mt-3">
                <div className="border-l-2 border-indigo-500 pl-4 py-1">
                  <p className="text-white font-semibold text-sm">Concepto 1: El Contexto</p>
                  <p className="text-xs text-surface-400 mt-1">Antes de nada, define qué lógica usarás. <code className="text-indigo-300">classical.propositional</code> es el estándar.</p>
                  <CopyBlock code="logic classical.propositional" />
                </div>

                <div className="border-l-2 border-indigo-500 pl-4 py-1">
                  <p className="text-white font-semibold text-sm">Concepto 2: Axiomas y Fórmulas</p>
                  <p className="text-xs text-surface-400 mt-1">Declara tus verdades iniciales. Soporta operadores <code className="text-surface-300">-&gt;</code> (implicación), <code className="text-surface-300">&amp;</code> (conjunción), <code className="text-surface-300">|</code> (disyunción) y <code className="text-surface-300">!</code> (negación).</p>
                  <CopyBlock code={`axiom base1 : P -> Q\naxiom base2 : P`} />
                </div>

                <div className="border-l-2 border-indigo-500 pl-4 py-1">
                  <p className="text-white font-semibold text-sm">Concepto 3: Derivación Automática</p>
                  <p className="text-xs text-surface-400 mt-1">Pide al motor que deduzca una conclusión a partir de un conjunto de premisas.</p>
                  <CopyBlock code="derive Q from {base1, base2}" />
                </div>
              </div>

              <div className="bg-surface-950/50 border border-surface-700/30 rounded-xl p-5">
                <h5 className="text-emerald-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><Check className="w-4 h-4" /> Comandos de Verificación</h5>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <code className="text-indigo-400 font-bold shrink-0">check valid &lt;formula&gt;</code>
                    <p className="text-[11px] text-surface-500 italic">Determina si una fórmula es una tautología (siempre verdadera).</p>
                  </div>
                  <div className="flex gap-2">
                    <code className="text-indigo-400 font-bold shrink-0">truth_table &lt;formula&gt;</code>
                    <p className="text-[11px] text-surface-500 italic">Genera la tabla de verdad completa en la salida del editor.</p>
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
                <div className="p-3 bg-surface-950/50 rounded border border-surface-700/30 flex items-center justify-between">
                  <span className="text-[10px] text-surface-500 font-bold uppercase">Plan Gratuito</span>
                  <span className="text-[10px] text-surface-300 font-mono">Límite: 100 MB</span>
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
                <CopyBlock code="curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb" />
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

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-surface-700/40 text-center space-y-4">
            <div className="flex justify-center gap-6">
              <a href="#" className="text-surface-500 hover:text-white transition text-xs font-medium uppercase tracking-widest">Soporte</a>
              <a href="#" className="text-surface-500 hover:text-white transition text-xs font-medium uppercase tracking-widest">Privacidad</a>
              <a href="https://github.com/stevenvo780/EducacionCooperativa" target="_blank" rel="noopener noreferrer" className="text-mandy-400 hover:text-mandy-300 transition text-xs font-medium uppercase tracking-widest flex items-center gap-1">
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[10px] text-surface-600 font-medium">Plataforma Ágora © 2026 — El conocimiento es un bien común.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
