# Pensamiento Crítico Asistido — Visión de Producto

> **Principio rector:** El usuario nunca debería necesitar saber qué es ST.
> ST es el motor invisible — como SQL en una webapp. El usuario final no escribe SQL, pero la app lo usa por debajo para hacer cosas que sin él serían imposibles.

---

## El problema real

Los estudiantes de educación cooperativa escriben ensayos, propuestas y análisis. El problema no es que no sepan lógica formal — es que **no tienen herramientas que les digan cuándo sus argumentos se contradicen, cuándo sus conclusiones no se siguen de sus premisas, o cuándo están asumiendo algo sin darse cuenta.**

Grammarly corrige gramática. Hemingway corrige estilo. **Nadie corrige la lógica del argumento.**

Eso es lo que hacemos. Y ST es el motor que lo permite.

---

## Qué ya funciona hoy (Fase 0)

Antes de proponer algo nuevo, esto es lo que el sistema ya hace:

| Acción del usuario | Qué pasa por debajo | Resultado visible |
|---|---|---|
| Selecciona texto → "Definir Concepto" | `buildSTFromSemantic()` genera `.st` con `define` + `interpret` | El concepto aparece en Mesa Semántica |
| Agrega fórmula opcional al concepto | Se incluye como `axiom` en el `.st` companion | Cross-doc linting resalta la definición en el markdown |
| Marca selección como evidencia | Se registra en `editorSemanticStore` con fragmento + fuente | Tarjeta de evidencia en Mesa Semántica |
| Relaciona dos conceptos | Se crea relación en el store semántico | Tarjeta de relación con tipo (supports/contradicts/etc) |
| Abre Mesa Semántica | Lee todo el estado semántico del workspace | Vista con tabs: conceptos, evidencias, fijados, relaciones, archivos .st |

**El pipeline completo**: texto → selección → concepto → `.st` auto-generado → definiciones registradas → linting cruzado en markdown.

**Lo que falta**: el usuario todavía tiene que hacer todo manualmente. Tiene que saber qué seleccionar, cómo categorizar, y qué significa cada cosa. Eso es lo que las siguientes fases resuelven.

---

## Fase 1 — Detección: el sistema lee lo que escribes

### 1.1 Detector de estructura argumentativa

**Qué ve el usuario**: Mientras escribe, aparecen subrayados sutiles de colores en su texto:
- 🔵 Azul tenue: "Esto parece una premisa"
- 🟢 Verde tenue: "Esto parece una conclusión"  
- 🟡 Amarillo tenue: "Esto parece una afirmación sin soporte"

**Cómo funciona**: Un conjunto de reglas heurísticas en `useMarkdownLinter` detecta patrones de argumentación en español:
- **Indicadores de premisa**: "porque", "ya que", "dado que", "considerando que", "puesto que", "en tanto que"
- **Indicadores de conclusión**: "por lo tanto", "en consecuencia", "así que", "de esto se sigue", "podemos concluir", "esto demuestra"
- **Indicadores de afirmación sin soporte**: oraciones declarativas sin conectores causales ni referencias

**Construye sobre**: `useMarkdownLinter` (ya tiene reglas de spellcheck, estructura, links) + `LinterPlugin`/`LinterOverlay` (ya renderizan subrayados con hover).

**Delta real**: Agregar 1 nueva `LinterRule` que busca patrones regex de conectores argumentativos. ~200 líneas de código. No requiere ST para nada — es pura heurística de lenguaje natural.

**Valor**: El usuario empieza a VER la estructura de su propio argumento sin esfuerzo. Primer paso para que luego acepte sugerencias de formalización.

### 1.2 Sugerencia de conceptos automática

**Qué ve el usuario**: Cuando el detector identifica una premisa o conclusión clara, aparece un botón inline: `💡 Definir como concepto`. Un clic lo lleva al diálogo de definición de concepto que ya existe, pero **pre-llenado**.

**Cómo funciona**: El sistema:
1. Toma la oración detectada como premisa/conclusión
2. Extrae un título candidato (la frase sustantiva principal)
3. Genera una definición candidata (la oración completa)
4. Pre-selecciona un perfil lógico basado en el tipo de lenguaje usado:
   - Cuantificadores universales ("todos", "siempre", "ninguno") → `classical.first_order`
   - Obligaciones/permisos ("debe", "es obligatorio", "se permite") → `deontic.standard`
   - Posibilidad/necesidad ("es posible", "necesariamente") → `modal.k`
   - Default → `classical.propositional`

**Construye sobre**: `handleDefineConcept` + `handleConfirmDefineConcept` en MosaicEditor (ya existen). La sugerencia solo pre-llena el formulario.

**Delta real**: Agregar lógica de extracción de título/definición (~100 líneas), mapeo de keywords a logic profiles (~50 líneas), y un botón de acción en el linter overlay (~50 líneas).

---

## Fase 2 — Verificación invisible: ST trabaja mientras tú escribes

### 2.1 Verificación en segundo plano

**Qué ve el usuario**: Un indicador discreto en la barra inferior del editor:
- ✅ "Argumentos consistentes" (verde)
- ⚠️ "Posible contradicción detectada" (amarillo) 
- ❌ "Contradicción encontrada entre [X] e [Y]" (rojo)

**Cómo funciona**:
1. Cada vez que el usuario define un concepto (o acepta una sugerencia de 1.2), `buildSTFromSemantic()` ya genera el `.st` companion
2. **NUEVO**: Un `useEffect` con debounce (5 segundos después del último cambio semántico) ejecuta el `.st` companion automáticamente usando `STRunner`
3. Si el resultado contiene `UNSAT` o `INVALID` → se extrae la info del contramodelo
4. Se traduce a lenguaje natural: "Tu premisa 'la justicia requiere igualdad' contradice tu conclusión 'la libertad puede existir sin igualdad'"
5. Se muestra como toast no-intrusivo + marca en la Mesa Semántica

**Construye sobre**: `buildSTFromSemantic()` (ya genera .st completo) + `STRunner` (ya ejecuta .st) + `editorSemanticStore` (ya tiene los conceptos).

**Delta real**: 
- Hook `useBackgroundVerification` que observa cambios en semantic store, ejecuta STRunner, parsea output (~150 líneas)
- Componente `VerificationBadge` en la barra del editor (~50 líneas)
- Función `translateSTOutputToSpanish()` que convierte resultados de check a lenguaje natural (~100 líneas)

**Esto es el killer feature.** Ninguna herramienta de escritura hace esto. El usuario no necesita saber qué es ST, qué es un CDCL solver, ni qué significa UNSAT. Solo ve: "tus argumentos se contradicen aquí".

### 2.2 Sugerencias de reparación

**Qué ve el usuario**: Cuando hay contradicción, un botón "¿Cómo resolverlo?" muestra opciones:
- "Debilitar la premisa X" (cambiar `A -> B` a `A -> Possible(B)`)
- "Agregar condición a Y" (cambiar `C` a `C & Condicion`)
- "Marcar como explícitamente contradictorio" (para argumentos dialécticos donde la contradicción es intencional)

**Cómo funciona**: Quick-fixes generados a partir del contramodelo de ST. Si el solver dice que `{P1, P2} ⊢ ⊥` y el contramodelo asigna `P1=T, P2=T, Q=F`, el sistema puede sugerir agregar `Q` como condición a P2.

**Construye sobre**: El sistema de quick-fixes de `LinterOverlay` (ya existe `generateQuickFixes()`).

**Delta real**: Extender `generateQuickFixes` para contradicciones lógicas (~200 líneas). Esto es lo más complejo de la fase, pero la infraestructura ya está.

---

## Fase 3 — Visualización: tu argumento como mapa

### 3.1 Mapa de argumentos

**Qué ve el usuario**: En la Mesa Semántica, una nueva tab "Mapa" muestra un grafo interactivo:
- **Nodos** = conceptos (círculos con el título)
- **Aristas** = relaciones (supports → flecha verde, contradicts → flecha roja, relates → flecha gris)
- **Colores de nodo**: verde = verificado consistente, rojo = involucrado en contradicción, gris = sin verificar
- **Click en nodo** → resalta el texto original en el documento
- **Click en arista roja** → muestra la explicación de la contradicción

**Construye sobre**: Mesa Semántica (ya tiene conceptos + relaciones) + `editorSemanticStore` (ya tiene el estado).

**Delta real**: Un componente React con una librería de grafos ligera (dagre-d3 o react-flow, ~300 líneas). Los datos ya existen en el store — solo falta la visualización.

**Valor**: Los estudiantes ven literalmente la estructura de su argumento. "Ah, mi ensayo tiene 5 premisas pero solo 2 conectan con mi conclusión — las otras 3 están flotando."

### 3.2 Indicadores de calidad argumentativa en el linter

**Qué ve el usuario**: Nuevas reglas de linting que aparecen como sugerencias suaves:

- `ℹ️ "Este párrafo tiene 3 afirmaciones declarativas sin evidencia ni premisa de soporte"`
- `ℹ️ "Buena estructura: premisa → evidencia → conclusión"`
- `⚠️ "Esta conclusión usa 'por lo tanto' pero no hay premisas previas que la sustenten"`
- `ℹ️ "Tip: podrías conectar este párrafo con tu concepto 'Justicia Social' definido arriba"`

**Construye sobre**: `useMarkdownLinter` custom rules + detector de Fase 1.

**Delta real**: 2-3 reglas nuevas de linting (~150 líneas total). La infraestructura ya soporta reglas custom.

---

## Fase 4 — Experiencia guiada: para que empezar no dé miedo

### 4.1 Plantillas de pensamiento crítico

**Qué ve el usuario**: Al crear un nuevo documento, opción "Usar plantilla":
- **"Análisis de texto argumentativo"**: secciones pre-definidas: Tesis, Premisas, Evidencias, Contraargumentos, Conclusión. Cada sección tiene un hint de qué escribir y auto-detecta cuando el usuario llena cada parte.
- **"Comparación de posturas"**: estructura de dos columnas con relaciones `contradicts` pre-cableadas entre secciones enfrentadas.
- **"Evaluación de evidencia"**: claim → sources → strength → conclusion, con campos de confianza.

**Construye sobre**: El sistema de documentos ya soporta markdown con estructura. Las plantillas son simplemente `.md` templates con bloques semánticos pre-insertados.

**Delta real**: 3-5 archivos `.md` template + un selector en la UI de creación de documento (~100 líneas de UI).

### 4.2 Exportación académica

**Qué ve el usuario**: Botón "Exportar como ensayo" que genera un documento limpio:
- Tabla de contenidos auto-generada desde los conceptos
- Sección de bibliografía desde las evidencias y fuentes
- Glosario de términos desde las definiciones
- Apéndice formal (opcional) con el análisis lógico

**Construye sobre**: ST ya tiene `render analysis as markdown` y `render glossary as markdown/json/latex`. El store semántico ya tiene toda la estructura.

**Delta real**: Una función `exportAsAcademicEssay()` que recopila datos del store + ejecuta render de ST + genera markdown estructurado (~200 líneas).

---

## Por qué esta propuesta es diferente a la anterior

| Antes | Ahora |
|---|---|
| 14 ideas sueltas sin hilo conductor | 4 fases progresivas con dependencias claras |
| Asumía usuarios expertos en lógica formal | El usuario solo escribe texto y recibe feedback |
| Features para impresionar ("temporal logic", "epistemic maps") | Features que resuelven problemas reales (contradicciones, argumentos débiles) |
| Cada idea requería aprender ST | ST es completamente invisible al usuario |
| Esfuerzo inestimable, todo "medio-alto" | Cada fase tiene delta concreto en líneas de código |
| Sin ancla en el codebase existente | Cada feature lista exactamente qué construye sobre |

---

## Roadmap concreto

```
Fase 0 ✅  Selección manual → concepto → .st → linting cruzado
           (YA EXISTE)

Fase 1 🔜  Detección automática de argumentos + sugerencia de conceptos
           Esfuerzo: ~400 líneas · 1-2 sprints
           Dependencia: ninguna, extiende useMarkdownLinter

Fase 2 ⏳  Verificación en background + alertas de contradicción
           Esfuerzo: ~500 líneas · 2-3 sprints
           Dependencia: Fase 1 (para tener conceptos auto-definidos)

Fase 3 ⏳  Mapa visual de argumentos + indicadores de calidad
           Esfuerzo: ~450 líneas + dependencia de librería de grafos · 2 sprints
           Dependencia: Fase 2 (para tener colores de verificación)

Fase 4 ⏳  Plantillas + exportación académica
           Esfuerzo: ~300 líneas + templates · 1-2 sprints
           Dependencia: Fase 1-3 (para que las plantillas tengan valor real)
```

---

## La propuesta de valor en una oración

**"Escribe tu ensayo normalmente. La plataforma te dice dónde tus argumentos son fuertes, dónde son débiles, y dónde se contradicen — sin que tengas que aprender nada de lógica formal."**

Eso es lo que ninguna otra herramienta hace. Y ST es lo que lo hace posible.
