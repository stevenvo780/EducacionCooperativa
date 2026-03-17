# ST Text Layer

## Objetivo

Conectar formulas y claims con fragmentos reales de texto sin fingir automatizacion semantica total.

## Principio duro

La formalizacion de un pasaje es una operacion interpretativa.

Por eso la capa texto no debe prometer:

- extraccion automatica de verdad
- traduccion perfecta de texto natural a formula

Si debe permitir:

- referir un pasaje estable
- declarar una formalizacion
- registrar soporte, contexto y confianza

## Tipos obligatorios

- `Anchor`
- `Passage`
- `Formalization`
- `Claim`
- `Support`
- `Context`
- `Confidence`

## Operaciones minimas

- `passage(...)`
- `formalize ... as ...`
- `support <-`
- `confidence =`
- `context =`

## Requisitos de anchors

Un anchor debe poder señalar al menos:

- bloque
- parrafo
- heading
- rango marcado

Y debe ser estable ante cambios menores.

## Contrato con el core

La capa texto no razona sola.

Compila hacia:

- `Formula`
- `Theory`
- `Judgment`

## Contrato con el runtime

Debe poder usarse en:

- scripts `.st`
- archivos `.md.st`
- bloques `st` embebidos mas adelante

## Fuera de alcance

- parser logico
- CLI
- editor
- search engine
- NLP automatico

## Entregables

- esquema de anchors
- esquema de pasajes
- esquema de formalizacion
- regla de compilacion texto -> formula/claim

## Criterio de exito

Debe poder expresarse algo como:

```st
logic classical.propositional

let p = passage([[clase-logica.md#b8]])
let phi = formalize p as (P -> Q)

claim c1 = phi
support c1 <- p
confidence c1 = 0.84
```
