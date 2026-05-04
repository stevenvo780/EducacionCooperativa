import { describe, it, expect, vi } from 'vitest';
import { parseSlashCommand, SLASH_COMMANDS } from '@/lib/agora-ai/slashCommands';

describe('parseSlashCommand', () => {
  it('input sin slash → pass-through', () => {
    expect(parseSlashCommand('hola').kind).toBe('pass-through');
  });

  it('/help dispara onShowHelp con la lista de comandos', () => {
    const onShowHelp = vi.fn();
    const result = parseSlashCommand('/help', { onShowHelp });
    expect(result.kind).toBe('handled');
    if (result.kind === 'handled') result.sideEffect?.();
    expect(onShowHelp).toHaveBeenCalledWith(SLASH_COMMANDS);
  });

  it('/clear dispara onClear', () => {
    const onClear = vi.fn();
    const result = parseSlashCommand('/clear', { onClear });
    expect(result.kind).toBe('handled');
    if (result.kind === 'handled') result.sideEffect?.();
    expect(onClear).toHaveBeenCalled();
  });

  it('/plan devuelve flag plan', () => {
    const result = parseSlashCommand('/plan');
    expect(result.kind).toBe('flag');
    if (result.kind === 'flag') expect(result.flag).toBe('plan');
  });

  it('/dryrun y /dry-run aceptan ambos formatos', () => {
    expect(parseSlashCommand('/dryrun').kind).toBe('flag');
    expect(parseSlashCommand('/dry-run').kind).toBe('flag');
  });

  it('/replay con id manda llamar agent_replay_turn', () => {
    const result = parseSlashCommand('/replay turn-123');
    expect(result.kind).toBe('inject-system');
    if (result.kind === 'inject-system') {
      expect(result.injection).toContain('turn-123');
      expect(result.injection).toContain('agent_replay_turn');
    }
  });

  it('/memory inyecta call a agent_list_memories', () => {
    const result = parseSlashCommand('/memory');
    expect(result.kind).toBe('inject-system');
    if (result.kind === 'inject-system') {
      expect(result.injection).toContain('agent_list_memories');
    }
  });

  it('comando desconocido → pass-through', () => {
    expect(parseSlashCommand('/nope').kind).toBe('pass-through');
  });
});
