# Agora — Release Notes Beta (2026-05-12)

Hola, gracias por sumarte a la beta de **Agora**. Esta es la primera versión
pública para testers: una plataforma educativa donde podés escribir, razonar,
colaborar y experimentar con código, todo desde el navegador.

URL de la beta: **https://agora.elenxos.com**

---

## Qué hay nuevo

### Agente IA conectado a tu red de notas

- **Grafo de citaciones en la mesa semántica.** Tus documentos se conectan
  automáticamente entre sí cuando usás wiki-links (`[[concepto]]`), enlaces
  markdown, citas bibliográficas APA o referencias a conceptos del glosario.
  Podés abrir la mesa semántica y ver el grafo interactivo de relaciones
  entre tus notas, con foco ajustable y filtros por tipo de enlace.
- **El agente IA conoce tu red de notas.** El asistente puede consultar el
  grafo para encontrar documentos relacionados, expandir contexto y sugerir
  lecturas vinculadas, sin que tengas que copiar y pegar nada. Se sumaron
  tres nuevas herramientas para navegar el grafo: consulta directa, búsqueda
  de relacionados y expansión de contexto.
- **Conversaciones con el agente IA sincronizadas entre dispositivos.**
  Empezá un chat en la compu y seguilo desde el celular: los mensajes, los
  pasos del agente y los resultados de sus herramientas quedan guardados en
  tu cuenta. Podés renombrar chats, archivarlos y volver a chats viejos sin
  perder nada.
- **Claves de IA seguras y cifradas.** Configurá tus propias claves de
  OpenAI, Anthropic u otros proveedores desde *Ajustes → Claves IA por
  proveedor*. Las guardamos cifradas en el servidor con AES-256-GCM y
  nunca volvemos a mostrarlas en claro (sólo verás los últimos 4 caracteres
  tipo `***ab12`). Si rotás una clave, podés borrarla y volverla a cargar.
- **Cuotas honestas y visibles.** Para evitar abuso del agente IA aplicamos
  límites diarios y por hora: 500.000 tokens diarios y 100 mensajes por hora
  por usuario. Si chocás contra el límite, el agente te lo dice claramente
  en lugar de fallar en silencio.

### Editor más rápido y formatos abiertos

- **Editor más liviano.** KaTeX (fórmulas), Mermaid (diagramas) y los
  plugins avanzados del editor ahora se cargan bajo demanda. Si solo abrís
  un documento de texto simple, no pagás el costo de cargar todo el
  ecosistema. Las herramientas pesadas aparecen cuando realmente las
  necesitás.
- **Archivos en cualquier formato.** Al crear un archivo nuevo ya no estás
  limitado a `.md` y `.st`: elegí "Otro formato" y poné la extensión que
  quieras (`.py`, `.yaml`, `.editorconfig`, lo que necesites).
- **`.gitignore` listo desde el día cero.** Cada workspace nuevo arranca
  con un `.gitignore` razonable (excluye `node_modules`, `.next`, `dist`,
  etc.), así no te llenás el historial de basura.
- **Subida de archivos grandes.** Podés subir archivos de más de 50MB sin
  que se corte la conexión: la subida se hace en partes y se reanuda sola
  si la red parpadea.
- **Búsqueda mejorada.** La búsqueda global ahora consulta el contenido
  real de tus documentos (no solo títulos y metadata). Encontrás cosas
  enterradas en notas viejas mucho más fácil.

### Git interno y externo

- **Conectá Git externo (GitHub, GitLab, SSH).** Además del Git interno de
  Agora, ahora podés vincular un repositorio remoto en GitHub, GitLab o
  por SSH, y sincronizar tu workspace contra él. Las credenciales se
  cifran igual que las claves de IA y nunca viajan en texto plano.
- **Sync de workspace más confiable.** El daemon que sincroniza tu
  workspace ignora archivos temporales (`.scratch/`, `.agent-tmp/`,
  `tmp-*`, `*.tmp`) que antes creaban ruido. El terminal y el navegador
  ven el mismo estado sin extras.

### Cuenta y seguridad

- **Contraseñas más fuertes.** Al registrarte exigimos al menos 8
  caracteres con letras y números, y bloqueamos las 15 contraseñas más
  comunes. Si la elegida es muy débil, te lo decimos antes de guardar.
- **Errores de login en español.** Los 14 códigos de error de Firebase
  Auth ahora se traducen a mensajes humanos (antes te llegaba
  `auth/wrong-password` crudo).
- **Logout limpia caché.** Cuando cerrás sesión, purgamos toda la data
  local de tu cuenta (documentos cacheados, chats del agente, preferencias
  por workspace). Útil si compartís la computadora.
- **Headers de seguridad más estrictos.** Activamos HSTS, Content
  Security Policy, X-Frame-Options DENY, Referrer-Policy y
  Permissions-Policy. Si usás Agora desde una red pública, ahora es
  bastante más difícil para un atacante interceptar o inyectar.
- **Rotamos las claves del backend.** Service Account interno rotado y
  versiones viejas deshabilitadas en Secret Manager. Si alguna credencial
  filtra del pasado, ya no sirve.

### Performance e infraestructura

- **Health check más rápido.** El endpoint `/api/diag` ahora se cachea 30
  segundos en memoria + 60s en el edge. Pasamos de ~3s en cold start a
  respuesta instantánea casi siempre.
- **Hub TermiCoop migrado a su propia VM.** Las terminales y el agente IA
  ahora se conectan a `hub.humanizar-dev.cloud`, que vive en una máquina
  dedicada en GCP (free tier, ~$0/mes) con TLS público, usuario no-root y
  apt updates automáticos. Más seguro, más predecible y separado del host
  donde corren los workers.
- **PWA modernizada.** Migramos al fork mantenido de la librería que hace
  Agora instalable como app. El service worker auto-registra y arregla
  varios edge cases en App Router.
- **Notificaciones menos invasivas.** Los toasts ahora tienen un cap de 3
  visibles a la vez y duran 4 segundos. Si pasan muchos eventos al mismo
  tiempo, no te tapa la pantalla.

### Workers (terminales en la nube)

- **Soporte Fedora / RHEL / CentOS.** Si querés correr tu propio worker
  fuera de la infra de Agora, el script de instalación detecta tu distro
  e instala Podman (en Fedora/RHEL) o Docker (en Ubuntu/Debian/Arch)
  automáticamente.
- **35 workers vivos.** Hoy tenemos 35 terminales activas en producción
  (subió desde 27 en la versión anterior). Cada workspace que crea
  terminal arranca su propio contenedor en menos de 5 segundos.
- **El agente ya no se confunde con `cd`.** Cuando el agente ejecuta
  comandos en tu terminal, el directorio de trabajo siempre arranca en
  `/workspace`. Si quiere moverse a otra carpeta, usa la ruta completa.
  Esto elimina una clase entera de errores raros.

## Cómo empezar

1. Entrá a **https://agora.elenxos.com**.
2. Registrate con email y contraseña, o con tu cuenta de Google.
3. Se te crea un **workspace personal** automáticamente: ese es tu espacio
   privado. Lo que escribas ahí solo lo ves vos.
4. Para colaborar en un workspace compartido, pedile al dueño que te
   invite por email desde su panel.
5. Tus datos (documentos, claves IA, chats con el agente) se sincronizan
   automáticamente entre todos los dispositivos donde inicies sesión.

## Funcionalidad clave

- **Editor MDX rico** con soporte de LaTeX (fórmulas), Mermaid (diagramas),
  kanban embebido, snippets reutilizables y glosario semántico.
- **Editor de lógica formal `.st`** con 11 perfiles lógicos, formalizador
  automático de lenguaje natural, mesa semántica y linter académico.
- **Terminal de trabajo real** por workspace: cada espacio tiene su propio
  contenedor con `/workspace` montado, así podés correr scripts, ver
  salidas y trabajar con tus archivos como en una máquina local.
- **Sincronización bidireccional** entre web y workspace: si editás un
  archivo desde la terminal, aparece en la web; si lo editás en la web,
  aparece en la terminal.
- **Agente IA conectado al workspace**: te ayuda a buscar, leer, escribir,
  ejecutar comandos y razonar sobre tus notas usando el grafo de
  citaciones. Persiste el contexto entre sesiones y dispositivos.
- **Búsqueda semántica** sobre todos tus documentos (ya no está limitada a
  50 resultados: ahora respeta el límite que le pidas).

## Limitaciones conocidas

Estamos en beta, así que hay cosas honestas que conviene mencionar:

- **Consumo de memoria del editor**: abrir un documento básico usa entre
  7 y 9 MB de RAM. Estamos por debajo de lo que pesa una pestaña de
  YouTube, pero no es el ideal teórico (<5MB) que queremos alcanzar.
  No afecta funcionalmente.
- **Chats viejos del agente IA**: los chats que se guardaron en versiones
  anteriores se ven como texto plano (sin la animación de "pensando",
  herramientas o citas detalladas que ves en los nuevos). Estamos
  reconstruyendo la sección de `agentRun` para chats nuevos primero.
- **Vulnerabilidades menores en dependencias**: hay un puñado de avisos
  en paquetes de terceros (frontend y hub). Ninguno es crítico ni está
  expuesto al usuario final; los estamos siguiendo y actualizando. Las
  4 CVEs que sí lo eran se cerraron actualizando Next.js a 15.5.18.
- **Categoría "No estructurado" en búsqueda global**: a veces aparece
  como resultado un grupo "No estructurado" que no debería estar visible.
  Es cosmético, no rompe nada.
- **Algunos editores avanzados pueden tardar un poco la primera vez** que
  los abrís en una sesión (KaTeX y Mermaid se cargan bajo demanda para no
  ralentizar la carga inicial).
- **Custom claims trigger automático**: tenemos un Cloud Function listo
  para mantener custom claims de Firebase sincronizados como defense in
  depth, pero todavía no lo deployamos. El cableado desde backend ya
  cubre el caso real, así que no notarás nada.

## Cómo reportar bugs

Si encontrás algo raro:

1. Anotá qué estabas haciendo, qué esperabas, y qué pasó.
2. Si podés, sacá una captura de pantalla y abrí la consola del navegador
   (F12 → pestaña *Console*) para copiar errores en rojo.
3. Reportalo en el canal que te pasamos al invitarte a la beta (GitHub
   Issues o el canal de chat indicado por el equipo).

Gracias por ayudarnos a romper esto antes de que lo vea más gente. Sin
beta testers no hay producto que sobreviva al primer día.

— El equipo de Agora
