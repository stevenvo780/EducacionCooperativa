# Formalización automática

> Cómo la plataforma convierte texto natural a lógica formal ST y los componentes que lo hacen posible.

---

## Visión general

La formalización automática es el proceso por el que el contenido de la plataforma — definiciones de conceptos, fragmentos de documentos, texto libre — se transforma en código ST ejecutable sin intervención manual.

La plataforma usa la librería **`@stevenvo780/autologic`** para este proceso. Autologic soporta dos modos:

| Modo | Cómo funciona | Cuándo se usa |
|---|---|---|
| **Reglas NLP** | Marcadores discursivos + stemming + correferencia. Determinista, sin IA. | Por defecto en toda la plataforma |
| **LLM/SLM** | Extracción semántica vía OpenAI, Ollama o modelo ONNX local | Para textos complejos (legal, técnico denso) |

En ambos modos, el texto pasa primero por el **NL Linter** que detecta problemas de ambigüedad o imprecisión antes de formalizar.

---

## Arquitectura completa del flujo

```
Texto natural (concepto / fragmento / texto libre)
           │
           ▼
      NL Linter ──(errores de severidad error)──▶ Diagnóstico: abortar
           │
           ▼ (texto válido)
   ┌───────────────────────────────────────┐
   │ Modo reglas NLP       │  Modo LLM/SLM │
   │ (buildSTFromSemantic) │  (future)     │
   │  formalize()          │  formalizeWithLLM() │
   └──────────┬────────────┴───────┬───────┘
              │                    │
              ▼                    ▼
      Pipeline de 6 etapas    LLM → AST JSON → compileAST()
              │                    │
              └──────────┬─────────┘
                         ▼
               ST Generator (emitST)
                         │
                         ▼
              Validar + Ejecutar (st-lang)
                         │
                         ▼
             FormalizationResult → archivo .st companion
```

---

## Puntos de entrada en la plataforma

### 1. Mesa Semántica → archivo `.st` companion

**Archivo**: [src/lib/buildSTFromSemantic.ts](../src/lib/buildSTFromSemantic.ts)

Genera automáticamente el archivo `.st` companion cada vez que el usuario guarda cambios en la Mesa Semántica.

**API pública**:

```typescript
import { buildSTFromSemantic, companionSTName, formalizeText } from '@/lib/buildSTFromSemantic';

// Genera el .st completo desde el estado semántico
const stCode = buildSTFromSemantic(semanticState, 'MiDocumento.md');

// Nombre canónico del archivo companion
companionSTName('Mi Documento.md');  // → 'Mi_Documento.md.st'

// Preview para el modal de definición de concepto
const preview = formalizeText(
  "Si la educación es accesible, el conocimiento se democratiza.",
  'classical.propositional'
);
// → { ok: true, stCode, patterns, atomCount, formulaCount }
```

### 2. FormalizerPlayground — panel interactivo

**Archivo**: [src/components/FormalizerPlayground.tsx](../src/components/FormalizerPlayground.tsx)

Panel de formalización interactiva disponible como panel del mosaic. Permite al usuario escribir texto libre y obtener ST ejecutable en tiempo real.

**Funcionalidades**:
- Selector de los 11 perfiles lógicos disponibles
- Formalización manual (`Ctrl+Enter`) o automática con debounce 600ms (modo Auto)
- Historial de todas las formalizaciones de la sesión con métricas (átomos, fórmulas, ms)
- Ejecución del código ST generado directamente en el navegador (via `@stevenvo780/st-lang`)
- Visualización de salida ST con resaltado de sintaxis
- Inserción de snippets de formalización desde la galería del workspace
- Tabla de resumen batch cuando hay 3+ ejecuciones

**Atajos**:

| Atajo | Acción |
|---|---|
| `Ctrl+Enter` | Formalizar texto actual |
| Auto (checkbox) | Formalizar automáticamente tras 600ms de inactividad |

### 3. Modal de definición de concepto (MosaicEditor)

**Archivo**: [src/components/MosaicEditor.tsx](../src/components/MosaicEditor.tsx)

Cuando el usuario selecciona texto y define un concepto semántico, el modal muestra un **preview autologic** en tiempo real con el ST que se generaría. Si el usuario no escribe una fórmula manual, autologic genera una automáticamente al guardar.

Flujo:
1. Usuario selecciona texto → `formalizeText()` genera preview automático
2. Modal muestra: átomos, número de fórmulas, patrones detectados y código ST (primeros 600 chars)
3. Si el usuario deja el campo Fórmula vacío → `buildSTFromSemantic` formaliza automáticamente ese concepto
4. Si escribe una fórmula manual → se usa como axiom en el `.st` (respeta la intención del usuario)

---

## Estructura del archivo `.st` generado

Un archivo `.st` generado por `buildSTFromSemantic` tiene cinco secciones:

### 1. Encabezado

```st
// ═══════════════════════════════════════════════════════
// Interpretaciones ST — autologic
// Generado desde: MiDocumento.md
// Fecha: 2026-03-22
// ═══════════════════════════════════════════════════════
```

### 2. Conceptos — formalización autologic

Para cada concepto de la Mesa Semántica:

```st
// ── Conceptos (formalización autologic) ────────────────

// Concepto 1: Si la educación es accesible, el conocimiento se democratiza
logic classical.propositional

interpret "la educación es accesible" as EDUCACION_ACCESIBLE
interpret "el conocimiento se democratiza" as CONOCIMIENTO_DEMOCRATIZA

// Patrón detectado: condicional
axiom regla_1 : EDUCACION_ACCESIBLE -> CONOCIMIENTO_DEMOCRATIZA
```

Para conceptos con fórmula manual:

```st
// Concepto 2: Cooperativismo (fórmula manual del usuario)
logic classical.propositional

interpret "el cooperativismo genera cohesión" as COOPERATIVISMO
define COOPERATIVISMO_DEF = COOPERATIVISMO description "Cooperativismo..."
axiom AX_COOPERATIVISMO = ACCESO & SOLIDARIDAD -> COHESION
```

### 3. Evidencias

Fragmentos marcados como `evidence` en el workspace:

```st
// ── Evidencias ────────────────────────────────────────

// [Documento.md] "Los datos muestran que..."
interpret "Los datos muestran que..." as EV_1
```

### 4. Relaciones

Vínculos entre conceptos y fragmentos como comentarios descriptivos:

```st
// ── Relaciones ────────────────────────────────────────

// NombreConcepto ←→ "fragmento relacionado..."
```

### 5. Esqueleto de verificación

Plantilla comentada para conectar conceptos manualmente con ST:

```st
// ── Verificación (esqueleto) ──────────────────────────
// Descomenta y adapta las fórmulas para conectar conceptos.

// axiom conexion_1 = CONCEPTO_A -> CONCEPTO_B
// check valid (CONCEPTO_A -> CONCEPTO_B)
// derive CONCEPTO_C from {conexion_1}
```

---

## Fórmulas manuales vs. automáticas

| Situación | Comportamiento |
|---|---|
| Campo fórmula **vacío** | autologic formaliza el texto automáticamente con el perfil del concepto |
| Campo fórmula **con valor** | Se respeta la fórmula; se genera `interpret` + `axiom` con ella |

Escribir una fórmula manual te da control total sobre la semántica lógica, útil cuando:
- El texto es demasiado ambiguo para formalización automática
- Necesitas una fórmula más precisa que la que infiere autologic
- Quieres usar operadores avanzados (cuantificadores, modales, temporales)

---

## NL Linter

El NL Linter de autologic pre-valida el texto antes de enviarlo al motor de formalización. Detecta problemas que reducen la calidad del ST generado.

### Reglas activas

| ID | Severidad | Problema detectado | Ejemplo |
|---|---|---|---|
| `nl-anaphoric-ambiguity` | warning | Pronombres que crean ambigüedad referencial | "este caso", "lo anterior", "su resultado" |
| `nl-cognitive-density` | warning | Oraciones de más de 40 palabras | Párrafos sin puntuación interna |
| `nl-fuzzy-quantifier` | **error** | Cuantificadores vagos incompatibles con lógica exacta | "frecuentemente", "la mayoría de", "a veces", "probablemente" |
| `nl-missing-relations` | warning | Texto > 60 chars sin conectores de inferencia | Texto sin "si... entonces", "por lo tanto" |

Los diagnósticos de severidad **error** bloquean la formalización en modo LLM. En modo reglas NLP, el pipeline continúa pero el resultado puede ser de menor calidad.

### Cómo mejorar el texto si hay errores

| Error | Solución |
|---|---|
| Cuantificador difuso: "frecuentemente" | Reemplazar por "siempre", "nunca", o "en el X% de los casos" |
| Anáfora: "esto", "lo anterior" | Repetir el sujeto explícito |
| Oración muy larga | Dividir en oraciones más cortas con puntuación |
| Sin conectores | Agregar "si... entonces", "dado que", "por lo tanto" |

---

## Perfiles lógicos

Cada concepto de la Mesa Semántica puede tener un **perfil lógico** que le indica a autologic el sistema formal a usar.

| Perfil | Cuándo usarlo | Operadores principales |
|---|---|---|
| `classical.propositional` | Argumentos con conectores básicos. **Default.** | `->`, `&`, `\|`, `!` |
| `classical.first_order` | "Todo X es Y", "algún X", predicados sobre individuos | `forall x`, `exists x`, `P(x)` |
| `modal.k` | "Es necesario que...", "Es posible que..." | `[]`, `<>` |
| `deontic.standard` | "Es obligatorio...", "Está permitido...", normas legales | `O()`, `P()`, `F()` |
| `epistemic.s5` | "Se sabe que...", "Se cree que...", agentes cognitivos | `K_agente()`, `B_agente()` |
| `aristotelian.syllogistic` | "Todo A es B. X es A. Por tanto X es B." | `forall x (A(x) -> B(x))` |
| `intuitionistic.propositional` | Argumentos constructivos sin tercero excluido | sin `P \| !P` automático |
| `temporal.ltl` | "Después de...", "Hasta que...", secuencias de eventos | `next`, `until`, `G`, `F` |
| `paraconsistent.belnap` | Documentos con información contradictoria | tolera `P & !P` |
| `probabilistic.basic` | "Es probable que...", grados de certeza numérica | `Pr(X) = 0.75` |
| `arithmetic` | Proposiciones con valores numéricos | `+`, `-`, `*`, `/`, `<`, `>` |

Si no se especifica perfil, se usa `classical.propositional`.

---

## Cómo funciona el pipeline NLP internamente

### 6 etapas de procesamiento

```
1. Segmenter
   Divide el texto en oraciones (por . ; ? !) y luego cada
   oración en cláusulas por marcadores discursivos y comas.
   Preserva texto entre comillas como unidad atómica.

2. Discourse Analyzer
   Clasifica cada cláusula asignándole un rol lógico:
   premise / conclusion / condition / consequent / negation...
   Detecta negaciones, cuantificadores y modificadores modales.

3. Atom Extractor
   Convierte cada cláusula en una proposición atómica con ID.
   Ejemplo: "la calle se moja" → CALLE_MOJA
   Resolución de correferencia: "está lloviendo" = LLUEVE (70% similitud léxica)

4. Formula Builder
   Conecta átomos según el perfil y la estructura discursiva:
   condition + consequent → A -> B
   and + and  → A & B & C
   universal + predicate → forall x P(x)

5. ST Generator (emitST)
   Emite el código ST con:
   - Declaración de perfil (logic ...)
   - interpret por cada átomo
   - axiom / derive / check según el patrón detectado
   - Comentarios de trazabilidad (texto fuente, patrón)

6. Validador + Ejecutor
   validateST(): parse con st-lang — verifica sintaxis
   executeST():  ejecuta con st-lang — verifica lógica
   Los resultados se incluyen en stValidation y stExecution.
```

### Marcadores discursivos reconocidos (~200)

- **Condición**: "si", "siempre que", "en caso de que", "dado que", "cuando"
- **Conclusión**: "entonces", "por lo tanto", "luego", "en consecuencia", "ergo"
- **Premisa**: "dado que", "puesto que", "ya que", "porque", "pues"
- **Negación**: "no", "nunca", "ningún", "jamás", "sin"
- **Universal**: "todo", "todos", "cada", "cualquier", "siempre"
- **Existencial**: "algún", "existe", "hay al menos", "alguna"
- **Modal-necesidad**: "necesariamente", "debe", "obligatoriamente"
- **Modal-posibilidad**: "posiblemente", "puede", "quizás", "tal vez"
- **Temporal**: "después", "antes", "hasta que", "mientras", "desde que"

### Patrones argumentales detectados

| Patrón | Ejemplo de texto |
|---|---|
| **Modus Ponens** | "Si P entonces Q. P. Por tanto Q." |
| **Modus Tollens** | "Si P entonces Q. No Q. Por tanto no P." |
| **Silogismo Hipotético** | "Si A entonces B. Si B entonces C." |
| **Silogismo Disyuntivo** | "A o B. No A. Por tanto B." |
| **Cadena condicional** | Serie de "si... entonces..." encadenados |

---

## Sistema AST y casos complejos

Para textos con estructura lógica compleja que el pipeline NLP general no puede manejar, autologic incluye un **compiler-frontend** y un sistema **AST** que construye fórmulas directamente en código.

Casos especiales manejados:

| Patrón textual | Perfil | Fórmula generada |
|---|---|---|
| "Ningún X es Y, excepto Z" | `aristotelian` | `forall x (X(x) -> !Y(x)) & Y(Z)` |
| "Solo administradores que también son fundadores pueden..." | `classical.first_order` | `forall x ((Admin(x) & Fund(x)) -> ...)` |
| "Exactamente tres supervisores" | `classical.first_order` | `exists s1,s2,s3 (... & s1!=s2 & s1!=s3 & s2!=s3)` |
| "El CEO cree que el admin lo ignora" | `epistemic.s5` | `B_CEO(!K_Admin(P))` |
| "75.5% de probabilidad" | `probabilistic` | `Pr(X) = 0.755` |
| "No es cierto que no tengamos soluciones" | `intuitionistic` | `!!TenemosSoluciones` |

---

## Modo LLM/SLM

Para textos que superen la capacidad del NLP basado en reglas, autologic ofrece `formalizeWithLLM()`:

### Flujo doble capa

```
Texto → NL Linter → LLM/SLM → AST JSON → compileAST() → ST
```

1. **NL Linter**: valida el texto antes de enviarlo al LLM
2. **LLM/SLM**: el modelo actúa como "parser semántico AST" — no resuelve la lógica, solo extrae claims y relaciones
3. **compileAST()**: convierte el JSON del LLM a sintaxis ST válida de forma segura (sin inyección)
4. **emitST + validator**: genera el código final y lo valida con st-lang

### Proveedores disponibles

| Provider | Descripción |
|---|---|
| `openai` | API OpenAI (gpt-4o por defecto) |
| `ollama` | Servidor Ollama local con GPU (qwen2.5:7b por defecto) |
| `web-distilled` | Modelo ONNX local `stevenvo780/autologic-slm-onnx` via @huggingface/transformers |

El modelo `web-distilled` es un Qwen2.5-0.5B fine-tuneado (~2.4 GB lazy download desde HuggingFace). Permite inferencia completamente offline en el browser o Node sin API externa.

---

## DRT — resolución de correferencia avanzada

autologic incluye un módulo **DRT** (Discourse Reference Theory) para resolver pronombres anafóricos en textos con múltiples agentes:

```
"Ana aprueba el balance. Diego sabe esto. Carlos duda de lo anterior."
                                ↑                        ↑
                         → ANA_APRUEBA             → K_Diego(ANA_APRUEBA)
```

El `globalDrt` registra cada enunciado formalizado en orden (`s1`, `s2`, ...) y resuelve "esto", "lo" y "lo anterior" apuntando al último enunciado registrado. Esto es especialmente útil en textos con lógica epistémica multi-agente.

---

## Referencia técnica

### `buildSTFromSemantic(state, docName): string`

Genera el script `.st` completo desde el estado de la Mesa Semántica.

```typescript
import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
const stCode = buildSTFromSemantic(semanticState, 'Documento.md');
```

**Lógica de selección por concepto**:
1. Si `concept.formula` tiene valor → `interpret` + `axiom` manual
2. Si no → `formalize(fullText, { profile, language: 'es', atomStyle: 'keywords' })`
3. Si autologic falla o `result.ok === false` → fallback: `interpret` básico

### `companionSTName(docName): string`

```typescript
companionSTName('Mi Documento.md')  // → 'Mi_Documento.md.st'
```

### `formalizeText(text, profile?): PreviewResult`

Formaliza un texto individual para previews en la UI. Nunca lanza excepciones.

```typescript
interface PreviewResult {
  ok: boolean;
  stCode: string;
  patterns: string[];
  atomCount: number;
  formulaCount: number;
}
```

### API de autologic directa

```typescript
import { formalize, formalizeWithLLM, lintNaturalLanguage } from '@stevenvo780/autologic';
import { evaluate } from '@stevenvo780/st-lang/api';

// Formalización modo reglas
const r = formalize(text, { profile: 'classical.propositional', language: 'es' });
r.ok          // true/false
r.stCode      // código ST completo
r.analysis.detectedPatterns  // ["modus_ponens"]
r.atoms       // Map { "LLUEVE" → "llueve" }
r.stExecution?.ok            // resultado de ejecutar con st-lang

// Pre-validación de texto
const diags = lintNaturalLanguage(text);
// [{ id, severity: 'error'|'warning', message, start, end }]

// Formalización con LLM
const rLLM = await formalizeWithLLM(text, {
  profile: 'deontic.standard',
  llmConfig: { provider: 'ollama', apiKey: '', model: 'qwen2.5:7b' }
});
rLLM.linterDiagnostics  // resultado del NL Linter
rLLM.llmRawAst          // AST JSON crudo del LLM
rLLM.stCode             // código ST final

// Ejecutar ST directamente
const stResult = evaluate(r.stCode);
stResult.ok             // true
stResult.results[0].status  // "valid" | "derivable" | "satisfiable"...
```

---

## Archivos clave en la plataforma

| Archivo | Descripción |
|---|---|
| [src/lib/buildSTFromSemantic.ts](../src/lib/buildSTFromSemantic.ts) | Genera el `.st` companion completo desde la Mesa Semántica |
| [src/components/FormalizerPlayground.tsx](../src/components/FormalizerPlayground.tsx) | Panel interactivo de formalización con historial y ejecución |
| [src/components/MosaicEditor.tsx](../src/components/MosaicEditor.tsx) | Editor principal; incluye preview autologic en el modal de concepto |
| [src/services/semanticCompanionSync.ts](../src/services/semanticCompanionSync.ts) | Sincroniza el `.st` companion con Firestore |
| [src/hooks/dashboard/useDocumentActions.ts](../src/hooks/dashboard/useDocumentActions.ts) | Acciones sobre documentos que desencadenan regeneración del `.st` |

---

## Ver también

- [docs/st-prompt.md](st-prompt.md) — Referencia completa del lenguaje ST (syntax, perfiles, operadores, CLI, API)
- [autologic/readme.md](../../autologic/readme.md) — Documentación técnica completa de la librería autologic
- [autologic/DESIGN.md](../../autologic/DESIGN.md) — Diseño estructurado del motor NLP
