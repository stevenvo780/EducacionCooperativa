# Idea 03: sistema contextual unificado de click derecho y long press

## Objetivo

Convertir el click derecho en desktop y el long press en touch en un sistema transversal de interaccion.

No es solo "agregar menus".
Es mover acciones hacia el lugar donde el usuario ya esta trabajando.

## Que problema resuelve

Hoy ya existe una base en `src/components/FileExplorer.tsx`:

- `handleContextMenu`
- menu contextual de doc

Pero hoy eso es:

- puntual
- limitado
- solo para una zona

Falta un sistema coherente y reutilizable.

## Donde deberia existir

- sidebar
- tabs
- resultados de busqueda
- explorador de archivos
- tablero
- editor

## Integracion con el codigo actual

Puntos utiles ya existentes:

- `src/components/FileExplorer.tsx`
  Ya tiene un contexto basico y es el mejor primer lugar para extraer un patron.

- `src/components/dashboard/Sidebar.tsx`
  Hoy tiene interacciones de lista pero no un sistema contextual equivalente.

- `src/components/MosaicLayout.tsx`
  Ahi viven tabs, tiles y varias zonas donde un menu contextual seria natural.

- `src/components/dashboard/KanbanBoard.tsx`
  Aun no tiene una capa contextual rica.

## Que hay que hacer exactamente

1. Crear un componente base `ContextMenu`.
2. Crear un hook comun para desktop y touch.
3. Unificar posicionamiento, cierre y keyboard fallback.
4. Definir acciones por tipo de entidad.
5. Reusar el mismo sistema en varias zonas.

## Problemas graves

### Problema 1: duplicar logica en cada componente

Si cada pantalla implementa su propio click derecho, se vuelve inmantenible.

Solucion:

- componente unico
- hook unico
- esquema de acciones por entidad

### Problema 2: touch roto o inconsistente

Desktop y touch no pueden comportarse como productos distintos.

Solucion:

- long press con tiempo fijo
- mismo menu o variante ligera
- cancelar long press cuando hay scroll

### Problema 3: menus demasiado cargados

Si el menu tiene 15 acciones siempre, nadie lo usara bien.

Solucion:

- acciones por contexto
- maximo bloque corto de acciones primarias
- secundarias agrupadas

### Problema 4: choque con drag and drop

Esto es serio porque ya tienes drag and drop en archivos y tablero.

Solucion:

- no disparar menu si se detecta movimiento
- en touch separar bien press corto, long press y drag

## Solucion tecnica recomendada

Crear algo como:

- `src/components/ui/ContextMenu.tsx`
- `src/hooks/useContextActions.ts`
- `src/hooks/useLongPressContext.ts`

Y luego migrar por fases:

1. `FileExplorer`
2. `Sidebar`
3. `MosaicLayout`
4. `KanbanBoard`
5. `MosaicEditor`

## Tiempo realista

- base comun: 2 a 3 dias
- integracion en explorador y sidebar: 2 dias
- integracion en tabs y tablero: 2 a 4 dias
- integracion en editor: separar como idea propia

## Criterio de exito

La idea funciona si el usuario puede hacer click derecho o long press y sentir que la app responde igual de bien en todas las zonas importantes.

