import { describe, expect, it } from 'vitest';
import { AGENT_KEY_PROVIDERS } from '@/lib/agora-ai/agentKeysApi';
import { PROVIDER_META } from '@/lib/agora-ai/clientSettings';
import {
  contextWindowForModel,
  continuityModelsForProvider,
  type ModelCatalog
} from '@/lib/agora-ai/modelCatalog';

const catalog: ModelCatalog = {
  lastUpdated: 'test',
  models: [
    { id: 'MiniMax-M3', family: 'minimax', label: 'MiniMax M3', contextWindow: 1_000_000, maxOutputTokens: 128_000, verified: 'official' },
    { id: 'deepseek-v4-flash', family: 'deepseek', label: 'DeepSeek V4 Flash', contextWindow: 1_000_000, maxOutputTokens: 384_000, verified: 'official' }
  ]
};

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

  it('lista MiniMax-M3 como modelo de continuidad al seleccionar MiniMax', () => {
    expect(continuityModelsForProvider(catalog, 'minimax').map((model) => model.id)).toEqual(['MiniMax-M3']);
  });

  it('no mezcla modelos de otros proveedores en continuidad', () => {
    expect(continuityModelsForProvider(catalog, 'deepseek').map((model) => model.id)).toEqual(['deepseek-v4-flash']);
  });
});
