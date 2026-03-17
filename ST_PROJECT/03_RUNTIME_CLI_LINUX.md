# ST Runtime CLI Linux

## Objetivo

Construir el binario `st` y el runtime Linux-first.

Este documento asume solo los contratos publicos de `02_LOGIC_CORE.md`.

## Comandos minimos

- `st run archivo.st`
- `st check archivo.st`
- `st repl`
- `st eval "..."`
- `st render archivo.st --format markdown`

## Canales de salida

Toda ejecucion debe producir:

- `stdout`
- `stderr`
- `exit_code`

Y opcionalmente:

- `diagnostics.json`
- artefactos renderizados

## Codigos de salida sugeridos

- `0`: ejecucion correcta
- `1`: error de parseo o tipado
- `2`: error de resolucion
- `3`: error de runtime
- `4`: resultado logico negativo esperado por comando de check

## REPL

Debe permitir:

- cambiar de perfil
- definir axiomas
- probar formulas
- pedir `prove`, `derive`, `countermodel`
- inspeccionar teoria actual

## Packaging Linux

Minimo:

- binario ejecutable
- instalacion simple
- tests de CLI

No hace falta empaquetado final complejo en la primera vuelta.

## Contrato con el core

El runtime no debe inventar semantica.

Consume:

- parser
- perfiles
- tipos
- resultados

Produce:

- ejecucion de scripts
- errores de usuario claros
- serializacion de resultados

## Fuera de alcance

- web
- React
- worker integration directa
- editor
- Markdown embebido

## Entregables

- binario `st`
- comandos base
- REPL funcional
- serializacion de resultados
- tests de CLI

## Criterio de exito

Desde Linux debe poder hacerse:

```bash
st run demo.st
st check demo.st
st repl
```

sin depender todavia de la app web.
