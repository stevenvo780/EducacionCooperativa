# ST Workbench Web

## Objetivo

Construir el mini IDE para archivos `.st` y `.md.st`.

Este documento no define el motor.
Define el consumidor web del motor.

## Principio

`.st` y `.md.st` no deben abrirse como Markdown normal.

Necesitan un workbench propio.

## Componentes minimos

- `STWorkbench`
- `STCodeEditor`
- `STProblemsPanel`
- `STOutputPanel`
- `STSymbolsPanel`
- `STToolbar`

## Funciones minimas

- resaltado de sintaxis
- diagnosticos inline
- panel de errores y warnings
- ejecutar
- validar
- renderizar
- hover
- goto definition
- explorer de simbolos

## Dependencias permitidas

Puede asumir:

- contrato del `Editor Protocol`
- salida del runtime

No debe asumir:

- detalles internos del parser
- detalles del solver

## Stack recomendado

Para esta app, el punto de partida razonable es `CodeMirror`, porque ya existe `@uiw/react-codemirror` en [package.json](/home/operador/proyectos/humanizar/EducacionCooperativa/package.json).

## Fuera de alcance

- implementar el motor
- definir logica
- definir CLI
- enrutar archivos Markdown normales

## Entregables

- layout del workbench
- acciones base
- consumo del protocolo
- presentacion de problemas y salida

## Criterio de exito

Un usuario debe poder abrir un `.st`, escribir, ejecutar, validar y leer diagnosticos sin tocar el editor Markdown.
