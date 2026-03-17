# Idea 06: integracion operativa entre Markdown y tablero

## Objetivo

Conectar notas y tablero sin convertir el Kanban en un sistema academico pesado.

El tablero debe seguir siendo operativo.

La integracion correcta es:

- el texto genera tareas
- las tareas apuntan al documento fuente
- el tablero devuelve contexto minimo al texto

## Que problema resuelve

Hoy el tablero existe, pero sus cards son muy pobres:

- `title`
- `description`
- `columnId`
- `order`
- `ownerId`

No hay union real con documentos.

## Integracion con el codigo actual

Puntos del codigo:

- `src/components/dashboard/types.ts`
  `BoardCard` hoy no tiene `sourceDocId`, `sourceFragment`, `sourceLabel`.

- `src/components/dashboard/KanbanBoard.tsx`
  La UI hoy no muestra contexto de documento.

- `src/services/boardApi.ts`
  El modelo actual no persiste una relacion fuerte con notas.

- `src/components/MosaicEditor.tsx`
  Desde aqui deberia nacer la accion "crear tarea desde seleccion".

## Que hay que hacer exactamente

1. Extender `BoardCard` con metadatos de origen:
   - `sourceDocId`
   - `sourceDocName`
   - `sourceFragment`
   - `sourcePath` o equivalente

2. Permitir crear card desde:
   - documento completo
   - texto seleccionado
   - pendiente detectado

3. Permitir abrir documento fuente desde la card.
4. Mostrar en la nota si hay tareas asociadas.

## Problemas graves

### Problema 1: meter demasiada semantica en cards

Eso seria un error.

Solucion:

- el tablero sigue operativo
- solo se agrega contexto minimo de origen

### Problema 2: fragmentos sin estabilidad

Si guardas solo texto crudo, luego editar la nota puede romper la referencia.

Solucion:

- guardar snapshot textual
- guardar docId
- luego evolucionar a anchors mas estables si hace falta

### Problema 3: UX pesada

Si crear tarea desde texto abre 4 modales, nadie la usara.

Solucion:

- accion directa
- titulo sugerido
- columna por defecto
- edicion opcional despues

## Solucion tecnica recomendada

Cambios iniciales:

- ampliar `BoardCard` en `types.ts`
- ampliar `boardApi.ts`
- agregar accion desde editor
- agregar apertura del documento fuente desde `KanbanBoard`

## Tiempo realista

- modelo y API: 2 a 3 dias
- UI del tablero: 2 dias
- accion desde editor: 2 a 4 dias

## Criterio de exito

La idea funciona si una persona puede seleccionar un fragmento de una nota, crear una tarea, y volver desde la tarea a la nota origen sin perder contexto.

