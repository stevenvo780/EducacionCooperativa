# Taller real auditado — `01-clasica-proposicional.st`

> Fuente original: `EducacionCooperativa/public/downloads/st/01-clasica-proposicional.st`
>
> Fecha de auditoría: 2026-04-21
>
> Motor auditado: `ST` **3.2.1** usando la CLI JS actual (`node dist/cli/index.js run ...`) y la API `evaluate()`.

## Veredicto corto

Sí: **`ST` resolvió bien el taller real disponible en el workspace**.

Resumen ejecutivo:

- `ok = true`
- `exitCode = 0`
- `87` resultados estructurados
- `27` pruebas con propiedad `proof`
- `27/27` por `natural_deduction`
- `0` casos con `semanticFallback = true`
- El bloque final de captura (`let derivacion`, `let comprobacion`, `let tabla`, `print`, `render analysis as markdown`) **sí se ejecutó correctamente**

Importante:

- El binario empaquetado local `./st` del repo está desactualizado (`2.6.0`) y puede arrojar falsos errores con sintaxis más nueva.
- La auditoría correcta del taller se hizo con la CLI/engine actual de este checkout: `3.2.1`.

## Qué quedó confirmado

### 1. Leyes clasificadas automáticamente

Las `27` leyes del primer bloque salieron correctas como válidas/tautológicas.

### 2. Operadores extendidos y aliases

Las `9` equivalencias de `nand`, `nor` y `xor` salieron correctas.

### 3. Satisfacibilidad y clasificación semántica

Los `5` casos del bloque semántico se comportaron como corresponde:

- `P & Q` → satisfacible
- `!P & !Q` → satisfacible
- `(P -> Q) & P` → satisfacible
- `(P -> Q) & P & !Q` → no satisfacible
- `P & !P` → no satisfacible

### 4. Derivación natural

Aquí está el punto central del taller.

- La galería principal de derivación contiene `26` ejercicios.
- Además, el bloque final tiene una derivación capturada con `let derivacion = derive Q from {cap1, cap2}`.
- En total, el archivo produjo `27` resultados con `proof`.
- **Los 27 salieron con `proof.method = natural_deduction`.**
- **Ninguno usó fallback semántico.**

Eso confirma que la parte fuerte del taller —la deducción natural— sí quedó bien resuelta por `ST` en este archivo real.

### 5. Análisis de inferencias y falacias

Este bloque también salió bien. Los `invalid` aquí **no son errores del motor**; son ejemplos puestos adrede para detectar falacias:

- `{P, P -> Q} -> Q` → válida
- `{P -> Q, Q} -> P` → inválida por **Afirmación del consecuente**
- `{P -> Q, !P} -> !Q` → inválida por **Negación del antecedente**
- `{P -> P} -> (P -> P)` → inválida por **Petición de principio**

### 6. Explain, tablas y contramodelos

Este bloque salió coherente:

- `explain (P -> Q)` → correcto
- `explain ((P ⊕ Q) -> (P | Q))` → correcto
- `truth_table (P -> Q)` → correcta
- `truth_table ((P ⊕ Q) <-> ((P | Q) & !(P & Q)))` → correcta
- `countermodel (P -> Q)` → correctamente encontró un contramodelo (`P = V`, `Q = F`)
- `countermodel (((P -> Q) & Q) -> P)` → correctamente encontró un contramodelo (`P = F`, `Q = V`)
- `render theory` → correcto

### 7. Definiciones, unfold/fold, fuentes e interpretaciones

Todo este bloque se comportó bien:

- `define Implicacion(x, y) := x -> y`
- `define LeyDeMorgan := !(P & Q) <-> (!P | !Q)`
- `check valid LeyDeMorgan`
- `check valid Implicacion(P, P)`
- `unfold LeyDeMorgan`
- `fold (!(P & Q) <-> (!P | !Q))`
- `source Frege { ... }`
- `interpret ...`
- `glossary`
- `render glossary as markdown`

### 8. Fórmulas grandes y simplificación profunda

También salió bien:

- `f21` → satisfacible
- `f27` → satisfacible
- `deep = !!!!!!!!!!!!!!!!!!!!(P)` → equivalente a `P`

### 9. Captura de resultados en variables

Este bloque **sí se ejecutó** y produjo exactamente lo esperado en la salida:

- `Let derivacion = Q`
- `print derivacion` → `Q`
- `print derivacion.status` → `"provable"`
- `print derivacion.command` → `"derive"`
- `Let comprobacion = (P → P)`
- `print comprobacion.status` → `"valid"`
- `Let tabla = (P ∧ Q)`
- `print tabla.rows_count` → `4`
- `print tabla.variables` → `[P, Q]`
- `render analysis as markdown` → imprimió el documento `# Análisis`

## Comparación con la revisión anterior

Mi revisión anterior cubría correctamente la **galería de derivaciones naturales**. Esta auditoría del archivo real completo confirma lo siguiente:

- **Sí resolví bien la parte de deducción natural** al compararla antes.
- **Sí, `ST` también lo hizo bien** en el archivo real completo, no solo en el subconjunto de derivaciones.
- Los únicos estados `invalid` del taller completo son los que **debían** ser inválidos:
  - las falacias del bloque `analyze`
  - los dos `countermodel` pedidos explícitamente

En otras palabras: en este taller real, `ST` no “falló”; **distinguió correctamente entre ejercicios válidos, falacias y contramodelos**.

## Taller convertido a Markdown

> Nota: no apareció en el workspace un PDF o imagen externa con otro “taller real”. El taller real disponible dentro del repo es este archivo `.st`, transcrito aquí en formato Markdown por secciones.

### 1. Leyes clasificadas automáticamente

```st
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid (P -> (Q -> P))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P -> Q) -> (!Q -> !P))
check valid ((!P -> !Q) -> (Q -> P))
check valid (!!P -> P)
check valid (P -> !!P)
check valid (((P -> Q) -> P) -> P)
check valid (!P -> (P -> Q))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P | Q) -> (Q | P))
check valid ((P & Q) -> (Q & P))
check valid (!(P & Q) <-> (!P | !Q))
check valid (!(P | Q) <-> (!P & !Q))
check valid ((P & (Q | R)) <-> ((P & Q) | (P & R)))
check valid ((P | (Q & R)) <-> ((P | Q) & (P | R)))
check valid ((P -> Q) <-> (!P | Q))
check valid ((P <-> Q) <-> ((P -> Q) & (Q -> P)))
check valid ((P & (P | Q)) <-> P)
check valid ((P | (P & Q)) <-> P)
check valid ((P & P) <-> P)
check valid ((P | P) <-> P)
check valid (((P & Q) -> R) <-> (P -> (Q -> R)))
check valid ((P <-> Q) <-> (Q <-> P))
check valid (!!P <-> P)
```

### 2. Operadores extendidos y aliases

```st
check equivalent (P !& Q), !(P & Q)
check equivalent (P nand Q), !(P & Q)
check equivalent (P ↑ Q), !(P & Q)
check equivalent (P !| Q), !(P | Q)
check equivalent (P nor Q), !(P | Q)
check equivalent (P ↓ Q), !(P | Q)
check equivalent (P ^ Q), ((P | Q) & !(P & Q))
check equivalent (P xor Q), ((P | Q) & !(P & Q))
check equivalent (P ⊕ Q), ((P | Q) & !(P & Q))
```

### 3. Satisfacibilidad y clasificación semántica

```st
check satisfiable (P & Q)
check satisfiable (!P & !Q)
check satisfiable ((P -> Q) & P)
check satisfiable ((P -> Q) & P & !Q)
check satisfiable (P & !P)
```

### 4. Galería de derivación

```st
axiom mp1 = P -> Q
axiom mp2 = P
derive Q from {mp1, mp2}

axiom pr1 = P -> Q
axiom pr2 = Q -> R
axiom pr3 = P
prove R from {pr1, pr2, pr3}

axiom mt1 = !Q
axiom mt2 = P -> Q
derive !P from {mt1, mt2}

axiom ci1 = P
axiom ci2 = Q
derive P & Q from {ci1, ci2}

axiom ce1 = P & Q
derive P from {ce1}

axiom di1 = P
derive P | Q from {di1}

axiom sh1 = P -> Q
axiom sh2 = Q -> R
derive P -> R from {sh1, sh2}

axiom pv1 = P -> Q
axiom pv2 = Q -> R
axiom pv3 = P
derive R from {pv1, pv2, pv3}

axiom sd1 = P | Q
axiom sd2 = !P
derive Q from {sd1, sd2}

axiom ib1 = P -> Q
axiom ib2 = Q -> P
derive P <-> Q from {ib1, ib2}

axiom eb1 = P <-> Q
axiom eb2 = P
derive Q from {eb1, eb2}

axiom dc1 = (P -> Q) & (R -> S)
axiom dc2 = P | R
derive Q | S from {dc1, dc2}

axiom dd1 = (P -> Q) & (R -> S)
axiom dd2 = !Q | !S
derive !P | !R from {dd1, dd2}

axiom ds1 = P | Q
axiom ds2 = P -> R
axiom ds3 = Q -> R
derive R from {ds1, ds2, ds3}

axiom rs1 = P | Q
axiom rs2 = !P | R
derive Q | R from {rs1, rs2}

axiom ex1 = P
axiom ex2 = !P
derive Q from {ex1, ex2}

axiom dn1 = !!P
derive P from {dn1}

axiom idn1 = P
derive !!P from {idn1}

axiom ii1 = Q
derive P -> Q from {ii1}

axiom cp1 = P -> Q
derive !Q -> !P from {cp1}

axiom ab1 = P -> Q
derive P -> (P & Q) from {ab1}

axiom expt1 = (P & Q) -> R
derive P -> (Q -> R) from {expt1}

axiom impt1 = P -> (Q -> R)
derive (P & Q) -> R from {impt1}

axiom dm1 = !(P & Q)
derive !P | !Q from {dm1}

axiom dm2 = !(P | Q)
derive !P & !Q from {dm2}

axiom raa1 = P -> Q
axiom raa2 = P -> !Q
derive !P from {raa1, raa2}
```

### 5. Falacias y análisis

```st
analyze {P, P -> Q} -> Q
analyze {P -> Q, Q} -> P
analyze {P -> Q, !P} -> !Q
analyze {P -> P} -> (P -> P)
```

### 6. Explain, tablas y contramodelos

```st
explain (P -> Q)
explain ((P ⊕ Q) -> (P | Q))
truth_table (P -> Q)
truth_table ((P ⊕ Q) <-> ((P | Q) & !(P & Q)))
countermodel (P -> Q)
countermodel (((P -> Q) & Q) -> P)
render theory
```

### 7. Definiciones, unfold y fold

```st
define Implicacion(x, y) := x -> y
description "Implicación material parametrizada"

define LeyDeMorgan := !(P & Q) <-> (!P | !Q)
description "Primera ley de De Morgan"

check valid LeyDeMorgan
check valid Implicacion(P, P)

unfold LeyDeMorgan
fold (!(P & Q) <-> (!P | !Q))
```

### 8. Fuentes, interpretaciones y glosario

```st
source Frege {
  author "Gottlob Frege"
  work "Begriffsschrift"
  year 1879
}

interpret "si llueve entonces la calle se moja" as P -> Q
interpret "está lloviendo" as P

glossary
render glossary as markdown
```

### 9. Fórmulas grandes, DPLL y negación profunda

```st
let f21 = A & B & C & D & E & F & G & H & I & J & K & L & M & N & O & P & Q & R & S & T & U
check satisfiable f21

let f27 = A & B & C & D & E & F & G & H & I & J & K & L & M & N & O & P & Q & R & S & T & U & V & W & X & Y & Z & AA
check satisfiable f27

let deep = !!!!!!!!!!!!!!!!!!!!(P)
check equivalent deep, P
```

### 10. Captura de resultados

```st
axiom cap1 = P -> Q
axiom cap2 = P
let derivacion = derive Q from {cap1, cap2}
print derivacion
print derivacion.status
print derivacion.command

let comprobacion = check valid (P -> P)
print comprobacion.status

let tabla = truth_table (P & Q)
print tabla.rows_count
print tabla.variables

render analysis as markdown
```

## Conclusión final

Si la pregunta es: **“¿resolvimos todos los puntos correctamente y `ST` lo hizo bien?”**, la respuesta, para este taller real disponible en el repo, es:

**Sí.**

- La parte de deducción natural quedó correcta.
- El resto del taller también quedó correcto.
- Los `invalid` observados son los que el propio taller pedía como falacias o contramodelos.
- El bloque final de captura de resultados sí funciona y produce exactamente la salida esperada.

En este taller, `ST` quedó bien parado.