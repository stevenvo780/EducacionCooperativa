# ST Roadmap Parallel

## Objetivo

Ordenar el trabajo para poder repartirlo entre varias IAs o personas con el menor bloqueo posible.

## Paquetes de trabajo

### Paquete A: alcance

Documento:

- [01_SCOPE_BOUNDARIES.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/01_SCOPE_BOUNDARIES.md)

Debe cerrarse primero y no moverse sin decision explicita.

### Paquete B: logic core

Documento:

- [02_LOGIC_CORE.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/02_LOGIC_CORE.md)

Puede arrancar apenas se cierre `A`.

### Paquete C: runtime y CLI

Documento:

- [03_RUNTIME_CLI_LINUX.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/03_RUNTIME_CLI_LINUX.md)

Puede arrancar en paralelo con `B` si se usa mock del core, pero se estabiliza cuando `B` fija contratos.

### Paquete D: text layer

Documento:

- [04_TEXT_LAYER.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/04_TEXT_LAYER.md)

Puede avanzar en paralelo con `B`.

### Paquete E: editor protocol

Documento:

- [05_EDITOR_PROTOCOL.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/05_EDITOR_PROTOCOL.md)

Puede avanzar en paralelo con `B` y `C`.

### Paquete F: workbench

Documento:

- [06_WORKBENCH_WEB.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/06_WORKBENCH_WEB.md)

Debe esperar el contrato de `E`, no el detalle interno del core.

### Paquete G: integracion con esta app

Documento:

- [07_APP_INTEGRATION.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/07_APP_INTEGRATION.md)

Debe esperar:

- CLI estable
- routing de archivos
- contrato del workbench

## Orden recomendado

1. `A`
2. `B`
3. `C` y `D`
4. `E`
5. `F`
6. `G`

## Primera meta obligatoria

Antes de pensar en web, tiene que funcionar esto:

- proyecto separado
- Linux-first
- parser
- AST
- CLI
- REPL
- scripts `.st`
- `classical.propositional`
- `check valid`
- `derive`
- `countermodel`

Si eso no existe, lo demas sigue siendo capa superficial.

## Regla para repartir a otras IAs

Cada IA recibe:

1. este roadmap
2. el documento de su paquete
3. como maximo el `README`

No hace falta pasarle toda la carpeta.
