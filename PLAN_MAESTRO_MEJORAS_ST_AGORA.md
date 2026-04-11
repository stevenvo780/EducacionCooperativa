# Plan Maestro de Mejoras: ST en Agora

Fecha: 2026-04-11

## Propósito

Convertir a ST en una capacidad de primera clase dentro de Agora, sirviendo al mismo tiempo a:

- usuarios simples, que no quieren pensar en sintaxis ni en lógica formal explícita;
- usuarios avanzados, que sí quieren editar, depurar y modelar directamente en `.st`.

La meta no es esconder ST a toda costa. La meta es que ST sea:

- invisible cuando conviene,
- visible cuando aporta poder,
- y consistente en ambos casos.

## Decisión estratégica principal

ST no debe desaparecer del producto. Debe convertirse en una capa de poder progresivamente revelada.

Eso implica tres modos de uso sobre la misma base semántica:

1. `Asistido`
   El usuario trabaja con texto, conceptos, evidencias, relaciones y sugerencias.

2. `Híbrido`
   El usuario ve la proyección ST del documento, puede inspeccionarla y hacer ediciones acotadas.

3. `Experto`
   El usuario trabaja directamente sobre archivos `.st`, teorías, imports, claims y verificación.

Los tres modos deben operar sobre el mismo modelo subyacente, no sobre sistemas paralelos.

## Visión objetivo

### Para usuarios simples

- Escriben texto normal.
- Definen conceptos desde selección o sugerencia automática.
- Reciben detección de contradicciones, debilidad argumental y soporte insuficiente.
- Ven un mapa argumental y sugerencias de mejora.
- No necesitan abrir ST si no quieren.

### Para usuarios avanzados

- Pueden abrir y editar `.st` libremente.
- Pueden definir axiomas, teorías, claims, imports y verificaciones manualmente.
- Sus cambios actualizan la capa semántica de Agora.
- Tienen autocompletado, diagnósticos, navegación semántica y validación sólida.
- Pueden usar Agora como IDE semántico real para ST.

### Para el producto

- Existe una única verdad operacional del runtime.
- La documentación está generada o verificada contra esa verdad.
- La capa semántica no es solo anotación, sino un modelo argumental robusto.
- La sincronización entre UI semántica y ST es bidireccional y estable.

## Principios no negociables

### 1. Fuente única de verdad

No puede seguir habiendo versiones distintas de ST en web, worker, documentación y ejemplos. La semántica real del lenguaje debe provenir de un único contrato.

### 2. Round-trip real

Toda entidad importante debe poder:

- nacer en la UI semántica y proyectarse a ST;
- nacer en ST y proyectarse a la UI semántica.

### 3. Identidad estable

Los conceptos, claims, evidencias y relaciones no pueden depender solo del título visible. Deben tener IDs estables.

### 4. Progresive disclosure

La complejidad no desaparece; se dosifica.

### 5. Verificación por defecto

La plataforma debe verificar en segundo plano siempre que sea seguro y útil.

### 6. Documentación ejecutable

Si la documentación dice que ST soporta algo, los ejemplos y validadores deben confirmarlo.

## Problemas que este plan corrige

Este plan cubre explícitamente:

- deriva de versiones del runtime;
- contradicción entre “ST invisible” y “ST expuesto”;
- modelo semántico demasiado pobre;
- colisión de conceptos por título;
- companions `.st` como archivos parciales y no como teoría integrada;
- tooling frágil basado en regex y stream parser;
- contrato inestable entre frontend y backend en formalización LLM;
- documentación desalineada o rota;
- duplicación de lógica de sincronización.

## Matriz de cobertura del análisis

Esta sección mapea, uno por uno, los hallazgos del reporte conceptual anterior con las partes del plan que los corrigen.

| Hallazgo del análisis | ¿Está cubierto? | Dónde se cubre en este plan |
| --- | --- | --- |
| Deriva de versiones entre web, worker, docs y guías | Sí | `A. Unificación del runtime y del contrato real` |
| Contradicción entre “ST invisible” y “ST expuesto” | Sí | `Decisión estratégica principal`, `B. Experiencia dual: simple y experta` |
| Modelo semántico demasiado débil para soportar lógica real | Sí | `1. Núcleo canónico: Document Theory Graph`, `C. Modelo semántico robusto` |
| Colisión de conceptos por título a nivel workspace | Sí | `Principios no negociables -> Identidad estable`, `C. Modelo semántico robusto` |
| Companion `.st` como archivo parcial y no como teoría integrada | Sí | `E. Nuevo diseño de companions .st` |
| Tooling frágil por uso de regex y stream parser | Sí | `3. Parser/AST como base, no regex`, `F. Editor ST de nivel profesional` |
| Contrato inestable frontend/backend en la ruta LLM | Sí | `H. Formalización automática robusta` |
| Documentación que promete archivos inexistentes o desalineados | Sí | `I. Documentación y aprendizaje de primera clase` |
| Duplicación de lógica de sincronización de companions | Sí | `J. Consolidación de la sincronización` |
| Falta de round-trip serio entre UI semántica y archivos ST | Sí | `D. Round-trip ST <-> Agora` |
| Necesidad de soportar usuarios simples y avanzados a la vez | Sí | `Propósito`, `Visión objetivo`, `B. Experiencia dual: simple y experta` |
| Necesidad de que usuarios avanzados editen definiciones directamente en `.st` | Sí | `Visión objetivo -> Para usuarios avanzados`, `D. Round-trip ST <-> Agora`, `F. Editor ST de nivel profesional` |
| Ausencia de verificación automática a nivel documento/argumento | Sí | `G. Verificación automática y mapa argumental` |
| Necesidad de convertir ST en columna vertebral y no feature suelta | Sí | `Recomendación final`, roadmap completo por fases |

Conclusión de cobertura:

- Sí, el plan cubre todos los puntos principales detectados en el análisis.
- No solo los menciona: les asigna una línea de trabajo concreta.
- Lo que todavía no hace es descomponer cada línea en tareas, dueños, estimación y orden fino de ejecución. Eso sería el siguiente documento.

## Arquitectura objetivo

## 1. Núcleo canónico: Document Theory Graph

Introducir un modelo canónico intermedio para cada documento y para el workspace:

- `TheoryNode`
- `ClaimNode`
- `EvidenceNode`
- `ConceptNode`
- `RelationEdge`
- `SourceNode`
- `DefinitionNode`
- `PassageNode`

Cada nodo y arista tendrá:

- `id` estable;
- `origin` (`semantic-ui`, `st-source`, `autologic`, `llm`, `system`);
- `scope` (`document`, `workspace`, `theory-file`);
- `logicProfile`;
- `sourceRefs`;
- `updatedAt`;
- `confidence`, cuando aplique;
- metadatos de trazabilidad.

Este grafo será la base común de:

- Mesa Semántica;
- Semantic Browser;
- companions `.st`;
- verificación automática;
- búsquedas y visualizaciones.

## 2. Proyecciones sobre el núcleo

Sobre ese núcleo se generan tres vistas:

1. `Vista semántica`
   Conceptos, evidencias, relaciones, notas, claims.

2. `Vista ST`
   Código `.st` estructurado y editable.

3. `Vista pedagógica`
   Alertas, contradicciones, calidad argumental, sugerencias.

La clave es que ninguna de estas vistas sea la base aislada. La base es el grafo canónico.

## 3. Parser/AST como base, no regex

El futuro de la integración no puede descansar en:

- `StreamLanguage` para casi todo;
- extracción regex de definiciones;
- heurísticas separadas del parser real.

La evolución correcta es:

- usar parser/AST del runtime de ST como contrato semántico;
- derivar símbolos, definiciones, referencias y diagnósticos desde ese AST;
- dejar regex y stream parser como fallback transitorio, no como arquitectura final.

## Workstreams principales

## A. Unificación del runtime y del contrato real

### Objetivo

Tener una única semántica de ST en todo el sistema.

### Trabajo

1. Fijar una versión única de `@stevenvo780/st-lang` para:
   - web;
   - worker;
   - validadores;
   - documentación;
   - snippets y ejemplos.

2. Crear un módulo central `st-runtime-manifest` que exponga:
   - versión real instalada;
   - perfiles disponibles;
   - keywords soportadas;
   - features activas;
   - comandos validados.

3. Hacer que docs, guías embebidas y páginas ST consuman ese manifiesto en vez de strings hardcodeados.

4. Definir si la verdad canónica es:
   - el paquete `@stevenvo780/st-lang` y su API;
   - o el CLI generado por la misma versión.

   Recomendación:
   usar el paquete como semántica canónica y el CLI como shell de esa misma versión.

5. Crear una matriz de compatibilidad obligatoria:
   - `evaluate()` vs `st run`;
   - parser API vs editor;
   - ejemplos docs vs runtime real.

### Entregables

- versión única pinneada;
- manifiesto generado;
- eliminación de referencias 2.0.4 / 2.5.0 / 2.6.1 divergentes;
- CI que rompa si docs y runtime divergen.

## B. Experiencia dual: simple y experta

### Objetivo

Resolver la tensión conceptual actual sin sacrificar poder.

### Trabajo

1. Introducir un ajuste de workspace o usuario:
   - `Modo asistido`
   - `Modo híbrido`
   - `Modo experto`

2. En `Modo asistido`:
   - priorizar conceptos, claims, evidencias, relaciones;
   - ocultar complejidad ST por defecto;
   - mostrar resultados en lenguaje natural;
   - permitir abrir ST solo bajo acción explícita.

3. En `Modo híbrido`:
   - mostrar preview ST;
   - permitir editar bloques concretos;
   - sincronizar ida y vuelta.

4. En `Modo experto`:
   - exponer archivos `.st` como artefactos primarios;
   - habilitar flujos de edición, debugging, navegación y estructura de teorías.

5. Mantener la misma base de datos semántica y misma verificación en los tres modos.

### Regla de producto

El usuario simple nunca debe ser obligado a abrir ST.
El usuario avanzado nunca debe ser bloqueado por una UI semántica limitada.

## C. Modelo semántico robusto

### Objetivo

Pasar de una mesa de anotaciones a un modelo argumental serio.

### Trabajo

1. Reemplazar `relationType: 'related-to'` por un conjunto expresivo:
   - `supports`
   - `contradicts`
   - `implies`
   - `depends-on`
   - `defines`
   - `example-of`
   - `evidence-for`
   - `evidence-against`
   - `restates`
   - `questions`

2. Separar claramente:
   - `Concept`
   - `Claim`
   - `Evidence`
   - `Definition`
   - `Source`
   - `Passage`

3. Añadir propiedades de razonamiento:
   - `confidence`
   - `context`
   - `logicProfile`
   - `status` (`draft`, `validated`, `contradicted`, `unsupported`)

4. Definir identidad por ID estable, no por título.

5. Permitir:
   - conceptos locales por documento;
   - conceptos globales de workspace;
   - enlaces explícitos entre ambos.

### Resultado esperado

El modelo deja de ser “fragmentos relacionados” y pasa a ser “grafo argumental verificable”.

## D. Round-trip ST <-> Agora

### Objetivo

Hacer que editar ST directamente sea una capacidad central y segura.

### Trabajo

1. Diseñar un pipeline `ST source -> parse -> AST -> Theory Graph`.

2. Diseñar el inverso `Theory Graph -> AST -> pretty print ST`.

3. Introducir IDs estables en ST para round-trip. Opciones:
   - comentarios estructurados;
   - atributos/metadatos del AST;
   - bloques anotados.

4. Reemplazar la extracción regex de definiciones por indexación basada en AST.

5. Cuando el usuario edite un `.st`:
   - parsear;
   - actualizar Semantic Browser;
   - mantener referencias a conceptos, claims y evidencias;
   - no destruir metadatos manuales.

6. Cuando el usuario edite desde la UI semántica:
   - regenerar el AST;
   - escribir ST estable;
   - preservar formato razonable y comentarios del usuario donde sea posible.

### Estrategia por etapas

#### Etapa 1

Companion editable con:

- bloque gestionado por sistema;
- bloque libre de usuario;
- sincronización parcial.

#### Etapa 2

Round-trip por AST para definiciones, claims, relaciones y evidencias estructuradas.

#### Etapa 3

Round-trip completo de primera clase, sin depender de zonas “protegidas”.

## E. Nuevo diseño de companions `.st`

### Objetivo

Que el `.st` companion deje de ser un dump auxiliar y se convierta en la teoría viva del documento.

### Trabajo

1. Rediseñar el companion por documento con secciones explícitas:
   - `profile`
   - `imports`
   - `definitions`
   - `claims`
   - `evidence`
   - `relations`
   - `checks`
   - `user extensions`

2. Separar:
   - teoría derivada automáticamente;
   - teoría escrita manualmente por el usuario;
   - checks generados por el sistema;
   - checks escritos por el usuario.

3. Permitir que un documento tenga:
   - un companion principal;
   - y, opcionalmente, archivos ST adicionales ligados al mismo workspace.

4. Añadir una teoría de workspace opcional para conceptos transversales.

### Resultado esperado

El archivo `.st` ya no es un artefacto secundario. Es una proyección operativa de la teoría del documento.

## F. Editor ST de nivel profesional

### Objetivo

Llevar la experiencia de edición a nivel de producto serio.

### Trabajo

1. Sustituir progresivamente el soporte basado en stream parser por uno respaldado por parser real o protocolo del runtime.

2. Unificar:
   - lint;
   - hover;
   - go-to-definition;
   - symbols;
   - folding;
   - autocompletado;
   - rename/refactor semántico.

3. Añadir:
   - outline del archivo;
   - panel de referencias;
   - navegación entre teorías e imports;
   - warnings por shadowing, nombres duplicados y perfiles inconsistentes.

4. Mantener fallback táctil estable, pero con diagnósticos equivalentes siempre que sea posible.

5. Mover parsing y análisis pesado a worker cuando haga falta.

### Criterio

Un usuario experto debe sentir que Agora respeta ST como lenguaje serio, no como textarea mejorado.

## G. Verificación automática y mapa argumental

### Objetivo

Cumplir la promesa más fuerte del producto.

### Trabajo

1. Introducir verificación en segundo plano con debounce.

2. Detectar:
   - contradicciones;
   - claims sin soporte;
   - evidencias huérfanas;
   - conceptos no conectados;
   - perfiles lógicos incompatibles dentro de una misma teoría.

3. Traducir resultados del runtime a mensajes pedagógicos comprensibles.

4. Añadir quick fixes:
   - debilitar claim;
   - agregar condición;
   - marcar tensión dialéctica intencional;
   - vincular evidencia faltante.

5. Crear mapa argumental visual:
   - nodos por claim/concepto/evidencia;
   - aristas por soporte/contradicción/implicación;
   - colores por estado de verificación.

### Resultado esperado

Agora deja de ser solo un editor con ST integrado y pasa a ser una herramienta real de análisis argumental.

## H. Formalización automática robusta

### Objetivo

Que NLP y LLM sean útiles sin romper la coherencia del sistema.

### Trabajo

1. Versionar el contrato de la API de formalización.

2. Unificar el payload de resultados:
   - `stCode`
   - `ast`
   - `linterDiagnostics`
   - `diagnostics`
   - `atomCount`
   - `formulaCount`
   - `claimCount`
   - `confidence`
   - `engine`

3. Hacer que frontend y backend consuman exactamente el mismo schema.

4. Guardar trazabilidad:
   - qué fue inferido por reglas;
   - qué vino del LLM;
   - qué corrigió el usuario.

5. Permitir que el usuario acepte, edite o descarte la formalización.

6. Integrar el resultado directamente al Theory Graph.

### Regla

Autologic y LLM deben producir material revisable, no mutaciones mágicas y opacas.

## I. Documentación y aprendizaje de primera clase

### Objetivo

Tener documentación confiable, útil y alineada con el runtime real.

### Trabajo

1. Eliminar referencias a archivos que no existen o moverlos al repo si son obligatorios.

2. Separar documentación en dos recorridos:
   - `Aprender con Agora`
   - `Dominar ST`

3. Generar automáticamente:
   - lista de perfiles;
   - versión real;
   - tabla de comandos;
   - ejemplos canónicos.

4. Hacer que todos los ejemplos de docs corran en CI.

5. Añadir documentación específica sobre:
   - editar directamente companions `.st`;
   - sincronización entre ST y Mesa Semántica;
   - límites del round-trip;
   - conflictos y resolución.

## J. Consolidación de la sincronización

### Objetivo

Eliminar duplicaciones y estados inconsistentes.

### Trabajo

1. Centralizar toda generación y sincronización de companions en un único servicio.

2. Hacer que `MosaicEditor`, `GlobalSemanticBrowser` y cualquier otra superficie usen ese servicio.

3. Definir un pipeline único:
   - mutación semántica;
   - persistencia;
   - proyección a Theory Graph;
   - proyección a ST;
   - indexación;
   - notificación de cambios.

4. Añadir control de conflictos y logs de sincronización.

### Resultado esperado

No más lógica duplicada de creación/actualización de `.st`.

## Roadmap recomendado

## Fase 0. Fundamento de verdad

### Objetivo

Detener la deriva.

### Entregables

- versión única ST;
- runtime manifest;
- docs alineadas;
- `validate:st-docs` en verde;
- eliminación de hardcodes de versión.

## Fase 1. Rediseño del modelo semántico

### Objetivo

Construir la base que hoy falta.

### Entregables

- nuevos tipos de nodo y relación;
- IDs estables;
- conceptos por documento y por workspace;
- migración de datos existente.

## Fase 2. Companion rediseñado y sincronización única

### Objetivo

Hacer que ST y Agora dejen de ser capas desacopladas.

### Entregables

- servicio único de sync;
- nuevo formato de companion;
- user zone + managed zone;
- indexación unificada.

## Fase 3. Parser/AST y round-trip parcial

### Objetivo

Dar el salto de tooling frágil a integración semántica seria.

### Entregables

- parser-backed definitions index;
- símbolos y diagnósticos desde AST;
- sync ST -> Semantic Browser para definiciones y claims.

## Fase 4. Experiencia dual completa

### Objetivo

Resolver la UX para simples y expertos.

### Entregables

- modos asistido/híbrido/experto;
- UI específica por modo;
- onboarding diferenciado;
- acceso directo a `.st` para expertos.

## Fase 5. Verificación y mapa argumental

### Objetivo

Entregar la ventaja competitiva principal.

### Entregables

- verificación en segundo plano;
- traducción pedagógica de resultados;
- quick fixes;
- mapa argumental.

## Fase 6. Round-trip avanzado y producto de primera

### Objetivo

Cerrar la promesa completa.

### Entregables

- edición directa de `.st` con proyección estable a la UI;
- refactors semánticos;
- imports y teorías multiarchivo;
- documentación ejecutable completa;
- métricas de calidad y observabilidad.

## Criterios de aceptación del estado final

El producto se considerará “de primera” cuando cumpla todo esto:

1. Un usuario simple puede escribir un ensayo y recibir feedback lógico útil sin abrir ST.
2. Un usuario avanzado puede modelar directamente en `.st` sin sentir que la plataforma le estorba.
3. Editar una definición en ST actualiza la UI semántica.
4. Editar una definición en la UI actualiza ST sin destruir identidad ni referencias.
5. Dos documentos con conceptos del mismo nombre no colisionan.
6. El runtime, los workers, la documentación y los ejemplos usan una misma verdad verificable.
7. Los companions `.st` son útiles por sí mismos como teorías vivas.
8. Los ejemplos de documentación ejecutan en CI.
9. La ruta de formalización NLP/LLM tiene contrato estable.
10. El mapa argumental y la verificación automática funcionan sobre el mismo modelo semántico que el editor.

## Riesgos duros

### 1. Complejidad de round-trip

Es el problema más caro del plan. Si se hace mal, destruye confianza.

Mitigación:

- hacerlo por AST;
- introducirlo por etapas;
- preservar zonas manuales hasta que el round-trip sea robusto.

### 2. Complejidad del lenguaje ST

ST mezcla lógica, scripting, teorías y text layer. No todo será fácil de proyectar a UI semántica.

Mitigación:

- definir un subconjunto “semánticamente proyectable”;
- marcar explícitamente lo que queda en modo experto puro.

### 3. Costo de tooling

Pasar de regex/stream parser a parser real es trabajo serio.

Mitigación:

- priorizar primero definiciones, claims, theories e imports;
- mover lo demás por iteraciones.

## Recomendación final

No intentar arreglar ST en Agora con parches aislados.

La estrategia correcta es asumir que ST ya no es un feature, sino una columna vertebral del producto. Eso obliga a:

- rediseñar el modelo;
- unificar el runtime;
- profesionalizar el editor;
- y aceptar que la experiencia simple y la avanzada deben convivir sobre una misma base.

Si este plan se ejecuta completo, Agora puede convertirse en algo raro y valioso:

- una plataforma donde cualquiera puede mejorar la calidad lógica de su escritura;
- y donde usuarios avanzados pueden trabajar directamente con teorías ST reales sin salir del producto.
