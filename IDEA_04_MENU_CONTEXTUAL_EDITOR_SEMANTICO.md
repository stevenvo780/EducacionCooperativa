# Idea 04: menu contextual del editor con acciones semanticas

## Objetivo

Crear un menu contextual dentro del editor, pero no para repetir Markdown.

No debe ser:

- negrilla
- italica
- encabezados
- links

Eso ya pertenece a la logica del editor y del lenguaje base.

Debe ser un menu de operaciones intelectuales sobre seleccion de texto.

## Que problema resuelve

Hoy `MosaicEditor.tsx` ya tiene:

- links internos
- preview
- snippets
- barra de herramientas
- carga y guardado en tiempo real

Lo que no tiene es una forma natural de decir:

- este fragmento es un concepto
- este fragmento debe ir al sistema semantico
- esto genera una tarea
- esto es evidencia importante

## Integracion con el codigo actual

Puntos relevantes:

- `src/components/MosaicEditor.tsx`
  Aqui vive el editor real y aqui hay que trabajar.

- El editor usa MDXEditor y `contentRef`, `statsContent`, `saveTimeoutRef`.
  Eso significa que no conviene hackear demasiado el flujo de guardado.

- El editor ya intercepta clicks sobre links y maneja navegacion interna.
  Esa misma capa es util para integrar acciones semanticas.

## Que hay que hacer exactamente

1. Detectar seleccion de texto de manera estable.
2. Abrir menu contextual solo cuando haya seleccion valida.
3. Crear acciones semanticas, no de formato.
4. Conectar esas acciones con:
   - `.md.st`
   - favoritos
   - tablero
   - referencias internas

## Acciones que si tienen sentido

- definir como concepto
- relacionar con concepto existente
- crear entrada semantica nueva
- enviar a tarea operativa
- marcar como evidencia
- fijar fragmento
- enlazar a documento

## Problemas graves

### Problema 1: conflicto con MDXEditor

MDXEditor no esta pensado como editor de DSL ni como motor de menus semanticos complejos.

Solucion:

- no tocar el modelo interno mas de la cuenta
- capturar seleccion y abrir menu por fuera
- hacer acciones que transformen texto o creen relaciones, no que reinventen el editor

### Problema 2: seleccion inestable

La seleccion puede perderse al abrir menu, re-renderizar o cambiar de nodo.

Solucion:

- capturar rango de seleccion antes de abrir menu
- guardar texto, offsets y docId
- ejecutar accion sobre snapshot, no sobre DOM vivo

### Problema 3: acciones que duplican cosas ya existentes

Si el menu hace lo mismo que toolbar, no aporta.

Solucion:

- prohibir acciones de formato basico
- reservar el menu contextual para acciones de trabajo academico

### Problema 4: iframe del editor

`Editor.tsx` a veces usa iframe cuando esta embebido.

Solucion:

- priorizar primero `forceInline` donde toque
- o crear puente de eventos si de verdad hace falta dentro del iframe

## Solucion tecnica recomendada

Agregar:

- `src/hooks/useEditorSelectionActions.ts`
- `src/components/editor/EditorSelectionMenu.tsx`

Y engancharlo en `MosaicEditor.tsx` cerca del shell del editor.

## Tiempo realista

- captura estable de seleccion: 2 a 3 dias
- menu y acciones base: 2 a 4 dias
- conexion con `.md.st` y tablero: 3 a 5 dias

## Criterio de exito

La idea funciona si seleccionar texto ya no es solo el paso previo a copiar, sino el inicio de una operacion academica util.

