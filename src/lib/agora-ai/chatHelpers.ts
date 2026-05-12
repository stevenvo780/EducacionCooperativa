import type { AgentDocumentTarget, AgentRun } from '@/lib/agora-ai/types';

/**
 * Marcador de la sección de contexto que añadimos al `content` del assistant
 * cuando lo serializamos para el modelo. Se mantiene como constante para que
 * `stripPreviousTurnContext` pueda detectar y remover el bloque en cualquier
 * mensaje que vuelva del backend o se rehidrate desde historial: el bloque es
 * un detalle de transporte, no parte del texto visible al usuario.
 */
export const PREVIOUS_TURN_CONTEXT_MARKER = '\n\n[contexto del turno previo — tools ejecutadas]\n';

/**
 * Quita la sección "[contexto del turno previo — tools ejecutadas]" si por
 * cualquier razón quedó embebida en el `content` de un mensaje. Evita el
 * render duplicado cuando el backend persiste el mensaje enriquecido y luego
 * lo devuelve en una rehidratación de historial (Bug 1 UX).
 */
export function stripPreviousTurnContext(content: string): string {
  if (!content) return content;
  const idx = content.indexOf(PREVIOUS_TURN_CONTEXT_MARKER);
  if (idx === -1) return content;
  return content.slice(0, idx).trimEnd();
}

/**
 * Serializa un mensaje del historial al formato que esperamos enviar al
 * modelo. Para mensajes del assistant en modo agente enriquecemos el
 * content con un resumen breve de los tool calls ya ejecutados, así el
 * modelo conserva contexto de qué información recabó en turnos previos
 * (sin tener que re-ejecutar las mismas tools). Si el `content` ya contiene
 * un bloque de contexto (por una rehidratación previa) lo recortamos para no
 * acumular duplicados.
 */
export function serializeMessageForHistory(message: { role: string; content: string; agentRun?: AgentRun | undefined }) {
  const baseContent = stripPreviousTurnContext(message.content);
  if (message.role !== 'assistant' || !message.agentRun) {
    return { role: message.role, content: baseContent };
  }
  const toolSteps = message.agentRun.steps.filter(step => step.type === 'tool_result' && step.result);
  if (toolSteps.length === 0) {
    return { role: message.role, content: baseContent };
  }
  const toolDigest = toolSteps
    .map(step => {
      const name = step.call?.name || step.title || 'tool';
      const summary = step.result?.summary?.trim();
      return summary ? `- ${name}: ${summary}` : `- ${name}`;
    })
    .join('\n');
  const enriched = `${baseContent}${PREVIOUS_TURN_CONTEXT_MARKER}${toolDigest}`;
  return { role: message.role, content: enriched };
}

/**
 * Bug 3 (Estrategia 3): extrae documentos referenciados desde los
 * `tool_result` del agentRun para renderizar pills clickeables al final del
 * mensaje. Reutiliza el mismo contrato (`result.data.document.id/name`) que
 * usa `collectAgentWorkspaceEffects`, así nos quedamos con un único punto de
 * verdad sobre qué cuenta como "abrir documento".
 */
const OPENABLE_TOOL_ACTIONS = new Set([
  'read_document',
  'create_document',
  'update_document',
  'rename_document',
  'move_document'
]);

export function extractReferencedDocuments(agentRun: AgentRun | undefined): AgentDocumentTarget[] {
  if (!agentRun) return [];
  const seen = new Set<string>();
  const out: AgentDocumentTarget[] = [];
  for (const step of agentRun.steps) {
    const result = step.result;
    if (!result?.ok) continue;
    if (!OPENABLE_TOOL_ACTIONS.has(result.name)) continue;
    const raw = result.data?.document;
    if (!raw || typeof raw !== 'object') continue;
    const doc = raw as Record<string, unknown>;
    if (typeof doc.id !== 'string' || !doc.id.trim()) continue;
    if (typeof doc.type === 'string' && doc.type === 'folder') continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    out.push({
      id: doc.id,
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Sin título',
      type: typeof doc.type === 'string' ? doc.type : undefined,
      folder: typeof doc.folder === 'string' ? doc.folder : undefined,
      mimeType: typeof doc.mimeType === 'string' ? doc.mimeType : null
    });
  }
  return out;
}

/**
 * Bug 2: detecta si el agentRun terminó con una tool bloqueada por el perfil
 * de acceso (p. ej. el agente quiso ejecutar `run_worker_command` con perfil
 * Workspace). Devuelve el motivo legible para el banner de reintento o `null`
 * si no hubo bloqueo de capability.
 */
export function detectCapabilityBlock(agentRun: AgentRun | undefined): string | null {
  if (!agentRun) return null;
  for (const step of agentRun.steps) {
    if (step.type !== 'error') continue;
    const haystack = `${step.content || ''} ${step.result?.error || ''} ${step.result?.summary || ''}`.toLowerCase();
    if (/perfil de acceso|capabilit|bloquead|workercommand|sin\s+workercommand/.test(haystack)) {
      return step.content?.trim() || step.result?.error || step.result?.summary || 'Tool bloqueada por el perfil de acceso';
    }
  }
  return null;
}
