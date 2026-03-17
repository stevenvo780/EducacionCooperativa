# ST Logic Core

## Objetivo

Construir el nucleo formal y ejecutable de `ST`, independiente de UI, web, workers y Markdown.

## Alcance

- lexer
- parser
- AST
- tipos base
- perfiles logicos
- contratos de resultados
- adaptadores de motores

## Tipos base obligatorios

- `Formula`
- `Judgment`
- `Theory`
- `Proof`
- `Model`
- `LogicProfile`
- `Diagnostic`
- `RunResult`

## Base formal

Nucleo:

- `simply typed lambda calculus`
- `many-sorted first-order logic with equality`

Extensiones previstas:

- `modal/indexed logic`
- `Belnap-Dunn`
- `description logic` ligera
- `Datalog` para consultas

## Perfiles iniciales

### `classical.propositional`

Obligatorio en V1.

Debe soportar:

- conectivos
- validez
- satisfacibilidad
- equivalencia
- tabla de verdad
- derivacion
- contramodelo

### `classical.first_order`

No necesita estar completo en V1, pero si definido como perfil y contrato.

Debe devolver:

- `provable`
- `refutable`
- `unknown`

### `modal.k`

Puede quedar como perfil declarado sin motor completo en la primera iteracion.

### `paraconsistent.belnap`

Debe quedar al menos como contrato formal del perfil, aunque la implementacion completa llegue mas tarde.

## Interfaz comun minima

Todos los perfiles deben exponer, cuando aplique:

- `check_wf`
- `check_valid`
- `check_satisfiable`
- `prove`
- `derive`
- `countermodel`
- `explain`

## Resultado estable

Estados permitidos:

- `valid`
- `invalid`
- `satisfiable`
- `unsatisfiable`
- `provable`
- `refutable`
- `unknown`
- `error`

## Decisiones de implementacion

- no intentar un engine universal desde el inicio
- si intentar AST, tipos y contratos comunes
- motores por perfil
- IR interno cercano a juicios y pruebas, no solo strings bonitas

## Fuera de alcance

- CLI
- REPL
- archivos del workspace
- pasajes y anchors
- UI
- navegador

## Entregables

- parser
- AST tipado
- interfaz `LogicProfile`
- perfil `classical.propositional` funcionando
- JSON de diagnosticos y resultados

## Criterio de exito

El core esta listo si puede ejecutar esto y devolver resultado correcto:

```st
logic classical.propositional

axiom a1 = P -> Q
axiom a2 = P

derive Q from {a1, a2}
check valid ((P -> Q) -> (!Q -> !P))
```
