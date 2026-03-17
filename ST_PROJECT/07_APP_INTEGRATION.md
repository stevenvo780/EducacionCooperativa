# ST App Integration

## Objetivo

Integrar `ST` con esta app sin convertir la app en el hogar del lenguaje.

La app debe consumir `ST`, no definirlo.

## Puntos reales del repo

### Apertura de documentos

- [Editor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/Editor.tsx)
- [MosaicEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/MosaicEditor.tsx)
- [dashboardDocUtils.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/services/dashboardDocUtils.ts)

### Terminal y workers

- [services/worker/index.js](/home/operador/proyectos/humanizar/EducacionCooperativa/services/worker/index.js)
- [services/hub/src/index.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/services/hub/src/index.ts)
- [TerminalController.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/TerminalController.ts)

## Integraciones minimas

### Routing de editor

- Markdown normal -> `MosaicEditor`
- Markdown con bloques `st` -> `MosaicEditor` + linting suave
- `.st` y `.md.st` -> `STWorkbench`

### Worker

- instalar binario `st`
- permitir `st run archivo.st`
- mostrar `stdout` y `stderr`

### Linting suave

El mismo core de `ST` debe servir para:

- bloques `st`
- referencias rotas
- claims sin soporte
- conceptos no definidos

## Dependencias permitidas

Puede asumir:

- CLI estable
- runtime estable
- workbench estable

No debe asumir:

- cambiar semantica del core
- reimplementar parser o solver en TS

## Fuera de alcance

- definir el lenguaje
- definir perfiles logicos
- implementar solver

## Entregables

- decision `editorKind`
- integracion con terminal
- apertura de `.st` y `.md.st`
- hooks de linting suave en Markdown

## Criterio de exito

La app debe poder usar `ST` sin volverse inseparable de `ST`.
