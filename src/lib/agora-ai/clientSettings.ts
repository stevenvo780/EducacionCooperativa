import { loadClientConfig, saveClientConfig } from '@/lib/clientConfigStorage';
import {
  DEFAULT_CLIENT_AGENT_ACCESS_POLICY,
  createAgentAccessPolicyFromProfile,
  normalizeAgentAccessPolicy
} from '@/lib/agora-ai/accessPolicy';
import type { AgentAccessPolicy, AgentAccessProfileId, AgentMode, AIProvider } from '@/lib/agora-ai/types';

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  endpoint: string;
}

export const PROVIDER_META: Record<AIProvider, {
  label: string;
  color: string;
  defaultModel: string;
  needsKey: boolean;
  modelPlaceholder: string;
}> = {
  openai: {
    label: 'ChatGPT (OpenAI)',
    color: 'text-emerald-400',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    modelPlaceholder: 'gpt-4o-mini, gpt-4o, o1-mini…'
  },
  anthropic: {
    label: 'Claude (Anthropic)',
    color: 'text-amber-400',
    defaultModel: 'claude-haiku-4-5-20251001',
    needsKey: true,
    modelPlaceholder: 'claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6…'
  },
  ollama: {
    label: 'Ollama',
    color: 'text-sky-400',
    defaultModel: 'llama3.2',
    needsKey: false,
    modelPlaceholder: 'llama3.2, mistral, gemma3…'
  },
  gemini: {
    label: 'Gemini (Google)',
    color: 'text-violet-400',
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
    modelPlaceholder: 'gemini-2.0-flash, gemini-1.5-pro…'
  },
  deepseek: {
    label: 'DeepSeek',
    color: 'text-cyan-400',
    defaultModel: 'deepseek-v4-flash',
    needsKey: true,
    modelPlaceholder: 'deepseek-v4-flash, deepseek-v4-pro, deepseek-chat…'
  }
};

export const AI_SETTINGS_CHANGED_EVENT = 'agora:ai-settings-changed';
export const CONFIG_KEY = 'agoraAIConfig';
export const AGENT_MODE_KEY = 'agoraAIMode';
export const AGENT_ACCESS_POLICY_KEY = 'agoraAIAccessPolicy';
export const AGENT_TRACE_EXPANDED_KEY = 'agoraAITraceExpanded';
const AGENT_USER_INSTRUCTIONS_KEY_PREFIX = 'agoraAIUserInstructions:';
export const AGENT_USER_INSTRUCTIONS_MAX_LENGTH = 4000;

// Default = deepseek (server-side, sin requerir Ollama local). Antes era
// 'ollama': si el user no tenía Ollama en localhost:11434 el panel quedaba
// "Ejecutando agente…" indefinidamente. Deepseek funciona out-of-the-box
// con la API key en server-side; el user puede cambiar a Ollama desde Ajustes.
export const DEFAULT_CONFIG: AIProviderConfig = {
  provider: 'deepseek',
  model: '',
  endpoint: ''
};

const CONFIG_STORAGE = {
  storageKey: CONFIG_KEY,
  defaults: DEFAULT_CONFIG,
  sensitiveKeys: [] as const
};

export function loadAIProviderConfig(): AIProviderConfig {
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(`${CONFIG_KEY}:session`); } catch { /* ignore */ }
  }
  return loadClientConfig(CONFIG_STORAGE);
}

export function saveAIProviderConfig(cfg: AIProviderConfig) {
  saveClientConfig(CONFIG_STORAGE, cfg);
  dispatchAISettingsChanged();
}

export function loadAgentMode(): AgentMode {
  if (typeof window === 'undefined') return 'agent';
  const raw = window.localStorage.getItem(AGENT_MODE_KEY);
  return raw === 'chat' ? 'chat' : 'agent';
}

export function saveAgentMode(mode: AgentMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AGENT_MODE_KEY, mode);
  dispatchAISettingsChanged();
}

export function loadAgentAccessPolicy(): AgentAccessPolicy {
  if (typeof window === 'undefined') return DEFAULT_CLIENT_AGENT_ACCESS_POLICY;
  try {
    const raw = window.localStorage.getItem(AGENT_ACCESS_POLICY_KEY);
    if (!raw) return DEFAULT_CLIENT_AGENT_ACCESS_POLICY;
    return normalizeAgentAccessPolicy(JSON.parse(raw) as Partial<AgentAccessPolicy>, DEFAULT_CLIENT_AGENT_ACCESS_POLICY);
  } catch {
    return DEFAULT_CLIENT_AGENT_ACCESS_POLICY;
  }
}

export function saveAgentAccessPolicy(policy: AgentAccessPolicy) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeAgentAccessPolicy(policy, DEFAULT_CLIENT_AGENT_ACCESS_POLICY);
  window.localStorage.setItem(AGENT_ACCESS_POLICY_KEY, JSON.stringify(normalized));
  dispatchAISettingsChanged();
}

export function saveAgentAccessProfile(profile: Exclude<AgentAccessProfileId, 'custom'>) {
  saveAgentAccessPolicy(createAgentAccessPolicyFromProfile(profile));
}

export function dispatchAISettingsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT));
}

export function loadAgentTraceExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AGENT_TRACE_EXPANDED_KEY) === '1';
}

export function saveAgentTraceExpanded(expanded: boolean) {
  if (typeof window === 'undefined') return;
  if (expanded) window.localStorage.setItem(AGENT_TRACE_EXPANDED_KEY, '1');
  else window.localStorage.removeItem(AGENT_TRACE_EXPANDED_KEY);
  dispatchAISettingsChanged();
}

const userInstructionsKeyFor = (workspaceId: string) => `${AGENT_USER_INSTRUCTIONS_KEY_PREFIX}${workspaceId || 'default'}`;

export function loadAgentUserInstructions(workspaceId: string): string {
  if (typeof window === 'undefined') return '';
  const raw = window.localStorage.getItem(userInstructionsKeyFor(workspaceId));
  return (raw || '').slice(0, AGENT_USER_INSTRUCTIONS_MAX_LENGTH);
}

export function saveAgentUserInstructions(workspaceId: string, value: string) {
  if (typeof window === 'undefined') return;
  const trimmed = (value || '').trim().slice(0, AGENT_USER_INSTRUCTIONS_MAX_LENGTH);
  if (trimmed) {
    window.localStorage.setItem(userInstructionsKeyFor(workspaceId), trimmed);
  } else {
    window.localStorage.removeItem(userInstructionsKeyFor(workspaceId));
  }
  dispatchAISettingsChanged();
}
