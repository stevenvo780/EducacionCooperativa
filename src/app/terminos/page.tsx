import Link from 'next/link';
import {
  BookOpen, AlertTriangle, ArrowLeft, Scale, CreditCard, FileText,
  Users, Shield, HardDrive, Cpu, Copyright, XCircle, Globe, RefreshCw,
  Mail
} from 'lucide-react';
import { ELENXOS_BRAND, PRODUCT_BRAND } from '@/lib/branding';

export const metadata = {
  title: `Términos y Condiciones | ${PRODUCT_BRAND.name}`,
  description: `Términos y condiciones del servicio de ${PRODUCT_BRAND.name} por ${ELENXOS_BRAND.name}.`
};

function Section({
  id,
  icon: Icon,
  title,
  accent = 'text-mandy-400',
  children
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border border-surface-700/40 rounded-xl bg-surface-800/30 backdrop-blur overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700/30 bg-surface-800/50">
        <div className="p-2 rounded-lg bg-mandy-500/10 border border-mandy-500/20">
          <Icon className={`w-5 h-5 ${accent}`} />
        </div>
        <h2 className="text-lg font-bold text-surface-100">{title}</h2>
      </div>
      <div className="px-5 py-5 space-y-4 text-surface-300 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-surface-100 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-mandy-500/60 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TerminosPage() {
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
        <div className="container mx-auto px-4 py-12 max-w-4xl">

          {/* Draft notice */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-8">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200 text-sm leading-relaxed">
              <strong>Borrador</strong> — revisar con asesoría legal antes de producción definitiva.
              Este documento tiene carácter informativo y no constituye asesoramiento jurídico.
            </p>
          </div>

          {/* Title block */}
          <div className="mb-10 space-y-3">
            <div className="flex items-center gap-3 text-mandy-400 text-xs font-medium uppercase tracking-widest">
              <span className="w-6 h-px bg-mandy-500/50" />
              Legal
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              Términos y Condiciones
            </h1>
            <p className="text-surface-400 text-sm">
              Última actualización: <strong className="text-surface-300">8 de junio de 2026</strong>
            </p>
            <p className="text-surface-400 leading-relaxed max-w-2xl">
              Estos Términos y Condiciones regulan el acceso y uso del servicio{' '}
              <strong className="text-white">Agora</strong>, plataforma educativa colaborativa
              operada por <strong className="text-white">Elenxos</strong>. Al registrarse o
              utilizar el servicio, usted acepta íntegramente estas condiciones.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-4">

            {/* 1. Objeto */}
            <Section id="objeto" icon={Scale} title="1. Objeto del servicio">
              <p>
                Agora es una plataforma SaaS (Software como Servicio) de{' '}
                <strong className="text-white">Elenxos</strong> que provee herramientas de
                investigación y colaboración académica accesibles vía navegador web en{' '}
                <a href="https://agora.elenxos.com" className="text-mandy-400 hover:underline" target="_blank" rel="noopener noreferrer">
                  agora.elenxos.com
                </a>. El servicio comprende:
              </p>
              <Ul items={[
                'Editor académico Markdown con soporte LaTeX, Mermaid y linter en tiempo real.',
                'Motor de lógica formal ST con 11 perfiles lógicos y derivaciones verificables.',
                'Workspaces colaborativos con gestión de documentos y archivos.',
                'Terminales Linux en la nube (workers Docker) disponibles en planes de pago.',
                'Asistente de inteligencia artificial Agora AI integrado al workspace.',
                'Herramientas de formalización semántica automática (NL Linter, Mesa Semántica, Text Layer).'
              ]} />
              <p>
                Elenxos se reserva el derecho de modificar, ampliar o reducir las
                funcionalidades del servicio con aviso previo a los usuarios activos.
              </p>
            </Section>

            {/* 2. Cuenta y elegibilidad */}
            <Section id="cuenta" icon={Users} title="2. Cuenta y elegibilidad">
              <Subsection title="2.1 Requisitos">
                <p>
                  Para crear una cuenta en Agora el usuario debe ser mayor de 13 años o
                  contar con autorización del representante legal si es menor. El servicio
                  está dirigido principalmente a estudiantes y docentes de Colombia y América
                  Latina; sin perjuicio de ello, es accesible desde cualquier jurisdicción
                  donde no exista restricción legal aplicable.
                </p>
              </Subsection>
              <Subsection title="2.2 Veracidad de la información">
                <p>
                  El usuario se compromete a proporcionar información verídica al registrarse
                  (nombre, correo electrónico) y a mantenerla actualizada. Elenxos no asume
                  responsabilidad por daños derivados de información falsa o inexacta suministrada
                  por el usuario.
                </p>
              </Subsection>
              <Subsection title="2.3 Seguridad de la cuenta">
                <p>
                  El usuario es responsable de la confidencialidad de sus credenciales de acceso.
                  Debe notificar de inmediato a{' '}
                  <a href={ELENXOS_BRAND.supportUrl} className="text-mandy-400 hover:underline">
                    admin@elenxos.com
                  </a>{' '}
                  ante cualquier uso no autorizado de su cuenta. Elenxos no responde por pérdidas
                  causadas por divulgación voluntaria o negligente de credenciales.
                </p>
              </Subsection>
              <Subsection title="2.4 Una cuenta por persona">
                <p>
                  Cada usuario puede mantener una sola cuenta activa. La creación de cuentas
                  múltiples para eludir límites del plan gratuito o sanciones constituye
                  incumplimiento de estos Términos.
                </p>
              </Subsection>
            </Section>

            {/* 3. Planes y pagos */}
            <Section id="pagos" icon={CreditCard} title="3. Planes y pagos">
              <Subsection title="3.1 Planes disponibles">
                <p>
                  Agora ofrece los siguientes planes en pesos colombianos (COP), sujetos a
                  cambios con aviso previo:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse mt-2">
                    <thead>
                      <tr className="border-b border-surface-700/50">
                        <th className="text-left py-2 pr-4 text-surface-300 font-semibold">Plan</th>
                        <th className="text-left py-2 pr-4 text-surface-300 font-semibold">Precio</th>
                        <th className="text-left py-2 text-surface-300 font-semibold">Almacenamiento</th>
                      </tr>
                    </thead>
                    <tbody className="text-surface-400">
                      <tr className="border-b border-surface-800"><td className="py-2 pr-4">Gratuito</td><td className="py-2 pr-4">$0 COP / mes</td><td className="py-2">50 MB</td></tr>
                      <tr className="border-b border-surface-800"><td className="py-2 pr-4">Básico</td><td className="py-2 pr-4">$30.000 COP / mes</td><td className="py-2">1 GB</td></tr>
                      <tr className="border-b border-surface-800"><td className="py-2 pr-4">Pro</td><td className="py-2 pr-4">$80.000 COP / mes</td><td className="py-2">1 GB</td></tr>
                      <tr><td className="py-2 pr-4">Enterprise</td><td className="py-2 pr-4">$240.000 COP / mes</td><td className="py-2">10 GB</td></tr>
                    </tbody>
                  </table>
                </div>
              </Subsection>
              <Subsection title="3.2 Procesamiento de pagos">
                <p>
                  Los cobros se procesan exclusivamente a través de{' '}
                  <strong className="text-white">MercadoPago</strong>. Agora/Elenxos no
                  almacena datos de tarjetas de crédito ni débito; dicha información es
                  gestionada íntegramente por MercadoPago conforme a sus propios términos y
                  políticas de privacidad. El usuario acepta los términos de MercadoPago al
                  efectuar cualquier pago.
                </p>
              </Subsection>
              <Subsection title="3.3 Renovación automática">
                <p>
                  Las suscripciones de pago se renuevan automáticamente al cierre de cada
                  período mensual mientras no se cancelen. El usuario recibirá un aviso por
                  correo electrónico al menos 3 días calendario antes de cada renovación.
                  La renovación se cargará al método de pago registrado en MercadoPago.
                </p>
              </Subsection>
              <Subsection title="3.4 Cancelación">
                <p>
                  El usuario puede cancelar su suscripción de pago en cualquier momento
                  desde la sección <em>Configuración → Suscripción</em> de su cuenta o
                  escribiendo a{' '}
                  <a href={ELENXOS_BRAND.salesUrl} className="text-mandy-400 hover:underline">
                    ventas@elenxos.com
                  </a>
                  . La cancelación surte efecto al final del período pagado; no se realizan
                  cobros adicionales tras la cancelación.
                </p>
              </Subsection>
              <Subsection title="3.5 Reembolsos">
                <p>
                  Elenxos evaluará solicitudes de reembolso caso por caso. Se considerarán
                  reembolsos parciales o totales únicamente cuando: (a) existan fallas
                  técnicas graves imputables a Elenxos que impidan el uso del servicio por
                  más de 72 horas continuas en un período de facturación, o (b) la
                  cancelación se solicite dentro de los 7 días calendario siguientes al
                  primer cobro de un plan nuevo. Las solicitudes deben enviarse a{' '}
                  <a href={ELENXOS_BRAND.supportUrl} className="text-mandy-400 hover:underline">
                    admin@elenxos.com
                  </a>{' '}
                  con el comprobante de pago. Elenxos no garantiza reembolsos fuera de estos
                  supuestos.
                </p>
              </Subsection>
              <Subsection title="3.6 Impuestos">
                <p>
                  Los precios publicados están expresados en COP e incluyen los impuestos
                  nacionales aplicables según la normativa tributaria colombiana vigente.
                  Para facturación con NIT/RUT dirigirse a{' '}
                  <a href={ELENXOS_BRAND.salesUrl} className="text-mandy-400 hover:underline">
                    ventas@elenxos.com
                  </a>
                  .
                </p>
              </Subsection>
            </Section>

            {/* 4. Uso aceptable */}
            <Section id="uso" icon={Shield} title="4. Uso aceptable">
              <p>El usuario se compromete a utilizar Agora exclusivamente para fines lícitos
              y en conformidad con estos Términos. Quedan <strong className="text-white">expresamente prohibidas</strong> las
              siguientes conductas:</p>
              <Ul items={[
                'Usar el servicio para actividades ilegales bajo la legislación colombiana o internacional.',
                'Cargar, transmitir o almacenar contenido que vulnere derechos de terceros, incluyendo propiedad intelectual, privacidad o datos personales.',
                'Intentar acceder sin autorización a sistemas, cuentas u otros workspaces ajenos.',
                'Ejecutar scripts o programas maliciosos (malware, ransomware, DDoS u otros) en los workers Docker o en la infraestructura de Elenxos.',
                'Hacer scraping o extracción automatizada masiva de contenido de la plataforma sin autorización escrita de Elenxos.',
                'Revender, sublicenciar o ceder el acceso al servicio a terceros.',
                'Usar el agente IA (Agora AI) para generar contenido que promueva odio, desinformación, acoso o actividades ilícitas.',
                'Sobrecargar deliberadamente la infraestructura o realizar pruebas de carga sin autorización previa de Elenxos.',
                'Crear cuentas falsas o suplantar identidades de terceros.'
              ]} />
              <p>
                El incumplimiento de estas prohibiciones puede acarrear la suspensión o
                terminación inmediata de la cuenta, sin perjuicio de las acciones legales
                que correspondan.
              </p>
            </Section>

            {/* 5. Contenido del usuario */}
            <Section id="contenido" icon={FileText} title="5. Contenido del usuario y propiedad">
              <Subsection title="5.1 Titularidad del contenido">
                <p>
                  El usuario conserva todos los derechos de propiedad intelectual sobre los
                  documentos, archivos, código y cualquier otro contenido que cree o cargue
                  en Agora (<em>&ldquo;Contenido del Usuario&rdquo;</em>). Elenxos no adquiere
                  propiedad sobre dicho contenido.
                </p>
              </Subsection>
              <Subsection title="5.2 Licencia de uso a Elenxos">
                <p>
                  Al subir Contenido del Usuario, el usuario otorga a Elenxos una licencia
                  mundial, no exclusiva, gratuita y revocable para alojar, almacenar, reproducir
                  y transmitir ese contenido exclusivamente en la medida necesaria para prestar
                  el servicio. Esta licencia no implica cesión de derechos ni autorización para
                  uso comercial del contenido fuera del propio servicio.
                </p>
              </Subsection>
              <Subsection title="5.3 Responsabilidad por el contenido">
                <p>
                  El usuario es el único responsable del Contenido del Usuario que genere,
                  almacene o comparta en Agora. Declara y garantiza que dicho contenido no
                  infringe derechos de propiedad intelectual de terceros ni contiene información
                  personal de terceros sin su consentimiento.
                </p>
              </Subsection>
              <Subsection title="5.4 Copias de seguridad">
                <p>
                  Si bien Elenxos realiza copias de seguridad periódicas de la infraestructura,
                  no garantiza la disponibilidad o integridad de los datos del usuario ante
                  pérdidas causadas por errores del usuario, mal uso del servicio o eventos
                  de fuerza mayor. Se recomienda mantener copias locales de la información
                  importante.
                </p>
              </Subsection>
            </Section>

            {/* 6. Disponibilidad y límites */}
            <Section id="disponibilidad" icon={HardDrive} title="6. Disponibilidad y límites del servicio">
              <Subsection title="6.1 Almacenamiento por plan">
                <p>
                  Cada plan incluye un cupo de almacenamiento en nube (MinIO) para archivos,
                  documentos e imágenes del workspace. Superado el límite, el sistema impedirá
                  nuevas cargas hasta que el usuario libere espacio o actualice su plan.
                </p>
              </Subsection>
              <Subsection title="6.2 Terminales y workers">
                <p>
                  Los planes Pro y Enterprise incluyen acceso a terminales Linux en la nube
                  (workers Docker). Los recursos de CPU, RAM y almacenamiento temporal de
                  cada worker están sujetos a los límites del plan contratado. Elenxos puede
                  ajustar dichos límites con aviso previo.
                </p>
              </Subsection>
              <Subsection title="6.3 Agora AI — límite de uso">
                <p>
                  El asistente IA tiene un presupuesto diario de tokens por usuario según
                  el plan activo. Al alcanzar el límite, el asistente estará inactivo hasta
                  la medianoche UTC del día siguiente. Elenxos puede ajustar estos límites
                  para garantizar la calidad del servicio al conjunto de usuarios.
                </p>
              </Subsection>
              <Subsection title="6.4 Disponibilidad del servicio">
                <p>
                  Elenxos procura mantener Agora disponible de forma continua, pero no garantiza
                  disponibilidad ininterrumpida (uptime 100%). Se realizarán mantenimientos
                  programados con aviso previo cuando sea posible. Los mantenimientos de
                  emergencia pueden ejecutarse sin aviso previo.
                </p>
              </Subsection>
            </Section>

            {/* 7. Propiedad intelectual de Agora/Elenxos */}
            <Section id="pi" icon={Copyright} title="7. Propiedad intelectual de Agora y Elenxos">
              <p>
                La plataforma Agora, incluyendo su código fuente, diseño visual, marca,
                logotipos, el lenguaje ST y sus herramientas asociadas (ST CLI, ST MCP,
                extensión VSCode), la documentación y todos los componentes desarrollados
                por Elenxos, son propiedad exclusiva de <strong className="text-white">Elenxos</strong>{' '}
                y/o sus colaboradores, y están protegidos por la legislación colombiana e
                internacional de derechos de autor y propiedad intelectual.
              </p>
              <p>
                El acceso al servicio no otorga al usuario ningún derecho de propiedad
                intelectual sobre la plataforma ni sus componentes. Queda prohibida la
                reproducción, distribución, modificación o creación de obras derivadas
                de los elementos de Elenxos sin autorización escrita previa.
              </p>
              <p>
                Los paquetes npm de código abierto publicados por Elenxos (
                <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded text-xs">
                  @stevenvo780/st-lang
                </code>,{' '}
                <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded text-xs">
                  @stevenvo780/st-mcp
                </code>,{' '}
                <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded text-xs">
                  @stevenvo780/st-cli
                </code>) se rigen por sus respectivas licencias de código abierto declaradas
                en cada repositorio.
              </p>
            </Section>

            {/* 8. Limitación de responsabilidad */}
            <Section id="responsabilidad" icon={Cpu} title="8. Limitación de responsabilidad">
              <p>
                En la máxima medida permitida por la legislación colombiana aplicable,
                Elenxos no será responsable por:
              </p>
              <Ul items={[
                'Pérdida de datos del usuario derivada de errores propios del usuario, mal uso de la plataforma o eventos fuera del control de Elenxos (fuerza mayor, fallas de proveedores terceros como Firebase, Google Cloud o MercadoPago).',
                'Daños indirectos, incidentales, especiales o consecuentes, incluyendo pérdida de beneficios o interrupción de actividades académicas o profesionales.',
                'Inexactitudes en los resultados generados por el asistente IA o el motor de lógica ST, los cuales son herramientas de apoyo académico y no sustituyen la verificación humana.',
                'Accesos no autorizados derivados de la divulgación de credenciales por parte del usuario.',
                'Disponibilidad o contenido de sitios web de terceros enlazados desde la plataforma.'
              ]} />
              <p>
                La responsabilidad máxima total de Elenxos frente a un usuario, por
                cualquier causa, no excederá el valor pagado por el usuario en los 3 meses
                inmediatamente anteriores al evento que origina la reclamación.
              </p>
            </Section>

            {/* 9. Terminación */}
            <Section id="terminacion" icon={XCircle} title="9. Terminación de la cuenta">
              <Subsection title="9.1 Por parte del usuario">
                <p>
                  El usuario puede eliminar su cuenta en cualquier momento desde{' '}
                  <em>Configuración → Cuenta → Eliminar cuenta</em>. La eliminación es
                  irreversible: todos los documentos, workspaces y datos asociados serán
                  borrados de forma permanente conforme a la política de privacidad.
                </p>
              </Subsection>
              <Subsection title="9.2 Por parte de Elenxos">
                <p>
                  Elenxos puede suspender o terminar el acceso de un usuario sin aviso
                  previo en caso de: (a) incumplimiento grave o reiterado de estos Términos,
                  (b) uso del servicio para actividades ilícitas, o (c) impago de más de
                  30 días. Para cierres no disciplinarios (p. ej. cierre del servicio),
                  Elenxos notificará con al menos 30 días de anticipación.
                </p>
              </Subsection>
              <Subsection title="9.3 Efectos de la terminación">
                <p>
                  Tras la terminación, el usuario pierde acceso al servicio y a su
                  contenido alojado. Elenxos conservará los datos el tiempo mínimo exigido
                  por ley antes de proceder a su eliminación definitiva.
                </p>
              </Subsection>
            </Section>

            {/* 10. Ley aplicable */}
            <Section id="ley" icon={Globe} title="10. Ley aplicable y resolución de controversias">
              <p>
                Estos Términos y Condiciones se rigen e interpretan de conformidad con las
                leyes de la <strong className="text-white">República de Colombia</strong>,
                incluyendo pero no limitado a la Ley 527 de 1999 (comercio electrónico),
                la Ley 1480 de 2011 (Estatuto del Consumidor) y la Ley 1581 de 2012
                (protección de datos personales).
              </p>
              <p>
                Ante cualquier controversia derivada de estos Términos, las partes procurarán
                resolverla de buena fe mediante comunicación directa. Si no se llegara a un
                acuerdo en un plazo de 30 días calendario, las controversias se someterán
                a los jueces y tribunales competentes de la ciudad de{' '}
                <strong className="text-white">Bogotá D.C., Colombia</strong>, salvo que la
                ley colombiana disponga fuero exclusivo diferente.
              </p>
              <p>
                Para reclamaciones de consumo se podrán utilizar los mecanismos dispuestos
                por la Superintendencia de Industria y Comercio (SIC) conforme al
                Estatuto del Consumidor.
              </p>
            </Section>

            {/* 11. Modificaciones */}
            <Section id="modificaciones" icon={RefreshCw} title="11. Modificaciones a los Términos">
              <p>
                Elenxos puede actualizar estos Términos y Condiciones en cualquier momento.
                Los cambios materiales serán notificados al correo registrado del usuario
                con al menos <strong className="text-white">15 días calendario</strong> de
                anticipación. El uso continuado del servicio tras la entrada en vigencia de
                los nuevos Términos implica su aceptación.
              </p>
              <p>
                La versión vigente siempre estará disponible en{' '}
                <Link href="/terminos" className="text-mandy-400 hover:underline">
                  agora.elenxos.com/terminos
                </Link>
                , con la fecha de última actualización indicada al inicio del documento.
              </p>
            </Section>

            {/* 12. Contacto */}
            <Section id="contacto" icon={Mail} title="12. Contacto">
              <p>
                Para consultas, solicitudes o reclamos relacionados con estos Términos,
                comuníquese con Elenxos a través de los siguientes canales:
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                <a
                  href={ELENXOS_BRAND.supportUrl}
                  className="flex items-center gap-3 bg-surface-800/60 border border-surface-700/50 rounded-lg px-4 py-3 hover:border-mandy-500/30 transition group"
                >
                  <Mail className="w-4 h-4 text-mandy-400 shrink-0" />
                  <div>
                    <p className="text-xs text-surface-500 font-medium uppercase tracking-wide">Soporte general</p>
                    <p className="text-sm text-surface-200 group-hover:text-mandy-300 transition">admin@elenxos.com</p>
                  </div>
                </a>
                <a
                  href={ELENXOS_BRAND.salesUrl}
                  className="flex items-center gap-3 bg-surface-800/60 border border-surface-700/50 rounded-lg px-4 py-3 hover:border-mandy-500/30 transition group"
                >
                  <Mail className="w-4 h-4 text-mandy-400 shrink-0" />
                  <div>
                    <p className="text-xs text-surface-500 font-medium uppercase tracking-wide">Facturación / ventas</p>
                    <p className="text-sm text-surface-200 group-hover:text-mandy-300 transition">ventas@elenxos.com</p>
                  </div>
                </a>
              </div>
              <p className="text-surface-500 text-xs mt-3">
                Elenxos · Bogotá D.C., Colombia ·{' '}
                <a href={ELENXOS_BRAND.homeUrl} className="text-mandy-400 hover:underline" target="_blank" rel="noopener noreferrer">
                  www.elenxos.com
                </a>
              </p>
            </Section>

            {/* Also see privacy */}
            <div className="flex items-center gap-3 bg-surface-800/40 border border-surface-700/40 rounded-xl px-5 py-4 mt-2">
              <Shield className="w-5 h-5 text-mandy-400 shrink-0" />
              <p className="text-sm text-surface-300">
                Para conocer cómo Agora trata sus datos personales, consulte la{' '}
                <Link href="/privacidad" className="text-mandy-400 hover:underline font-medium">
                  Política de Privacidad y Tratamiento de Datos
                </Link>
                , elaborada conforme a la Ley 1581 de 2012 (Habeas Data).
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-950 text-surface-500 py-8 border-t border-surface-600/30 mt-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-mandy-500" />
            <span>&copy; {new Date().getFullYear()} {PRODUCT_BRAND.name} · Producto de {ELENXOS_BRAND.name}</span>
          </div>
          <nav className="flex items-center gap-4 text-xs">
            <Link href="/" className="hover:text-mandy-400 transition">Inicio</Link>
            <Link href="/terminos" className="text-mandy-400">Términos</Link>
            <Link href="/privacidad" className="hover:text-mandy-400 transition">Privacidad</Link>
            <a href={ELENXOS_BRAND.homeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">Elenxos</a>
          </nav>
        </div>
      </footer>

    </div>
  );
}
