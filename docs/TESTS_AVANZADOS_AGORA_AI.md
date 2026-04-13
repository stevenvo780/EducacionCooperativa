# Tests Avanzados — Agora AI Agent (qwen3:14b)

## Contexto
- Workspace: FilosofiCiudad / `TxFHNwYtgNTS7aTROXOz`
- Auth: `stevenvallejo780@gmail.com`
- Carpetas: `filosofiaDeLaCiudad/Clase 1/...`, `filosofiaDeLaCiudad/Clase2`, `filosofiaDeLaCiudad/Clase3`, `No estructurado`, `prompts`
- ~41 documentos existentes

## Criterios de evaluación

| Nivel | Significado |
|-------|-------------|
| ✅ | Herramientas correctas, resultado coherente |
| ⚠️ | Usó herramientas pero eligió mal o incompleto |
| ❌ | No usó herramientas, inventó datos, o falló |

---

## Bloque A: Navegación y contenido de clases (Fix test 12)

### A1. "¿Qué vimos en la última clase?"
**Herramientas esperadas**: `list_folders` → `list_documents(Clase3)` → `summarize_document` o `read_document`
**Verifica**: NO usa `get_board`. Identifica Clase3 como la más reciente.

### A2. "Dame un resumen de cada clase que hemos tenido"
**Herramientas esperadas**: `list_folders` → `list_documents(Clase 1)` + `list_documents(Clase2)` + `list_documents(Clase3)` → `summarize_document` de docs clave de cada una
**Verifica**: Itera sobre TODAS las clases, no solo una.

### A3. "¿Cuál fue la primera clase y de qué trató?"
**Herramientas esperadas**: `list_folders` → `list_documents(Clase 1)` → `read_document` o `summarize_document`
**Verifica**: Identifica "Clase 1" como la primera.

### A4. "¿Qué diferencias hay entre lo que vimos en la clase 1 y la clase 3?"
**Herramientas esperadas**: Contenido de ambas clases + comparación razonada
**Verifica**: Lee documentos de ambas carpetas ANTES de comparar.

---

## Bloque B: Búsqueda cruzada y síntesis

### B1. "¿En qué documentos se menciona a Heidegger y qué dice cada uno?"
**Herramientas esperadas**: `search_documents({query: "Heidegger"})` → `read_document` de cada resultado
**Verifica**: No inventa contenido. Lee los documentos encontrados.

### B2. "¿Cuáles son los 3 conceptos filosóficos más importantes del curso según los documentos?"
**Herramientas esperadas**: Búsqueda amplia o lectura de docs → síntesis razonada
**Verifica**: Basa su respuesta en contenido REAL, no conocimiento general.

### B3. "Busca todos los documentos que hablen sobre espacio público y haz una lista con citas textuales"
**Herramientas esperadas**: `search_documents({query: "espacio público"})` → `read_document` de cada resultado → extracto textual
**Verifica**: Cita texto real de los documentos, no parafrasea de su conocimiento.

### B4. "¿Hay algún documento que contradiga o complemente lo que dice el documento CiudadContemporanea?"
**Herramientas esperadas**: `read_document(CiudadContemporanea)` → `search_documents` con conceptos clave → lectura de resultados → análisis
**Verifica**: Flujo multi-herramienta en cadena.

---

## Bloque C: Acciones compuestas (crear + organizar)

### C1. "Lee los documentos de la clase 3 y crea un resumen ejecutivo como nuevo documento en la carpeta 'Resúmenes'"
**Herramientas esperadas**: `list_documents(Clase3)` → `read_document` de cada uno → `create_document` con resumen + carpeta "Resúmenes"
**Verifica**: Primero LEE, luego CREA con contenido basado en lo leído.

### C2. "Crea una tarjeta en el tablero por cada documento de la clase 1 que no tenga notas finales"
**Herramientas esperadas**: `list_documents(Clase 1)` → filtra por nombre/contenido → `create_board_card` por cada uno
**Verifica**: Acción en lote basada en lógica condicional.

### C3. "Toma el documento más reciente y conviértelo en un snippet con formato de cita académica"
**Herramientas esperadas**: `list_documents` (ordenados por fecha) → `read_document` del primero → `create_snippet` con formato
**Verifica**: Identifica el más reciente por fecha, no inventa.

---

## Bloque D: Tablero Kanban vs Documentos (discriminación)

### D1. "¿Qué tareas tenemos pendientes relacionadas con la clase 3?"
**Herramientas esperadas**: `get_board` → filtra tarjetas que mencionen clase 3 O `list_documents(Clase3)` + `get_board` → cruce
**Verifica**: Puede combinar tablero y documentos.

### D2. "Mueve todas las tarjetas de 'Por hacer' a 'En progreso'"
**Herramientas esperadas**: `get_board` → identifica tarjetas en "Por hacer" → `move_board_card` para cada una
**Verifica**: Acción en lote sobre tablero.

### D3. "¿El tablero refleja lo que hemos avanzado en las clases? Compara"
**Herramientas esperadas**: `get_board` + `list_folders`/`list_documents` → análisis cruzado
**Verifica**: No inventa. Compara datos reales de ambas fuentes.

---

## Bloque E: Lógica formal integrada con contenido

### E1. "Formaliza el argumento principal del documento CiudadContemporanea y verifica si es válido"
**Herramientas esperadas**: `read_document(CiudadContemporanea)` → `check_logic` o `formalize_text` con el argumento extraído
**Verifica**: Lee PRIMERO, luego formaliza contenido real.

### E2. "¿Hay algún silogismo implícito en los documentos de la clase 1? Si lo encuentras, analízalo"
**Herramientas esperadas**: `list_documents(Clase 1)` → `read_document` → identifica argumento → `check_logic`
**Verifica**: Cadena completa de lectura → extracción → análisis lógico.

---

## Bloque F: Consultas ambiguas y razonamiento contextual

### F1. "¿De qué trata este curso?"
**Herramientas esperadas**: `list_folders` + `list_documents` (general) → síntesis basada en estructura y nombres
**Verifica**: NO responde desde conocimiento general. Lee la estructura real.

### F2. "¿Qué debería estudiar para un examen de este curso?"
**Herramientas esperadas**: Exploración amplia del workspace → resumen temático
**Verifica**: Basa recomendaciones en contenido real del workspace.

### F3. "¿Hay algo que no hayamos cubierto y debería estar en el curso?"
**Herramientas esperadas**: Lee contenido real → identifica gaps desde su conocimiento de filosofía
**Verifica**: Combina análisis del workspace con conocimiento general de forma transparente.

### F4. "Actúa como si fueras un estudiante que no entiende nada y hazme preguntas sobre los documentos"
**Herramientas esperadas**: Lee documentos → genera preguntas basadas en contenido real
**Verifica**: Las preguntas son sobre contenido REAL de los documentos.

---

## Bloque G: Estrés y edge cases

### G1. "Busca un documento que no existe: 'Teoría cuántica de la verdad'"
**Herramientas esperadas**: `search_documents` → 0 resultados → respuesta honesta
**Verifica**: NO inventa que existe.

### G2. "Crea 3 documentos: uno con definiciones, otro con argumentos y otro con bibliografía, todos basados en la clase 3"
**Herramientas esperadas**: `list_documents(Clase3)` → `read_document` × N → `create_document` × 3
**Verifica**: Acción masiva multi-paso.

### G3. "¿Cuántos documentos hay en total y en qué carpetas están?"
**Herramientas esperadas**: `list_folders` + `list_documents` por carpeta → conteo
**Verifica**: Datos numéricos exactos, no aproximaciones.

### G4. (Pregunta vacía) Solo escribe "hola"
**Herramientas esperadas**: Ninguna — respuesta conversacional
**Verifica**: NO llama herramientas innecesariamente para un saludo.

---

## Ejecución

Estos tests se ejecutan manualmente en el navegador:
1. Abrir http://localhost:4005
2. Login con `stevenvallejo780@gmail.com`
3. Ir al workspace FilosofiCiudad
4. Activar modo agente
5. Ejecutar cada prompt y registrar resultado

## Registro de resultados

| Test | Herramientas usadas | Resultado | Notas |
|------|---------------------|-----------|-------|
| A1 | | | |
| A2 | | | |
| A3 | | | |
| A4 | | | |
| B1 | | | |
| B2 | | | |
| B3 | | | |
| B4 | | | |
| C1 | | | |
| C2 | | | |
| C3 | | | |
| D1 | | | |
| D2 | | | |
| D3 | | | |
| E1 | | | |
| E2 | | | |
| F1 | | | |
| F2 | | | |
| F3 | | | |
| F4 | | | |
| G1 | | | |
| G2 | | | |
| G3 | | | |
| G4 | | | |
