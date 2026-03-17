'use client';

import { useState } from 'react';
import { ArrowLeft, Terminal, Server, Download, Settings, Users, RefreshCw, Shield, HardDrive, BookOpen, ChevronDown, ChevronRight, Copy, Check, ExternalLink, Columns, PenTool, Layout, WifiOff, FileSpreadsheet, KanbanSquare } from 'lucide-react';
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
    { id: 'workspaces', label: 'Espacios & Gestión' },
    { id: 'editor', label: 'Editor Semántico' },
    { id: 'spreadsheet', label: 'Hojas de Cálculo' },
    { id: 'st-lang', label: 'Lenguaje ST' },
    { id: 'ui-layout', label: 'Interfaz & Layout' },
    { id: 'offline', label: 'Soporte Offline' },
    { id: 'worker-arch', label: 'Arquitectura Worker' },
    { id: 'worker-install', label: 'Instalación Worker' },
    { id: 'worker-cmds', label: 'Comandos Worker' }
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
            <h1 className="text-lg font-bold text-white">Documentación de la Plataforma</h1>
          </div>
          <div className="flex-1" />
          <span className="text-xs bg-mandy-500/20 text-mandy-400 px-2 py-0.5 rounded-full border border-mandy-500/30 font-mono">v2.0.0</span>
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
            <h2 className="text-3xl font-bold text-white mb-3">Plataforma Ágora</h2>
            <p className="text-surface-400 max-w-2xl leading-relaxed">
              Entorno colaborativo distribuido diseñado para la educación, investigación y desarrollo. 
              Integra edición semántica, ejecución remota en contenedores (Edu Worker), herramientas de lógica formal (Lenguaje ST) y tableros de gestión, todo sincronizado en tiempo real.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">React / Next.js</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">PWA Offline</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Docker</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Firebase</span>
              <span className="text-xs bg-surface-700/50 px-3 py-1.5 rounded-full text-surface-300 border border-surface-600/50">Socket.io</span>
            </div>
          </div>

          {/* Sections */}
          <Section id="overview" icon={Server} title="Visión General" defaultOpen={true}>
            <p>La arquitectura del sistema está compuesta por tres pilares:</p>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-emerald-400 text-sm mb-1">🌐 Frontend (Web)</h4>
                <p className="text-xs text-surface-400">Aplicación web PWA. Contiene el editor semántico, gestor de archivos, tableros Kanban y terminal interactiva (xterm.js).</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-blue-400 text-sm mb-1">🔗 Hub (Node)</h4>
                <p className="text-xs text-surface-400">Coordinador Socket.io. Gestiona las sesiones de terminal y enruta el tráfico entre los usuarios y los workers remotos.</p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h4 className="font-bold text-mandy-400 text-sm mb-1">⚙️ Worker (Docker)</h4>
                <p className="text-xs text-surface-400">Agente de ejecución remoto. Proporciona un entorno aislado (Ubuntu) por workspace, sincronizando archivos automáticamente.</p>
              </div>
            </div>
          </Section>

          <Section id="workspaces" icon={Users} title="Espacios de Trabajo & Gestión">
            <p className="text-surface-400">
              La plataforma organiza la información en <strong>Espacios de Trabajo (Workspaces)</strong>, que pueden ser Personales o Compartidos.
            </p>
            <div className="space-y-4 mt-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-blue-400 text-sm mb-2">Explorador de Archivos</h5>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li><strong>Drag & Drop:</strong> Arrastra archivos y carpetas para moverlos.</li>
                  <li><strong>Favoritos:</strong> Fija documentos importantes en la parte superior.</li>
                  <li><strong>Búsqueda Rápida (Ctrl+P):</strong> Búsqueda semántica global en todo el workspace.</li>
                  <li>Soporte para carpetas anidadas y renombrado en línea.</li>
                </ul>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-amber-400 text-sm mb-2">Tableros Kanban</h5>
                <p className="text-xs text-surface-400 mb-2">
                  Cada workspace incluye un tablero para gestión de tareas estilo Kanban.
                </p>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li>Columnas personalizables (Por hacer, En progreso, Completado).</li>
                  <li>Creación rápida de tareas y arrastrar y soltar entre columnas.</li>
                  <li><strong>Integración Semántica:</strong> Puedes crear tareas directamente seleccionando texto en el Editor Markdown.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="editor" icon={PenTool} title="Editor Markdown Semántico">
            <p className="text-surface-400">
              El <strong>MosaicEditor</strong> es un editor de texto enriquecido diseñado para la gestión del conocimiento.
            </p>
            <div className="space-y-4 mt-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-mandy-400 text-sm mb-2">Características Principales</h5>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li><strong>Modos de vista:</strong> Visual (WYSIWYG), Código Raw y Vista Previa.</li>
                  <li>Soporte nativo para <strong>LaTeX</strong> (inline y bloques) y diagramas <strong>Mermaid</strong>.</li>
                  <li><strong>Galería de Snippets:</strong> Inserta plantillas predefinidas rápidamente.</li>
                  <li>Menú de "Más opciones" (3 puntos) para configuraciones avanzadas.</li>
                </ul>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-emerald-400 text-sm mb-2">Panel Semántico Contextual</h5>
                <p className="text-xs text-surface-400 mb-2">
                  Al seleccionar texto en el editor, aparece un menú flotante inteligente que permite:
                </p>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li><strong>Definir Concepto:</strong> Extrae el texto como un concepto clave del workspace.</li>
                  <li><strong>Marcar Evidencia / Fijar Fragmento:</strong> Guarda citas importantes.</li>
                  <li><strong>Enviar a Tarea:</strong> Convierte la selección en una tarjeta del Kanban.</li>
                  <li><strong>Relacionar:</strong> Vincula el texto con documentos internos o conceptos existentes.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="spreadsheet" icon={FileSpreadsheet} title="Visor de Hojas de Cálculo">
            <p className="text-surface-400">
              Visualiza y analiza datos directamente en la plataforma sin salir del entorno.
            </p>
            <ul className="list-disc list-inside text-xs text-surface-400 mt-2 space-y-1">
              <li>Formatos soportados: <strong>XLSX, XLS, CSV, TSV</strong>.</li>
              <li>Soporte para múltiples hojas (pestañas en la parte inferior).</li>
              <li>Búsqueda global dentro de la hoja activa.</li>
              <li>Ordenamiento por columnas (ascendente/descendente).</li>
              <li>Paginación automática para grandes conjuntos de datos.</li>
            </ul>
          </Section>

          <Section id="st-lang" icon={BookOpen} title="Lenguaje ST (Lógica Formal)">
            <p className="text-surface-400">
              ST es un motor de ejecución de lógica formal integrado en la plataforma. Permite declarar axiomas, derivar teoremas y verificar la validez de fórmulas en diversos sistemas lógicos.
            </p>

            <h4 className="font-bold text-white mt-5">Tutorial Paso a Paso</h4>
            <div className="space-y-4 mt-3">
              <div className="border-l-2 border-mandy-500 pl-4 py-1">
                <p className="text-white font-semibold text-sm">1. Definir el Sistema Lógico</p>
                <p className="text-xs text-surface-400 mt-1">Usa <code className="text-mandy-300">logic</code> para establecer el contexto (ej: classical.propositional).</p>
                <CopyBlock code="logic classical.propositional" />
              </div>

              <div className="border-l-2 border-mandy-500 pl-4 py-1">
                <p className="text-white font-semibold text-sm">2. Declarar Axiomas</p>
                <p className="text-xs text-surface-400 mt-1">Nombra tus premisas básicas con <code className="text-mandy-300">axiom</code>.</p>
                <CopyBlock code={`axiom premisa1 : P -> Q\naxiom premisa2 : P`} />
              </div>

              <div className="border-l-2 border-mandy-500 pl-4 py-1">
                <p className="text-white font-semibold text-sm">3. Derivar Resultados</p>
                <p className="text-xs text-surface-400 mt-1">Obtén conclusiones usando reglas de inferencia o derivaciones directas.</p>
                <CopyBlock code="derive Q from {premisa1, premisa2}" />
              </div>

              <div className="border-l-2 border-mandy-500 pl-4 py-1">
                <p className="text-white font-semibold text-sm">4. Verificación y Tablas de Verdad</p>
                <p className="text-xs text-surface-400 mt-1">Comprueba si una fórmula es una tautología o genera su tabla de verdad.</p>
                <CopyBlock code={`check valid ((P -> Q) -> (!Q -> !P))\ntruth_table (P & Q)`} />
              </div>
            </div>

            <h4 className="font-bold text-white mt-6">STRunner & Editor</h4>
            <p className="text-xs text-surface-400 mt-2 leading-relaxed">
              Usa la herramienta <strong>STRunner</strong> (ícono de Rayo) para scripts rápidos o el editor de archivos <strong>.st</strong> para proyectos extensos. 
              <strong>Novedad:</strong> El panel de salida del STRunner es redimensionable y se puede ocultar para ampliar el área de código.
            </p>

            <div className="bg-surface-950/50 border border-surface-700/30 rounded-lg p-4 mt-4">
              <h5 className="text-emerald-400 text-xs font-bold uppercase mb-2">Ejemplo Completo</h5>
              <pre className="text-xs font-mono text-surface-300 leading-relaxed">
{`// Script de prueba ST
logic classical.propositional

axiom a1 : A | B
axiom a2 : !A

// Derivación por Silogismo Disyuntivo
derive B from {a1, a2}

// Verificar Ley de De Morgan
check valid !(P & Q) <-> (!P | !Q)`}
              </pre>
            </div>
          </Section>

          <Section id="ui-layout" icon={Layout} title="Interfaz Dinámica (Layout)">
            <p className="text-surface-400">
              El entorno de trabajo es completamente moldeable gracias a la integración de vistas en mosaico y paneles ajustables.
            </p>
            <div className="space-y-4 mt-4">
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-blue-400 text-sm mb-2">Mosaicos (MosaicLayout)</h5>
                <p className="text-xs text-surface-400">
                  Arrastra las pestañas para dividir la pantalla horizontal o verticalmente. Puedes tener el editor, la terminal y el tablero Kanban visibles simultáneamente.
                </p>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-emerald-400 text-sm mb-2">Redimensionamiento y Pantalla Completa</h5>
                <ul className="list-disc list-inside text-xs text-surface-400 space-y-1">
                  <li><strong>Barra lateral:</strong> Arrastra el borde derecho del explorador de archivos para cambiar su anchura dinámicamente.</li>
                  <li><strong>Maximizar:</strong> Cada panel del mosaico tiene un botón para expandirlo a pantalla completa (Fullscreen API), aislando tu atención en una sola tarea.</li>
                </ul>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4">
                <h5 className="font-bold text-purple-400 text-sm mb-2">Modo Zen</h5>
                <p className="text-xs text-surface-400">
                  Activa el Modo Zen desde la cabecera para ocultar automáticamente la barra lateral y superior, creando un entorno de escritura libre de distracciones.
                </p>
              </div>
            </div>
          </Section>

          <Section id="offline" icon={WifiOff} title="Soporte Offline (PWA)">
            <p className="text-surface-400">
              La plataforma está diseñada para funcionar incluso sin conexión a internet.
            </p>
            <ul className="list-disc list-inside text-xs text-surface-400 mt-3 space-y-2">
              <li><strong>Modo Desconectado:</strong> Un indicador visual te notificará cuando pierdas la conexión.</li>
              <li><strong>Edición Local:</strong> Puedes seguir editando documentos y gestionando tareas de forma local usando almacenamiento interno (IndexedDB).</li>
              <li><strong>Sincronización Automática:</strong> Al recuperar la conexión, el sistema detecta los cambios y los sincroniza silenciosamente con Firebase, previniendo conflictos de edición.</li>
            </ul>
          </Section>

          <Section id="worker-arch" icon={Server} title="Arquitectura del Edu Worker">
            <h4 className="font-bold text-white">Dentro del contenedor</h4>
            <p className="mt-2 text-surface-400">Cada contenedor Docker ejecuta:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-400 mt-2">
              <li><strong className="text-white">sync_agent.js</strong> — Observa cambios en <code className="text-mandy-300">/workspace</code> con chokidar, sincroniza a Firebase Storage, y escucha cambios remotos via Firestore/RTDB.</li>
              <li><strong className="text-white">Socket.io client</strong> — Se conecta al Hub, recibe comandos de terminal (<code className="text-mandy-300">execute</code>), envía output de vuelta.</li>
              <li><strong className="text-white">node-pty</strong> — Crea pseudo-terminales para ejecutar bash con PTY real (soporta colores, vim, htop, etc.).</li>
            </ul>

            <h4 className="font-bold text-white mt-5">Estructura de red y Persistencia</h4>
            <p className="text-surface-400 mt-2 text-sm">
              El worker usa <code className="text-mandy-300">--network=host</code> para conectarse al Hub. La persistencia se logra montando volúmenes locales en el contenedor:
            </p>
            <div className="bg-surface-800/60 border border-surface-700/40 rounded-lg p-4 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-emerald-400 text-sm">/workspace</code> <span className="text-xs text-surface-500">→</span> <code className="text-surface-400 text-xs">BASE/workspaces/&lt;id&gt;</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-emerald-400 text-sm">/home/estudiante</code> <span className="text-xs text-surface-500">→</span> <code className="text-surface-400 text-xs">BASE/home/&lt;id&gt;</code>
                </div>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              Esto garantiza que configuraciones de SSH, Git, cachés de npm y el historial de bash sobrevivan a reinicios del contenedor.
            </p>
          </Section>

          <Section id="worker-install" icon={Download} title="Instalación del Worker">
            <h4 className="font-bold text-white">Requisitos</h4>
            <ul className="list-disc list-inside space-y-1 text-surface-400">
              <li>Ubuntu 20.04+ / Debian 11+ con Docker instalado</li>
              <li>Acceso a internet (para descargar la imagen Docker)</li>
            </ul>

            <h4 className="font-bold text-white mt-5">Instalación rápida</h4>
            <CopyBlock
              label="Descargar e instalar el gestor CLI"
              code={`curl -fsSL https://visormarkdown-virid.vercel.app/downloads/edu-worker_1.0.10_amd64.deb -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb`}
            />

            <h4 className="font-bold text-white mt-5">Configuración Inicial</h4>
            <p className="text-surface-400 text-xs mb-2">El archivo <code>/etc/edu-worker/worker.env</code> requiere configuración de Firebase y secretos compartidos.</p>
            <CopyBlock label="Añadir un nuevo entorno de workspace" code={`sudo edu-worker-manager add <workspace-id> --name "Mi Espacio"`} />
          </Section>

          <Section id="worker-cmds" icon={Terminal} title="Comandos CLI (edu-worker-manager)">
            <p className="text-surface-400 mb-3">Ejecutados mediante <code className="text-mandy-300">sudo edu-worker-manager &lt;comando&gt;</code></p>
            <div className="space-y-3">
              <CommandRef cmd="add <id> [--personal|--shared]" desc="Registra un workspace, crea el volumen y arranca el contenedor." />
              <CommandRef cmd="remove <id>" desc="Detiene y elimina el contenedor. Los datos del workspace se conservan en disco." />
              <CommandRef cmd="start | stop | restart <id|all>" desc="Controla el ciclo de vida de los contenedores Docker." />
              <CommandRef cmd="update [id|all]" desc="Descarga la última imagen stevenvo780/edu-worker y recrea los contenedores." />
              <CommandRef cmd="resync <id|all>" desc="Fuerza la resincronización de Firebase reiniciando el servicio interno del worker." />
              <CommandRef cmd="status" desc="Muestra tabla de workers activos, IDs, y estado del listener de sincronización." />
              <CommandRef cmd="logs <id> [-f]" desc="Muestra logs del contenedor (soporta tail -f)." />
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-surface-700/40 text-center text-xs text-surface-500">
            <p>Plataforma Ágora — Documentación Oficial</p>
            <p className="mt-1">
              <a href="https://github.com/stevenvo780/EducacionCooperativa" target="_blank" rel="noopener noreferrer" className="text-mandy-400 hover:text-mandy-300 transition inline-flex items-center gap-1">
                GitHub Repository <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
