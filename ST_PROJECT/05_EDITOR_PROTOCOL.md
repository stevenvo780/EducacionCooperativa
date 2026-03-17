# ST Editor Protocol

## Objetivo

Definir un contrato estable entre el motor de `ST` y cualquier editor o workbench.

La idea es que UI y core puedan avanzar en paralelo.

## Principio

El editor no debe depender de internals del runtime.

Debe hablar con `ST` a traves de un protocolo pequeno y claro.

## Operaciones minimas

- `parse`
- `check`
- `run`
- `render`
- `hover`
- `symbols`
- `goto_definition`
- `completion`

## Respuestas minimas

- `diagnostics`
- `run_result`
- `hover_info`
- `symbol_list`
- `definition_location`
- `completion_items`

## Estructura de diagnosticos

Cada diagnostico debe incluir:

- severidad
- mensaje
- archivo
- linea
- columna
- codigo opcional
- sugerencia opcional

## Transporte

No fijar un transporte unico aqui.

Puede ser:

- llamada directa a libreria
- JSON-RPC
- wrapper CLI
- binding WASM

Lo importante es el contrato, no el medio.

## Fuera de alcance

- UI concreta
- React
- CodeMirror
- worker

## Entregables

- esquema de request/response
- esquema de diagnosticos
- esquema de resultados de ejecucion

## Criterio de exito

Una UI deberia poder implementarse solo con este documento y los contratos de `02` y `03`.
