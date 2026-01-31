# Diagnostico general de rendimiento, duplicacion y planteamientos
Fecha: 2026-01-31

Alcance revisado: `src/`, `src/app/api/`, `services/hub/`, `services/worker/`.

Enfasis: pequenos cambios con alto impacto. Cada item indica impacto y accion recomendada.

## Prioridad 0 (critico)
- Sin hallazgos criticos inmediatos que bloqueen operacion; ver Prioridad 1 para riesgos de degradacion en sesiones largas.

## Prioridad 1 (alto impacto / quick wins)
- **Fuga de recursos en terminales**: las instancias XTerm quedan en memoria al cerrar o finalizar sesiones; `disposeSession` existe pero no se usa. Impacto: crecimiento de memoria/DOM y eventos en sesiones largas. Accion: llamar `controller.disposeSession(sessionId)` al recibir `session-ended` y al cerrar tabs de terminal. Archivos: `src/lib/TerminalController.ts`, `src/context/TerminalContext.tsx`, `src/app/dashboard/page.tsx`.
- **Carga duplicada de XTerm CSS/JS**: `TerminalController.initialize` inyecta CSS/JS desde CDN y `TerminalContext` vuelve a insertar CSS. Impacto: red/tiempo extra y riesgo de estados inconsistentes. Accion: centralizar carga en un solo lugar (ideal: usar dependencias locales `@xterm/*` o un unico loader). Archivos: `src/lib/TerminalController.ts`, `src/context/TerminalContext.tsx`.
- **Polling frecuente de documentos**: `fetchDocs` corre cada 15s aun con SSE por documento. Impacto: lecturas Firestore y rerenders innecesarios en listas grandes. Accion: aumentar intervalo, backoff cuando no hay cambios, o agregar soporte `updatedAfter`/ETag en `GET /api/documents`. Archivos: `src/app/dashboard/page.tsx`, `src/app/api/documents/route.ts`.
- **Sync del worker hace listado completo cada 10s**: `syncCycle` recorre todo el bucket y calcula md5; en buckets grandes escala mal. Accion: subir `POLL_INTERVAL_MS`, agregar backoff por inactividad y evitar md5 si `updated` no cambio. Archivos: `services/worker/sync_agent.js`.

## Prioridad 2 (medio)
- **Duplicacion de utilidades de docs/carpetas**: logica de `isMarkdown*`, `getDocBadge`, `docsByFolder`, arbol de carpetas y badges se repite en `FileExplorer` y `dashboard`. Impacto: divergencia y mantenimiento caro. Accion: extraer a utilidades compartidas (ej. `src/lib/doc-utils.ts`) y reutilizar. Archivos: `src/components/FileExplorer.tsx`, `src/app/dashboard/page.tsx`, `src/components/MosaicLayout.tsx`.
- **Duplicacion del calculo de workerToken**: se calcula en `Terminal` y en `AssistantSection` con reglas similares. Impacto: errores sutiles si se cambia formato. Accion: mover a helper unico (ej. `src/lib/workspace-token.ts`). Archivos: `src/components/Terminal.tsx`, `src/app/dashboard/page.tsx`.
- **Componente dashboard monolitico**: `page.tsx` concentra UI + datos + drag/drop + dialogs. Impacto: rerenders amplios y dificultad de perf tuning. Accion: separar en subcomponentes memoizables y aislar estados locales. Archivo: `src/app/dashboard/page.tsx`.
- **Imports dinamicos repetidos de react-mosaic**: se hace `import('react-mosaic-component')` en varias funciones. Impacto: micro-latencia y complejidad. Accion: cachear la promesa en un `useRef` o importar una vez. Archivo: `src/app/dashboard/page.tsx`.

## Prioridad 3 (bajo / deuda tecnica)
- **Auth hibrida y mock-token**: se guarda usuario en `localStorage` y el hub acepta `mock-token`. Impacto: flujo de autenticacion poco claro y debil. Accion: separar claramente modos dev/prod y eliminar mock en prod. Archivos: `src/context/AuthContext.tsx`, `services/hub/src/index.ts`.
- **Hash de password sin sal**: `sha256` simple para contrasenas (custom auth). Impacto: debilidad de seguridad. Accion: usar bcrypt/argon2 con sal y costo. Archivos: `src/lib/crypto.ts`, `src/app/api/auth/*.ts`.
- **Buffer completo en uploads**: `api/upload` carga archivo entero en memoria. Impacto: picos de RAM en archivos grandes. Accion: stream al bucket. Archivo: `src/app/api/upload/route.ts`.
