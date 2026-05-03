# Proyecto desde el diseño — Agora / Educación Cooperativa

**Fecha:** 2026-05-03  
**Producto revisado:** Agora / Educación Cooperativa  
**Objetivo:** responder, desde el diseño de producto, las preguntas de Product Discovery, UX Research y definición de MVP para una plataforma que ayuda a pasar de ideas ambiguas a conocimiento formal verificable.

## Nota de alcance y rigor

Este documento se basa en una revisión del proyecto existente: `README.md`, `CLAUDE.md`, `docs/formalizacion-automatica.md`, `docs/st-prompt.md`, `docs/01-clasica-proposicional.md`, `docs/13-fase-final-validation-2026-04-30.md`, la landing en `src/app/page.tsx`, el manual en `src/app/docs/page.tsx`, y componentes clave como `MosaicEditor`, `FormalizerPlayground`, `SemanticWorkbench`, `STRunner`, `AgoraAIChat`, `MosaicLayout` y `FileExplorer`.

No se realizaron entrevistas reales con usuarios externos durante esta revisión. En la sección de entrevistas se incluyen **proto-entrevistas simuladas** para orientar investigación futura; no deben presentarse como evidencia empírica validada.

---

# FASE 1 — Entender el producto

## 1. Definir el problema

### Pregunta central del producto

¿Cómo hago que alguien pase de escribir ideas ambiguas a construir conocimiento formal verificable sin fricción?

### ¿Qué dolor resuelve?

Agora resuelve el dolor de investigadores, docentes y estudiantes que producen conocimiento argumentativo pero trabajan con herramientas separadas: escriben en un editor, razonan en papel, formalizan en otra herramienta, colaboran en otra, versionan con Git o carpetas manuales, y validan argumentos de forma informal o tardía.

El dolor no es solo “escribir documentos”. El dolor real es que una idea académica suele empezar como prosa ambigua y, para volverse conocimiento verificable, necesita pasar por varias transformaciones:

1. Clarificar el lenguaje natural.
2. Detectar ambigüedades, vaguedad y premisas ocultas.
3. Separar conceptos, claims, evidencias y relaciones.
4. Traducir lo relevante a una forma lógica.
5. Verificar si la estructura es válida, satisfacible o refutable.
6. Mantener trazabilidad entre el texto original y su formalización.
7. Colaborar sin romper versiones ni perder contexto.
8. Exportar o publicar el resultado de forma académica.

Hoy ese flujo es demasiado fragmentado. Agora intenta convertirlo en un único entorno de trabajo: Markdown académico, lógica ST, formalización automática, linter, mesa semántica, ejecución verificable, colaboración, archivos, Git, IA y terminal.

### Problema principal

El problema principal es que **la producción académica rigurosa no tiene una interfaz continua entre pensamiento natural, escritura, estructura argumental y verificación formal**.

Dicho de forma más concreta:

> Las personas pueden escribir ideas complejas, pero no tienen una forma fluida de convertir esas ideas en conocimiento formalmente inspeccionable, verificable, colaborativo y reproducible.

En consecuencia, mucha investigación queda atrapada en documentos hermosos pero no auditables: textos con argumentos plausibles, citas y diagramas, pero sin una capa formal que permita comprobar qué se está afirmando, qué premisas lo sostienen, qué evidencia falta y qué inferencias son válidas.

### Consecuencias del problema

- **Ambigüedad acumulada:** las ideas nacen vagas y permanecen vagas porque no hay una herramienta que obligue suavemente a precisar conceptos, premisas y relaciones.
- **Validación tardía:** los errores argumentales aparecen al final, cuando el artículo, tesis o clase ya está avanzado.
- **Pérdida de trazabilidad:** se separa la afirmación escrita de la razón formal que la justifica.
- **Colaboración frágil:** los equipos discuten versiones de documentos, no estructuras argumentales compartidas.
- **Aprendizaje lento de lógica formal:** los estudiantes enfrentan sintaxis y teoría a la vez, sin puente gradual desde la prosa.
- **Dependencia excesiva de revisión humana:** profesores, revisores o directores deben detectar manualmente inconsistencias, falacias, mala citación y falta de evidencia.
- **Herramientas inconexas:** Notion, Obsidian, Overleaf, Google Docs, proof assistants, Git, terminales y LLMs operan como piezas sueltas.
- **Baja reproducibilidad académica:** es difícil reconstruir cómo una idea pasó de intuición a tesis, de tesis a fórmula, y de fórmula a verificación.

### Por qué las soluciones actuales fallan

Las soluciones actuales suelen resolver un fragmento del flujo, no el flujo completo.

- **Procesadores de texto y Google Docs:** colaboran bien y son fáciles de usar, pero no entienden estructura lógica, inferencia, formalización ni validez.
- **Notion / Obsidian / Logseq / Roam:** organizan conocimiento y enlaces, pero no verifican argumentos formalmente ni ejecutan lógica.
- **Overleaf / LaTeX:** produce documentos académicos excelentes, pero la verificación de argumentos queda fuera del documento y requiere alta fricción técnica.
- **Proof assistants como Lean, Coq o Isabelle:** ofrecen rigor fuerte, pero están diseñados para usuarios técnicos; no son una experiencia natural de escritura académica ni de discovery filosófico.
- **LLMs genéricos:** ayudan a redactar y sugerir formalizaciones, pero pueden alucinar, no garantizan validez, no preservan trazabilidad y no integran ejecución formal por defecto.
- **Git puro:** versiona cambios, pero no ofrece una experiencia académica amigable ni comprende conceptos, evidencias o claims.
- **Editores Markdown tradicionales:** son rápidos para escribir, pero no agregan una capa semántica verificable.

La falla común es que obligan al usuario a cambiar de contexto: escribir aquí, formalizar allá, verificar en otra herramienta, colaborar por otro canal y exportar con otra cadena de herramientas.

### Qué oportunidad existe

Existe una oportunidad clara para crear una nueva categoría de producto:

> **Un entorno de investigación formal asistida**, donde escribir, formalizar, verificar, colaborar y publicar sean partes de una sola experiencia.

La oportunidad es especialmente fuerte porque Agora ya tiene varios activos diferenciales implementados:

- Lenguaje ST ejecutable con perfiles lógicos múltiples.
- Formalizador de lenguaje natural a ST.
- Linter académico y linter de lenguaje natural.
- Mesa semántica con conceptos, evidencias y relaciones.
- Editor Markdown con KaTeX, Mermaid, tablas, snippets y preview.
- Workspaces personales y compartidos.
- Git por workspace mediante Forgejo.
- IA contextual con acceso al workspace.
- Terminales cloud y workers Docker para usuarios avanzados.

La oportunidad de diseño consiste en reducir la fricción para que el usuario no sienta que está “programando lógica”, sino que está **pensando mejor con una herramienta que lo acompaña desde la intuición hasta la verificación**.

---

## 2. Definir usuarios reales

### Tipo de usuario principal

El usuario principal no es cualquier usuario de notas. Es alguien que trabaja con argumentos, teorías, definiciones o demostraciones, y necesita aumentar el rigor sin abandonar la escritura.

#### Segmentos principales

| Segmento | Qué hacen | Cómo trabajan hoy | Herramientas que usan | Qué odian de esas herramientas | Qué necesitan urgentemente |
| --- | --- | --- | --- | --- | --- |
| Filósofos analíticos | Construyen argumentos, distinguen conceptos, analizan tesis, preparan papers y seminarios. | Escriben en Word, Google Docs, LaTeX, Markdown u Obsidian; validan argumentos mentalmente o en discusión. | Word, Google Docs, Obsidian, Zotero, Overleaf, PDFs anotados. | Que la prosa no obligue a explicitar premisas; que los mapas de ideas no validen inferencias; que formalizar sea una tarea separada. | Un editor donde puedan pasar de prosa a claims, conceptos y fórmulas verificables sin salir del texto. |
| Investigadores en lógica | Desarrollan sistemas, prueban propiedades, enseñan reglas, preparan ejemplos y talleres. | Usan editores de código, LaTeX, scripts, proof assistants o herramientas propias. | VS Code, LaTeX, Lean/Coq/Isabelle, Python, repos Git. | La distancia entre un texto pedagógico y una prueba ejecutable; la mala UX de herramientas formales para estudiantes. | Un entorno didáctico donde ST, texto, explicación, tabla de verdad, contramodelo y prueba convivan. |
| Estudiantes de maestría/doctorado | Escriben tesis, artículos, estados del arte y argumentos largos. | Mezclan apuntes, borradores, PDFs, citas, comentarios del tutor y versiones de archivos. | Google Docs, Word, Overleaf, Zotero, Notion, Obsidian. | Perder versiones; no saber si su argumento es sólido; no encontrar evidencia; aprender lógica como barrera adicional. | Un flujo guiado que los ayude a detectar ambigüedad, marcar evidencia, formalizar y recibir diagnósticos comprensibles. |
| Científicos formales | Definen modelos, axiomas, hipótesis, inferencias y validaciones reproducibles. | Separan paper, código, notebooks, repos y documentación. | LaTeX, Jupyter, GitHub, Python, VS Code, Overleaf. | Que los resultados formales no estén conectados a la narrativa; que reproducir un razonamiento sea costoso. | Un workspace donde documento, fórmulas, scripts y ejecución sean auditables desde un mismo lugar. |
| Profesores universitarios | Preparan clases, talleres, materiales verificables y retroalimentación. | Crean PDFs, diapositivas, ejercicios en documentos separados y corrigen manualmente. | PowerPoint, PDF, Moodle, Overleaf, Google Classroom, editores online. | Corregir lo mismo muchas veces; explicar lógica sin feedback interactivo; que estudiantes no puedan experimentar. | Un laboratorio en navegador para escribir, formalizar, ejecutar y mostrar errores/contraejemplos en vivo. |

### Tipo de usuario secundario

El usuario secundario aparece cuando el trabajo deja de ser individual y se vuelve revisión, colaboración o debate.

#### Segmentos secundarios

| Segmento | Qué hacen | Cómo trabajan hoy | Herramientas que usan | Qué odian de esas herramientas | Qué necesitan urgentemente |
| --- | --- | --- | --- | --- | --- |
| Equipos de investigación | Coescriben documentos, reparten tareas, organizan archivos, versionan avances y discuten tesis. | Comparten carpetas, documentos en la nube, chats, tableros y repos. | Google Drive, Slack/WhatsApp, Trello, Notion, GitHub, Overleaf. | La duplicación de archivos; la pérdida de contexto; permisos pobres; que las tareas no estén ligadas al texto. | Workspaces con documentos, tareas, evidencias, Git, historial y miembros en un solo lugar. |
| Grupos de debate formal | Discuten argumentos, contraargumentos, falacias, definiciones y consistencia. | Usan foros, documentos compartidos o sesiones en vivo sin estructura formal persistente. | Discord, Google Docs, pizarras, Obsidian compartido. | Que el debate se vuelva retórico y no formal; que no quede registro verificable de claims y refutaciones. | Un mapa de argumentos con relaciones como soporta, contradice, implica, depende de, evidencia para/en contra. |
| Revisores académicos | Evalúan claridad, validez, citas, consistencia y trazabilidad de artículos o tesis. | Revisan PDFs, Word con comentarios, checklists y bibliografía manualmente. | Word comments, PDF annotations, Zotero, email, gestores editoriales. | La revisión tardía; no poder inspeccionar fácilmente premisas, evidencia o formalización. | Una vista de problemas, claims huérfanos, evidencia faltante, citas sospechosas y formalizaciones ejecutables. |

### Hipótesis de usuario principal más fuerte

El usuario inicial más valioso para el MVP parece ser:

> Estudiante de posgrado o docente/investigador en filosofía analítica, lógica o teoría formal que ya escribe textos complejos, tolera Markdown y desea convertir argumentos en estructuras verificables sin adoptar un proof assistant pesado.

Esta persona entiende el valor del rigor, pero necesita una interfaz menos intimidante que Lean/Coq y más formal que Notion/Obsidian.

---

## 3. Benchmark competitivo

**No se responde este punto por instrucción explícita del pedido.**

Se deja constancia de que el benchmark contra Notion, Obsidian, Overleaf, Roam Research, Typst y Logseq queda fuera de este documento.

---

# FASE 2 — UX Research

## 4. Entrevistas

### Nota metodológica

No se hicieron cinco entrevistas reales durante esta revisión. Para no fabricar evidencia, esta sección presenta **cinco proto-entrevistas simuladas**. Sirven como hipótesis para orientar entrevistas reales, pruebas de usabilidad y validación de mercado.

Las preguntas usadas son:

1. ¿Cómo escribes trabajos académicos?
2. ¿Cómo validas argumentos?
3. ¿Usas Markdown?
4. ¿Usas lógica formal?
5. ¿Qué parte te frustra más?
6. ¿Cómo colaboras con otros?
7. ¿Qué sería una solución ideal?

### Entrevista 1 — Laura, 29, doctoranda en filosofía analítica

- **¿Cómo escribes trabajos académicos?** Empieza en notas sueltas, luego pasa a un documento largo en Word o Google Docs. Usa Zotero para bibliografía y PDFs anotados.
- **¿Cómo validas argumentos?** Relee, dibuja esquemas a mano y discute con su director. No tiene una herramienta que le diga si una inferencia está mal.
- **¿Usas Markdown?** Lo conoce por Obsidian, pero no lo usa para entregables finales.
- **¿Usas lógica formal?** Sí, pero más para clases y análisis puntual que para escribir la tesis completa.
- **¿Qué parte te frustra más?** Perder de vista premisas implícitas y no saber si un argumento sigue siendo válido después de reescribirlo.
- **¿Cómo colaboras con otros?** Google Docs, comentarios y reuniones.
- **¿Qué sería una solución ideal?** Un editor donde pueda escribir normalmente, seleccionar una tesis, verla como argumento formal, detectar huecos y volver al texto sin cambiar de herramienta.

### Entrevista 2 — Andrés, 41, investigador en lógica

- **¿Cómo escribes trabajos académicos?** Usa LaTeX y repos Git. Los ejemplos formales los mantiene como archivos separados.
- **¿Cómo validas argumentos?** Con scripts, tablas, pruebas manuales y revisión de colegas.
- **¿Usas Markdown?** Sí para notas, documentación y borradores rápidos.
- **¿Usas lógica formal?** Sí, a diario. Le interesa tener perfiles distintos: proposicional, primer orden, modal, deóntico, paraconsistente.
- **¿Qué parte te frustra más?** Que enseñar lógica requiere saltar entre PDF, pizarra, editor y consola.
- **¿Cómo colaboras con otros?** Git, Overleaf y correo.
- **¿Qué sería una solución ideal?** Un laboratorio donde el texto pedagógico y la prueba ejecutable sean la misma unidad de trabajo.

### Entrevista 3 — Mariana, 36, profesora universitaria

- **¿Cómo escribes trabajos académicos?** Prepara guías en Word/LaTeX y diapositivas. Para clases prácticas usa documentos separados.
- **¿Cómo validas argumentos?** Ella los revisa manualmente; los estudiantes reciben feedback después.
- **¿Usas Markdown?** Poco. Le atrae si la interfaz visual no exige ver sintaxis todo el tiempo.
- **¿Usas lógica formal?** Sí, para enseñar, pero evita herramientas demasiado técnicas porque asustan al estudiante.
- **¿Qué parte te frustra más?** Corregir ejercicios repetitivos y no poder mostrar contraejemplos instantáneamente en clase.
- **¿Cómo colaboras con otros?** Drive, LMS institucional, correo y reuniones.
- **¿Qué sería una solución ideal?** Una plataforma de clase donde el estudiante escriba un argumento, lo formalice con ayuda y vea si funciona.

### Entrevista 4 — Mateo, 27, estudiante de maestría en ciencia formal/computación

- **¿Cómo escribes trabajos académicos?** Usa Markdown, VS Code, Jupyter y Git. Exporta a PDF cuando necesita entregar.
- **¿Cómo validas argumentos?** Ejecuta código o pruebas pequeñas, pero la conexión con la explicación escrita queda manual.
- **¿Usas Markdown?** Sí, todos los días.
- **¿Usas lógica formal?** Sí, pero no siempre en un proof assistant; a veces le basta una lógica más ligera y explicable.
- **¿Qué parte te frustra más?** Mantener sincronizados documento, código, resultados y repositorio.
- **¿Cómo colaboras con otros?** GitHub, issues, pull requests y chats.
- **¿Qué sería una solución ideal?** Un workspace que combine editor, terminal, Git, lógica y archivos sin configuración local.

### Entrevista 5 — Equipo de seminario de argumentación normativa

- **¿Cómo escriben trabajos académicos?** Cada integrante trae notas y luego se consolidan en un documento común.
- **¿Cómo validan argumentos?** En discusión oral; a veces alguien dibuja mapas de argumentos o tablas.
- **¿Usan Markdown?** Algunos sí, otros no.
- **¿Usan lógica formal?** Solo los miembros más técnicos. El resto entiende la necesidad, pero no quiere escribir fórmulas desde cero.
- **¿Qué parte les frustra más?** Que el debate se dispersa, se repiten puntos y no queda claro qué evidencia soporta cada claim.
- **¿Cómo colaboran con otros?** Reuniones, Drive, WhatsApp/Telegram, documentos compartidos.
- **¿Qué sería una solución ideal?** Un espacio compartido donde se pueda convertir una discusión en conceptos, claims, relaciones, tareas y un documento final verificable.

### Patrones comunes detectados en estas proto-entrevistas

- El usuario quiere escribir en prosa, no empezar desde sintaxis formal.
- La verificación debe aparecer como ayuda, no como castigo.
- La trazabilidad entre texto y fórmula es más importante que la automatización pura.
- La colaboración necesita objetos académicos: claims, evidencias, conceptos, no solo comentarios.
- Markdown es aceptable si hay una interfaz visual y ejemplos.
- La lógica formal debe tener una ruta pedagógica progresiva.
- El usuario ideal no quiere otro “bloc de notas”; quiere una estación de investigación.

---

## 5. User Persona

### Persona 1 — Laura, estudiante de doctorado en filosofía analítica

- **Edad:** 29
- **Contexto:** escribe tesis sobre teoría de la acción y normatividad.
- **Objetivos:** producir argumentos claros, defender tesis, evitar ambigüedades, responder objeciones del director.
- **Frustraciones:** no sabe cuándo una reformulación altera la estructura lógica; pierde evidencia entre PDFs; teme que el argumento parezca sólido pero tenga una premisa oculta.
- **Herramientas actuales:** Google Docs, Zotero, Obsidian, PDFs anotados, Word.
- **Motivaciones:** mejorar la calidad de su tesis y trabajar con más seguridad argumental.
- **Barreras:** miedo a que la plataforma sea demasiado técnica; curva de aprendizaje de ST; necesidad de exportar en formatos académicos.

### Persona 2 — Andrés, investigador en lógica

- **Edad:** 41
- **Contexto:** publica y enseña lógica formal, trabaja con ejemplos, talleres y sistemas.
- **Objetivos:** crear materiales verificables, probar reglas, comparar perfiles lógicos, enseñar con ejemplos vivos.
- **Frustraciones:** separar teoría, ejemplos, ejecución y documento final; herramientas formales potentes pero poco pedagógicas.
- **Herramientas actuales:** LaTeX, Git, VS Code, scripts, proof assistants, Overleaf.
- **Motivaciones:** tener un entorno más rápido para enseñar, prototipar y compartir formalizaciones.
- **Barreras:** necesita confiar en la corrección del motor ST; pedirá evidencia de validación y reproducibilidad.

### Persona 3 — Mariana, profesora universitaria

- **Edad:** 36
- **Contexto:** enseña lógica, argumentación o teoría crítica en pregrado y posgrado.
- **Objetivos:** preparar clases, ejercicios, evaluaciones y materiales interactivos.
- **Frustraciones:** corrección manual, bajo engagement de estudiantes, herramientas técnicas que intimidan.
- **Herramientas actuales:** Moodle/Classroom, PDFs, PowerPoint, Google Docs, Overleaf básico.
- **Motivaciones:** mostrar derivaciones, falacias y contraejemplos en vivo.
- **Barreras:** necesita onboarding muy guiado y plantillas listas para usar.

### Persona 4 — Mateo, estudiante técnico de maestría

- **Edad:** 27
- **Contexto:** trabaja entre computación, matemáticas, filosofía formal o IA.
- **Objetivos:** integrar texto, código, validación y control de versiones.
- **Frustraciones:** documentos desconectados de resultados; configuración local repetitiva; colaboración por repos difícil para compañeros no técnicos.
- **Herramientas actuales:** Markdown, VS Code, GitHub, Jupyter, terminal, Overleaf.
- **Motivaciones:** productividad, reproducibilidad y velocidad.
- **Barreras:** si el producto se siente menos potente que VS Code + Git, puede abandonarlo.

### Persona 5 — Equipo de investigación académico

- **Tipo:** grupo de 3 a 8 personas.
- **Contexto:** seminario, laboratorio o grupo de lectura que produce papers, informes o materiales docentes.
- **Objetivos:** compartir documentos, discutir conceptos, asignar tareas, mantener historial y exportar resultados.
- **Frustraciones:** múltiples versiones, comentarios perdidos, tareas sin contexto, evidencia dispersa.
- **Herramientas actuales:** Google Drive, Notion, Trello, WhatsApp/Slack, Overleaf, GitHub según perfil técnico.
- **Motivaciones:** coordinación y memoria colectiva del razonamiento.
- **Barreras:** permisos, adopción del equipo completo, compatibilidad con prácticas existentes.

---

## 6. User Journey

### Mapa general

| Etapa | Qué busca el usuario | Qué debería ofrecer Agora | Riesgo UX |
| --- | --- | --- | --- |
| Descubrimiento | Entender si la herramienta es para su trabajo académico. | Landing clara: “de prosa a lógica verificable”; demos de ST, formalizador y Markdown. | Que parezca demasiadas cosas a la vez: editor, IA, terminal, Git, Kanban. |
| Onboarding | Entrar sin configurar demasiado. | Registro, workspace personal automático, plantillas iniciales, ejemplo guiado. | Que el usuario no sepa si debe empezar por Markdown, ST o mesa semántica. |
| Primer uso | Probar valor en menos de 10 minutos. | Crear documento, pegar argumento, seleccionar fragmento, formalizar, ver diagnóstico y ejecutar ST. | Que la primera experiencia sea una pantalla vacía. |
| Trabajo diario | Escribir, corregir, organizar, formalizar y guardar. | Autosave, linter, snippets, vista previa, mesa semántica, ST companion, AI contextual. | Fatiga por demasiados paneles o conceptos nuevos. |
| Colaboración | Compartir workspace y avanzar en equipo. | Miembros, invitaciones, sync en tiempo real, tablero Kanban, Git, comentarios/estado. | Falta de permisos granulares o de enlaces públicos de solo lectura. |
| Exportación / cierre | Entregar, publicar o versionar. | Descargar archivos/ZIP, commit Git, exportar Markdown/PDF, conservar `.st` verificable. | Exportación académica puede quedarse corta si no hay PDF/LaTeX/Typst robusto. |

### Journey detallado: de idea ambigua a conocimiento verificable

#### 1. Descubrimiento

El usuario llega a Agora por una promesa: escribir con libertad, verificar con rigor. La landing ya comunica pilares como Markdown académico, ST, formalizador, IA, terminales y colaboración.

El usuario necesita entender rápidamente:

- Esto no es solo Notion.
- Esto no es solo Overleaf.
- Esto no es solo un chat con IA.
- Esto es un entorno para construir conocimiento formal verificable.

#### 2. Onboarding

El flujo esperado:

1. Crear cuenta o iniciar sesión.
2. Entrar al dashboard.
3. Recibir un workspace personal por defecto.
4. Ver un ejemplo inicial o plantilla.
5. Elegir una ruta:
   - “Quiero escribir un paper”.
   - “Quiero formalizar un argumento”.
   - “Quiero enseñar lógica”.
   - “Quiero colaborar con mi equipo”.

El onboarding ideal debería evitar una pantalla vacía. Un usuario nuevo necesita una tarea guiada, por ejemplo:

> Pega una frase: “Si P entonces Q. P. Por lo tanto Q”. Agora la formaliza, la ejecuta y explica la derivación.

#### 3. Primer uso

El primer momento de valor debería ocurrir así:

1. Usuario crea un documento Markdown.
2. Escribe una tesis o argumento breve.
3. El linter marca ambigüedades o frases vagas.
4. Selecciona un fragmento.
5. Lo guarda como concepto, evidencia o claim.
6. El sistema muestra preview de formalización ST.
7. Genera un archivo `.st` companion.
8. Ejecuta ST y ve resultado: válido, derivable, satisfacible, error o contraejemplo.

La emoción buscada es: “mi texto ahora tiene una estructura verificable”.

#### 4. Trabajo diario

En el uso diario, el usuario alterna entre:

- Redactar en Markdown.
- Ver preview con KaTeX/Mermaid.
- Corregir problemas del linter académico.
- Marcar conceptos y evidencias.
- Generar atlas semántico, matriz de evidencias o bitácora.
- Formalizar fragmentos a ST.
- Ejecutar ST.
- Preguntar a Agora AI sobre el workspace.
- Guardar snippets reutilizables.
- Usar Git/commits para cortes importantes.
- Usar terminal si necesita ejecución externa o scripts.

El final de un día de trabajo debería verse así:

- Documento guardado.
- Diagnósticos importantes revisados.
- Nuevos conceptos/evidencias sincronizados.
- Tareas actualizadas si aplica.
- Commit opcional del workspace.
- Próximo paso claro en la bitácora o Kanban.

#### 5. Colaboración

Un equipo debería poder:

1. Crear workspace compartido.
2. Invitar miembros.
3. Subir documentos y fuentes.
4. Marcar conceptos compartidos.
5. Crear tareas desde fragmentos seleccionados.
6. Ver cambios sincronizados.
7. Versionar en Git.
8. Mantener una matriz común de evidencias y claims.

El valor no es solamente editar juntos. El valor es construir una memoria argumental común.

#### 6. Exportación y cierre

El proyecto puede finalizar de dos formas: cierre diario o cierre definitivo.

**Cierre diario:**

- El usuario termina una sesión de trabajo.
- Guarda o confirma autosave.
- Revisa el panel de problemas.
- Actualiza tareas.
- Hace commit si hay avance relevante.
- Deja una bitácora con próximos pasos.

**Cierre de proyecto:**

- El documento final está listo.
- Las tesis principales tienen evidencia vinculada.
- Las formalizaciones clave están en `.st`.
- ST corre sin errores críticos.
- Se exporta el material académico.
- Se conserva historial Git.
- El workspace queda como archivo reproducible del razonamiento.

---

# FASE 3 — Definir el producto

## 7. MVP

### Definición del MVP

El MVP de Agora debe demostrar una promesa específica:

> Una persona puede escribir una idea en lenguaje natural, convertirla en estructura lógica formal, verificarla, corregirla y conservar la trazabilidad dentro de un documento académico.

Si el MVP no logra ese flujo, el producto se vuelve “otro editor con muchas herramientas”. El núcleo no es la cantidad de funcionalidades; el núcleo es la continuidad entre prosa, semántica y verificación.

### Qué debe existir sí o sí

Ordenado desde lo más general a lo más particular y por importancia.

#### P0 — Núcleo indispensable

| Prioridad | Función | Por qué es esencial | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Sistema de usuarios, workspaces y documentos | Sin persistencia y espacios de trabajo no hay producto usable. | Usuario entra, crea/abre workspace y guarda documentos. |
| 2 | Editor Markdown académico | Es la superficie primaria donde nace la idea. | Usuario escribe prosa, fórmulas, tablas, diagramas y estructura académica. |
| 3 | Motor ST ejecutable | Es la base de verificabilidad. | Usuario puede ejecutar axiomas, derivaciones, checks, tablas y contraejemplos. |
| 4 | Editor ST integrado | Permite escribir y corregir formalizaciones sin salir del workspace. | Sintaxis, autocompletado, diagnósticos y ejecución desde el mismo entorno. |
| 5 | Formalización texto natural → ST | Es el puente principal desde ambigüedad a forma verificable. | Usuario selecciona o pega texto y obtiene ST inicial. |
| 6 | Panel de errores y diagnósticos | La verificabilidad necesita feedback comprensible. | Usuario ve errores de Markdown, ST, ambigüedad, citas o estructura. |
| 7 | Mesa semántica mínima | Permite pasar de texto lineal a conocimiento estructurado. | Usuario registra conceptos, claims, evidencias y relaciones básicas. |
| 8 | Generación de archivo `.st` companion | Une documento natural con formalización reproducible. | Cada documento puede tener su contraparte formal sincronizada. |
| 9 | Visualización básica de estructura lógica | Hace visible el razonamiento. | Usuario ve conceptos, relaciones, evidencias y estado de formalización. |
| 10 | Exportación académica mínima | El trabajo debe poder salir de la plataforma. | Descargar Markdown/archivos, exportar o imprimir PDF, conservar `.st`. |

#### P1 — MVP fuerte para adopción temprana

| Prioridad | Función | Valor |
| --- | --- | --- |
| 11 | Colaboración básica | Workspaces compartidos, miembros e invitaciones. |
| 12 | Git por workspace | Historial, auditoría y reproducibilidad. |
| 13 | Snippets académicos y ST | Reduce fricción para usuarios nuevos. |
| 14 | Onboarding con plantillas | Evita pantalla vacía y acelera primer valor. |
| 15 | Agora AI con contexto del workspace | Ayuda a redactar, resumir y formalizar sin copiar/pegar. |
| 16 | Tablero Kanban vinculado a documentos | Convierte fragmentos en tareas accionables. |
| 17 | Visor y explorador de archivos | Permite trabajar con PDFs, imágenes, hojas y fuentes. |
| 18 | Modo offline/PWA básico | Mejora confiabilidad y uso en campo. |

#### P2 — Potenciadores, no núcleo inicial

| Función | Por qué puede esperar |
| --- | --- |
| Terminales Linux cloud | Muy valiosas para usuarios técnicos, pero no son necesarias para probar la promesa central de formalización verificable. |
| Workers Docker avanzados | Relevantes para ejecución remota y CLI, pero aumentan complejidad operativa. |
| MercadoPago y planes completos | Importante para SaaS, no para validar el núcleo de producto. |
| Importadores avanzados desde Overleaf/LaTeX/Notion | Aceleran migración, pero pueden venir después de validar retención. |
| Permisos granulares complejos | Necesarios para equipos maduros, pero colaboración básica basta para MVP. |
| Public share links / revisión externa | Útil para difusión y revisión, pero no bloquea el primer flujo. |
| Multi-model IA avanzada | El producto no debe depender de IA sofisticada si ST y diagnósticos ya entregan valor. |

### Funciones desde la más general a la más particular

1. **Espacio de trabajo académico:** lugar persistente donde vive un proyecto.
2. **Documento académico:** unidad de escritura principal.
3. **Estructura semántica:** conceptos, claims, evidencias y relaciones extraídas del documento.
4. **Formalización lógica:** traducción de fragmentos relevantes a ST.
5. **Verificación formal:** ejecución de ST, diagnósticos, validez, satisfacibilidad y contraejemplos.
6. **Retroalimentación de calidad:** linter académico, linter de ambigüedad y panel de problemas.
7. **Trazabilidad:** vínculo entre texto natural, concepto, evidencia y fórmula ST.
8. **Colaboración:** miembros, sincronización y tareas vinculadas al texto.
9. **Versionado:** commits Git y estado reproducible del workspace.
10. **Exportación:** salida a Markdown, PDF/impresión, ZIP, Git y archivos `.st`.
11. **Asistencia IA:** apoyo contextual para redactar, resumir, formalizar y organizar.
12. **Ejecución técnica ampliada:** terminales, workers y CLI para usuarios avanzados.

### Criterio de éxito del MVP

El MVP se considera exitoso si un usuario nuevo puede completar este flujo sin ayuda externa:

1. Crear un workspace.
2. Crear o abrir un documento.
3. Escribir un argumento breve.
4. Recibir al menos un diagnóstico útil.
5. Seleccionar un fragmento y guardarlo como concepto o claim.
6. Formalizarlo a ST.
7. Ejecutar la formalización.
8. Entender el resultado.
9. Exportar o guardar una versión reproducible.

La métrica cualitativa clave sería:

> “Ahora veo mi argumento con más claridad que antes”.

La métrica de producto asociada:

- Tiempo hasta primera formalización exitosa.
- Porcentaje de usuarios que ejecutan ST en la primera sesión.
- Porcentaje de documentos con al menos un concepto/evidencia marcada.
- Porcentaje de formalizaciones corregidas después de diagnóstico.
- Retención de usuarios que vuelven a editar el mismo workspace.

---

# Síntesis final

Agora debe posicionarse como una plataforma para **investigación rigurosa asistida**, no como un simple editor, una app de notas o un chat académico.

La frase de producto más clara sería:

> Agora convierte escritura académica en conocimiento formal verificable: escribe en Markdown, estructura tus conceptos, formaliza en ST, ejecuta la lógica y conserva la trazabilidad de todo tu razonamiento.

El diseño debe priorizar una experiencia progresiva:

1. Empieza escribiendo como siempre.
2. Marca lo importante.
3. El sistema ayuda a formalizar.
4. ST verifica.
5. La mesa semántica organiza.
6. El workspace conserva y comparte.
7. La exportación permite publicar o entregar.

La oportunidad más grande está en hacer que la lógica formal deje de sentirse como una herramienta externa y pase a sentirse como una capa natural de la escritura académica.

---

# Fuentes revisadas del proyecto

- `README.md` — arquitectura, funcionalidades, planes, endpoints.
- `CLAUDE.md` — visión operativa, arquitectura actual, sync, NAS, MinIO, Forgejo, workers.
- `docs/formalizacion-automatica.md` — flujo de formalización automática y ST companion.
- `docs/st-prompt.md` — definición de ST, perfiles lógicos, CLI, Text Layer.
- `docs/01-clasica-proposicional.md` — validación real del motor ST con taller auditado.
- `docs/13-fase-final-validation-2026-04-30.md` — validación productiva de MinIO, Forgejo, Git y APIs.
- `src/app/page.tsx` — landing, posicionamiento, pilares, planes y workflow.
- `src/app/docs/page.tsx` — manual maestro y descripción de UX por módulos.
- `src/components/MosaicEditor.tsx` — editor Markdown, linter, selección semántica, ST companion.
- `src/components/FormalizerPlayground.tsx` — formalización NLP/LLM, perfiles, ejecución ST y métricas.
- `src/components/editor/SemanticWorkbench.tsx` — atlas semántico, matriz de evidencias, bitácora y generación ST.
- `src/components/STRunner.tsx` — ejecución ST, historial, problemas y símbolos.
- `src/components/AgoraAIChat.tsx` — IA multi-proveedor, modo agente, contexto de workspace.
- `src/components/MosaicLayout.tsx` — layout de paneles, integración de editor, terminal, ST, IA, formalizador y explorador.
- `src/components/FileExplorer.tsx` — organización de archivos, carpetas, favoritos, descarga y acciones.
