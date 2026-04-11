# Reporte Conceptual: ST y su Implementación en Agora

Fecha: 2026-04-11

## Alcance

Este reporte se basa en:

- Lectura del código y la documentación del repositorio.
- Revisión de la integración entre `@stevenvo780/st-lang`, `@stevenvo780/autologic` y la capa semántica de Agora.
- Verificación local con comandos reales.

## Resumen ejecutivo

Conceptualmente, la idea es buena: ST funciona como un motor formal capaz de dar a Agora algo que casi ninguna plataforma educativa ofrece, que es verificación lógica, formalización y apoyo pedagógico sobre texto real. La arquitectura también tiene una intuición correcta: editor, runtime, capa semántica y archivos `.st` companion.

Lo que está mal no es la intuición central, sino la coherencia del sistema. Hoy ST está integrado en muchas capas, pero no todas cuentan la misma historia ni obedecen el mismo contrato. El resultado es una implementación potente, pero todavía inestable como producto unificado.

## Qué está bien

### 1. La tesis de producto es fuerte

La visión de usar ST como motor invisible para pensamiento crítico y formalización es correcta. `IDEAS_ST_PLATAFORMA.md` formula bien el valor real: no enseñar lógica por enseñar lógica, sino usarla para detectar contradicciones, soportes débiles y estructura argumentativa.

Eso es importante porque le da a ST una función productiva dentro de Agora, no solo un lugar como "lenguaje curioso".

### 2. La arquitectura tiene capas bien separadas

Hay una separación conceptualmente sana entre:

- Runtime/evaluación local en navegador, vía `useSTInterpreter` con `evaluate`, `check`, `createInterpreter` y `listProfiles` ([src/hooks/useSTInterpreter.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/hooks/useSTInterpreter.ts:58)).
- Generación de archivos `.st` desde el estado semántico ([src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:145)).
- Sincronización de companions por documento, con filtrado por documento fuente ([src/services/semanticCompanionSync.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/services/semanticCompanionSync.ts:47)).
- Editor ST dedicado con lint, navegación, keymaps y fallback táctil ([src/components/editor/STCodeEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/editor/STCodeEditor.tsx:97)).

Eso muestra una implementación pensada como sistema y no como feature aislada.

### 3. Hay una decisión pragmática correcta en la UX técnica

El editor no intenta prometer "IDE completo" en todos los dispositivos. En touch/tablet cae a `textarea` nativo para priorizar estabilidad de IME y edición real ([src/components/editor/STCodeEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/editor/STCodeEditor.tsx:195)).

Ese tipo de decisión es buena ingeniería de producto: menos espectacular, más usable.

### 4. El acoplamiento con `st-lang` da valor real al editor

No es solo coloreado visual. La integración usa `symbols`, `hover`, `gotoDefinition` y completions estáticas del runtime ([src/components/editor/codemirror/st-semantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/editor/codemirror/st-semantic.ts:1), [tests/unit/st-semantic.test.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/tests/unit/st-semantic.test.ts:18)).

Eso significa que el editor sí aprovecha semántica del lenguaje, no solo tokens.

### 5. La formalización automática tiene buen criterio humano-en-el-loop

`buildSTFromSemantic()` respeta fórmulas manuales del usuario y solo formaliza automáticamente cuando no hay fórmula explícita ([src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:174)).

Eso es correcto conceptualmente: la IA o la heurística deben asistir, no reemplazar el juicio del usuario.

### 6. Sí hay disciplina de verificación, aunque hoy esté incompleta

La existencia de tests unitarios específicos para semántica ST, configuración del editor y estado semántico es una señal positiva. La ejecución local de:

```bash
npx vitest run tests/unit/st-semantic.test.ts tests/unit/st-editor-config.test.ts tests/unit/semantic-workspace-state.test.ts
```

dio `3 passed`, `11 passed`.

También existe un validador de ejemplos ST (`scripts/validate-st-docs.sh`). El hecho de que exista ya es bueno; el problema es que hoy está rojo.

## Qué está mal

### 1. ST todavía no es "invisible"; sigue siendo una superficie principal del producto

La visión de producto dice que el usuario no debería necesitar saber qué es ST, pero la app expone:

- STRunner
- archivos `.st`
- guía ST embebida
- centro documental ST
- snippets y flujo explícito de creación de archivos ST

Eso no es necesariamente malo para usuarios avanzados, pero sí contradice la tesis de invisibilidad. Hoy Agora tiene dos discursos al mismo tiempo:

- "ST es infraestructura invisible"
- "ST es una experiencia de usuario de primera clase"

Mientras ambos convivan, el producto queda conceptualmente dividido.

### 2. Hay deriva grave de versiones y de contrato entre capas

Encontré referencias cruzadas incompatibles:

- Web usa `@stevenvo780/st-lang` `^3.0.1` ([package.json](/home/operador/proyectos/humanizar/EducacionCooperativa/package.json:37)).
- Worker instala `@stevenvo780/st-lang@3.0.0` ([services/worker/Dockerfile](/home/operador/proyectos/humanizar/EducacionCooperativa/services/worker/Dockerfile:86)).
- La documentación principal fija `ST_RUNTIME_VERSION = '2.5.0'` ([src/app/docs/st/page.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/app/docs/st/page.tsx:85)).
- La guía embebida en documentos habla de `2.0.4` ([src/hooks/dashboard/useDocumentActions.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/hooks/dashboard/useDocumentActions.ts:238)).
- La guía del worker dice `ST v2.6.1` ([services/worker/entrypoint.sh](/home/operador/proyectos/humanizar/EducacionCooperativa/services/worker/entrypoint.sh:217)).

Además, localmente:

- `node_modules/.bin/st --version` devolvió `2.6.0`.
- `npm run validate:st-docs` falló en `01-clasica-proposicional.st`.
- Pero `evaluate()` desde `@stevenvo780/st-lang/api` aceptó ese mismo script sin diagnósticos fatales.

Eso es una inconsistencia conceptual seria: Agora no tiene hoy una única verdad operacional sobre "qué ST está corriendo".

### 3. El modelo semántico de Agora todavía es demasiado débil para cumplir la promesa lógica

La estructura semántica actual solo modela relaciones `related-to` ([src/lib/semantic/workspace-state.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/semantic/workspace-state.ts:39)).

Eso es insuficiente para una plataforma que quiere razonar sobre:

- soporte
- contradicción
- implicación
- evidencia
- confianza
- conclusión

Hoy la generación del `.st` companion hace esto:

- conceptos -> formalización o axioma
- evidencias -> `interpret` plano ([src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:223))
- relaciones -> comentarios, no formalización ([src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:247))
- verificación -> esqueleto comentado, no verificación automática real

Eso significa que la Mesa Semántica todavía funciona más como sistema de anotación estructurada que como grafo argumental formal.

### 4. La identidad de conceptos está mal resuelta a nivel de workspace

`registerConceptFromSelection()` deduplica conceptos solo por título normalizado dentro de todo el workspace, no por documento ni por contexto lógico ([src/services/editorSemanticStore.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/services/editorSemanticStore.ts:140)).

Eso implica que si dos documentos distintos usan el mismo título de concepto, el segundo puede sobrescribir:

- `docId`
- `docName`
- `sourceFragmentId`
- `definition`
- `logicProfile`
- `formula`

Conceptualmente esto es incorrecto. Un concepto compartido entre documentos debería ser:

- o una entidad global explícita,
- o dos conceptos distintos con mismo rótulo,
- pero no una colisión silenciosa.

Este es uno de los problemas más importantes del diseño actual.

### 5. El companion `.st` no representa todavía una teoría unificada del documento

`buildSTFromSemantic()` permite que cada concepto introduzca su propio `logic <perfil>` y luego concatena bloques ([src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:170), [src/lib/buildSTFromSemantic.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/buildSTFromSemantic.ts:198)).

Eso es útil para capturar formalizaciones locales, pero conceptualmente deja el archivo como una colección de escenas lógicas parciales, no como un modelo coherente del documento.

En otras palabras: el `.st` companion hoy es más un archivo de apoyo documental que una teoría integrada lista para verificar argumentos completos.

### 6. La capa de tooling del editor es pragmática, pero frágil

El editor usa `StreamLanguage` en vez de una gramática estructural completa ([src/components/editor/codemirror/st-language.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/editor/codemirror/st-language.ts:1)).

Eso está bien como decisión de costo/beneficio, pero limita:

- análisis sintáctico profundo
- folding realmente semántico
- recuperación robusta ante errores
- features avanzadas equivalentes al parser real

Lo mismo pasa con el registro de definiciones: extrae símbolos usando regex "ligero, sin parser" ([src/lib/st-definitions-registry.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/lib/st-definitions-registry.ts:97)).

Para un lenguaje que mezcla lógica, scripting, teoría, módulos y text layer, eso es útil como atajo, pero no es una base estable a largo plazo.

### 7. Hay deriva entre frontend y backend en la ruta LLM

El playground LLM espera `atomCount` y `formulaCount` ([src/components/FormalizerPlayground.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/FormalizerPlayground.tsx:206)), pero la API devuelve `axiomCount` y `conclusionCount` ([src/app/api/formalize-llm/route.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/app/api/formalize-llm/route.ts:88)).

Eso indica que la integración LLM no está cerrada como contrato. Puede parecer un detalle pequeño, pero conceptualmente es síntoma de algo mayor: la plataforma tiene varias narrativas sobre qué produce exactamente la formalización.

### 8. La documentación promete archivos locales que no existen

La documentación menciona:

- `ST/DOCS.md`
- `ST/QUICKSTART.md`
- `ST/README.md`

en [docs/st-prompt.md](/home/operador/proyectos/humanizar/EducacionCooperativa/docs/st-prompt.md:17), y también referencia:

- `../../autologic/readme.md`
- `../../autologic/DESIGN.md`

en [docs/formalizacion-automatica.md](/home/operador/proyectos/humanizar/EducacionCooperativa/docs/formalizacion-automatica.md:460).

Esos paths no están presentes en este repositorio. Conceptualmente, esto debilita la confiabilidad de la documentación como fuente de verdad.

### 9. Hay duplicación de lógica de sincronización

La creación y actualización de companions ST existe tanto en `MosaicEditor.tsx` como en `semanticCompanionSync.ts` ([src/components/MosaicEditor.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/components/MosaicEditor.tsx:1414), [src/services/semanticCompanionSync.ts](/home/operador/proyectos/humanizar/EducacionCooperativa/src/services/semanticCompanionSync.ts:78)).

Eso no es todavía un bug obligatorio, pero sí un riesgo arquitectónico: cuando la lógica de generación/sincronización se duplica, tarde o temprano diverge.

## Diagnóstico conceptual sobre ST como lenguaje

ST está bien pensado como lenguaje si se lo evalúa como:

- runtime pedagógico de lógica formal
- lenguaje de verificación y exploración
- puente entre razonamiento formal y documentos

ST está mal posicionado si se lo evalúa como:

- lenguaje invisible de backend completamente estable
- contrato único ya consolidado entre editor, CLI, API, docs y companions

El problema no es que ST sea demasiado expresivo. El problema es que mezcla muchas responsabilidades:

- lógica formal
- scripting
- teoría/OO
- text layer
- claims/evidencia

Eso lo vuelve muy poderoso, pero también aumenta muchísimo el costo de mantener consistencia entre runtime, editor, documentación y experiencia de usuario.

## Diagnóstico conceptual sobre ST dentro de Agora

Agora está más cerca de una buena "plataforma aumentada por ST" que de una "plataforma verdaderamente guiada por ST".

Lo que ya existe funciona bien para:

- capturar conceptos
- producir formalizaciones locales
- ejecutar scripts
- enseñar ST
- abrir camino hacia análisis argumental

Lo que todavía no existe de forma madura es:

- un modelo argumental fuerte
- una semántica de relaciones rica
- verificación automática de contradicciones a nivel de documento
- una verdad única sobre el runtime/documentación

La conclusión conceptual es esta:

ST sí aporta valor real a Agora, pero Agora aún no convirtió completamente ese valor en un sistema lógico coherente de punta a punta.

## Verificación local realizada

### Comandos ejecutados

```bash
npx vitest run tests/unit/st-semantic.test.ts tests/unit/st-editor-config.test.ts tests/unit/semantic-workspace-state.test.ts
npm run validate:st-docs
node_modules/.bin/st --version
```

### Resultado

- Tests focalizados: `3 files passed`, `11 tests passed`.
- `validate:st-docs`: falla desde `01-clasica-proposicional.st`.
- CLI `st --version`: `2.6.0`.

### Ejemplos del fallo de validación

El primer script canónico falla con errores sobre features que la propia documentación presenta como disponibles, por ejemplo:

- `define`
- `description`
- `unfold`
- `source`
- `interpret`
- `glossary`

Eso hace que la afirmación "Documentación generada y validada automáticamente contra ST v2.5.0" ([src/app/docs/st/page.tsx](/home/operador/proyectos/humanizar/EducacionCooperativa/src/app/docs/st/page.tsx:2094)) no sea confiable en el estado actual.

## Prioridades recomendadas

1. Unificar la verdad del runtime: misma versión real en web, worker, docs, guía embebida y validadores.
2. Decidir si ST será invisible para el usuario común o si será también un lenguaje expuesto; hoy el producto intenta ambas cosas a la vez.
3. Corregir el modelo de identidad de conceptos para evitar colisiones por título entre documentos.
4. Enriquecer `relationType` más allá de `related-to` y mapearlo a construcciones ST reales, no solo comentarios.
5. Convertir el `.st` companion en una teoría de documento coherente, no solo en una colección de formalizaciones locales.
6. Reducir la brecha entre tooling ligero del editor y parser/runtime real.
7. Consolidar la lógica de sincronización de companions en un solo flujo.
8. Arreglar la documentación rota o ausente antes de seguir ampliando el surface area de ST.

## Juicio final

La base conceptual es buena y vale la pena seguirla.

Lo mejor del proyecto no es ST como lenguaje aislado, sino la idea de usar ST para volver verificable la escritura académica y cooperativa.

Lo peor del proyecto no es la complejidad de ST, sino la falta de alineación entre:

- lo que ST promete,
- lo que Agora muestra,
- lo que el runtime realmente ejecuta,
- y lo que la documentación afirma.

Si se corrige esa alineación, ST puede ser una ventaja estructural real para Agora. Si no se corrige, corre el riesgo de convertirse en una pieza poderosa pero conceptualmente inestable.
