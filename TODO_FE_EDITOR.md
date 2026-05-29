# TODO — Editor blank-render con docs grandes (>200KB)

Reportado en QA Wave 2 (2026-05-29). Síntoma: `MosaicEditor` muestra
word-count y "Guardado" con contenido correcto, pero el `contenteditable`
de Lexical queda en placeholder ("Escribe aquí... Usa Markdown como en
Obsidian"). Reproducible con doc Descartes (345KB) y
`reglas_tablas_de_verdad.md`.

## Causa raíz parcialmente identificada

El flujo de hidratación tiene tres bumps de `editorKey` que pueden
desalinearse con docs grandes:

1. `setEditorContent(text)` desde `maybeLoadRawContent` (raw fetch
   completa) — line 567-575.
2. Lazy-plugin remount cuando `useDeferredMount(700)` expira — line
   1786-1799 (`pluginsArmedRef`).
3. `setMarkdown` directo vía `mdxEditorRef.current` cuando `applyDocData`
   recibe contenido inline y el editor ya está montado — line 713-728.

El fix histórico `0b7e09e` resolvió el caso 3 sincronizando
`setInitialMarkdown(incoming)` junto al `setMarkdown` para que el bump
del lazy-plugin no remontara el editor con un `initialMarkdown` vacío.

## Hipótesis para el síntoma actual

Tres candidatos no descartados, ordenados por probabilidad:

**A. Excepción silenciosa en `setMarkdown(huge)`** — al parsear 345KB de
markdown con KaTeX/Mermaid/tables, el parser de Lexical/MDXEditor puede
arrojar un error parcial que el wrapper traga sin propagar al UI.
Resultado: `statsContent` se setea (línea 718) pero el state interno de
Lexical no termina de actualizarse y el contenteditable queda en
placeholder.

Aplicado como mitigación en este commit (línea 712-731): `try/catch`
sobre `setMarkdown` con fallback a `setInitialMarkdown` + `setEditorKey++`
para remontar el editor con el contenido como prop inicial. **NO valida
la causa raíz** — sólo evita el síntoma si la excepción es la causa.

**B. Race entre dynamic-import de MDXEditor y la actualización del
prop `markdown`** — `DynamicMDXEditor` usa `dynamic({ ssr:false })`. El
módulo se importa una vez (cacheado por Next), pero el componente se
construye fresco en cada mount. Para docs grandes, la fase de
construcción del modelo Lexical es síncrona y bloqueante en main thread
(>200ms en doc Descartes). Si durante esa ventana `editorKey` recibe
otro bump (raw fetch tardío o re-render por sync events), el árbol
Lexical queda parcialmente inicializado.

**C. `pluginsArmedRef.current` queda true entre cambios de doc** —
nunca se resetea al cambiar `roomId`. Para el primer doc se bumpea
una vez; en docs siguientes, si el set de plugins pesados cambia
(p.ej. doc A usa tables, doc B usa katex), el remount no se dispara
porque el ref está armado. Sin embargo `editorPlugins` se recalcula
por `pluginsDeferredReady=true`, así que en la práctica el set sigue
completo. Es una pista pero probablemente no la causa directa.

## Propuesta de fix definitivo (requiere validación)

Diferencia entre fix mínimo (este commit) y fix completo:

### Fix mínimo aplicado (commit actual)
- `try/catch` en `applyDocData` setMarkdown path → fallback a remount.
- `setInitialMarkdown(newMd)` añadido a `handleLinterFix` para cerrar
  el último gap de `setMarkdown` sin compañero `setInitialMarkdown`.

### Fix completo pendiente
1. Resetear `pluginsArmedRef.current = false` en el `useEffect` que
   reacciona a `roomId` change (line 840-849). Coste: bajo, riesgo:
   bajo. Beneficio: garantiza recalculo del set de plugins por doc.
2. Loggear con telemetría client-side (Sentry o un endpoint propio)
   cuando el fallback try/catch dispare → confirmará si hipótesis A
   es la causa real.
3. Considerar emitir un evento `agora:editor-rehydrate` al detectar
   `statsContent.length > 0 && contenteditable.textContent === ''`
   después del próximo paint, y disparar `setEditorKey + 1` automático.
   Coste: medio (requiere hook con MutationObserver sobre el
   contenteditable), riesgo: medio (loop infinito si la lectura del
   contenteditable falla).
4. Investigar la opción de migrar `markdown` a controlled prop (vía
   forks de MDXEditor o usando `setMarkdown` siempre + suprimiendo el
   initial prop). Coste: alto (refactor profundo), beneficio: elimina
   la familia de bugs de hidratación.

### No aplicar (decisión bloqueada para el main)
- Cambiar el bump de `editorKey` en `pluginsDeferredReady` a un timer
  más largo (1500ms): mitigaría la race pero degrada UX en docs
  pequeños.
- Removcr el lazy-plugin defer: pierde ~3-4MB de heap en docs
  triviales (regresión documentada en CLAUDE.md).

## Reproducción

1. Login en `agora.elenxos.com`.
2. Abrir doc Descartes (345KB) o `reglas_tablas_de_verdad.md`.
3. Refresh con F5 o cambiar de doc y volver.
4. Observar: barra de status muestra "Guardado" + word-count > 0;
   contenteditable muestra placeholder.

Con el fix mínimo aplicado en este commit, el fallback try/catch
debería convertir el escenario en una recarga visible (~200-500ms de
skeleton extra) en lugar de un editor en blanco indefinido. Si el
síntoma persiste con `setMarkdown` exitoso (sin warn en consola),
entonces la hipótesis A queda descartada y hay que perseguir B o C.
