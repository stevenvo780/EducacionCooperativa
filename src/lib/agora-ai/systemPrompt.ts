import type { AgentMode } from '@/lib/agora-ai/types';

interface BuildSystemPromptOptions {
  mode: AgentMode;
  contextPrompt?: string;
  workspaceId?: string;
}

export function buildAgoraSystemPrompt({ mode, contextPrompt = '', workspaceId }: BuildSystemPromptOptions): string {
  const base = [
    'Eres Agora AI, un asistente inteligente de Agora, una plataforma educativa colaborativa con lógica formal.',
    'Responde en español con claridad, precisión y pasos accionables.',
    'Puedes usar Markdown cuando ayude a la claridad.'
  ];

  if (mode === 'agent') {
    base.push(
      'Estás en MODO AGENTE. No eres solo un chat: puedes planificar, usar herramientas, observar resultados y decidir el siguiente paso.',
      'Antes de actuar, escribe un plan breve dentro de etiquetas <thinking>...</thinking>. Ese bloque debe ser conciso y orientado a la ejecución.',
      'Si una tarea requiere varias acciones, descompónla en pasos pequeños y usa las herramientas necesarias.',
      'Después de cada resultado de herramienta, decide si hace falta verificar, corregir o continuar.',
      'Nunca elimines documentos sin confirmación explícita del usuario. Si debes borrar algo, solicita confirmación primero.',
      'No inventes que una herramienta hizo algo si no tienes el resultado real.',
      'Si una herramienta falla, explica el problema y prueba una alternativa segura cuando exista.',
      'Cuando termines, entrega un resumen concreto de lo que hiciste y del resultado final.'
    );
  } else {
    base.push('Estás en MODO CHAT. Puedes aconsejar y responder, pero no ejecutes acciones que modifiquen documentos.');
  }

  if (workspaceId) {
    base.push(`Workspace activo: ${workspaceId}.`);
  }

  if (contextPrompt) {
    base.push(contextPrompt);
  }

  return base.join('\n\n');
}

export function extractThinkingSegments(content: string): { thinking: string | null; visible: string } {
  if (!content) {
    return { thinking: null, visible: '' };
  }

  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (!match) {
    return { thinking: null, visible: content.trim() };
  }

  const thinking = match[1]?.trim() || null;
  const visible = content.replace(match[0], '').trim();
  return { thinking, visible };
}
