# Diagnostico de animaciones y rendimiento percibido
Fecha: 2026-02-01

Observacion base: las animaciones se perciben lentas, pero el rendimiento general del sistema es rapido.

Alcance revisado: `src/app/dashboard/page.tsx`, `src/components/FileExplorer.tsx`, `src/components/MosaicLayout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/Terminal.tsx`.

Enfasis: reducir jank y mejorar la sensacion de respuesta sin cambios masivos.

## Prioridad 0 (critico)
- Sin hallazgos criticos que bloqueen la interfaz. El problema es de fluidez percibida, no de bloqueo total.

## Prioridad 1 (alto impacto / quick wins)
- **Monolito del dashboard y renders amplios**: `src/app/dashboard/page.tsx` concentra estados y renders grandes; cualquier cambio (polling, quick search, estado de sesiones) re-renderiza arboles completos y puede degradar FPS en animaciones. Accion: separar en subcomponentes memoizables (Sidebar, Modals, Header, MosaicArea) y envolver con `React.memo` + props estables; mover estados locales a cada subcomponente.
- **Listas grandes sin virtualizacion**: `FileExplorer` renderiza arbol y listas completas (`renderFolderTree`, `filteredFolderDocs`), lo que amplifica el costo de cada re-render durante animaciones. Accion: virtualizar listas (ej. `react-window`) o paginar; memoizar items y evitar re-render cuando no cambian.
- **Filtros en teclado bloqueando el hilo**: el quick search filtra `docs` en cada keypress dentro del dashboard. Si el set es grande, compite con animaciones. Accion: usar `useDeferredValue`/`startTransition` y limitar resultados con un indice precomputado.
- **Efectos visuales costosos en overlays**: modales usan `backdrop-blur-sm` y sombras grandes (`shadow-2xl`) sobre pantalla completa. Estos efectos son caros en GPU y hacen que la animacion parezca lenta. Accion: reducir blur/sombra o degradar segun `prefers-reduced-motion`/`prefers-reduced-transparency`.
- **Framer Motion para transiciones simples**: los modales usan `AnimatePresence` y `motion.div` para fades/scale simples. Accion: considerar CSS (opacity/transform) para estos casos o usar `LazyMotion` para reducir overhead de framer-motion.

## Prioridad 2 (medio)
- **Duraciones perceptiblemente largas**: hay duraciones explicitas de 0.5s (landing) y 300ms (sidebar). Si la percepcion es de lentitud, ajustar a 150-200ms en interacciones directas. Archivos: `src/app/page.tsx`, `src/app/dashboard/page.tsx`.
- **`transition-all` en elementos grandes**: se usa en botones/barras (`Terminal`, progreso de upload/delete). Accion: restringir a `transition-opacity`/`transition-transform` para evitar reflow cuando cambian ancho/alto.
- **Rerenders por polling**: `fetchDocs` corre cada 30s. Si coincide con animaciones puede sentirse jank. Accion: mover actualizaciones a `startTransition`, o bloquear repaint cuando el documento no cambia (ya hay comparaciones, pero aplicar diff parcial reduce trabajo).

## Prioridad 3 (bajo / validacion)
- **Medicion dirigida**: capturar un perfil con Performance/React Profiler mientras se reproduce la lentitud. Priorizar long tasks (>50ms), layout/paint y commits grandes durante animaciones.
- **Politica de reduccion de animaciones**: respetar `prefers-reduced-motion` para disminuir carga en equipos lentos.

## Resultado esperado
- Animaciones mas "rapidas" (menos jank y menor duracion percibida) sin afectar la responsividad general ni la arquitectura base.
