import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Shield } from 'lucide-react';
import { ELENXOS_BRAND, PRODUCT_BRAND } from '@/lib/branding';

export const metadata: Metadata = {
  title: `Política de Privacidad | ${PRODUCT_BRAND.name}`,
  description:
    'Política de privacidad y tratamiento de datos personales de Agora (Elenxos), conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.',
  alternates: { canonical: '/privacidad' }
};

export default function PrivacidadPage() {
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
            className="text-sm text-surface-400 hover:text-mandy-400 transition"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Page heading */}
          <div className="mb-10 space-y-4">
            <div className="flex items-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest">
              <span className="w-8 h-px bg-mandy-500/50" />
              Legal
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-mandy-500/10 border border-mandy-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-mandy-400" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                  Política de Privacidad y Tratamiento de Datos Personales
                </h1>
                <p className="mt-2 text-surface-400 text-sm">
                  Conforme a la Ley 1581 de 2012 (Habeas Data) y el Decreto 1377 de 2013 — Colombia
                </p>
              </div>
            </div>

            {/* Draft notice */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
              <p className="text-amber-300 text-sm font-semibold">
                Borrador — revisar con asesoría legal antes de producción definitiva.
              </p>
              <p className="text-surface-400 text-xs mt-1">
                Última actualización: 8 de junio de 2026
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="prose-legal space-y-10">

            {/* 1. Responsable */}
            <Section id="responsable" title="1. Responsable del tratamiento">
              <p>
                El responsable del tratamiento de los datos personales recolectados a través de la
                plataforma <strong>Agora</strong> (en adelante &ldquo;la Plataforma&rdquo;) es:
              </p>
              <InfoTable rows={[
                ['Empresa / Marca', 'Elenxos'],
                ['Sitio web principal', 'https://www.elenxos.com/'],
                ['Plataforma', 'https://agora.elenxos.com'],
                ['Correo de contacto legal', '[correo legal de Elenxos]'],
                ['Correo de soporte', 'admin@elenxos.com'],
                ['País de operación principal', 'Colombia'],
              ]} />
              <p>
                Para efectos de la Ley 1581 de 2012, Elenxos actúa como responsable del tratamiento y
                determina las finalidades, medios y alcances del tratamiento de los datos personales de
                los titulares que usan Agora.
              </p>
            </Section>

            {/* 2. Datos recolectados */}
            <Section id="datos" title="2. Datos personales que recolectamos">
              <p>
                Dependiendo del plan y las funcionalidades que utilices, Agora puede recolectar las
                siguientes categorías de datos:
              </p>

              <SubSection title="2.1 Datos de cuenta y autenticación">
                <ul>
                  <li>Nombre y correo electrónico (proporcionados al registrarse o al iniciar sesión con Google).</li>
                  <li>Credenciales de autenticación gestionadas por <strong>Firebase Authentication</strong> (Google LLC). Agora no almacena contraseñas en texto plano.</li>
                  <li>Foto de perfil, si el usuario inicia sesión con una cuenta de Google que la tenga configurada.</li>
                </ul>
              </SubSection>

              <SubSection title="2.2 Contenido del usuario">
                <ul>
                  <li>Documentos, archivos, notas y código creados o subidos dentro de workspaces personales o compartidos.</li>
                  <li>Scripts de lógica formal en formato <code>.st</code> y notebooks (<code>.stnb</code>).</li>
                  <li>Archivos adjuntos (PDFs, imágenes, hojas de cálculo) hasta los límites del plan contratado.</li>
                  <li>Historial de chats con el agente IA (<strong>Agora AI</strong>), almacenado en Firestore bajo el identificador del usuario.</li>
                </ul>
              </SubSection>

              <SubSection title="2.3 Claves de API del usuario (Agora AI)">
                <ul>
                  <li>
                    Si el usuario configura claves de API de proveedores de inteligencia artificial
                    (OpenAI, Anthropic, Google, etc.) en su perfil, dichas claves se cifran en el servidor
                    con <strong>AES-256-GCM / HKDF</strong> antes de almacenarse. Agora no almacena ni
                    transmite estas claves en texto plano. Su uso está limitado exclusivamente a ejecutar
                    las solicitudes del mismo usuario.
                  </li>
                </ul>
              </SubSection>

              <SubSection title="2.4 Datos de uso y analítica">
                <ul>
                  <li>Métricas de uso del agente IA: número de tokens consumidos por día, límites de presupuesto.</li>
                  <li>Registros del sistema (logs) con información técnica como dirección IP, tipo de navegador, timestamps y rutas de solicitudes, con fines de seguridad y diagnóstico.</li>
                  <li>Analítica básica del sitio web para entender patrones de navegación agregados.</li>
                </ul>
              </SubSection>

              <SubSection title="2.5 Datos de pago">
                <ul>
                  <li>
                    Los pagos de suscripción se procesan a través de <strong>MercadoPago</strong> (Mercado Libre
                    de Colombia S.A.S.). Agora <strong>no almacena datos de tarjetas de crédito/débito</strong>.
                    Solo se conserva información de referencia de la transacción (ID de pago, plan contratado,
                    fecha, estado) para administrar las suscripciones.
                  </li>
                </ul>
              </SubSection>
            </Section>

            {/* 3. Finalidades */}
            <Section id="finalidades" title="3. Finalidades del tratamiento">
              <p>Los datos personales recolectados se usan para las siguientes finalidades:</p>
              <ol>
                <li><strong>Prestación del servicio:</strong> crear y gestionar cuentas, workspaces, documentos y terminales.</li>
                <li><strong>Autenticación y seguridad:</strong> verificar la identidad del usuario, prevenir acceso no autorizado y detectar abusos.</li>
                <li><strong>Facturación y suscripciones:</strong> gestionar pagos recurrentes, aplicar cambios de plan y emitir comprobantes.</li>
                <li><strong>Agente IA personalizado:</strong> usar las claves de API del usuario para ejecutar solicitudes al proveedor de IA elegido y entregar respuestas dentro de la Plataforma.</li>
                <li><strong>Soporte técnico:</strong> atender solicitudes, diagnosticar problemas y mejorar la estabilidad del servicio.</li>
                <li><strong>Mejora del producto:</strong> analizar patrones de uso agregados y anónimos para priorizar nuevas funcionalidades.</li>
                <li><strong>Cumplimiento legal:</strong> atender requerimientos de autoridades colombianas o de otras jurisdicciones con competencia aplicable.</li>
                <li><strong>Comunicaciones del servicio:</strong> notificar cambios importantes en los planes, la política de privacidad o las condiciones de uso.</li>
              </ol>
              <p>
                Agora <strong>no vende, alquila ni cede</strong> datos personales a terceros con fines
                comerciales o publicitarios.
              </p>
            </Section>

            {/* 4. Base legal */}
            <Section id="base-legal" title="4. Base legal y autorización">
              <p>
                El tratamiento de datos personales se fundamenta en las siguientes bases legales, conforme
                a la Ley 1581 de 2012 y el Decreto 1377 de 2013:
              </p>
              <ul>
                <li>
                  <strong>Autorización del titular:</strong> al crear una cuenta en Agora, el usuario
                  otorga su autorización libre, previa e informada para el tratamiento de sus datos con
                  las finalidades descritas en esta política.
                </li>
                <li>
                  <strong>Ejecución de contrato:</strong> el tratamiento es necesario para cumplir el
                  servicio de suscripción contratado.
                </li>
                <li>
                  <strong>Interés legítimo:</strong> el tratamiento de datos de uso y logs de seguridad
                  se realiza para mantener la integridad y estabilidad de la Plataforma.
                </li>
                <li>
                  <strong>Cumplimiento de obligaciones legales:</strong> cuando así lo exija la normativa
                  colombiana aplicable.
                </li>
              </ul>
            </Section>

            {/* 5. Encargados y terceros */}
            <Section id="terceros" title="5. Encargados del tratamiento y terceros">
              <p>
                Agora comparte datos con los siguientes encargados del tratamiento y proveedores de
                servicios, quienes actúan bajo instrucciones de Elenxos y están sujetos a obligaciones
                de confidencialidad:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-surface-700/60">
                      <th className="text-left py-3 pr-4 text-surface-300 font-semibold">Proveedor</th>
                      <th className="text-left py-3 pr-4 text-surface-300 font-semibold">Rol</th>
                      <th className="text-left py-3 text-surface-300 font-semibold">Datos compartidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/30">
                    {[
                      ['Firebase / Google Cloud (Google LLC)', 'Infraestructura: autenticación (Firebase Auth), base de datos (Firestore), base de datos en tiempo real (RTDB)', 'Email, UID de usuario, contenido de documentos, eventos de sincronización'],
                      ['MercadoPago (Mercado Libre de Colombia S.A.S.)', 'Procesador de pagos', 'Nombre, email, información de la transacción'],
                      ['Proveedores de IA configurados por el usuario (OpenAI, Anthropic, Google, etc.)', 'Procesamiento de solicitudes del agente IA, con la clave del propio usuario', 'Texto de las solicitudes del usuario (prompts) y contexto del workspace enviado por el usuario'],
                      ['Hostinger (UAB Interneto Vizija)', 'Infraestructura de almacenamiento (MinIO S3), control de versiones (Forgejo), entornos de trabajo Docker (workers)', 'Archivos y documentos del workspace cifrados en tránsito'],
                      ['Vercel Inc.', 'Hosting y CDN del frontend de la Plataforma', 'Logs de acceso HTTP, datos de telemetría de rendimiento'],
                      ['Google Cloud Run / GCP (Google LLC)', 'Ejecución del backend de la Plataforma', 'Logs de las solicitudes de la API'],
                    ].map(([prov, rol, datos], i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4 text-white align-top font-medium">{prov}</td>
                        <td className="py-3 pr-4 text-surface-300 align-top">{rol}</td>
                        <td className="py-3 text-surface-400 align-top">{datos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 6. Transferencias internacionales */}
            <Section id="transferencias" title="6. Transferencias internacionales de datos">
              <p>
                Dado que Agora utiliza infraestructura de proveedores globales (Google LLC —
                Estados Unidos; Vercel Inc. — Estados Unidos; Hostinger — Lituania), los datos
                personales pueden ser transferidos y procesados fuera de Colombia. Estas
                transferencias se realizan bajo los siguientes marcos:
              </p>
              <ul>
                <li>Las Cláusulas Contractuales Estándar adoptadas por la Comisión Europea y referenciadas por la Superintendencia de Industria y Comercio de Colombia.</li>
                <li>Las políticas de privacidad y certificaciones de los proveedores (por ejemplo, el Marco de Privacidad de Datos UE-EE. UU. para Google).</li>
                <li>La autorización otorgada por el titular al aceptar esta política.</li>
              </ul>
              <p>
                Los proveedores de IA (OpenAI, Anthropic, Google, etc.) son configurados directamente
                por el usuario mediante su propia clave de API. El tratamiento de datos por parte de
                estos proveedores se rige por sus propias políticas de privacidad, que el usuario debe
                revisar antes de activar esta funcionalidad.
              </p>
            </Section>

            {/* 7. Conservación */}
            <Section id="conservacion" title="7. Plazos de conservación">
              <ul>
                <li><strong>Datos de cuenta:</strong> mientras la cuenta esté activa. Tras la solicitud de eliminación, se suprimirán en un plazo máximo de 30 días hábiles, salvo obligación legal de conservación.</li>
                <li><strong>Contenido del usuario (documentos, archivos):</strong> mientras la cuenta esté activa o hasta que el usuario los elimine. Tras la eliminación de cuenta, se eliminan en un plazo máximo de 30 días hábiles.</li>
                <li><strong>Historial de chats con el agente IA:</strong> mientras la cuenta esté activa; el usuario puede eliminar chats individuales desde la interfaz.</li>
                <li><strong>Registros de transacciones de pago:</strong> mínimo 5 años, en cumplimiento de la normativa tributaria y contable colombiana.</li>
                <li><strong>Logs de seguridad y sistema:</strong> hasta 12 meses, salvo requerimiento legal expreso.</li>
              </ul>
            </Section>

            {/* 8. Seguridad */}
            <Section id="seguridad" title="8. Medidas de seguridad">
              <p>
                Elenxos implementa medidas técnicas y organizacionales para proteger los datos
                personales de los usuarios, entre ellas:
              </p>
              <ul>
                <li>Transmisión de datos cifrada mediante <strong>TLS 1.2/1.3</strong> (HTTPS).</li>
                <li>Almacenamiento de claves de API del usuario cifradas con <strong>AES-256-GCM / HKDF</strong> en el servidor; nunca en texto plano.</li>
                <li>Autenticación segura delegada en <strong>Firebase Authentication</strong> (soporta 2FA vía Google).</li>
                <li>Control de acceso basado en roles para documentos y workspaces compartidos.</li>
                <li>Restricción de acceso a la infraestructura de producción mediante VPN (NetBird) y claves SSH.</li>
                <li>Rotación periódica de secretos y cuentas de servicio.</li>
                <li>Monitoreo de seguridad y logs de auditoría para detectar accesos no autorizados.</li>
              </ul>
              <p>
                No obstante, ningún sistema en línea es completamente invulnerable. En caso de
                incidente de seguridad que afecte datos personales, Elenxos notificará a los
                titulares afectados conforme lo exige la normativa colombiana vigente.
              </p>
            </Section>

            {/* 9. Derechos ARCO+ */}
            <Section id="derechos" title="9. Derechos del titular (ARCO+)">
              <p>
                Conforme al artículo 8 de la Ley 1581 de 2012, el titular de los datos personales
                tiene los siguientes derechos:
              </p>
              <ul>
                <li><strong>Conocer:</strong> acceder de forma gratuita a los datos personales que han sido objeto de tratamiento.</li>
                <li><strong>Actualizar:</strong> solicitar la actualización de los datos que estén desactualizados o incompletos.</li>
                <li><strong>Rectificar:</strong> solicitar la corrección de datos inexactos o erróneos.</li>
                <li><strong>Suprimir:</strong> solicitar la eliminación de los datos cuando su tratamiento no se ajuste a los principios, derechos y garantías de la Ley 1581 de 2012, o cuando se haya revocado la autorización.</li>
                <li><strong>Revocar la autorización:</strong> dejar sin efecto el consentimiento otorgado para el tratamiento, en cualquier momento, salvo que exista una obligación legal o contractual que lo impida.</li>
                <li><strong>Presentar quejas:</strong> ante la Superintendencia de Industria y Comercio (SIC) de Colombia, cuando considere que se han vulnerado sus derechos.</li>
              </ul>

              <SubSection title="9.1 Cómo ejercer sus derechos">
                <p>Para ejercer cualquiera de los derechos anteriores, el titular puede:</p>
                <ul>
                  <li>Enviar una solicitud al correo <strong>admin@elenxos.com</strong> con el asunto <em>&ldquo;Solicitud ARCO — Datos Personales&rdquo;</em>.</li>
                  <li>Incluir: nombre completo, correo electrónico asociado a la cuenta, descripción clara de la solicitud y, si lo considera pertinente, documentación de soporte.</li>
                </ul>
                <p>
                  Elenxos dará respuesta dentro de los <strong>15 días hábiles</strong> siguientes a la
                  recepción de la solicitud. Si no fuera posible atenderla en ese plazo, se informará
                  al titular indicando los motivos de la demora y la fecha estimada de respuesta, que
                  no podrá superar los <strong>8 días hábiles adicionales</strong>, conforme al artículo
                  14 de la Ley 1581 de 2012.
                </p>
              </SubSection>
            </Section>

            {/* 10. Cookies */}
            <Section id="cookies" title="10. Cookies y tecnologías similares">
              <p>
                Agora utiliza cookies y tecnologías similares (localStorage, Service Worker) para el
                funcionamiento de la aplicación web progresiva (PWA), la gestión de sesión y la
                sincronización de datos. Para mayor detalle sobre los tipos de cookies utilizadas y
                cómo gestionarlas, consulta nuestra{' '}
                <Link href="/cookies" className="text-mandy-400 hover:text-mandy-300 transition underline">
                  Política de Cookies
                </Link>
                .
              </p>
            </Section>

            {/* 11. Menores de edad */}
            <Section id="menores" title="11. Menores de edad">
              <p>
                Agora está dirigida principalmente a estudiantes universitarios, docentes e
                investigadores. El servicio <strong>no está dirigido a menores de 13 años</strong>.
                Si bien personas entre 13 y 18 años pueden usar la Plataforma con fines educativos,
                se recomienda que lo hagan con conocimiento y supervisión de sus padres o tutores.
              </p>
              <p>
                Si Elenxos toma conocimiento de que ha recolectado datos de un menor de 13 años sin
                el consentimiento verificable de sus padres o tutores, procederá a eliminar dicha
                información de forma inmediata.
              </p>
            </Section>

            {/* 12. Cambios */}
            <Section id="cambios" title="12. Cambios a esta política">
              <p>
                Elenxos se reserva el derecho de actualizar esta Política de Privacidad en cualquier
                momento. Cuando se realicen cambios materiales, se notificará a los usuarios mediante:
              </p>
              <ul>
                <li>Un aviso visible en la Plataforma al iniciar sesión.</li>
                <li>Un correo electrónico a la dirección registrada en la cuenta, cuando el cambio afecte de forma significativa los derechos del titular.</li>
              </ul>
              <p>
                El uso continuado de la Plataforma tras la publicación de los cambios constituye la
                aceptación de la política actualizada. Si el usuario no acepta los cambios, puede
                solicitar la eliminación de su cuenta.
              </p>
              <p>
                La versión vigente siempre estará disponible en{' '}
                <Link href="/privacidad" className="text-mandy-400 hover:text-mandy-300 transition underline">
                  agora.elenxos.com/privacidad
                </Link>
                .
              </p>
            </Section>

            {/* 13. Contacto */}
            <Section id="contacto" title="13. Contacto y canal de atención">
              <p>Para cualquier duda, solicitud o queja relacionada con el tratamiento de datos personales:</p>
              <InfoTable rows={[
                ['Correo electrónico', 'admin@elenxos.com'],
                ['Correo legal (responsable del tratamiento)', '[correo legal de Elenxos]'],
                ['Sitio web', 'https://www.elenxos.com/'],
                ['Autoridad de control en Colombia', 'Superintendencia de Industria y Comercio (SIC) — www.sic.gov.co'],
              ]} />
            </Section>

          </div>

          {/* Back to top / nav */}
          <div className="mt-16 pt-8 border-t border-surface-700/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-surface-500 text-xs">
              Agora es un producto de{' '}
              <a
                href={ELENXOS_BRAND.homeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mandy-400 hover:text-mandy-300 transition"
              >
                Elenxos
              </a>
              . Última actualización: 8 de junio de 2026.
            </p>
            <Link
              href="/"
              className="text-sm text-surface-400 hover:text-mandy-400 transition"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-950 text-surface-500 py-8 border-t border-surface-600/30">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-mandy-500" />
            <span className="text-white font-semibold">{PRODUCT_BRAND.name}</span>
            <span className="text-surface-600">·</span>
            <span>Producto de {ELENXOS_BRAND.name}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-surface-500">
            <Link href="/" className="hover:text-mandy-400 transition">Inicio</Link>
            <Link href="/privacidad" className="text-mandy-400">Privacidad</Link>
            <Link href="/cookies" className="hover:text-mandy-400 transition">Cookies</Link>
            <a
              href={ELENXOS_BRAND.supportUrl}
              className="hover:text-mandy-400 transition"
            >
              Soporte
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 bg-surface-800/30 border border-surface-700/40 rounded-2xl p-6 md:p-8 space-y-4"
    >
      <h2 className="text-xl font-bold text-white border-b border-surface-700/40 pb-3">
        {title}
      </h2>
      <div className="space-y-3 text-surface-300 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_li]:leading-relaxed [&_strong]:text-white [&_code]:text-mandy-300 [&_code]:bg-mandy-500/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_em]:text-surface-200">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-surface-200">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-surface-700/40 overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-surface-700/30">
          {rows.map(([label, value], i) => (
            <tr key={i} className="group">
              <td className="py-2.5 px-4 text-surface-400 font-medium w-2/5 bg-surface-800/40 group-last:rounded-bl-xl">
                {label}
              </td>
              <td className="py-2.5 px-4 text-surface-200 bg-surface-900/30 group-last:rounded-br-xl">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
