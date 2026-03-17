# Idea 01: ST, lenguaje ejecutable para formalizar y operar textos

## Resumen

`ST` no debe ser un "Markdown con metadatos".

Debe ser un lenguaje ejecutable con tres capas:

- `ST Logic Core`: formulas, juicios, teorias, perfiles logicos, pruebas y modelos
- `ST Text Layer`: pasajes, anchors, formalizaciones, soporte y proveniencia
- `ST Execution Layer`: scripts, CLI, REPL, workbench, renderizadores e integracion con workers

Markdown sigue siendo la capa de escritura.
`ST` se usa cuando hace falta formalizar, probar, derivar, consultar o renderizar.

## Que es y que no es

`ST` si es:

- un lenguaje ejecutable
- un framework logico con perfiles
- una capa formal sobre textos y corpus
- un sistema que puede devolver pruebas, derivaciones, contramodelos y diagnosticos

`ST` no es:

- un reemplazo de Markdown
- un "motor que entiende textos" por arte de magia
- un mini JavaScript generico
- un solo solver universal para toda logica

## Problema real que resuelve

Hoy una nota puede enlazar, citar y organizar.
No puede hacer bien estas operaciones:

- tomar un pasaje y formalizarlo
- comprobar si una formula es valida
- derivar una conclusion
- mostrar un contramodelo
- registrar conflicto entre lecturas sin colapsar
- correr consultas sobre corpus usando conceptos y claims

En humanidades eso importa mucho para:

- logica
- filosofia
- teoria politica
- teoria literaria
- historia intelectual
- trabajo sobre corpus y debates

## Critica necesaria a la idea

La idea se vuelve humo si mezcla sin separar:

- anotacion semantica
- framework logico
- consultas sobre corpus
- ejecucion distribuida

Tambien se vuelve falsa si promete "validar textos" en sentido fuerte.

`ST` no puede decidir la verdad historica o filosofica de un texto natural.
Si puede validar una formalizacion declarada, una derivacion, una inconsistencia, una satisfacibilidad o una falta de soporte.

La formalizacion siempre es una operacion interpretativa.
Por eso `ST` debe modelar:

- autor de la formalizacion
- contexto
- soporte textual
- confianza

## Arquitectura conceptual

### Capa A: ST Logic Core

Define:

- firmas
- terminos
- formulas
- juicios
- teorias
- perfiles logicos
- pruebas
- modelos

Es el nucleo duro y debe ser independiente de la UI.

### Capa B: ST Text Layer

Conecta el nucleo con notas y documentos.

Define:

- `Doc`
- `Passage`
- `Anchor`
- `Formalization`
- `Claim`
- `Support`
- `Context`

Su trabajo no es "entender" texto natural, sino ligar pasajes concretos a estructuras formales.

### Capa C: ST Execution Layer

Hace operable el sistema.

Define:

- scripts `.st`
- modulos
- `CLI`
- `REPL`
- runtime
- renderizadores
- workbench
- integracion con workers

## Base formal recomendada

La mejor formulacion para `ST` no sale de una sola logica.
Sale de un nucleo por capas.

### Nucleo comun

- `simply typed lambda calculus` para composicion
- `many-sorted first-order logic with equality` como columna vertebral

Eso da:

- variables
- cuantificadores
- predicados
- relaciones n-arias
- dominios tipados

### Extensiones necesarias

- `modal/indexed logic` para contexto, lectura, escuela, epoca, edicion
- `Belnap-Dunn` como perfil recomendado para contradiccion e informacion incompleta
- `description logic` ligera para conceptos, taxonomias y restricciones
- `Datalog` o algebra relacional para consultas sobre corpus

## Decisiones duras

### Decision 1: ST debe tener perfiles logicos

No conviene una semantica unica para todo.

La forma correcta es:

- un lenguaje de superficie comun
- un AST comun
- un contrato de resultados comun
- motores distintos por perfil cuando haga falta

### Decision 2: no prometer un engine universal

Un solo motor de prueba bueno para proposicional, FOL, modal y paraconsistente desde el principio es una mala promesa.

La estrategia correcta es:

- kernel comun de representacion
- adaptadores de razonamiento por perfil

### Decision 3: la capa textual compila a la capa logica

`concept`, `claim`, `formalize`, `support` y similares no deben quedarse como azucar superficial.

Deben compilar a:

- firmas
- formulas
- juicios
- teorias

## Perfiles logicos iniciales

### `classical.propositional`

Debe ser el perfil inicial del REPL y la primera prueba seria de que `ST` funciona.

Debe soportar:

- conectivos
- validez
- satisfacibilidad
- equivalencia
- tabla de verdad
- derivacion
- contramodelo

Salidas esperables:

- `valid`
- `invalid`
- `satisfiable`
- `unsatisfiable`

Motores razonables:

- tablas de verdad para formulas pequenas
- SAT solver para formulas mas grandes

### `classical.first_order`

Debe ser el perfil formal principal, pero con limites honestos.

Debe soportar:

- cuantificadores
- predicados
- funciones
- igualdad
- sorts

Salidas esperables:

- `provable`
- `refutable`
- `unknown`

No debe prometer decision total.

### `modal.k`

Debe servir para:

- necesidad
- posibilidad
- marcos de lectura
- contexto teorico

Salidas esperables:

- prueba
- refutacion
- `unknown`

### `paraconsistent.belnap`

Debe servir para:

- conflicto entre lecturas
- informacion incompleta
- coexistencia de tesis incompatibles

Salidas esperables:

- evaluacion en cuatro valores
- conflicto explicito
- derivacion segun perfil

## Interfaz comun del lenguaje

Todos los perfiles deberian exponer una interfaz parecida:

- `check wf`
- `check valid`
- `check satisfiable`
- `prove`
- `derive`
- `countermodel`
- `explain`

Eso unifica UX sin fingir que todos los perfiles hacen exactamente lo mismo por dentro.

## Kernel de pruebas

Internamente, `ST` necesita una representacion mas abstracta que la sintaxis amigable.

La opcion mas seria es:

- formulas y juicios en AST tipado
- IR de pruebas cercano a calculo de secuentes

Razon:

- generaliza mejor entre perfiles
- permite arboles de prueba
- deja una base mas limpia para explicaciones y proof search

## Tipos base del lenguaje

Minimo necesario:

- `Doc`
- `Passage`
- `Anchor`
- `Concept`
- `Claim`
- `Formula`
- `Judgment`
- `Theory`
- `Context`
- `Corpus`
- `Model`
- `Proof`
- `View`

## Que debe validar de verdad

`ST` si puede validar:

- formulas bien formadas
- tipado
- nombres no resueltos
- derivaciones en un perfil dado
- satisfacibilidad o validez cuando el perfil lo permita
- contradicciones explicitas
- soporte ausente
- formalizaciones sin anchor
- consultas inseguras o mal estratificadas

`ST` no puede validar:

- la verdad final de una interpretacion historica o filosofica
- una formalizacion que nadie explicito
- el paso de texto natural a formula sin intervencion interpretativa

## Formalizacion de textos

La operacion central no es citar.
Es esta:

1. seleccionar un pasaje
2. asignarle un anchor estable
3. proponer una formalizacion
4. ligarla a un perfil logico
5. ejecutarla
6. guardar resultado, soporte y contexto

Ejemplo:

```st
logic classical.propositional

let p = passage([[clase-logica.md#b8]])
let phi = formalize p as (P -> Q)

check wf phi
derive Q from {phi, P}
```

Eso ya es formalizacion ejecutable, no solo documentacion.

## Sintaxis de trabajo esperable

### Script

```st
logic classical.propositional

axiom a1 = P -> Q
axiom a2 = P

derive Q from {a1, a2}
check valid ((P -> Q) -> (!Q -> !P))
```

### Primer orden

```st
logic classical.first_order

sort Persona
const Socrates: Persona
pred Humano(Persona)
pred Mortal(Persona)

axiom a1 = forall x: Persona. Humano(x) -> Mortal(x)
axiom a2 = Humano(Socrates)

prove Mortal(Socrates)
```

### Texto con soporte

```st
logic classical.propositional

let p = passage([[seminario/nota.md#b12]])
let phi = formalize p as (P -> Q)

claim c1 = phi
support c1 <- p
confidence c1 = 0.84
```

## ST como lenguaje ejecutable

`ST` debe correr como script real.

Comandos minimos:

- `st run archivo.st`
- `st check archivo.st`
- `st repl`
- `st eval "..."`
- `st render archivo.st --format markdown`

Toda ejecucion debe tener:

- `stdout`
- `stderr`
- `exit code`
- artefactos derivados opcionales

## Runtime

Pipeline minima:

1. cargar modulos y entradas
2. parsear
3. resolver nombres y anchors
4. tipar
5. compilar a IR
6. delegar en motor del perfil
7. producir salida
8. devolver diagnosticos

## REPL y salidas

El REPL debe permitir:

- probar formulas
- cambiar de perfil
- inspeccionar teorias
- pedir pruebas o contramodelos

Los resultados del runtime deben poder devolver:

- texto
- Markdown
- JSON
- HTML
- tablas
- diagnosticos

## Modulos y stdlib

`ST` necesita:

- `import`
- `export`
- namespaces
- alias
- stdlib minima

La stdlib inicial deberia cubrir:

- formulas
- teorias
- pasajes
- soporte
- render
- consultas

## Modelo de efectos

No conviene darle efectos arbitrarios tipo shell general.

Mejor capacidades acotadas:

- `read.workspace`
- `read.doc`
- `read.corpus`
- `write.output`
- `write.derived`
- `render.markdown`
- `render.json`
- `tasks.create`

## Editor: direccion correcta

`.st` y `.md.st` no deben abrirse como Markdown normal.

Hace falta un componente nuevo tipo mini IDE:

- `STWorkbench`
- `STCodeEditor`
- `STProblemsPanel`
- `STOutputPanel`
- `STSymbolsPanel`

Funciones minimas:

- resaltado de sintaxis
- diagnosticos inline
- panel de problemas
- ejecutar, validar y renderizar
- hover de tipos y predicados
- goto definition
- explorer de simbolos

Con el stack actual, la opcion mas razonable para empezar es `CodeMirror`, porque ya existe `@uiw/react-codemirror` en [package.json](/home/operador/proyectos/humanizar/EducacionCooperativa/package.json).

## Convivencia con Markdown

Hay tres niveles:

### Nivel 1: Markdown normal

Se abre en [MosaicEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/MosaicEditor.tsx).

### Nivel 2: Markdown con bloques `st`

Se sigue abriendo en [MosaicEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/MosaicEditor.tsx), pero con:

- diagnosticos suaves
- accion `Ejecutar bloque ST`
- previews y salidas locales

### Nivel 3: `.st` y `.md.st`

Se abren en un workbench propio.

La decision de enrutado deberia vivir en [Editor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/Editor.tsx) o en un router nuevo de documentos.

## Reutilizacion del nucleo en Markdown normal

El mismo core de `ST` debe servir para:

- linting de bloques `st`
- referencias rotas
- claims sin soporte
- conceptos no definidos
- chequeos suaves en notas normales

O sea:

el workbench y el linter no son dos proyectos distintos.

## Encaje con el codigo actual

### UI

- [Editor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/Editor.tsx): debe decidir `editorKind`
- [MosaicEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/MosaicEditor.tsx): solo para Markdown y bloques `st`
- [dashboardDocUtils.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/services/dashboardDocUtils.ts): debe reconocer `.st` y `.md.st`

### Terminal y workers

La infraestructura ya existe:

- [services/worker/index.js](/home/operador/proyectos/humanizar/EducacionCooperativa/services/worker/index.js) crea PTY con `node-pty`
- [services/hub/src/index.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/services/hub/src/index.ts) retransmite `execute` y `output`
- [TerminalController.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/TerminalController.ts) ya controla sesiones

Eso permite:

- instalar un interprete `st` en el worker
- ejecutar `st run archivo.st`
- ver `stdout` y `stderr` en la terminal actual
- reutilizar esa salida en notas o artefactos

## Decision de arquitectura: proyecto aparte, Linux primero

Esta probablemente es la decision correcta.

`ST` no deberia nacer dentro de la app web como una feature grande de frontend.

Deberia nacer como herramienta independiente, primero para Linux, con:

- binario `st`
- runtime propio
- CLI
- REPL
- tests
- perfiles logicos

Y despues integrarse con la web.

### Por que esta decision es mejor

- no satura la app web con un core pesado desde el dia uno
- obliga a que `ST` sea reutilizable de verdad
- permite perfilar, testear y depurar fuera del frontend
- hace mucho mas facil integrarlo luego con workers, terminal, navegador y otras herramientas
- evita atar la semantica del lenguaje a decisiones de React o Next

### Orden correcto

1. proyecto independiente Linux-first
2. CLI y REPL estables
3. runtime y perfiles minimos
4. uso desde terminal y worker
5. workbench web
6. version WASM en navegador

### Error a evitar

No conviene hacer primero una implementacion acoplada a la web y luego "sacarla".

Eso casi siempre termina en:

- deuda tecnica
- doble implementacion
- semantica mezclada con UI
- rendimiento peor

La direccion correcta es la inversa:

- core independiente
- integraciones encima

## Implementacion tecnica

Si `ST` va en serio, el core no deberia quedarse solo en TypeScript.

Direccion recomendada:

- `Rust` para parser, AST, type checker, runtime y motores/adaptadores
- `WASM` para reutilizar el core en frontend y backend
- `TypeScript` para integracion con UI, workbench y app

La forma mas limpia es:

- proyecto principal de `ST` fuera de esta app
- core en `Rust`
- binario Linux primero
- `WASM` despues
- integracion web como consumidor, no como origen del lenguaje

No hace falta resolver todo desde el primer commit.
Pero si conviene diseñarlo desde el inicio como producto independiente.

## Estructura tecnica sugerida

Proyecto `st` independiente:

- `crates/st_core`
- `crates/st_parser`
- `crates/st_types`
- `crates/st_profiles`
- `crates/st_runtime`
- `crates/st_cli`
- `crates/st_repl`
- `tests/`

Integracion posterior en esta app:

- binario instalado en worker
- wrapper de ejecucion
- workbench web
- bindings WASM cuando toque

UI:

- `src/components/st/STWorkbench.tsx`
- `src/components/st/STCodeEditor.tsx`
- `src/components/st/STProblemsPanel.tsx`
- `src/components/st/STOutputPanel.tsx`
- `src/components/st/STSymbolsPanel.tsx`

Integracion:

- `src/lib/st/client.ts`
- `src/lib/st/lint.ts`
- `src/lib/st/editor.ts`

## Riesgos graves

### Riesgo 1: querer resolver todo a la vez

Solucion:

- separar `Logic Core`, `Text Layer` y `Execution Layer`

### Riesgo 2: prometer validacion total en FOL o en formalizacion textual

Solucion:

- contratos honestos: `valid`, `invalid`, `provable`, `refutable`, `unknown`

### Riesgo 3: intentar un motor universal desde el inicio

Solucion:

- motores por perfil con interfaz comun

### Riesgo 4: forzar `.st` dentro del editor Markdown

Solucion:

- workbench propio

### Riesgo 5: no tener anchors estables

Solucion:

- ids invisibles por bloque y resolucion tolerante

### Riesgo 6: nacer demasiado acoplado a la web

Solucion:

- proyecto independiente
- Linux-first
- web como integracion posterior

## Hoja de ruta correcta

### Fase 0

Demostrar que `ST` ya es un lenguaje logico real:

- proyecto separado
- parser
- AST
- CLI
- REPL
- scripts `.st`
- `classical.propositional`
- `check valid`
- `derive`
- `truth_table`
- `countermodel`

Si esto falla, no tiene sentido seguir.

### Fase 1

Integracion con Linux y worker:

- binario ejecutable
- packaging basico
- ejecucion en terminal
- uso desde worker actual

### Fase 2

Workbench y UX minima:

- `STWorkbench`
- panel de salida
- panel de problemas
- ejecutar y validar scripts

### Fase 3

Capa textual:

- `Passage`
- anchors
- `formalize`
- `support`
- proveniencia

### Fase 4

Primer orden y teorias:

- `classical.first_order`
- sorts
- teorias
- modulos

### Fase 5

Consultas y corpus:

- indice
- consultas
- renderizadores

### Fase 6

Perfiles avanzados:

- `modal.k`
- `paraconsistent.belnap`

### Fase 7

Integracion editorial amplia:

- linting de Markdown
- hover semantico
- explorador de simbolos
- busqueda por claims y teorias

## Definicion final

`ST` debe presentarse asi:

`Lenguaje ejecutable con nucleo logico y capa textual, pensado para formalizar fragmentos de escritura, correr razonamiento sobre ellos y devolver pruebas, derivaciones, contramodelos, diagnosticos y salidas renderizadas.`
