import { describe, expect, it } from 'vitest';
import { AGENT_KEY_PROVIDERS } from '@/lib/agora-ai/agentKeysApi';
import { PROVIDER_META } from '@/lib/agora-ai/clientSettings';
import { contextWindowForModel } from '@/lib/agora-ai/modelCatalog';

describe('Agora AI · MiniMax', () => {
  it('expone MiniMax-M3 como proveedor configurable con key cifrada', () => {
    expect(AGENT_KEY_PROVIDERS).toContain('minimax');
    expect(PROVIDER_META.minimax).toMatchObject({
      label: 'MiniMax',
      defaultModel: 'MiniMax-M3',
      needsKey: true
    });
  });

  it('publica el contexto oficial de MiniMax-M3', () => {
    expect(contextWindowForModel('minimax', 'MiniMax-M3', {
      lastUpdated: 'test',
      models: []
    })).toBe(1_000_000);
  });
});
