import Link from 'next/link';
import { BookOpen, ArrowLeft, Cookie, Shield, Settings, BarChart3, Users, AlertTriangle, ExternalLink } from 'lucide-react';
import { ELENXOS_BRAND, PRODUCT_BRAND } from '@/lib/branding';

export const metadata = {
  title: `Política de Cookies | ${PRODUCT_BRAND.name}`,
  description: 'Información sobre el uso de cookies y almacenamiento local en Agora por Elenxos.'
};

function SectionCard({
  icon: Icon,
  title,
  children,
  accent = 'text-mandy-400',
  bg = 'bg-mandy-500/10',
  border = 'border-mandy-500/20'
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  accent?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-6 space-y-4`}>
      <div className={`flex items-center gap-3 ${accent} font-semibold text-lg`}>
        <Icon className="w-5 h-5 shrink-0" />
        <span>{title}</span>
      </div>
      <div className="text-surface-300 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function Table({ rows }: { rows: { nombre: string; tipo: string; finalidad: string; duracion: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-700/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-800/80 text-surface-300 uppercase text-xs tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Nombre / Clave</th>
            <th className="text-left px-4 py-3 font-semibold">Tipo</th>
            <th className="text-left px-4 py-3 font-semibold">Finalidad</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Duración</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-surface-700/40 ${i % 2 === 0 ? 'bg-surface-800/20' : 'bg-surface-800/40'}`}
            >
              <td className="px-4 py-3 font-mono text-xs text-mandy-300 align-top">{row.nombre}</td>
              <td className="px-4 py-3 text-surface-400 align-top">{row.tipo}</td>
              <td className="px-4 py-3 text-surface-300 align-top">{row.finalidad}</td>
              <td className="px-4 py-3 text-surface-400 whitespace-nowrap align-top">{row.duracion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  const esenciales = [
    {
      nombre: 'firebase:authUser:*',
      tipo: 'localStorage',
      finalidad: 'Persiste la sesión activa del usuario autenticado con Firebase Auth. Sin esta entrada el usuario debe volver a iniciar sesión en cada carga de página.',
      duracion: 'Sesión / hasta cierre de sesión'
    },
    {
      nombre: 'firebase:host:*',
      tipo: 'IndexedDB / localStorage',
      finalidad: 'Estado interno del SDK de Firebase (tokens de refresco, rutas RTDB, caché de Firestore offline). Necesario para el funcionamiento de Auth, Firestore y RTDB.',
      duracion: 'Persistente mientras la sesión esté activa'
    },
    {
      nombre: '__session',
      tipo: 'Cookie HTTP',
      finalidad: 'Cookie de sesión establecida por Firebase Auth al iniciar sesión con Google. Permite mantener la autenticación entre peticiones al servidor (Next.js App Router).',
      duracion: 'Sesión de navegador'
    }
  ];

  const preferencias = [
    {
      nombre: 'agora:editor:*',
      tipo: 'localStorage',
      finalidad: 'Guarda preferencias del editor: tema (claro/oscuro), tamaño de fuente, disposición de paneles, estado de linters activos y snippets frecuentes. Persiste entre sesiones para no requerir reconfiguración.',
      duracion: 'Persistente (sin expiración)'
    },
    {
      nombre: 'agora:workspace:*',
      tipo: 'localStorage',
      finalidad: 'Estado de UI por workspace: documentos abiertos, tabs activos, posición del cursor, estado del panel de terminal y filtros de explorador de archivos.',
      duracion: 'Persistente (sin expiración)'
    },
    {
      nombre: 'agora:chat:*',
      tipo: 'localStorage',
      finalidad: 'Caché local del historial del agente IA para respuesta rápida antes de sincronizar con Firestore. Los chats completos viven en la nube; este almacenamiento es solo un búfer de rendimiento.',
      duracion: 'Hasta cierre de sesión o limpieza manual'
    },
    {
      nombre: 'agora:pwa:*',
      tipo: 'Cache API / Service Worker',
      finalidad: 'Recursos estáticos cacheados por el Service Worker (PWA) para funcionamiento offline. Incluye bundles JS/CSS y fuentes. No contiene datos personales del usuario.',
      duracion: 'Hasta desinstalación de la PWA o limpieza de caché'
    }
  ];

  const analitica = [
    {
      nombre: '(Google Analytics / Firebase Analytics)',
      tipo: 'Cookie / localStorage',
      finalidad: 'Si se activa analítica, se usaría Firebase Analytics (Google) para medir sesiones anónimas, páginas visitadas y errores de carga. A la fecha de esta política, la analítica no está activada en producción.',
      duracion: 'N/A (no activo actualmente)'
    }
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface-900 text-white">

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <BookOpen className="w-6 h-6 text-mandy-500" />
            <span className="text-gradient-mandy">Agora</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="relative py-16 overflow-hidden border-b border-surface-700/30">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-mandy-500/4 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-[350px] h-[350px] bg-violet-500/4 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-4 relative z-10 max-w-4xl">
            <div className="flex items-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest mb-6">
              <span className="w-8 h-px bg-mandy-500/50" />
              Legal · Privacidad
            </div>
            <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Política de Cookies
            </h1>
            <p className="text-surface-300 text-lg leading-relaxed max-w-2xl">
              Qué almacenamos en tu navegador, por qué, y cómo puedes controlarlo.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-full">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Borrador — revisar con asesoría legal antes de producción definitiva
              </span>
              <span className="inline-flex items-center gap-2 bg-surface-800/60 border border-surface-700/50 text-surface-400 px-4 py-2 rounded-full">
                Última actualización: 8 de junio de 2026
              </span>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl space-y-8">

            {/* Qué son las cookies */}
            <SectionCard
              icon={Cookie}
              title="¿Qué son las cookies y el almacenamiento local?"
              accent="text-mandy-400"
              bg="bg-mandy-500/5"
              border="border-mandy-500/20"
            >
              <p>
                Las <strong className="text-white">cookies</strong> son pequeños archivos de texto que un sitio web deposita
                en tu navegador para recordar información entre visitas. Además de cookies, los sitios web modernos
                usan mecanismos complementarios: <strong className="text-white">localStorage</strong>,{' '}
                <strong className="text-white">sessionStorage</strong>, <strong className="text-white">IndexedDB</strong>{' '}
                y la <strong className="text-white">Cache API</strong> del Service Worker (PWA).
              </p>
              <p>
                Agora utiliza principalmente <strong className="text-white">localStorage</strong> e{' '}
                <strong className="text-white">IndexedDB</strong> para la sesión de Firebase Auth y las preferencias de
                usuario, y una <strong className="text-white">cookie HTTP de sesión</strong> ({' '}
                <code className="text-mandy-300 bg-mandy-500/10 px-1 rounded text-xs">__session</code>) para la
                autenticación con Google. No usamos cookies de seguimiento de terceros con fines publicitarios.
              </p>
            </SectionCard>

            {/* Cookies esenciales */}
            <SectionCard
              icon={Shield}
              title="Cookies y almacenamiento esenciales"
              accent="text-emerald-400"
              bg="bg-emerald-500/5"
              border="border-emerald-500/20"
            >
              <p>
                Son <strong className="text-white">indispensables</strong> para que Agora funcione. Sin ellas no es
                posible autenticarse ni usar la plataforma. No pueden desactivarse desde nuestra configuración,
                aunque el usuario puede limpiarlas manualmente desde su navegador (lo que cerrará la sesión activa).
              </p>
              <Table rows={esenciales} />
            </SectionCard>

            {/* Almacenamiento de preferencias */}
            <SectionCard
              icon={Settings}
              title="Almacenamiento de preferencias y UI"
              accent="text-violet-400"
              bg="bg-violet-500/5"
              border="border-violet-500/20"
            >
              <p>
                Estas entradas guardan la <strong className="text-white">configuración personal</strong> del editor,
                los workspaces y la interfaz para mejorar la experiencia de uso entre sesiones. No contienen datos
                personales sensibles ni se comparten con terceros. El usuario puede eliminarlas sin afectar la
                funcionalidad esencial de la plataforma; al hacerlo, la configuración de UI volverá a los valores
                predeterminados.
              </p>
              <Table rows={preferencias} />
            </SectionCard>

            {/* Analítica */}
            <SectionCard
              icon={BarChart3}
              title="Analítica (actualmente no activa)"
              accent="text-sky-400"
              bg="bg-sky-500/5"
              border="border-sky-500/20"
            >
              <p>
                Agora <strong className="text-white">no tiene analítica de terceros activa</strong> a la fecha de esta
                política. En el futuro podría activarse Firebase Analytics (proporcionado por Google) con el objetivo
                exclusivo de entender el uso anónimo de la plataforma y mejorar el servicio (páginas más visitadas,
                errores frecuentes, rendimiento de carga). Si se activa:
              </p>
              <ul className="space-y-1 list-disc list-inside text-surface-400">
                <li>Los datos serán anonimizados en la medida posible.</li>
                <li>Se actualizará esta política con los detalles específicos antes de su activación.</li>
                <li>Los usuarios recibirán una notificación visible y tendrán la opción de no participar.</li>
              </ul>
              <Table rows={analitica} />
            </SectionCard>

            {/* Terceros */}
            <SectionCard
              icon={Users}
              title="Terceros que pueden acceder al almacenamiento"
              accent="text-amber-400"
              bg="bg-amber-500/5"
              border="border-amber-500/20"
            >
              <p>
                Los siguientes proveedores de servicios pueden establecer sus propias cookies o acceder a datos del
                navegador cuando usas Agora. Cada uno tiene su propia política de privacidad independiente:
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-surface-700/40 bg-surface-800/40 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">Google / Firebase (Firebase Auth, Firestore, RTDB)</span>
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-mandy-400 hover:text-mandy-300 transition"
                    >
                      Política de privacidad <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-surface-400 text-xs leading-relaxed">
                    Proporciona autenticación, base de datos en tiempo real y almacenamiento de documentos y preferencias.
                    Puede establecer cookies de sesión y usar localStorage para el SDK de Firebase.
                  </p>
                </div>
                <div className="rounded-xl border border-surface-700/40 bg-surface-800/40 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">MercadoPago (procesamiento de pagos)</span>
                    <a
                      href="https://www.mercadopago.com.co/ayuda/terminos-y-condiciones_194"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-mandy-400 hover:text-mandy-300 transition"
                    >
                      Política de privacidad <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-surface-400 text-xs leading-relaxed">
                    Procesador de pagos para las suscripciones en Colombia (COP). MercadoPago puede establecer sus
                    propias cookies en las páginas de pago. Agora nunca almacena datos de tarjetas; toda la
                    información de pago se procesa directamente en la infraestructura de MercadoPago.
                  </p>
                </div>
                <div className="rounded-xl border border-surface-700/40 bg-surface-800/40 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">Proveedores de IA (OpenAI, Anthropic, Google AI — configurados por el usuario)</span>
                    <span className="text-xs text-surface-500">Configurado por el usuario</span>
                  </div>
                  <p className="text-surface-400 text-xs leading-relaxed">
                    Si el usuario configura sus propias API keys para el agente IA (OpenAI, Anthropic, Google Gemini),
                    las llamadas se realizan desde el servidor de Agora hacia esos proveedores. Las API keys se
                    cifran con AES-256-GCM en el servidor y no se almacenan en el navegador. Los proveedores de IA
                    no establecen cookies en tu navegador a través de Agora.
                  </p>
                </div>
                <div className="rounded-xl border border-surface-700/40 bg-surface-800/40 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">Vercel (infraestructura de hosting)</span>
                    <a
                      href="https://vercel.com/legal/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-mandy-400 hover:text-mandy-300 transition"
                    >
                      Política de privacidad <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-surface-400 text-xs leading-relaxed">
                    Plataforma de despliegue del frontend de Agora. Vercel puede recopilar datos de acceso (IP,
                    user-agent) para seguridad y rendimiento de la red. Consulta la política de Vercel para más detalle.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Cómo gestionar / desactivar */}
            <SectionCard
              icon={Settings}
              title="Cómo gestionar o eliminar las cookies"
              accent="text-teal-400"
              bg="bg-teal-500/5"
              border="border-teal-500/20"
            >
              <p>
                El usuario tiene control total sobre el almacenamiento de su navegador. Las opciones disponibles son:
              </p>

              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-white mb-1">Desde el navegador (herramientas de desarrollador)</p>
                  <p className="text-surface-400">
                    En Chrome, Firefox, Safari y Edge es posible inspeccionar y eliminar cookies, localStorage e
                    IndexedDB desde las DevTools (F12 → Aplicación / Storage). Eliminar las entradas de{' '}
                    <code className="text-mandy-300 bg-mandy-500/10 px-1 rounded text-xs">firebase:authUser</code>{' '}
                    cerrará tu sesión activa en Agora.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Desde la configuración del navegador</p>
                  <ul className="space-y-1 list-disc list-inside text-surface-400">
                    <li>
                      <strong className="text-surface-300">Chrome:</strong> Configuración → Privacidad y seguridad →
                      Cookies y otros datos de sitios.
                    </li>
                    <li>
                      <strong className="text-surface-300">Firefox:</strong> Configuración → Privacidad y seguridad →
                      Cookies y datos del sitio.
                    </li>
                    <li>
                      <strong className="text-surface-300">Safari:</strong> Preferencias → Privacidad → Gestionar datos
                      del sitio web.
                    </li>
                    <li>
                      <strong className="text-surface-300">Edge:</strong> Configuración → Privacidad, búsqueda y servicios
                      → Cookies y datos del sitio.
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Efectos de eliminar el almacenamiento esencial</p>
                  <p className="text-surface-400">
                    Eliminar las cookies y el localStorage de sesión cerrará tu cuenta en Agora y borrará las
                    preferencias de editor guardadas localmente. Los documentos, workspaces y datos del agente IA
                    permanecen almacenados en la nube (Firestore / MinIO) y estarán disponibles al volver a iniciar
                    sesión.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Modo navegación privada / incógnito</p>
                  <p className="text-surface-400">
                    El almacenamiento en modo incógnito se elimina automáticamente al cerrar la ventana. La sesión
                    de Agora no persistirá entre ventanas privadas.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Ley 1581 / derechos */}
            <SectionCard
              icon={Shield}
              title="Ley 1581 de 2012 (Habeas Data) y tus derechos"
              accent="text-mandy-400"
              bg="bg-mandy-500/5"
              border="border-mandy-500/20"
            >
              <p>
                En Colombia, el tratamiento de datos personales está regulado por la{' '}
                <strong className="text-white">Ley 1581 de 2012 (Ley de Habeas Data)</strong> y el{' '}
                <strong className="text-white">Decreto 1377 de 2013</strong>. Como titular de tus datos tienes derecho a:
              </p>
              <ul className="space-y-1 list-disc list-inside text-surface-400">
                <li><strong className="text-surface-300">Conocer</strong> los datos personales que Elenxos trata sobre ti.</li>
                <li><strong className="text-surface-300">Actualizar y rectificar</strong> datos inexactos o incompletos.</li>
                <li><strong className="text-surface-300">Suprimir</strong> tus datos cuando no sean necesarios para la finalidad declarada o cuando hayas revocado la autorización.</li>
                <li><strong className="text-surface-300">Revocar la autorización</strong> de tratamiento en cualquier momento.</li>
                <li><strong className="text-surface-300">Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) si consideras que tus derechos han sido vulnerados.</li>
              </ul>
              <p className="mt-2">
                <strong className="text-white">Responsable del tratamiento:</strong> Elenxos —{' '}
                <strong className="text-white">canal para ejercer tus derechos:</strong>{' '}
                <a
                  href={ELENXOS_BRAND.supportUrl}
                  className="text-mandy-400 hover:text-mandy-300 underline transition"
                >
                  admin@elenxos.com
                </a>
                . Las solicitudes se atienden en un plazo máximo de quince (15) días hábiles conforme a la normativa vigente.
              </p>
              <p className="text-surface-500 text-xs mt-2">
                Para información completa sobre el tratamiento de datos personales (finalidades, transferencias,
                tiempos de retención), consulta la Política de Privacidad de Agora/Elenxos.
              </p>
            </SectionCard>

            {/* Cambios a esta política */}
            <div className="rounded-2xl border border-surface-700/50 bg-surface-800/30 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-white">Cambios a esta política</h2>
              <p className="text-surface-300 text-sm leading-relaxed">
                Elenxos puede actualizar esta Política de Cookies para reflejar cambios en la plataforma, en la
                tecnología utilizada o en la normativa aplicable. Cuando los cambios sean materiales, se publicará
                un aviso visible en Agora con al menos <strong className="text-white">15 días de anticipación</strong>.
                La versión vigente siempre estará disponible en{' '}
                <Link href="/cookies" className="text-mandy-400 hover:text-mandy-300 underline transition">
                  agora.elenxos.com/cookies
                </Link>
                .
              </p>
              <p className="text-surface-300 text-sm leading-relaxed">
                El uso continuado de Agora tras la fecha de vigencia de los cambios implica la aceptación de la
                nueva versión de la política.
              </p>
            </div>

            {/* Contacto */}
            <div className="rounded-2xl border border-surface-700/50 bg-surface-800/30 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-white">Contacto</h2>
              <p className="text-surface-300 text-sm leading-relaxed">
                Para consultas sobre esta política o para ejercer tus derechos como titular:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={ELENXOS_BRAND.supportUrl}
                  className="flex items-center gap-2 bg-mandy-500/10 border border-mandy-500/20 text-mandy-400 px-5 py-3 rounded-xl text-sm font-medium hover:bg-mandy-500/20 transition"
                >
                  <Shield className="w-4 h-4" />
                  admin@elenxos.com
                </a>
                <a
                  href={ELENXOS_BRAND.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-surface-700/50 border border-surface-600/50 text-surface-300 px-5 py-3 rounded-xl text-sm font-medium hover:bg-surface-700 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  elenxos.com
                </a>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-950 text-surface-500 py-8 border-t border-surface-600/30">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-mandy-500" />
            <span>
              &copy; {new Date().getFullYear()} {PRODUCT_BRAND.name} · Producto de {ELENXOS_BRAND.name}
            </span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-surface-600">
            <Link href="/" className="hover:text-mandy-400 transition">
              Inicio
            </Link>
            <Link href="/cookies" className="hover:text-mandy-400 transition text-mandy-500">
              Política de Cookies
            </Link>
            <a
              href={ELENXOS_BRAND.homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-mandy-400 transition"
            >
              Elenxos
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
