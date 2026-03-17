# ST Project

## Estado

`ST` se considera, por ahora, un proyecto aparte del sistema web principal.

Direccion:

- Linux-first
- CLI y REPL primero
- workbench web despues
- integracion con la app como consumidor

## Objetivo del set de documentos

Estos archivos estan pensados para poder darse por separado a distintas IAs o personas.

Cada documento intenta ser:

- corto
- riguroso
- construible por si solo
- dependiente solo de contratos pequenos y estables

## Documentos

- [01_SCOPE_BOUNDARIES.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/01_SCOPE_BOUNDARIES.md)
  Define que es `ST`, que no es y que limites no deben romperse.

- [02_LOGIC_CORE.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/02_LOGIC_CORE.md)
  Define el nucleo formal, perfiles logicos, tipos y contratos de resultados.

- [03_RUNTIME_CLI_LINUX.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/03_RUNTIME_CLI_LINUX.md)
  Define el binario `st`, CLI, REPL, salida y packaging Linux.

- [04_TEXT_LAYER.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/04_TEXT_LAYER.md)
  Define anchors, pasajes, formalizacion, soporte y proveniencia.

- [05_EDITOR_PROTOCOL.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/05_EDITOR_PROTOCOL.md)
  Define el contrato editor-motor para diagnosticos, hover, simbolos y ejecucion.

- [06_WORKBENCH_WEB.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/06_WORKBENCH_WEB.md)
  Define el mini IDE para `.st` y `.md.st`.

- [07_APP_INTEGRATION.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/07_APP_INTEGRATION.md)
  Define como integrar `ST` con esta app sin acoplarlo.

- [08_ROADMAP_PARALLEL.md](/home/operador/proyectos/humanizar/EducacionCooperativa/ST_PROJECT/08_ROADMAP_PARALLEL.md)
  Define orden, paralelizacion y bloqueos reales.

## Contratos compartidos minimos

Estos contratos son los unicos que todos deben respetar.

### Resultado logico

Estados base:

- `valid`
- `invalid`
- `satisfiable`
- `unsatisfiable`
- `provable`
- `refutable`
- `unknown`
- `error`

### Canales de ejecucion

- `stdout`
- `stderr`
- `exit_code`
- `diagnostics`

### Tipos compartidos

- `Formula`
- `Judgment`
- `Theory`
- `Proof`
- `Model`
- `Passage`
- `Anchor`
- `Claim`

## Regla para trabajo paralelo

Cada implementacion debe asumir solo esto:

- `01` fija alcance y no-objetivos
- `02` fija semantica y tipos duros
- `03` consume contratos de `02`
- `04` consume tipos de `02`, no CLI ni UI
- `05` consume resultados de `02` y `03`, no UI concreta
- `06` consume `05`, no necesita saber internals del motor
- `07` consume `03` y `06`, no modifica el core

## Regla anti-caos

Ningun documento debe ampliar el alcance de `ST` por su cuenta.

Si una IA quiere agregar algo nuevo, primero tiene que entrar en:

- `01_SCOPE_BOUNDARIES.md`

Si no entra ahi, no entra en el proyecto.
