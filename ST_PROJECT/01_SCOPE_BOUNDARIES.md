# ST Scope And Boundaries

## Objetivo

Fijar que es `ST` y evitar que el proyecto se vuelva una mezcla borrosa de lenguaje, app, NLP y UI.

## Definicion

`ST` es un lenguaje ejecutable con nucleo logico y capa textual, pensado para formalizar fragmentos de escritura, correr razonamiento sobre ellos y devolver pruebas, derivaciones, contramodelos, diagnosticos y salidas renderizadas.

## Si entra en alcance

- lenguaje ejecutable
- perfiles logicos
- formulas, juicios, teorias y pruebas
- formalizacion explicita de pasajes
- soporte, proveniencia y contexto
- scripts `.st`
- CLI y REPL
- workbench posterior
- integracion con workers y terminal

## No entra en alcance

- reemplazar Markdown
- entender automaticamente textos naturales
- decidir verdad historica o filosofica
- ser un mini JavaScript general
- meter primero todo dentro de la web
- un solo solver universal para toda logica

## Supuestos duros

- proyecto aparte del sistema web principal
- Linux-first
- web despues
- UI consumiendo contratos del core
- formalizacion siempre interpretativa, no automatica

## Capas oficiales

- `Logic Core`
- `Text Layer`
- `Execution Layer`

Nadie debe mezclar estas capas en una sola implementacion.

## No-objetivos explicitamente prohibidos

- NLP automatico como requisito base
- claims sin soporte textual cuando el caso exige soporte
- acoplar semantica del lenguaje a React o Next
- forzar `.st` dentro del editor Markdown

## Criterio de exito

`ST` vale la pena si puede:

1. ejecutar scripts reales
2. probar al menos proposicional clasica bien
3. enlazar formulas con pasajes concretos
4. integrarse con terminal y luego con navegador sin reescribirse
