# Formalización automática

> Cómo la plataforma convierte texto natural a lógica formal ST sin intervención manual.

---

## Qué es

La **formalización automática** es el proceso por el que el contenido de la Mesa Semántica — definiciones de conceptos, fragmentos de documentos — se transforma en código ST ejecutable de forma automática.

La plataforma usa la librería **`@stevenvo780/autologic`** para este proceso: un motor NLP basado en reglas (sin IA) que analiza marcadores discursivos, detecta estructura argumental y produce código ST válido que el motor `@stevenvo780/st-lang` puede ejecutar.

---

## Flujo general

```
Mesa Semántica (conceptos + fragmentos)
         │
         ▼
  buildSTFromSemantic()          src/lib/buildSTFromSemantic.ts
         │
         ├── Para cada concepto con fórmula manual:
         │     interpret + axiom con la fórmula del usuario
         │
         └── Para cada concepto sin fórmula manual:
               │
               ▼
          autologic.formalize()
               │
               ├── ok → código ST con estructura argumental
               └── fallo → interpret básico (fallback)
         │
         ▼
  Archivo .st companion (guardado junto al .md)
```

El archivo `.st` generado tiene el nombre `<documento>.md.st` y se guarda en el mismo workspace que el documento markdown de origen.

---

## Componentes implicados

| Archivo | Rol |
|---|---|
| `src/lib/buildSTFromSemantic.ts` | Orquestador principal: genera el `.st` completo |
| `@stevenvo780/autologic` | Motor de formalización de texto → ST |
| `@stevenvo780/st-lang` | Parser y ejecutor de código ST |
| `src/services/semanticCompanionSync.ts` | Sincroniza el `.st` companion con Firestore |

---

## Secciones del archivo .st generado

Un archivo `.st` generado por la plataforma tiene cuatro secciones:

### 1. Encabezado

```st
// ═══════════════════════════════════════════════════════
// Interpretaciones ST — autologic
// Generado desde: MiDocumento.md
// Fecha: 2026-03-22
// ═══════════════════════════════════════════════════════
```

### 2. Conceptos (formalización autologic)

Para cada concepto de la Mesa Semántica, autologic analiza el texto y genera la estructura lógica apropiada:

```st
// ── Conceptos (formalización autologic) ────────────────

// Concepto 1: Si la educación es accesible, el conocimiento se democratiza
logic classical.propositional

interpret "la educación es accesible" as EDUCACION_ACCESIBLE
interpret "el conocimiento se democratiza" as CONOCIMIENTO_DEMOCRATIZA

// Patrón: condicional
axiom regla_1 : EDUCACION_ACCESIBLE -> CONOCIMIENTO_DEMOCRATIZA
```

### 3. Evidencias

Fragmentos marcados como `evidence` en el workspace:

```st
// ── Evidencias ────────────────────────────────────────

// [NombreDocumento] Texto del fragmento de evidencia...
interpret "Texto del fragmento de evidencia..." as EV_1
```

### 4. Relaciones

Vínculos entre conceptos y fragmentos, como comentarios descriptivos:

```st
// ── Relaciones ────────────────────────────────────────

// NombreConcepto ←→ "fragmento relacionado..."
```

### 5. Esqueleto de verificación

Plantilla comentada para conectar conceptos manualmente:

```st
// ── Verificación (esqueleto) ──────────────────────────
// Descomenta y adapta las fórmulas para conectar conceptos.

// axiom conexion_1 = CONCEPTO_A -> CONCEPTO_B
// check valid (CONCEPTO_A -> CONCEPTO_B)
// derive CONCEPTO_C from {conexion_1}
```

---

## Fórmulas manuales vs. automáticas

Los conceptos de la Mesa Semántica tienen un campo **Fórmula** opcional.

| Situación | Comportamiento |
|---|---|
| Campo fórmula **vacío** | autologic formaliza el texto automáticamente |
| Campo fórmula **con valor** | Se respeta la fórmula del usuario; se genera `interpret` + `axiom` con ella |

Ejemplo de fórmula manual:

```
Campo fórmula: LLUEVE -> CALLE_MOJADA
```

Genera:

```st
interpret "Si llueve la calle se moja" as EDUCACION_LIBRE
axiom AX_EDUCACION_LIBRE = LLUEVE -> CALLE_MOJADA
```

Esto permite al usuario precisar la formalización cuando el texto es ambiguo o cuando quiere una fórmula más elaborada.

---

## Perfiles lógicos

Cada concepto puede tener un **perfil lógico** que le indica a autologic qué tipo de lógica aplicar.

| Perfil | Cuándo usarlo |
|---|---|
| `classical.propositional` | Argumentos con conectores básicos (→, ∧, ∨, ¬). **Default.** |
| `classical.first_order` | Afirmaciones con "todo", "algún", predicados sobre individuos |
| `modal.k` | "Es necesario que...", "Es posible que..." |
| `deontic.standard` | "Es obligatorio...", "Está permitido...", normas |
| `epistemic.s5` | "Se sabe que...", "Se cree que..." |
| `aristotelian.syllogistic` | "Todo A es B. X es A. Por tanto X es B." |
| `intuitionistic.propositional` | Argumentos constructivos sin tercero excluido |
| `temporal.ltl` | "Después de...", "Hasta que..." — secuencias de eventos |
| `paraconsistent.belnap` | Documentos con información contradictoria |
| `probabilistic.basic` | "Es probable que...", grados de certeza |
| `arithmetic` | Proposiciones con valores numéricos |

Si no se especifica perfil, se usa `classical.propositional`.

---

## Cómo autologic analiza el texto

El pipeline interno de autologic tiene seis etapas:

```
1. Segmentador     Divide el texto en oraciones y cláusulas
2. Analizador      Clasifica cada cláusula: premisa, conclusión,
   discursivo      condición, consecuente
                   Detecta negaciones y cuantificadores
3. Extractor       Extrae proposiciones atómicas y les asigna IDs
   de átomos       (LLUEVE, CALLE_MOJADA)
                   Resuelve correferencias léxicas básicas
4. Constructor     Construye fórmulas ST según el perfil elegido
   de fórmulas     (A->B, forall x P(x), []A, next A...)
5. Generador ST    Emite el código ST con comentarios y trazabilidad
6. Validador       Valida y ejecuta con st-lang (opcional)
```

### Marcadores discursivos reconocidos

autologic reconoce ~200 marcadores en español e inglés:

- **Condición**: "si", "siempre que", "en caso de que", "dado que..."
- **Conclusión**: "entonces", "por lo tanto", "luego", "en consecuencia..."
- **Premisa**: "dado que", "puesto que", "ya que", "porque..."
- **Negación**: "no", "nunca", "ningún", "jamás..."
- **Universal**: "todo", "todos", "cada", "cualquier..."
- **Existencial**: "algún", "existe", "hay al menos..."
- **Modal**: "necesariamente", "posiblemente", "debe", "puede..."
- **Temporal**: "después", "antes", "hasta que", "mientras..."

### Patrones argumentales

autologic detecta automáticamente:

| Patrón | Ejemplo |
|---|---|
| **Modus Ponens** | "Si P entonces Q. P. Por tanto Q." |
| **Modus Tollens** | "Si P entonces Q. No Q. Por tanto no P." |
| **Silogismo Hipotético** | "Si A entonces B. Si B entonces C." |
| **Silogismo Disyuntivo** | "A o B. No A. Por tanto B." |
| **Cadena condicional** | Serie de condicionales encadenados |

---

## Preview de formalización

La función `formalizeText()` permite previsualizar el resultado de autologic antes de guardar. Se usa en el modal de definición de conceptos.

```typescript
import { formalizeText } from '@/lib/buildSTFromSemantic';

const preview = formalizeText(
  "Si la cooperativa es transparente, los socios confían en ella.",
  'classical.propositional'
);

// preview.ok           → true/false
// preview.stCode       → código ST generado
// preview.patterns     → ["modus_ponens", ...]
// preview.atomCount    → número de proposiciones atómicas
// preview.formulaCount → número de fórmulas generadas
```

---

## Fallback

Cuando autologic no puede formalizar un texto (texto demasiado corto, sin estructura argumental reconocible, error interno), se genera un `interpret` básico como fallback:

```st
// Concepto 3: Cooperativismo (fallback)
interpret "El cooperativismo es una forma de organización..." as COOPERATIVISMO
```

Esto garantiza que el archivo `.st` siempre se genera, aunque algunos conceptos queden como interpretaciones simples sin estructura argumental.

---

## Referencia técnica

### `buildSTFromSemantic(state, docName): string`

Genera el script `.st` completo a partir del estado de la Mesa Semántica.

```typescript
import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';

const stCode = buildSTFromSemantic(semanticState, 'MiDocumento.md');
```

### `companionSTName(docName): string`

Devuelve el nombre canónico del archivo `.st` companion para un documento markdown.

```typescript
companionSTName('Mi Documento.md')
// → 'Mi_Documento.md.st'
```

### `formalizeText(text, profile?): PreviewResult`

Formaliza un texto individual. Útil para previews en la UI.

```typescript
formalizeText("Si P entonces Q. P. Por tanto Q.", 'classical.propositional')
// → { ok: true, stCode: '...', patterns: ['modus_ponens'], atomCount: 2, formulaCount: 2 }
```

---

## Ver también

- [docs/st-prompt.md](st-prompt.md) — Referencia del lenguaje ST
- [autologic/DESIGN.md](../../autologic/DESIGN.md) — Diseño interno de autologic
- [autologic/readme.md](../../autologic/readme.md) — Documentación de la librería
- `src/lib/buildSTFromSemantic.ts` — Implementación del generador
