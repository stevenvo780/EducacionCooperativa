# Plan: Agora AI Agent — De chat a agente autónomo

> **Objetivo**: Transformar AgoraAIChat de un chat conversacional pasivo en un **agente autónomo** capaz de leer, crear, editar, mover y eliminar documentos dentro del workspace de Agora, utilizando function calling nativo de los LLMs y un loop agéntico server-side.

## Estado de ejecución de las 6 fases

- [x] **Fase 1 — Function Calling Loop**: loop agéntico implementado para OpenAI, Anthropic y Gemini en servidor; loop agéntico implementado para Ollama desde cliente.
- [x] **Fase 2 — Tools ampliadas**: CRUD de documentos, mover, buscar, carpetas, snippets, estado semántico y formalización disponibles vía `/api/agora-ai/tools`.
- [x] **Fase 3 — Capa agéntica**: system prompt agéntico, parsing de `<thinking>`, planes multi-paso y auto-corrección por tool results.
- [x] **Fase 4 — Seguridad y permisos**: validación de membresía, confirmación destructiva, límite de iteraciones y audit log en Firestore.
- [x] **Fase 5 — UX del agente (base funcional)**: toggle chat/agente, bloques colapsables de tools, razonamiento visible, confirmaciones inline, evento global de invalidación y comando de deshacer.
- [x] **Fase 5 — UX del agente (streaming + navegación)**: streaming SSE en tiempo real implementado para proveedores server-side y apertura/enfoque automático de documentos afectados en el dashboard/mosaic vía eventos de UI.
- [x] **Fase 6 — Capacidades avanzadas (base funcional)**: rollback del último turno, observación post-acción soportada por el loop, batch ops delegables al modelo y formalización integrada.
- [ ] **Fase 6 — Capacidades avanzadas (pendiente)**: integración específica con paneles abiertos de ST / mosaic y memoria persistente de sesión más allá del historial del chat quedan pendientes para una iteración posterior.

---

## Estado actual

| Componente | Estado | Archivos |
|-----------|--------|----------|
| Chat multi-proveedor (OpenAI, Anthropic, Gemini, Ollama) | ✅ Funcional | `src/components/AgoraAIChat.tsx`, `src/app/api/agora-ai/route.ts` |
| Inyección de contexto del workspace (docs + semántica) | ✅ Funcional | `route.ts` → `buildContextPrompt()`, `context/route.ts` |
| API REST de tools (`list_files`, `read_file`, `create_file`, `rename_file`, `delete_file`) | ✅ Existe pero **NO conectada** al LLM | `src/app/api/agora-ai/tools/route.ts` |
| Function calling / tool_use | ❌ No existe | — |
| Loop agéntico (planificar → ejecutar → observar → decidir) | ❌ No existe | — |
| Tools de edición, movimiento, búsqueda | ❌ No existen | — |
| Confirmación de acciones destructivas | ❌ No existe | — |
| UI de acciones del agente | ❌ No existe | — |

---

## Arquitectura propuesta

```
┌───────────────────────────────┐
│       AgoraAIChat.tsx         │  UI: mensajes + indicadores de tool calls
│       (componente React)      │  + confirmación de acciones destructivas
└──────────────┬────────────────┘
               │ POST /api/agora-ai  { messages, tools: true }
               ▼
┌───────────────────────────────┐
│     route.ts  (agent loop)    │  1. Construye system prompt + tools schema
│                               │  2. Envía al LLM con tools habilitadas
│                               │  3. Si LLM responde con tool_calls:
│                               │     a. Ejecuta cada tool via toolExecutor
│                               │     b. Añade resultado como tool_result
│                               │     c. Re-envía al LLM → loop
│                               │  4. Si LLM responde texto final → return
│                               │  5. Max N iteraciones como safety brake
└──────────┬───────┬────────────┘
           │       │
     ┌─────▼───┐ ┌─▼──────────────────┐
     │  LLM    │ │  toolExecutor.ts   │
     │ Provider│ │                    │
     │ APIs    │ │  Ejecuta tools     │
     │         │ │  contra Firestore  │
     │ OpenAI  │ │  y Storage         │
     │ Claude  │ │  con el token del  │
     │ Gemini  │ │  usuario           │
     │ Ollama  │ └────────────────────┘
     └─────────┘
```

### Diferencia clave: Chat vs Agente

| Aspecto | Chat actual | Agente propuesto |
|---------|-------------|------------------|
| Flujo | 1 request → 1 response | Loop: request → tool_call → execute → observe → repeat |
| Capacidad | Solo responde texto | Lee, crea, edita, mueve, elimina, busca documentos |
| Contexto | Estático (inyectado al inicio) | Dinámico (el agente puede leer más docs cuando necesita) |
| Planificación | Ninguna | El LLM planifica pasos, los ejecuta y verifica |
| Autonomía | Cero | Ejecuta hasta N tools por turno; confirma destructivas |

---

## Fases de implementación

### Fase 1 — Function Calling Loop (Core agéntico)

**Objetivo**: Implementar el loop agente-herramienta en el servidor para que el LLM pueda invocar tools y actuar sobre el workspace.

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 1.1 | **Definir tool schemas** | Nuevo: `src/app/api/agora-ai/toolDefinitions.ts` | JSON Schema de cada tool compatible con OpenAI tools format. Incluir `name`, `description`, `parameters` para cada herramienta. |
| 1.2 | **Crear tool executor** | Nuevo: `src/app/api/agora-ai/toolExecutor.ts` | Función `executeTool(name, args, context)` que despacha al servicio Firestore correcto. El `context` lleva `workspaceId`, `userId`, y `authToken`. |
| 1.3 | **Implementar agent loop en route.ts** | Modificar: `src/app/api/agora-ai/route.ts` | Refactorizar los `callOpenAI`/`callAnthropic`/`callGemini` para: (a) enviar `tools` en el request, (b) detectar `tool_calls` en la respuesta, (c) ejecutar tools, (d) re-enviar resultados al LLM, (e) repetir hasta respuesta final o max iteraciones (ej: 10). |
| 1.4 | **Adaptar flujo Ollama** | Modificar: `src/components/AgoraAIChat.tsx` | Ollama ≥0.5 soporta tools. Implementar el mismo loop client-side, o proxear Ollama por el servidor para unificar. |
| 1.5 | **Normalizar formato entre proveedores** | `route.ts` | Cada proveedor tiene formato distinto de tool_calls/tool_results. Crear adaptadores: `openaiAdapter`, `anthropicAdapter`, `geminiAdapter`, `ollamaAdapter`. |

**Formato del agent loop (pseudocódigo)**:

```typescript
async function agentLoop(messages, tools, provider, maxIter = 10) {
  for (let i = 0; i < maxIter; i++) {
    const response = await callProvider(messages, tools);
    
    if (response.type === 'text') {
      return response.content; // final answer
    }
    
    if (response.type === 'tool_calls') {
      for (const call of response.toolCalls) {
        const result = await executeTool(call.name, call.args, context);
        messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result) });
      }
      // Loop continues: LLM sees tool results and decides next action
    }
  }
  return 'Se alcanzó el límite de acciones por turno.';
}
```

---

### Fase 2 — Ampliar Tools disponibles

**Objetivo**: Cubrir todas las operaciones necesarias para que el agente pueda "moverse" libremente por Agora.

| # | Tool | Descripción | Parámetros | Endpoint base |
|---|------|-------------|------------|---------------|
| 2.1 | `list_documents` | Listar documentos del workspace | `folder?`, `type?`, `limit?` | GET `documents` collection |
| 2.2 | `read_document` | Leer contenido completo de un doc | `documentId` | GET `documents/{id}` |
| 2.3 | `create_document` | Crear nuevo documento de texto | `title`, `content`, `folder?` | POST `documents` |
| 2.4 | `update_document` | **Editar contenido** de un doc existente | `documentId`, `content`, `title?` | PUT `documents/{id}` |
| 2.5 | `rename_document` | Renombrar documento | `documentId`, `newTitle` | PUT `documents/{id}` |
| 2.6 | `delete_document` | Eliminar documento | `documentId` | DELETE `documents/{id}` |
| 2.7 | `move_document` | **Mover** documento a otra carpeta | `documentId`, `targetFolder` | PUT `documents/{id}` con `{ folder }` |
| 2.8 | `search_documents` | **Buscar** docs por nombre o contenido | `query`, `limit?` | Query Firestore / `/api/search/semantic` |
| 2.9 | `list_folders` | Listar carpetas del workspace | — | Derivado de `list_documents` |
| 2.10 | `create_folder` | Crear carpeta | `name`, `parentFolder?` | POST `documents` con `type=folder` |
| 2.11 | `get_workspace_info` | Info del workspace (nombre, miembros) | — | GET `workspaces/{id}` |
| 2.12 | `get_semantic_state` | Leer conceptos y fragmentos semánticos | — | GET `workspaceSemanticStates/{id}` |
| 2.13 | `list_snippets` | Listar snippets reutilizables | — | GET `/api/snippets` |
| 2.14 | `create_snippet` | Crear snippet | `title`, `content`, `language?` | POST `/api/snippets` |
| 2.15 | `formalize_text` | Formalizar texto en lógica formal | `text`, `logic?` | POST `/api/formalize-llm` |

---

### Fase 3 — Capa agéntica: planificación y razonamiento

**Objetivo**: Dotar al agente de capacidad de planificar, razonar sobre múltiples pasos y auto-corregirse, yendo más allá de simple function calling reactivo.

| # | Tarea | Detalle |
|---|-------|---------|
| 3.1 | **System prompt agéntico** | Reescribir el system prompt para instruir al LLM como agente. Incluir: (a) descripción de cada tool y cuándo usarla, (b) instrucciones de planificación ("piensa antes de actuar, planifica los pasos"), (c) reglas de seguridad ("nunca borres sin confirmar"), (d) formato de razonamiento interno. |
| 3.2 | **Chain-of-thought visible** | Permitir que el LLM emita un bloque `<thinking>` antes de sus tool_calls. El servidor lo parsea y lo envía al frontend como metadata del paso, no como respuesta final. El usuario puede expandirlo para ver el razonamiento. |
| 3.3 | **Plan multi-paso** | El agente puede generar un plan explícito de N pasos (ej: "1. Buscar docs sobre X, 2. Leer el más relevante, 3. Crear resumen, 4. Guardarlo como nuevo doc"). Cada paso se ejecuta y verifica antes de pasar al siguiente. |
| 3.4 | **Auto-corrección** | Si una tool falla (doc no encontrado, error de permisos), el agente recibe el error como tool_result y puede decidir un camino alternativo en vez de fallar. |
| 3.5 | **Memoria de sesión enriquecida** | Mantener un contexto acumulativo de la sesión: qué docs ha leído, qué ha creado, qué carpetas ha explorado. Esto se inyecta como contexto adicional para evitar re-leer documentos. |
| 3.6 | **Task decomposition** | Para peticiones complejas ("organiza todos los documentos por tema"), el agente descompone en sub-tareas: listar docs → categorizar → crear carpetas → mover docs. El system prompt incluye instrucciones para esta descomposición. |

**System prompt agéntico (ejemplo)**:

```markdown
Eres un agente inteligente de Agora con acceso completo al workspace del usuario.

## Capacidades
Puedes: listar, leer, crear, editar, renombrar, mover y eliminar documentos.
También puedes: buscar documentos, ver conceptos semánticos, crear snippets y formalizar texto.

## Instrucciones
1. Cuando recibas una petición, PIENSA primero qué pasos necesitas.
2. Ejecuta las herramientas necesarias en orden lógico.
3. Si algo falla, intenta un camino alternativo.
4. Confirma con el usuario antes de eliminar documentos.
5. Al terminar, resume qué hiciste y qué cambió.

## Reglas de seguridad
- NUNCA elimines un documento sin que el usuario lo haya pedido explícitamente.
- NUNCA modifiques más de 5 documentos en un solo turno sin confirmar.
- Si no estás seguro, pregunta antes de actuar.

## Contexto del workspace
{context}
```

---

### Fase 4 — Seguridad y permisos

**Objetivo**: Asegurar que el agente IA respete exactamente los mismos permisos que el usuario.

| # | Tarea | Detalle |
|---|-------|---------|
| 4.1 | **Reusar autenticación Firebase** | El proxy ya verifica el token del usuario. Pasar ese mismo `uid` al `toolExecutor` para que todas las operaciones Firestore se ejecuten con los permisos del usuario. |
| 4.2 | **Validar membership por tool** | Antes de cada ejecución de tool, verificar `isWorkspaceMember(workspaceId, uid)`. Ya existe esta función. |
| 4.3 | **Rate limiting del agent loop** | Máximo 10 tool_calls por turno. Máximo 3 operaciones de escritura por turno. Configurable. |
| 4.4 | **Confirmación de destructivas** | Para `delete_document`: el servidor responde al frontend con `{ requiresConfirmation: true, action: 'delete', target: '...' }`. El frontend muestra un diálogo de confirmación. Si el usuario acepta, se reenvía con `confirmed: true`. |
| 4.5 | **Audit log** | Registrar en Firestore cada acción del agente: `{ timestamp, userId, workspaceId, toolName, args, result, success }`. Colección: `agentAuditLog`. |
| 4.6 | **Sanitización de contenido** | Validar que el contenido generado por el LLM no inyecte scripts o markup peligroso antes de guardarlo en documentos. |

---

### Fase 5 — UX del agente en el frontend

**Objetivo**: Que el usuario vea qué está haciendo el agente en cada paso, no solo la respuesta final.

| # | Tarea | Detalle |
|---|-------|---------|
| 5.1 | **Indicador de tool en ejecución** | Mientras el agent loop corre, el frontend muestra estados: `📄 Listando documentos…`, `📖 Leyendo "Apuntes de lógica"…`, `✏️ Editando "Resumen"…` |
| 5.2 | **Streaming del agent loop** | Usar SSE (Server-Sent Events) o streaming para enviar cada paso del loop al frontend en tiempo real, en vez de esperar a que termine todo. |
| 5.3 | **Bloques colapsables de acciones** | Cada tool_call se renderiza como un bloque colapsable debajo del mensaje del asistente, mostrando: tool name, parámetros, resultado resumido. |
| 5.4 | **Links a documentos afectados** | Cuando el agente crea/edita/lee un doc, incluir un link clicable que abra ese doc en el mosaic layout del dashboard. |
| 5.5 | **Preview de cambios** | Para `update_document`, mostrar un diff visual (antes/después) del contenido editado. |
| 5.6 | **Confirmación interactiva** | Para acciones destructivas, mostrar un diálogo inline en el chat: "¿Eliminar el documento 'X'? [Sí] [No]". |
| 5.7 | **Invalidación de caches** | Cuando el agente modifica documentos, emitir un evento para que el sidebar y el editor refresquen sus datos (invalidar IndexedDB cache). |
| 5.8 | **Toggle modo agente** | Switch en el header del chat: "Chat" (solo conversación) vs "Agente" (con tools habilitadas). Por defecto en modo agente. |

**Mockup del UI**:

```
┌─────────────────────────────────────────────────┐
│  🤖 Agora AI  ·  Claude (Anthropic)  · Agente  │
│                                        [⚙️][🗑]│
├─────────────────────────────────────────────────┤
│                                                 │
│  [usuario]: Organiza los documentos sobre       │
│  filosofía en una carpeta llamada "Filosofía"   │
│                                                 │
│  [agente]:                                      │
│  ┌─ 🔍 Planificando ─────────────────────────┐  │
│  │ 1. Buscar documentos sobre filosofía       │  │
│  │ 2. Crear carpeta "Filosofía"               │  │
│  │ 3. Mover documentos encontrados            │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ┌─ 🔧 search_documents ───────────────── ▾ ─┐  │
│  │ query: "filosofía"  →  3 resultados        │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ┌─ 📁 create_folder ─────────────────── ▾ ─┐   │
│  │ name: "Filosofía"  →  ✅ creada            │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ┌─ 📦 move_document (×3) ────────────── ▾ ─┐   │
│  │ "Ética kantiana" → Filosofía  ✅          │  │
│  │ "Lógica aristotélica" → Filosofía  ✅     │  │
│  │ "Fenomenología" → Filosofía  ✅           │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  Listo. Moví 3 documentos a la carpeta          │
│  "Filosofía": Ética kantiana, Lógica            │
│  aristotélica y Fenomenología.                  │
│                                                 │
├─────────────────────────────────────────────────┤
│  [____________________________________] [Send]  │
│  Claude (Anthropic)                    Enter ·  │
└─────────────────────────────────────────────────┘
```

---

### Fase 6 — Capacidades agénticas avanzadas

**Objetivo**: Capacidades que distinguen un agente de un simple ejecutor de funciones.

| # | Tarea | Detalle |
|---|-------|---------|
| 6.1 | **Observación post-acción** | Después de crear/editar un documento, el agente puede `read_document` para verificar que el resultado es correcto. |
| 6.2 | **Rollback de acciones** | El agente mantiene un historial de acciones en el turno. Si el usuario dice "deshaz eso", el agente puede revertir (eliminar lo creado, restaurar contenido previo). |
| 6.3 | **Batch operations inteligentes** | Para peticiones tipo "renombra todos los docs sin título", el agente lista, filtra, y ejecuta renames en lote, reportando progreso. |
| 6.4 | **Generación de contenido contextual** | El agente puede leer varios documentos, sintetizar la información y crear un nuevo documento con el resumen o análisis. |
| 6.5 | **Asistente de workspace** | Comandos especiales: "¿qué hay en este workspace?", "¿cuántos docs hay?", "¿qué conceptos semánticos tenemos?", "haz un índice de todo". |
| 6.6 | **Integración con ST** | Si hay un panel `STRunner` abierto, el agente puede enviar expresiones a formalizar y recibir resultados. |

---

## Orden de implementación

| Prioridad | Fase | Esfuerzo | Impacto | Dependencias |
|-----------|------|----------|---------|--------------|
| 🔴 P0 | **Fase 1** — Agent loop + function calling | 3-4 días | Habilita todo lo demás | Ninguna |
| 🔴 P0 | **Fase 2.1–2.4** — Tools core (list, read, create, update) | 1 día | Operaciones básicas | Fase 1 |
| 🔴 P0 | **Fase 3.1** — System prompt agéntico | 0.5 días | Calidad del agente | Fase 1 |
| 🟡 P1 | **Fase 2.5–2.8** — Tools CRUD completo (rename, delete, move, search) | 1 día | CRUD completo | Fase 2 core |
| 🟡 P1 | **Fase 4.1–4.4** — Seguridad y permisos | 1 día | Crítico pre-producción | Fase 1 |
| 🟡 P1 | **Fase 5.1, 5.3, 5.8** — UX básica (indicadores, bloques, toggle) | 1.5 días | Experiencia mínima viable | Fase 1 |
| 🟢 P2 | **Fase 3.2–3.4** — Chain-of-thought, planes, auto-corrección | 1.5 días | Agente inteligente | Fase 1 |
| 🟢 P2 | **Fase 5.2** — Streaming SSE del loop | 1 día | UX en tiempo real | Fase 5 básica |
| 🟢 P2 | **Fase 2.9–2.15** — Tools extendidas (folders, snippets, semántica, formalizar) | 2 días | Cobertura completa | Fase 2 core |
| 🟢 P2 | **Fase 5.4–5.7** — UX avanzada (links, diffs, confirmación, cache) | 2 días | Polish | Fase 5 básica |
| 🔵 P3 | **Fase 4.5–4.6** — Audit log, sanitización | 1 día | Trazabilidad | Fase 4 |
| 🔵 P3 | **Fase 6** — Capacidades agénticas avanzadas | 3-4 días | Diferenciación | Todo anterior |
| 🔵 P3 | **Fase 3.5–3.6** — Memoria de sesión, task decomposition | 1.5 días | Agente avanzado | Fase 3 básica |

**Total estimado**: ~20-23 días de desarrollo (MVP agéntico en ~7 días con P0).

---

## Resumen de archivos a crear/modificar

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/app/api/agora-ai/toolDefinitions.ts` | Schema JSON de todas las tools |
| `src/app/api/agora-ai/toolExecutor.ts` | Dispatcher que ejecuta tools contra Firestore |
| `src/app/api/agora-ai/providerAdapters.ts` | Adaptadores de formato tool_calls por proveedor |
| `src/app/api/agora-ai/agentLoop.ts` | Lógica core del loop agéntico |
| `src/app/api/agora-ai/agentSystemPrompt.ts` | Generador del system prompt agéntico |
| `src/components/chat/ToolCallBlock.tsx` | Componente UI para bloques de tool_call |
| `src/components/chat/AgentThinkingBlock.tsx` | Componente UI para razonamiento visible |
| `src/components/chat/ConfirmationDialog.tsx` | Diálogo de confirmación inline para destructivas |

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/app/api/agora-ai/route.ts` | Integrar agent loop, pasar tools, manejar streaming |
| `src/app/api/agora-ai/tools/route.ts` | Agregar tools: update, move, search, folders, snippets, semantic |
| `src/components/AgoraAIChat.tsx` | Toggle agente, renderizar tool_calls, confirmaciones, streaming |

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| El LLM hace tool_calls en loop infinito | Max 10 iteraciones por turno (hard limit) |
| El agente borra documentos importantes | Confirmación obligatoria + audit log |
| API keys expuestas en logs | Nunca loguear API keys; ya se manejan client-side |
| Costo excesivo de tokens por agent loop | Limitar contexto inyectado; truncar tool results largos |
| Ollama no soporta tools en modelos viejos | Fallback a modo chat si tools no soportadas; instrucciones en system prompt |
| Latencia alta por múltiples round-trips LLM | Streaming SSE para feedback inmediato; paralelizar tool_calls independientes |
| El LLM genera contenido basura en docs | Preview antes de guardar (Fase 5.5); rollback (Fase 6.2) |
