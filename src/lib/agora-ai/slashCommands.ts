/**
 * Slash commands locales del agente. Se reconocen en el input del usuario
 * cuando empiezan con `/` y disparan acciones del cliente sin llamar al
 * modelo. Inspirados en Claude Code: /clear, /compact, /plan, /think,
 * /dryrun, /help.
 */

export type SlashCommandResult =
  | { kind: 'handled'; description: string; sideEffect?: () => void }
  | { kind: 'inject-system'; description: string; injection: string }
  | { kind: 'flag'; description: string; flag: 'plan' | 'think' | 'dry-run' }
  | { kind: 'pass-through' }; // No es slash command, mandar al modelo normal.

export interface SlashCommandHelp {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandHelp[] = [
  { command: '/help', description: 'Lista los comandos disponibles' },
  { command: '/clear', description: 'Limpia el chat actual' },
  { command: '/compact', description: 'Pide al agente compactar el historial conservando objetivos' },
  { command: '/plan', description: 'Forzar plan-mode en el próximo mensaje (el agente publica plan antes de actuar)' },
  { command: '/think', description: 'Pedirle al modelo que razone más antes de responder' },
  { command: '/dryrun', description: 'Modo simulación: las tools destructivas no aplican cambios reales' },
  { command: '/replay', description: 'Pide al agente listar y reproducir un turno guardado' },
  { command: '/memory', description: 'Lista las memorias persistentes del workspace y user' },
  { command: '/hooks', description: 'Lista los hooks PreToolUse/PostToolUse configurados' }
];

export function parseSlashCommand(
  rawInput: string,
  callbacks: {
    onClear?: () => void;
    onShowHelp?: (commands: SlashCommandHelp[]) => void;
  } = {}
): SlashCommandResult {
  const input = rawInput.trim();
  if (!input.startsWith('/')) return { kind: 'pass-through' };
  const [cmd, ...rest] = input.split(/\s+/);
  const args = rest.join(' ').trim();

  switch (cmd) {
    case '/help':
      return {
        kind: 'handled',
        description: 'Mostrando comandos disponibles',
        sideEffect: () => callbacks.onShowHelp?.(SLASH_COMMANDS)
      };
    case '/clear':
      return {
        kind: 'handled',
        description: 'Chat limpiado',
        sideEffect: () => callbacks.onClear?.()
      };
    case '/compact':
      return {
        kind: 'inject-system',
        description: 'Compactar historial',
        injection: 'COMPACT_TURN: resume los turnos previos en máx 200 palabras conservando: 1) objetivo del usuario, 2) decisiones tomadas, 3) datos relevantes recuperados. Continúa la conversación con esa síntesis como contexto.'
      };
    case '/plan':
      return {
        kind: 'flag',
        description: 'Plan mode activado para próximo turno',
        flag: 'plan'
      };
    case '/think':
      return {
        kind: 'flag',
        description: 'Razonamiento extendido para próximo turno',
        flag: 'think'
      };
    case '/dryrun':
    case '/dry-run':
      return {
        kind: 'flag',
        description: 'Dry-run mode: tools destructivas no aplicarán cambios',
        flag: 'dry-run'
      };
    case '/replay':
      return {
        kind: 'inject-system',
        description: 'Solicitando replay',
        injection: args
          ? `Llama agent_replay_turn con turnId="${args}" y luego re-ejecuta el plan registrado.`
          : 'Llama agent_list_turn_snapshots y muestra al usuario los snapshots disponibles para que elija cuál reproducir.'
      };
    case '/memory':
      return {
        kind: 'inject-system',
        description: 'Listando memorias',
        injection: 'Llama agent_list_memories y muestra al usuario lo que recuerdas sobre él y este workspace.'
      };
    case '/hooks':
      return {
        kind: 'inject-system',
        description: 'Listando hooks',
        injection: 'Llama agent_list_hooks y muestra al usuario los hooks PreToolUse/PostToolUse activos.'
      };
    default:
      return { kind: 'pass-through' };
  }
}
