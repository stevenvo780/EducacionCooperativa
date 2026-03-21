# Ideas: Aprovechamiento Máximo de ST en la Plataforma

> ST no es solo un verificador lógico — es un puente entre el lenguaje natural y el razonamiento formal. Estas ideas exploran cómo explotar cada feature del lenguaje para transformar la plataforma educativa.

---

## 1. Entrelazamiento Semántico: Documentos que se Verifican entre Sí

### El concepto
Un usuario escribe en varios `.md` y genera `.st` desde cada uno. Las definiciones de un documento **pueden referenciar y verificar** afirmaciones de otro.

### Cómo funciona con ST
```st
// epistemologia.st
source Kant { author "Kant" work "Crítica de la Razón Pura" year 1781 }
define JuicioSintetico(S) := Experiencia(S) & !Analitico(S)

// etica.st  
import "epistemologia.st"
define ImperativoCategorico := forall A. (Moral(A) -> Universal(A))
interpret "El deber moral no depende de la experiencia" as ImperativoCategorico -> !JuicioSintetico(Deber)
check valid ImperativoCategorico -> !JuicioSintetico(Deber)
```

### En la plataforma
- **Grafo de dependencias entre documentos**: la Mesa Semántica muestra qué documentos importan definiciones de cuáles.
- **Verificación cruzada**: al editar un concepto en un doc, se re-verifica automáticamente en todos los docs que lo importan.
- **Vista "Constelación"**: visualización de nodos (docs) conectados por definiciones compartidas, con colores según estado de verificación (verde = consistente, rojo = conflicto detectado).

---

## 2. Debates Formalizados: Argumentos que Compiten

### El concepto
Dos o más usuarios (o el mismo en perspectivas distintas) escriben argumentos formalizados que **se contradicen**. ST puede detectar automáticamente la inconsistencia y mostrar el contramodelo.

### Cómo funciona con ST
```st
logic classical.propositional

// Posición A: utilitarista
define Util := Accion(A) & MaxBien(A) -> Correcta(A)
axiom pos_a : Util

// Posición B: deontologista  
define Deon := Accion(A) & !Deber(A) -> !Correcta(A)
axiom pos_b : Deon

// ¿Son compatibles?
check satisfiable (Util & Deon)
// Si es UNSAT → las posiciones son lógicamente incompatibles
// Si es SAT → hay un modelo donde ambas coexisten
```

### En la plataforma
- **Modo Debate**: dos paneles de editor `.md` con sus `.st` respectivos. Un panel central muestra el `check satisfiable` de la conjunción.
- **Contramodelo visual**: cuando hay conflicto, mostrar la asignación de verdad que rompe la consistencia.
- **"Espacio de acuerdo"**: variables proposicionales donde ambos coinciden (verdad compartida).
- **Tablero Kanban de argumentos**: cada claim es una tarjeta que puede ser "soportada", "refutada" o "pendiente".

---

## 3. Formalización Progresiva: Del Borrador a la Prueba

### El concepto
El usuario comienza con texto libre, va seleccionando fragmentos y formalizándolos incrementalmente. ST crece orgánicamente con el documento.

### Flujo
1. **Escritura libre**: "Creo que la justicia requiere tanto libertad como igualdad"
2. **Selección → interpret**: `interpret "la justicia requiere libertad y igualdad" as J -> (L & I)`
3. **Define**: `define Justicia := L & I`
4. **Axiom + derive**: formalizar premisas, derivar conclusiones
5. **Glossary → render**: generar documentación formal del argumento completo

### En la plataforma
- **Barra lateral de formalización**: al seleccionar texto, opciones contextuales: "Interpretar como fórmula", "Definir concepto", "Declarar fuente"
- **Progress bar de formalización**: porcentaje del documento que tiene respaldo formal (conceptos con define/interpret vs texto libre)
- **"Modo riguroso"**: resalta en gris los párrafos sin formalización, incentivando al usuario a fundamentar cada afirmación

---

## 4. Teorías como Marcos Conceptuales Reutilizables

### El concepto
Los `theory` de ST son clases instanciables. Un profesor puede crear marcos teóricos que los estudiantes instancian con sus propios datos.

### Cómo funciona con ST
```st
// El profesor publica esta teoría:
theory MarcoEtico(accion, consecuencia, agente) {
  axiom causalidad = accion -> consecuencia
  define Responsable := accion & Intencion(agente)
  
  fn evaluar() {
    check valid (Responsable -> consecuencia)
  }
}

// El estudiante la instancia:
let caso1 = MarcoEtico(Matar, Muerte, Socrates)
caso1.evaluar()

let caso2 = MarcoEtico(Mentir, Desconfianza, Politico)
caso2.evaluar()
```

### En la plataforma
- **Biblioteca de teorías**: carpeta compartida del workspace con `.st` que contienen `theory` exportadas
- **"Usar este marco"**: botón que genera un `.st` con `import` y una instanciación placeholder
- **Comparador de instancias**: tabla mostrando cómo diferentes estudiantes instanciaron el mismo marco con diferentes casos

---

## 5. Auditoría Epistemológica: Trazabilidad Total

### El concepto
Cada afirmación del documento tiene una cadena de proveniencia: fuente → interpretación → definición → axioma → derivación → verificación. ST ya tiene todo esto; solo falta conectarlo visualmente.

### Features de ST involucrados
- `source` → atribución
- `interpret` → vínculo texto ↔ fórmula  
- `define` → definición eliminable
- `axiom` → premisa explícita
- `derive` → derivación con justificación
- `check` → verificación mecánica
- `glossary` / `render analysis` → documentación automática

### En la plataforma
- **Vista "Cadena de evidencia"**: para cada conclusión, mostrar el árbol invertido hasta las fuentes originales
- **Indicador de solidez**: un score basado en cuántos eslabones de la cadena están verificados (todo verde = argumento blindado, amarillo = asunciones no verificadas, rojo = inconsistencias)
- **Export académico**: `render analysis as markdown` genera un documento publicable con formato de paper (fuentes, definiciones, pruebas)

---

## 6. Lógicas Múltiples para Perspectivas Múltiples

### El concepto
ST tiene 11 perfiles lógicos. Un mismo argumento puede ser **válido** en una lógica e **inválido** en otra. Esto es pedagógicamente riquísimo.

### Ejemplo didáctico
```st
// En lógica clásica, el tercero excluido vale:
logic classical.propositional
check valid P | !P        // VÁLIDO

// En lógica intuicionista, NO:
logic intuitionistic.propositional  
check valid P | !P        // INVÁLIDO — no hay prueba constructiva

// En lógica paraconsistente, las contradicciones no explotan:
logic paraconsistent.belnap
check valid (P & !P) -> Q // INVÁLIDO (ex falso no aplica)
```

### En la plataforma
- **"Verificar en todos los perfiles"**: botón que ejecuta el mismo `check` en los 11 perfiles y muestra una tabla comparativa
- **Panel de contraste lógico**: dos columnas con diferentes perfiles evaluando la misma fórmula, resaltando dónde divergen
- **Filtro por perfil en Mesa Semántica**: ver qué conceptos son válidos según qué lógica

---

## 7. Claims con Confianza: Argumentación Graduada

### El concepto
El text-layer de ST soporta `claim`, `support`, `confidence` y `context`. Esto permite argumentación probabilística y graduada.

### Cómo funciona
```st
logic probabilistic.basic

let p1 = passage([[estudio-clima.md#seccion-datos]])
let f1 = formalize p1 as (CO2 -> Calentamiento)

claim c1 = f1
support c1 <- p1
confidence c1 = 0.95
context c1 = "Basado en datos del IPCC 2023, correlación r=0.89"

// Derivar con grado de confianza explícito
check prob(CO2 -> Calentamiento) >= 0.9
```

### En la plataforma
- **Barra de confianza** en cada tarjeta de concepto (visual tipo termómetro)
- **Mapa de calor de confianza**: vista de documento donde los párrafos se colorean según el `confidence` de sus claims (rojo = baja, verde = alta)
- **"Desafiar claim"**: un usuario puede crear un counter-claim con su propia confianza y soporte, iniciando un debate graduado

---

## 8. Glosarios Vivos y Exportables

### El concepto
`glossary` y `render glossary as FORMAT` generan documentación viva. Cada vez que se agrega un `define`, `source` o `interpret`, el glosario se actualiza automáticamente.

### En la plataforma
- **Panel "Glosario del workspace"** en la Mesa Semántica: muestra todas las definiciones, fuentes e interpretaciones de todos los `.st` del workspace
- **Export con un clic**: `render glossary as markdown` → insertar como sección en el `.md`, `as latex` → descargar `.tex`, `as json` → API para integración externa
- **Glosario compartido**: en workspaces colaborativos, las definiciones de todos los participantes se fusionan en un glosario unificado, detectando conflictos (dos `define` con el mismo nombre pero diferente fórmula)

---

## 9. Unfold/Fold como Herramienta Pedagógica

### El concepto
`unfold` expande definiciones, `fold` las contrae. Esto es exactamente lo que un profesor hace en una clase: "expandamos esta idea" → "resumamos esto en un concepto".

### En la plataforma
- **Botón expand/collapse** en cada concepto de la Mesa Semántica: muestra la fórmula expandida o la definición compacta
- **"Modo despliegue"** del editor: al hacer hover sobre un nombre de definición en el texto, muestra inline la expansión completa
- **Ejercicio interactivo**: el profesor define conceptos complejos, el estudiante debe `fold` una fórmula expandida identificando a qué definición corresponde (gamificación)

---

## 10. Análisis Automático de Documentos

### El concepto
`render analysis as markdown` genera un documento estructurado con fuentes, definiciones, axiomas, teoremas, claims y verificaciones. Esto puede ser la **base de un paper académico autogenerado**.

### En la plataforma
- **"Generar análisis"**: botón que ejecuta `render analysis as markdown` y lo inserta como un nuevo `.md` en el workspace
- **Template de paper**: el análisis generado sigue una estructura publicable (Introducción de fuentes, Marco formal, Axiomas, Resultados, Verificación)
- **Diff de análisis**: al modificar definiciones, comparar el análisis anterior vs el nuevo para ver qué cambió en las conclusiones

---

## 11. Silogística Aristotélica como Puerta de Entrada

### El concepto
El perfil `aristotelian.syllogistic` es el más accesible para principiantes. Permite razonar con "Todo A es B", "Algún A es B", etc., sin notación simbólica compleja.

```st
logic aristotelian.syllogistic

axiom p1 = all(Humano, Mortal)
axiom p2 = all(Griego, Humano)
derive all(Griego, Mortal) from {p1, p2}  // Barbara
```

### En la plataforma
- **"Modo principiante"**: interfaz simplificada donde el usuario solo maneja cuantificadores aristotélicos
- **Diagrama de Venn** automático: para cada silogismo verificado, generar la representación visual
- **Escalera de perfiles**: empezar con aristotélico → pasar a proposicional → primer orden → modal, con cada paso desbloqueando más expresividad

---

## 12. Modal + Deontic + Epistemic para Ética y Política

### El concepto
Los perfiles modal, deóntico y epistémico permiten formalizar afirmaciones sobre obligaciones, permisos, creencias y conocimiento — exactamente lo que se discute en filosofía política y ética.

```st
logic deontic.standard
// "Es obligatorio que si prometes, cumplas"
check valid Obligatory(Promesa -> Cumplimiento)

logic epistemic.s5
// "Si sabes que P, entonces P es verdad" (axiom T)
check valid (K(agent, P) -> P)

logic modal.k
// "Es posible que haya justicia sin igualdad"
check satisfiable Possible(Justicia & !Igualdad)
```

### En la plataforma
- **Selector de "lente lógica"**: dropdown que cambia el perfil y re-evalúa todo el `.st`
- **Panel de obligaciones**: lista de todo lo que el sistema ha verificado como `Obligatory`, `Permitted`, `Forbidden`
- **Mapa epistémico**: quién sabe qué, quién cree qué, dónde hay conocimiento compartido

---

## 13. Temporal Logic para Análisis Histórico

### El concepto
El perfil `temporal.ltl` permite formalizar secuencias históricas y verificar patrones temporales.

```st
logic temporal.ltl

// "Siempre que hay revolución, eventualmente hay constitución"
check valid Always(Revolucion -> Eventually(Constitucion))

// "La democracia se mantiene hasta que hay golpe de estado"
check satisfiable (Democracia Until GolpeEstado)
```

### En la plataforma
- **Timeline formal**: línea de tiempo donde cada evento es un `passage` formalizado, y ST verifica las relaciones temporales entre ellos
- **"¿Qué pasaría si...?"**: cambiar una premisa temporal y ver cómo cambian las conclusiones (contrafactuales históricos)

---

## 14. Workspace Semántico Compartido

### Integración completa propuesta

```
┌─ Workspace Colaborativo ─────────────────────────────────────┐
│                                                               │
│  📝 Docs (.md)     ←→     🔬 Formal (.st)                    │
│  ┊ Conceptos ←──────────── define / interpret                 │
│  ┊ Evidencias ←─────────── claim + support + confidence       │
│  ┊ Fuentes ←────────────── source                             │
│  ┊ Relaciones ←─────────── derive, relate                     │
│                                                               │
│  Mesa Semántica = Vista unificada de todo lo anterior          │
│  ┊ Glosario vivo (glossary)                                   │
│  ┊ Grafo de relaciones (relations)                            │
│  ┊ Cadena de evidencia (source → interpret → check)           │
│  ┊ Score de rigurosidad (% formalizado + % verificado)        │
│                                                               │
│  Salidas:                                                     │
│  ┊ render analysis as markdown → Paper autogenerado           │
│  ┊ render glossary as latex → Exportación académica           │
│  ┊ render glossary as json → API para otras herramientas      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Prioridad Sugerida

| # | Idea | Impacto | Esfuerzo | Prioridad |
|---|------|---------|----------|-----------|
| 1 | Entrelazamiento (imports entre .st) | Alto | Medio | P0 |
| 3 | Formalización progresiva | Alto | Bajo | P0 |
| 5 | Auditoría epistemológica | Alto | Medio | P0 |
| 8 | Glosarios vivos | Alto | Bajo | P0 |
| 9 | Unfold/Fold pedagógico | Medio | Bajo | P1 |
| 6 | Contraste multi-perfil | Alto | Medio | P1 |
| 10 | Análisis auto-generado | Alto | Bajo | P1 |
| 2 | Debates formalizados | Alto | Alto | P1 |
| 4 | Teorías reutilizables | Medio | Medio | P2 |
| 7 | Claims con confianza | Medio | Medio | P2 |
| 11 | Silogística como puerta de entrada | Medio | Bajo | P2 |
| 12 | Modal/Deontic/Epistemic panels | Medio | Medio | P2 |
| 13 | Temporal para historia | Medio | Alto | P3 |
| 14 | Workspace semántico completo | Máximo | Alto | P3 (meta) |
