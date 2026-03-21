# Prompt de contexto: Lenguaje ST

> Copia y pega este archivo como contexto en cualquier workspace o chat con IA para que el asistente sepa cómo usar el lenguaje ST.

---

## Qué es ST

**ST** (Symbolic Theory Language) es un lenguaje ejecutable para lógica formal, argumentación y formalización de documentos. Combina tres capas:

1. **Lógica formal**: axiomas, teoremas, derivaciones, validez, satisfacibilidad, contramodelos.
2. **Scripting declarativo**: variables, condicionales, loops, funciones, módulos, POO.
3. **Text Layer**: vincula pasajes de documentos con formalizaciones verificables.

Los archivos tienen extensión `.st` y se ejecutan con el CLI `st`.

**Documentación completa:**
- Manual local: `ST/DOCS.md` (secciones 1–20)
- Quickstart: `ST/QUICKSTART.md`
- README con sintaxis resumida: `ST/README.md`

---

## Instalación

```bash
# npm global
npm install -g @stevenvo780/st-lang

# o binario Linux
chmod +x st && sudo mv st /usr/local/bin/
```

---

## CLI principal

```bash
st run archivo.st          # ejecutar archivo
st archivo.st              # modo legacy
st check archivo.st        # validar sintaxis
st run archivo.st --diagnostics  # guardar diagnósticos JSON
st eval "check valid (P -> P)"   # expresión rápida
st repl                    # modo interactivo
st profiles                # listar perfiles disponibles
st protocol                # protocolo para editores (LSP)
```

---

## Estructura mínima de un script

Todo script necesita declarar un perfil lógico al inicio:

```st
logic classical.propositional

axiom a1 : P -> Q
axiom a2 : P
derive Q from {a1, a2}
check valid (P | !P)
```

---

## Perfiles lógicos disponibles

| Perfil | Uso principal |
|---|---|
| `classical.propositional` | Lógica proposicional clásica (el más completo) |
| `classical.first_order` | Lógica de primer orden con cuantificadores |
| `modal.k` | Lógica modal (`[]` necesidad, `<>` posibilidad) |
| `deontic.standard` | Razonamiento normativo/deóntico |
| `epistemic.s5` | Razonamiento sobre conocimiento |
| `aristotelian.syllogistic` | Silogística aristotélica |
| `intuitionistic.propositional` | Sin tercero excluido |
| `temporal.ltl` | Lógica temporal (`next`, `until`) |
| `probabilistic.basic` | Razonamiento probabilístico básico |
| `paraconsistent.belnap` | Tolerante a inconsistencia |
| `arithmetic` | Aritmética explicable (`+`, `-`, `*`, `/`, `%`, `<`, `>`) |

Selección:
```st
logic modal.k
logic arithmetic
```

---

## Statements principales

### Núcleo lógico

```st
logic classical.propositional

axiom a1 : P -> Q          -- declara axioma
theorem t1 : (P -> P)      -- registra teorema
derive Q from {a1, a2}     -- deriva desde premisas nombradas
prove (P -> P)             -- prueba desde teoría acumulada
check valid (P | !P)       -- verifica validez
check satisfiable (P & Q)  -- verifica satisfacibilidad
check equivalent (!(P&Q)), (!P|!Q)  -- equivalencia
truth_table (P -> Q)       -- tabla de verdad
countermodel (P -> Q)      -- busca contraejemplo
analyze {P, P->Q} -> Q     -- evalúa inferencia + detecta falacias
explain (P & !P)           -- explica fórmula en el perfil activo
render theory              -- inspecciona teoría cargada
render claims              -- inspecciona claims
```

Falacias detectadas por `analyze`: afirmación del consecuente, negación del antecedente, medio no distribuido.

### Variables y scripting

```st
let regla = P -> Q                         -- alias de fórmula (también como axioma implícito)
let causa = "Si llueve, se moja" : (L->M)  -- descripción + fórmula
let P = "Llueve"                           -- descripción semántica de átomo
set regla = Q -> R                         -- reasignación mutable
print "texto"                              -- imprime texto
print regla                                -- imprime variable resuelta
```

### Control de flujo

```st
if valid (P | !P) {
  print "tautología"
} else if satisfiable P {
  print "satisfacible"
} else {
  print "insatisfacible"
}

for F in { P, Q, (R -> R) } {
  check valid F
}

set cond = P
while satisfiable cond {
  print "iteración"
  set cond = P & !P
}
```

Condiciones para `if`/`while`: `valid`, `invalid`, `satisfiable`, `unsatisfiable`.
Límite de seguridad en `while`: 1000 iteraciones.

### Funciones

```st
fn verificar(X) {
  check valid X
  return X
}

fn combinar(A, B) {
  return A & B
}

verificar((P | !P))
let resultado = combinar(P, Q) | !R    -- funciones como expresiones
```

### Proof blocks

```st
assume h1 : P -> Q
assume h2 : P
show Q
derive Q from {h1, h2}
qed
```

### Teorías (POO lógico)

```st
-- Singleton (sin parámetros)
theory Base {
  axiom ley = P -> P
  private let interno = Q
  let publico = R
}

-- Con parámetros (instanciable como clase)
theory Agente(id, creencia) {
  let nombre = id
  axiom p = creencia

  fn saludar() {
    print nombre
  }
}

let a1 = Agente("Socrates", P)
a1.saludar()
check valid a1.p
print Base.publico   -- acceso con punto
```

Herencia:
```st
theory Extendida extends Base {
  axiom otra = Q -> Q
}
```

### Módulos

```st
-- lib.st
export let Identidad = P -> P
export fn doble_neg(phi) { return !!phi }
let Interno = Q & !Q   -- no se exporta

-- main.st
import "lib.st"
check valid Identidad
```

### Text Layer

```st
let p = passage([[documento.md#seccion-2]])
let f = formalize p as (P -> Q)
claim c1 = f
support c1 <- p
confidence c1 = 0.84
context c1 = "Lectura conservadora"
render claims
```

---

## Operadores

### Proposicional (precedencia de menor a mayor)

| Op | Significado | Unicode |
|---|---|---|
| `<->` | Bicondicional | `↔` |
| `->` | Implicación | `→` |
| `\|` | Disyunción | `∨` |
| `^` / `xor` | XOR | `⊕` |
| `!\|` / `nor` | NOR | `↓` |
| `&` | Conjunción | `∧` |
| `!&` / `nand` | NAND | `↑` |
| `!` | Negación | `¬` |

### Primer orden
`forall x`, `exists x`, `P(x)`, `x = y`

### Modal / Deóntica / Epistémica
`[]` (necesario/obligatorio/conocido), `<>` (posible/permitido)

### Temporal
`next P`, `P until Q`

### Aritmética
`+`, `-`, `*`, `/`, `%`, `<`, `>`, `<=`, `>=`

---

## Alias en español

ST acepta keywords tanto en inglés como en español:

| Inglés | Español |
|---|---|
| `logic` | `logica` |
| `axiom` | `axioma` |
| `theorem` | `teorema` |
| `derive` | `derivar` |
| `from` | `desde` |
| `check valid` | `verificar valido` |
| `check satisfiable` | `verificar satisfacible` |
| `countermodel` | `contramodelo` |
| `truth_table` | `tabla_verdad` |
| `analyze` | `analizar` |
| `explain` | `explicar` |
| `import` | `importar` |
| `export` | `exportar` |
| `theory` | `teoria` |
| `private` | `privado` |
| `if` | `si` |
| `else` | `sino` |
| `for` | `para` |
| `while` | `mientras` |
| `fn` | `funcion` |
| `return` | `retornar` |

---

## API programática (TypeScript/JavaScript)

```typescript
import { evaluate, createInterpreter } from '@stevenvo780/st-lang/api';

// Stateless: corre un script completo de una vez
const result = evaluate(`
  logic classical.propositional
  let regla = P -> Q
  let hecho = P
  derive Q from {regla, hecho}
`);
console.log(result.results[0].status);

// Stateful: útil para REPLs y sesiones interactivas
const st = createInterpreter();
st.exec('logic arithmetic');
st.exec('explain 2 + 3 * 4');
```

---

## Ejemplos incluidos en el repositorio (`ST/examples/`)

| Archivo | Contenido |
|---|---|
| `demo.st` | Núcleo lógico básico |
| `programming-control-flow.st` | `let`, `if`, `for`, `while`, `fn` |
| `guided-language-tour.st` | Recorrido pedagógico paso a paso |
| `text-layer.st` | Formalización documental |
| `theory-showcase.st` | Teorías, herencia y POO |
| `arithmetic-programming.st` | Aritmética con scripting |
| `stress-all-profiles.st` | Smoke test de todos los perfiles |

```bash
npm run examples:run   # ejecuta todos
```

---

## Secciones de DOCS.md (referencia rápida)

| Sección | Tema |
|---|---|
| §1 | Modelo mental de ST |
| §2 | Estructura mínima de un script |
| §3 | Statements principales (`logic`, `axiom`, `derive`, `check`, `analyze`, `explain`, `render`...) |
| §4 | Variables, alias y scripting (`let`, `set`, `print`) |
| §5 | Control de flujo (`if`, `for`, `while`) |
| §6 | Funciones (`fn`, `return`) |
| §7 | Proof blocks (`assume`, `show`, `qed`) |
| §8 | Teorías, encapsulación y herencia (POO) |
| §9 | Módulos (`import`, `export`) |
| §10 | Text Layer (`passage`, `formalize`, `claim`, `support`, `confidence`, `context`) |
| §11 | Perfiles lógicos soportados (11 perfiles) |
| §12 | Operadores y precedencia |
| §13 | Alias en español |
| §14 | CLI |
| §15 | API programática |
| §16 | Integración con editores (protocolo LSP) |
| §17 | Ejemplos recomendados |
| §18 | Buenas prácticas |
| §19 | Limitaciones y notas de precisión |
| §20 | Receta pedagógica sugerida |

---

## Notas de precisión

- `classical.propositional` es el perfil más completo y probado.
- `truth_table` y `check equivalent` dependen de que el perfil los implemente.
- `while` tiene límite de 1000 iteraciones para evitar loops infinitos.
- `return` dentro de `fn` corta la ejecución y preserva el valor; las funciones también pueden usarse como expresiones en fórmulas.
- Las teorías sin parámetros actúan como singletons (se instancian al declararse).
- Solo `let`, `axiom`, `theorem`, `fn` y `theory` pueden ser `export`ados.
