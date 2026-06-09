'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Wrench, Sparkles, Code2, Shield, FolderGit2, KeyRound, Users, BookMarked, RotateCcw, Copy, Eye, EyeOff, RefreshCcw, Terminal, ExternalLink, Check, Download, Loader2, Cpu, type LucideIcon } from 'lucide-react';
import { authFetch } from '@/services/apiClient';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEditorToolbarVisibility } from '@/store/dashboardSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';
import { TOOLBAR_GROUP_LABELS, DEFAULT_TOOLBAR_VISIBILITY, TOOLBAR_VISIBILITY_STORAGE_KEY } from '@/components/mosaic-editor/constants';
import type { ToolbarGroupKey, ToolbarVisibility } from '@/components/mosaic-editor/types';
import {
  loadConfig as loadStEditorConfig,
  saveConfig as saveStEditorConfig,
  getDefaultConfig as getDefaultStEditorConfig,
  FEATURE_LABELS as ST_FEATURE_LABELS,
  ALL_FEATURES as ST_ALL_FEATURES,
  type EditorConfig as StEditorConfig
} from '@/components/editor/codemirror/st-editor-config';
import { LinterRegistry } from '@/lib/linters/registry';
import { fold } from '@/lib/text-fold';
import { MarkdownLinterRegistry, type RuleState } from '@/lib/markdown-linter/registry';
import { AGORA_EVENTS, dispatchAgoraEvent } from '@/lib/agora-events';
import { RULE_CATEGORY_LABELS, type RuleCategory } from '@/lib/markdown-linter/types';
import {
  AGENT_ACCESS_CAPABILITIES,
  AGENT_ACCESS_PROFILE_ORDER,
  AGENT_ACCESS_PROFILES,
  DEFAULT_CLIENT_AGENT_ACCESS_POLICY,
  getAgentToolAccessState,
  normalizeAgentAccessPolicy
} from '@/lib/agora-ai/accessPolicy';
import { AGORA_AGENT_TOOLS } from '@/lib/agora-ai/toolDefinitions';
import {
  PROVIDER_META,
  loadAIProviderConfig,
  saveAIProviderConfig,
  loadAgentAccessPolicy,
  saveAgentAccessPolicy,
  loadAgentUserInstructions,
  saveAgentUserInstructions,
  AGENT_USER_INSTRUCTIONS_MAX_LENGTH,
  type AIProviderConfig
} from '@/lib/agora-ai/clientSettings';
import {
  getModelCatalogSync,
  loadModelCatalog,
  modelsForProvider,
  type CatalogModel,
  type ModelCatalog
} from '@/lib/agora-ai/modelCatalog';
import {
  DEFAULT_AGENT_SETTINGS,
  loadAgentSettings,
  saveAgentSettings,
  type AgentSettings
} from '@/lib/agora-ai/agentSettingsApi';
import { useAuth } from '@/context/AuthContext';
import type { AgentAccessCapability, AgentAccessPolicy, AIProvider } from '@/lib/agora-ai/types';
import AgentApiKeysPanel from '@/components/dashboard/AgentApiKeysPanel';
import CliTokensPanel from '@/components/dashboard/CliTokensPanel';
import type { SettingsSectionId } from '@/lib/settings-events';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import { EMPTY_SEMANTIC_WORKSPACE_STATE } from '@/lib/semantic/workspace-state';
import {
  loadSemanticWorkspaceState,
  setSemanticWorkspacePreferences,
  type SemanticWorkspacePreferences,
  type SemanticWorkspaceState
} from '@/services/editorSemanticStore';
import { saveSemanticWorkspaceStateApi } from '@/services/semanticStateApi';

export type { SettingsSectionId } from '@/lib/settings-events';

interface Section {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

const SECTIONS: Section[] = [
  { id: 'editor-md', label: 'Editor Markdown', icon: Wrench, description: 'Toolbar y módulos visibles' },
  { id: 'editor-st', label: 'Editor ST', icon: Code2, description: 'Comportamiento del editor de código' },
  { id: 'semantic', label: 'Mesa semántica', icon: BookMarked, description: 'Modo de experiencia y previews' },
  { id: 'ai', label: 'Agora IA', icon: Sparkles, description: 'Proveedor, modelo, permisos' },
  { id: 'linter', label: 'Linter Markdown', icon: Shield, description: 'Reglas activas y diccionario personal' },
  { id: 'git-access', label: 'Acceso Git', icon: FolderGit2, description: 'Tokens y URLs de clone para Forgejo' },
  { id: 'cli-tokens', label: 'Acceso CLI', icon: Terminal, description: 'Personal Access Tokens para el CLI' },
  { id: 'cuenta', label: 'Cuenta y permisos', icon: KeyRound, description: 'Contraseña y miembros del workspace' }
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  activeWorkspaceId?: string;
  activeUserId?: string;
  onOpenChangePassword: () => void;
  onOpenMembers: () => void;
  onOpenWorkerInstall?: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  initialSection = 'editor-md',
  activeWorkspaceId,
  activeUserId,
  onOpenChangePassword,
  onOpenMembers,
  onOpenWorkerInstall
}: SettingsModalProps) {
  const [section, setSection] = useState<SettingsSectionId>(initialSection);

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Configuración"
    >
      <div
        className="relative flex h-[min(640px,92vh)] w-full max-w-4xl overflow-hidden rounded-xl border border-surface-700/60 bg-surface-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <aside className="flex w-56 shrink-0 flex-col border-r border-surface-700/40 bg-surface-925/40">
          <div className="flex items-center gap-2 border-b border-surface-700/40 px-4 py-3">
            <SettingsIcon className="h-4 w-4 text-mandy-300" />
            <h2 className="text-sm font-semibold text-surface-100">Configuración</h2>
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSection(s.id)}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition ${
                        active
                          ? 'bg-mandy-500/10 text-white'
                          : 'text-surface-300 hover:bg-surface-800/60'
                      }`}
                    >
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? 'text-mandy-300' : 'text-surface-500'}`} />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{s.label}</span>
                        <span className="truncate text-[10px] text-surface-500">{s.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-surface-700/40 px-4 py-3">
            <h3 className="text-sm font-semibold text-surface-100">
              {SECTIONS.find((s) => s.id === section)?.label}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-surface-400 hover:bg-surface-800/70 hover:text-white"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {section === 'editor-md' && <EditorMdSection />}
            {section === 'editor-st' && <EditorStSection />}
            {section === 'semantic' && (
              <SemanticSection activeWorkspaceId={activeWorkspaceId} activeUserId={activeUserId} />
            )}
            {section === 'ai' && (
              <AISection activeWorkspaceId={activeWorkspaceId} activeUserId={activeUserId} />
            )}
            {section === 'linter' && <LintersSection />}
            {section === 'git-access' && <GitAccessSection />}
            {section === 'cli-tokens' && <CliTokensPanel />}
            {section === 'cuenta' && (
              <CuentaSection
                onOpenChangePassword={() => { onOpenChangePassword(); onClose(); }}
                onOpenMembers={() => { onOpenMembers(); onClose(); }}
                onOpenGitAccess={() => setSection('git-access')}
                onOpenWorkerInstall={onOpenWorkerInstall ? () => { onOpenWorkerInstall(); onClose(); } : undefined}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const CAPABILITY_LABELS: Record<AgentAccessCapability, { label: string; description: string }> = {
  workspaceContext: {
    label: 'Contexto automático',
    description: 'Incluye resumen del workspace en cada conversación.'
  },
  documentsRead: {
    label: 'Leer documentos',
    description: 'Listar, buscar, resumir, analizar, revisar PDF y consultar actividad.'
  },
  documentsWrite: {
    label: 'Editar documentos',
    description: 'Crear, actualizar, renombrar, mover y restaurar documentos.'
  },
  documentsDelete: {
    label: 'Eliminar documentos',
    description: 'Permite borrar documentos, siempre con confirmación.'
  },
  snippets: {
    label: 'Snippets',
    description: 'Leer y modificar snippets reutilizables.'
  },
  board: {
    label: 'Tablero Kanban',
    description: 'Leer y modificar columnas y tarjetas.'
  },
  semantic: {
    label: 'Glosario semántico',
    description: 'Leer y editar conceptos y relaciones.'
  },
  logic: {
    label: 'Lógica formal / ST',
    description: 'Formalizar, validar y ejecutar programas ST.'
  },
  gitRead: {
    label: 'Git lectura',
    description: 'Consultar status, historial, diff, repos e información Git.'
  },
  gitWrite: {
    label: 'Git escritura',
    description: 'Commit, pull, push, ramas, checkout y revert, con confirmación.'
  },
  workerRead: {
    label: 'Worker lectura',
    description: 'Ver estado, archivos, logs y sesiones reales del worker.'
  },
  workerCommand: {
    label: 'Comandos worker',
    description: 'Ejecutar comandos, escribir archivos y reiniciar procesos.'
  },
  uiControl: {
    label: 'UI y control agente',
    description: 'Abrir paneles, mostrar diffs, planes, memoria, hooks y snapshots.'
  },
  debug: {
    label: 'Debug a Problemas',
    description: 'Publicar diagnósticos del agente en el bus de Problemas.'
  }
};

type ToolPermissionGroupId = AgentAccessCapability | 'unrestricted';

type ToolPermissionRowModel = {
  name: string;
  description: string;
  enabled: boolean;
  source: 'tool' | 'capability' | 'unrestricted';
};

const TOOL_PERMISSION_GROUP_ORDER: ToolPermissionGroupId[] = [
  ...AGENT_ACCESS_CAPABILITIES.filter((capability) => capability !== 'workspaceContext'),
  'unrestricted'
];

function toolGroupLabel(group: ToolPermissionGroupId): string {
  if (group === 'unrestricted') return 'Sin grupo';
  return CAPABILITY_LABELS[group].label;
}

function compactToolDescription(description: string): string {
  return description.length > 180 ? `${description.slice(0, 177).trim()}...` : description;
}

/** Heurística: un modelo es "rápido/barato" (apto para el aux model de
 *  clasificación) si su id sugiere una variante flash/mini/haiku/lite/small/nano
 *  o si es deepseek-chat (el barato de deepseek). */
function isFastCheapModel(model: CatalogModel): boolean {
  const id = model.id.toLowerCase();
  return /flash|mini|haiku|lite|small|nano|8b|7b|3b|1\.5b|deepseek-chat/.test(id);
}

function modelOptionLabel(model: CatalogModel): string {
  const ctx = `${(model.contextWindow / 1000).toFixed(0)}K`;
  return `${model.label} · ${model.family} · ${ctx}${model.verified === 'unverified' ? ' (no verificado)' : ''}`;
}

function AgentModelsSection({
  uid,
  catalog,
  settings,
  loaded,
  savedAt,
  error,
  persist
}: {
  uid: string | null;
  catalog: ModelCatalog;
  settings: AgentSettings;
  loaded: boolean;
  savedAt: number | null;
  error: string | null;
  persist: (partial: Partial<AgentSettings>) => void;
}) {
  const allModels = useMemo(
    () => [...catalog.models].sort((a, b) => a.family.localeCompare(b.family) || a.label.localeCompare(b.label)),
    [catalog]
  );
  const fastModels = useMemo(() => allModels.filter(isFastCheapModel), [allModels]);

  // Si el modelo guardado no está en el catálogo (modelo manual / antiguo) lo
  // mantenemos como opción adicional para no perder la selección del user.
  const auxOptions = useMemo(() => {
    if (settings.auxModel && !fastModels.some((m) => m.id === settings.auxModel)) {
      const fromAll = allModels.find((m) => m.id === settings.auxModel);
      const extra: CatalogModel = fromAll ?? { id: settings.auxModel, label: `${settings.auxModel} (manual)`, family: 'deepseek', contextWindow: 0, maxOutputTokens: 0, verified: 'unverified' };
      return [extra, ...fastModels];
    }
    return fastModels;
  }, [fastModels, allModels, settings.auxModel]);

  return (
    <div className="border-t border-surface-700/40 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-surface-200">Autonomía del agente</h4>
        {uid && savedAt && <span className="text-[10px] text-emerald-400">Guardado</span>}
      </div>
      <SectionHelper>
        El modelo principal se elige arriba (campo «Modelo principal»). Aquí va el modelo auxiliar
        —barato/rápido para la clasificación en segundo plano— y el modo autónomo. Todo se sincroniza
        con tu cuenta y lo usa el backend del agente.
      </SectionHelper>

      {!uid && (
        <p className="mt-2 text-[11px] text-amber-300">Inicia sesión para configurar el agente.</p>
      )}
      {error && (
        <p className="mt-2 text-[11px] text-red-400" role="alert">No se pudo sincronizar: {error}</p>
      )}

      <div className="mt-3">
        <label className="block text-xs">
          <span className="mb-1 block text-surface-400">Modelo auxiliar (rápido / clasificación)</span>
          <select
            value={settings.auxModel}
            disabled={!uid || !loaded}
            onChange={(e) => persist({ auxModel: e.target.value })}
            className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40 disabled:opacity-50"
          >
            <option value="" className="bg-surface-900 text-surface-100">— Default del backend —</option>
            {auxOptions.map((m) => (
              <option key={m.id} value={m.id} className="bg-surface-900 text-surface-100">{modelOptionLabel(m)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <ToggleRow
          label="Modo autónomo (bypass)"
          description="El agente auto-continúa tareas largas sin pedir confirmación en cada paso. Úsalo solo si confías en las acciones del perfil activo: salta los puntos de control que normalmente esperan tu visto bueno."
          checked={settings.autonomousMode}
          onChange={(v) => persist({ autonomousMode: v })}
        />
      </div>
    </div>
  );
}

function AISection({ activeWorkspaceId, activeUserId }: { activeWorkspaceId?: string; activeUserId?: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? activeUserId ?? null;
  const [config, setConfig] = useState<AIProviderConfig>(() => loadAIProviderConfig());
  const [accessPolicy, setAccessPolicy] = useState<AgentAccessPolicy>(() => loadAgentAccessPolicy());
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>(getModelCatalogSync);
  const [userInstructionsDraft, setUserInstructionsDraft] = useState<string>('');
  const [userInstructionsSavedAt, setUserInstructionsSavedAt] = useState<number | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS);
  const [agentSettingsLoaded, setAgentSettingsLoaded] = useState(false);
  const [agentSettingsSavedAt, setAgentSettingsSavedAt] = useState<number | null>(null);
  const [agentSettingsError, setAgentSettingsError] = useState<string | null>(null);
  const meta = PROVIDER_META[config.provider];
  const providerModels = modelsForProvider(modelCatalog, config.provider);
  const workspaceForInstructions = activeWorkspaceId || 'personal';

  useEffect(() => {
    let cancelled = false;
    void loadModelCatalog().then((catalog) => { if (!cancelled) setModelCatalog(catalog); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setUserInstructionsDraft(loadAgentUserInstructions(workspaceForInstructions));
    setUserInstructionsSavedAt(null);
  }, [workspaceForInstructions]);

  // Fuente de verdad del modelo del agente: `agentSettings.mainModel` en
  // `users/{uid}` (lo que lee el backend). El selector de modelo de esta
  // sección y el de "Modelos y autonomía" escriben aquí — no a estados locales
  // separados — para que elegir en cualquier lado quede coherente.
  useEffect(() => {
    if (!uid) { setAgentSettingsLoaded(true); return; }
    let cancelled = false;
    setAgentSettingsLoaded(false);
    loadAgentSettings(uid)
      .then((s) => { if (!cancelled) { setAgentSettings(s); setAgentSettingsError(null); } })
      .catch((e) => { if (!cancelled) setAgentSettingsError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setAgentSettingsLoaded(true); });
    return () => { cancelled = true; };
  }, [uid]);

  const persistAgentSettings = useCallback((partial: Partial<AgentSettings>) => {
    setAgentSettings((prev) => {
      const next = { ...prev, ...partial };
      if (uid) {
        setAgentSettingsSavedAt(null);
        saveAgentSettings(uid, next)
          .then(() => setAgentSettingsSavedAt(Date.now()))
          .catch((e) => setAgentSettingsError(e instanceof Error ? e.message : String(e)));
      }
      return next;
    });
  }, [uid]);

  const updateConfig = (partial: Partial<AIProviderConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveAIProviderConfig(next);
      return next;
    });
  };

  // El selector "Modelo" escribe la fuente de verdad (`agentSettings.mainModel`)
  // y espeja el valor en `config.model` para que el fallback que el stream manda
  // en el body coincida con lo que el backend ya resuelve desde agentSettings.
  const updateMainModel = (modelId: string) => {
    persistAgentSettings({ mainModel: modelId });
    updateConfig({ model: modelId });
  };

  const updatePolicy = (nextPolicy: AgentAccessPolicy) => {
    const normalized = normalizeAgentAccessPolicy(nextPolicy, DEFAULT_CLIENT_AGENT_ACCESS_POLICY);
    setAccessPolicy(normalized);
    saveAgentAccessPolicy(normalized);
  };

  const applyProfile = (profile: Exclude<AgentAccessPolicy['profile'], 'custom'>) => {
    updatePolicy({
      profile,
      capabilities: { ...AGENT_ACCESS_PROFILES[profile].capabilities }
    });
  };

  const toggleCapability = (capability: AgentAccessCapability, enabled: boolean) => {
    updatePolicy({
      profile: 'custom',
      capabilities: {
        ...accessPolicy.capabilities,
        [capability]: enabled
      },
      toolPermissions: accessPolicy.toolPermissions
    });
  };

  const toolPermissionGroups = useMemo(() => {
    const groups = new Map<ToolPermissionGroupId, ToolPermissionRowModel[]>(
      TOOL_PERMISSION_GROUP_ORDER.map((group): [ToolPermissionGroupId, ToolPermissionRowModel[]] => [group, []])
    );

    for (const tool of AGORA_AGENT_TOOLS) {
      const state = getAgentToolAccessState(tool.name, accessPolicy);
      const group = state.capability ?? 'unrestricted';
      const rows = groups.get(group) ?? [];
      rows.push({
        name: tool.name,
        description: compactToolDescription(tool.description),
        enabled: state.enabled,
        source: state.source
      });
      groups.set(group, rows);
    }

    return TOOL_PERMISSION_GROUP_ORDER
      .map((group) => ({
        id: group,
        label: toolGroupLabel(group),
        tools: groups.get(group) ?? []
      }))
      .filter((group) => group.tools.length > 0);
  }, [accessPolicy]);

  const enabledToolCount = toolPermissionGroups.reduce((count, group) => (
    count + group.tools.filter((tool) => tool.enabled).length
  ), 0);
  const toolOverrideCount = Object.keys(accessPolicy.toolPermissions ?? {}).length;

  const toggleToolPermission = (toolName: string, enabled: boolean) => {
    updatePolicy({
      profile: 'custom',
      capabilities: { ...accessPolicy.capabilities },
      toolPermissions: {
        ...(accessPolicy.toolPermissions ?? {}),
        [toolName]: enabled
      }
    });
  };

  const resetToolPermission = (toolName: string) => {
    const nextToolPermissions = { ...(accessPolicy.toolPermissions ?? {}) };
    delete nextToolPermissions[toolName];
    updatePolicy({
      profile: 'custom',
      capabilities: { ...accessPolicy.capabilities },
      toolPermissions: Object.keys(nextToolPermissions).length > 0 ? nextToolPermissions : undefined
    });
  };

  const resetAllToolPermissions = () => {
    updatePolicy({
      profile: 'custom',
      capabilities: { ...accessPolicy.capabilities }
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHelper>
          Elige proveedor y modelo. Las API keys se gestionan en el panel de abajo (cifradas server-side); este navegador nunca conserva el plaintext.
        </SectionHelper>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {(Object.keys(PROVIDER_META) as AIProvider[]).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => updateConfig({ provider })}
              className={`rounded-md border px-2 py-1.5 text-left text-xs transition ${
                config.provider === provider
                  ? 'border-mandy-400/50 bg-mandy-500/10 text-mandy-100'
                  : 'border-surface-700/50 bg-surface-925/50 text-surface-400 hover:border-surface-600 hover:text-surface-200'
              }`}
            >
              <div className={`font-medium ${PROVIDER_META[provider].color}`}>{PROVIDER_META[provider].label.split('(')[0]?.trim() || provider}</div>
              <div className="mt-0.5 truncate text-[10px] text-surface-500">{PROVIDER_META[provider].label.split('(')[1]?.replace(')', '') ?? ''}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {config.provider === 'ollama' && (
          <label className="block text-xs">
            <span className="mb-1 block text-surface-400">URL de Ollama</span>
            <input
              type="text"
              value={config.endpoint}
              onChange={(e) => updateConfig({ endpoint: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 placeholder:text-surface-400 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
            />
          </label>
        )}

        <label className="block text-xs">
          <span className="mb-1 flex items-center justify-between gap-2 text-surface-400">
            <span>Modelo principal</span>
            {uid && agentSettingsSavedAt && <span className="text-[10px] text-emerald-400">Guardado</span>}
          </span>
          {providerModels.length > 0 ? (
            <>
              <select
                value={providerModels.some((m) => m.id === agentSettings.mainModel) ? agentSettings.mainModel : '__custom__'}
                disabled={!uid || !agentSettingsLoaded}
                onChange={(e) => {
                  if (e.target.value === '__custom__') return;
                  updateMainModel(e.target.value);
                }}
                className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40 disabled:opacity-50"
              >
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-surface-900 text-surface-100">
                    {m.label} — {(m.contextWindow / 1000).toFixed(0)}K ctx{m.verified === 'unverified' ? ' (no verificado)' : ''}
                  </option>
                ))}
                <option value="__custom__" className="bg-surface-900 text-surface-100">— Otro (escribir abajo) —</option>
              </select>
              <input
                type="text"
                value={agentSettings.mainModel}
                disabled={!uid || !agentSettingsLoaded}
                onChange={(e) => updateMainModel(e.target.value)}
                placeholder={meta.modelPlaceholder}
                className="mt-1 w-full rounded-md border border-surface-700/50 bg-surface-900 px-2 py-1 font-mono text-[11px] text-surface-200 placeholder:text-surface-500 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40 disabled:opacity-50"
              />
            </>
          ) : (
            <input
              type="text"
              value={agentSettings.mainModel}
              disabled={!uid || !agentSettingsLoaded}
              onChange={(e) => updateMainModel(e.target.value)}
              placeholder={meta.modelPlaceholder}
              className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 placeholder:text-surface-400 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40 disabled:opacity-50"
            />
          )}
          <span className="mt-1 block text-[10px] text-surface-500">
            {!uid
              ? 'Inicia sesión para elegir el modelo del agente.'
              : <>Vacío usa el default del backend ({meta.defaultModel}){modelCatalog.lastUpdated !== 'fallback' ? ` · catálogo ${modelCatalog.lastUpdated}` : ''}</>}
          </span>
          {agentSettingsError && (
            <span className="mt-1 block text-[10px] text-red-400" role="alert">No se pudo sincronizar: {agentSettingsError}</span>
          )}
        </label>
      </div>

      <AgentApiKeysPanel />

      <AgentModelsSection
        uid={uid}
        catalog={modelCatalog}
        settings={agentSettings}
        loaded={agentSettingsLoaded}
        savedAt={agentSettingsSavedAt}
        error={agentSettingsError}
        persist={persistAgentSettings}
      />

      <div className="border-t border-surface-700/40 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-surface-200">Perfil de acceso del agente</h4>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          {AGENT_ACCESS_PROFILE_ORDER.map((profile) => (
            <button
              key={profile}
              type="button"
              onClick={() => applyProfile(profile)}
              title={AGENT_ACCESS_PROFILES[profile].description}
              className={`rounded-md border px-2 py-2 text-left text-xs transition ${
                accessPolicy.profile === profile
                  ? 'border-mandy-400/50 bg-mandy-500/10 text-mandy-100'
                  : 'border-surface-700/50 bg-surface-925/50 text-surface-400 hover:border-surface-600 hover:text-surface-200'
              }`}
            >
              <div className="font-medium">{AGENT_ACCESS_PROFILES[profile].label}</div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-surface-500">{AGENT_ACCESS_PROFILES[profile].description}</div>
            </button>
          ))}
        </div>

        {accessPolicy.profile === 'custom' && (
          <p className="mt-2 text-[11px] text-amber-300">Perfil personalizado activo por cambios manuales.</p>
        )}
      </div>

      <div className="border-t border-surface-700/40 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-surface-200">Capacidades del agente</h4>
          <span className="text-[10px] text-surface-500">
            {AGENT_ACCESS_CAPABILITIES.filter((capability) => accessPolicy.capabilities[capability]).length}/{AGENT_ACCESS_CAPABILITIES.length} activas
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AGENT_ACCESS_CAPABILITIES.map((capability) => (
            <ToggleRow
              key={capability}
              label={CAPABILITY_LABELS[capability].label}
              description={CAPABILITY_LABELS[capability].description}
              checked={accessPolicy.capabilities[capability]}
              onChange={(enabled) => toggleCapability(capability, enabled)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-surface-700/40 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-surface-200">Herramientas del agente</h4>
            <span className="text-[10px] text-surface-500">
              {enabledToolCount}/{AGORA_AGENT_TOOLS.length} activas
              {toolOverrideCount > 0 ? ` · ${toolOverrideCount} manuales` : ' · heredando perfil'}
            </span>
          </div>
          <button
            type="button"
            onClick={resetAllToolPermissions}
            disabled={toolOverrideCount === 0}
            className="rounded-md border border-surface-700 bg-surface-925 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Heredar perfil
          </button>
        </div>

        <div className="space-y-3">
          {toolPermissionGroups.map((group) => (
            <section key={group.id} className="rounded-md border border-surface-700/40 bg-surface-925/30">
              <div className="flex items-center justify-between border-b border-surface-700/30 px-3 py-2">
                <h5 className="text-[11px] font-semibold uppercase tracking-wide text-surface-300">{group.label}</h5>
                <span className="text-[10px] text-surface-500">
                  {group.tools.filter((tool) => tool.enabled).length}/{group.tools.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 p-2 lg:grid-cols-2">
                {group.tools.map((tool) => (
                  <ToolPermissionRow
                    key={tool.name}
                    tool={tool}
                    onToggle={(enabled) => toggleToolPermission(tool.name, enabled)}
                    onReset={() => resetToolPermission(tool.name)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Instrucciones del workspace</SectionTitle>
        <SectionHelper>
          Texto extra que se inyecta al system prompt SOLO en este workspace ({workspaceForInstructions}). Útil para fijar el dominio (filosofía, programación, lógica modal, etc.), tono o reglas específicas. Máximo {AGENT_USER_INSTRUCTIONS_MAX_LENGTH} caracteres. Persiste en este navegador.
        </SectionHelper>
        <textarea
          value={userInstructionsDraft}
          onChange={(event) => {
            setUserInstructionsDraft(event.target.value.slice(0, AGENT_USER_INSTRUCTIONS_MAX_LENGTH));
            setUserInstructionsSavedAt(null);
          }}
          placeholder="Ej.: Soy estudiante de filosofía. Cuando formalice argumentos prefiere lógica modal S5 salvo que pida otra cosa. Comenta cada paso de la derivación."
          className="mt-3 h-40 w-full resize-none rounded-md border border-surface-700 bg-surface-925 px-3 py-2 text-sm text-surface-100 placeholder:text-surface-600 focus:border-mandy-400/50 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-surface-500">
          <span>{userInstructionsDraft.length} / {AGENT_USER_INSTRUCTIONS_MAX_LENGTH}{userInstructionsSavedAt ? ' · guardado' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveAgentUserInstructions(workspaceForInstructions, '');
                setUserInstructionsDraft('');
                setUserInstructionsSavedAt(Date.now());
              }}
              className="rounded-md border border-surface-700 bg-surface-925 px-3 py-1 text-surface-300 hover:border-surface-600"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => {
                saveAgentUserInstructions(workspaceForInstructions, userInstructionsDraft);
                setUserInstructionsSavedAt(Date.now());
              }}
              className="rounded-md border border-mandy-500/40 bg-mandy-500/10 px-3 py-1 text-mandy-100 hover:border-mandy-500/60"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorMdSection() {
  const visibility = useAppSelector(selectEditorToolbarVisibility);
  const dispatch = useAppDispatch();

  const set = (group: ToolbarGroupKey, value: boolean) => {
    const next: ToolbarVisibility = { ...visibility, [group]: value };
    dispatch(setEditorToolbarVisibility(next));
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(TOOLBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div className="space-y-4">
      <SectionHelper>
        Decide qué grupos aparecen en la toolbar superior del editor de Markdown.
        Los grupos ocultos se mueven automáticamente al menú overflow ⋯ del editor.
      </SectionHelper>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(TOOLBAR_GROUP_LABELS) as ToolbarGroupKey[]).map((group) => (
          <ToggleRow
            key={group}
            label={TOOLBAR_GROUP_LABELS[group]}
            checked={visibility[group] ?? DEFAULT_TOOLBAR_VISIBILITY[group]}
            onChange={(v) => set(group, v)}
          />
        ))}
      </div>
    </div>
  );
}

function EditorStSection() {
  const [config, setConfig] = useState<StEditorConfig | null>(null);

  useEffect(() => {
    setConfig(loadStEditorConfig());
  }, []);

  const update = (key: keyof StEditorConfig, value: boolean) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      saveStEditorConfig(next);
      dispatchAgoraEvent(AGORA_EVENTS.stEditorConfigChanged, next);
      return next;
    });
  };

  const resetDefaults = () => {
    const next = getDefaultStEditorConfig();
    saveStEditorConfig(next);
    dispatchAgoraEvent(AGORA_EVENTS.stEditorConfigChanged, next);
    setConfig(next);
  };

  if (!config) return <div className="text-xs text-surface-500">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <SectionHelper>
          Toggles que se aplican a los archivos .st (lenguaje formal).
          Los cambios surten efecto al volver a abrir el archivo.
        </SectionHelper>
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-700 bg-surface-925 px-2.5 py-1 text-[11px] text-surface-300 transition hover:border-surface-600 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ST_ALL_FEATURES.map((feature) => (
          <ToggleRow
            key={feature}
            label={ST_FEATURE_LABELS[feature]}
            checked={config[feature]}
            onChange={(v) => update(feature, v)}
          />
        ))}
      </div>
    </div>
  );
}

const EXPERIENCE_MODE_LABELS: Record<SemanticWorkspacePreferences['experienceMode'], { label: string; description: string }> = {
  assisted: {
    label: 'Asistido',
    description: 'Prioriza guías, recomendaciones y flujo pedagógico.'
  },
  hybrid: {
    label: 'Híbrido',
    description: 'Equilibra ayuda contextual con controles avanzados.'
  },
  expert: {
    label: 'Experto',
    description: 'Muestra capas formales y reduce ayudas introductorias.'
  }
};

function SemanticSection({
  activeWorkspaceId,
  activeUserId
}: {
  activeWorkspaceId?: string;
  activeUserId?: string;
}) {
  const workspaceId = activeWorkspaceId || PERSONAL_WORKSPACE_ID;
  const context = useMemo(() => ({
    workspaceId,
    userId: activeUserId ?? null
  }), [activeUserId, workspaceId]);
  const [state, setState] = useState<SemanticWorkspaceState>(() => loadSemanticWorkspaceState(context));

  useEffect(() => {
    setState(loadSemanticWorkspaceState(context));
  }, [context]);

  const persistPreferences = (updates: Partial<SemanticWorkspacePreferences>) => {
    const nextState = setSemanticWorkspacePreferences(context, updates);
    setState(nextState);
    dispatchAgoraEvent(AGORA_EVENTS.semanticPreferencesChanged, { workspaceId, preferences: nextState.preferences });
    void saveSemanticWorkspaceStateApi(workspaceId, nextState).catch((error) => {
      console.warn('[settings] no se pudieron sincronizar preferencias semánticas', error);
    });
  };

  const resetDefaults = () => {
    persistPreferences(EMPTY_SEMANTIC_WORKSPACE_STATE.preferences);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <SectionHelper>
          Estas preferencias pertenecen al workspace activo y afectan cómo se presenta la mesa semántica.
        </SectionHelper>
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-700 bg-surface-925 px-2.5 py-1 text-[11px] text-surface-300 transition hover:border-surface-600 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </button>
      </div>

      <div>
        <SectionTitle>Modo de experiencia</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(EXPERIENCE_MODE_LABELS) as SemanticWorkspacePreferences['experienceMode'][]).map((mode) => {
            const option = EXPERIENCE_MODE_LABELS[mode];
            const active = state.preferences.experienceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => persistPreferences({ experienceMode: mode })}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                  active
                    ? 'border-mandy-400/50 bg-mandy-500/10 text-mandy-100'
                    : 'border-surface-700/50 bg-surface-925/50 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                }`}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block text-[10px] leading-tight text-surface-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ToggleRow
          label="Mostrar preview ST"
          description="Mantiene visibles los previews formales cuando la vista los use."
          checked={state.preferences.showSTPreview}
          onChange={(checked) => persistPreferences({ showSTPreview: checked })}
        />
        <ToggleRow
          label="Mostrar ayudas pedagógicas"
          description="Activa guías y recomendaciones para consolidar conceptos."
          checked={state.preferences.showPedagogicalHints}
          onChange={(checked) => persistPreferences({ showPedagogicalHints: checked })}
        />
      </div>
    </div>
  );
}

function LintersSection() {
  const [, force] = useState(0);
  const [query, setQuery] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<RuleCategory>>(new Set());

  useEffect(() => {
    const offGlobal = LinterRegistry.subscribe(() => force((n) => n + 1));
    const offMd = MarkdownLinterRegistry.subscribe(() => force((n) => n + 1));
    return () => { offGlobal(); offMd(); };
  }, []);

  const linters = LinterRegistry.all();
  const allRules = MarkdownLinterRegistry.getAllRuleStates();
  const profiles = MarkdownLinterRegistry.getProfiles();
  const activeProfile = MarkdownLinterRegistry.getActiveProfile();
  const enabledCount = allRules.filter((r) => r.enabled).length;

  const filtered = query.trim().length === 0
    ? allRules
    : allRules.filter((r) => {
        const q = fold(query);
        return fold(r.meta.name).includes(q)
          || fold(r.meta.description).includes(q)
          || fold(r.meta.id).includes(q);
      });

  const grouped = new Map<RuleCategory, RuleState[]>();
  for (const r of filtered) {
    const cat = r.meta.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  const toggleCat = (cat: RuleCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHelper>
          Linters disponibles por lenguaje. Para añadir uno nuevo, registra
          un descriptor en{' '}
          <code className="rounded bg-surface-800 px-1 py-0.5 text-[10px]">@/lib/linters/registry</code>.
        </SectionHelper>
        <div className="mt-3 space-y-2">
          {linters.map((linter) => (
            <ToggleRow
              key={linter.id}
              label={`${linter.displayName} (${linter.scope.map((s) => `.${s}`).join(', ')})`}
              description={linter.description}
              checked={LinterRegistry.isEnabled(linter.id)}
              onChange={(v) => LinterRegistry.setEnabled(linter.id, v)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-surface-700/40 pt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-xs font-semibold text-surface-200">
            Reglas individuales del linter Markdown
          </h4>
          <span className="text-[11px] text-surface-500">
            {enabledCount}/{allRules.length} activas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-surface-500">Perfil:</span>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => MarkdownLinterRegistry.applyProfile(p.id)}
              title={p.description}
              className={`rounded px-2 py-0.5 text-[10px] transition ${
                activeProfile === p.id
                  ? 'bg-mandy-500/20 text-mandy-200 ring-1 ring-mandy-400/40'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => MarkdownLinterRegistry.resetToDefaults()}
            className="ml-auto rounded px-2 py-0.5 text-[10px] text-surface-500 hover:bg-surface-800 hover:text-surface-200 transition"
          >
            Reset
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar reglas (por nombre, id o descripción)…"
          className="mb-3 w-full rounded-md border border-surface-700/40 bg-surface-925 px-2 py-1.5 text-xs text-surface-100 placeholder:text-surface-500 focus:border-mandy-400/50 focus:outline-none"
        />

        {grouped.size === 0 && (
          <p className="text-[11px] text-surface-500 px-1">Sin coincidencias.</p>
        )}

        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([cat, rules]) => {
            const collapsed = collapsedCats.has(cat);
            const catEnabled = rules.filter((r) => r.enabled).length;
            return (
              <div key={cat} className="rounded-md border border-surface-700/40 bg-surface-925/40">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    className="flex flex-1 items-center gap-2 text-left text-[11px] font-semibold text-surface-100 hover:text-mandy-300"
                  >
                    <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
                    <span>{RULE_CATEGORY_LABELS[cat]}</span>
                    <span className="text-[10px] font-normal text-surface-500">
                      {catEnabled}/{rules.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => MarkdownLinterRegistry.setCategoryEnabled(cat, catEnabled !== rules.length)}
                    className="rounded px-2 py-0.5 text-[10px] text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition"
                  >
                    {catEnabled === rules.length ? 'Desactivar todas' : 'Activar todas'}
                  </button>
                </div>
                {!collapsed && (
                  <ul className="divide-y divide-surface-700/30 border-t border-surface-700/30">
                    {rules.map((r) => (
                      <li key={r.meta.id}>
                        <button
                          type="button"
                          onClick={() => MarkdownLinterRegistry.toggleRule(r.meta.id)}
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-surface-800/40 transition"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-medium text-surface-100">{r.meta.name}</span>
                            <span className="text-[10px] text-surface-500 leading-tight">{r.meta.description}</span>
                          </span>
                          <span
                            aria-hidden
                            className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition ${
                              r.enabled ? 'bg-mandy-500/80' : 'bg-surface-700'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                                r.enabled ? 'left-3' : 'left-0.5'
                              }`}
                            />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CuentaSection({
  onOpenChangePassword,
  onOpenMembers,
  onOpenGitAccess,
  onOpenWorkerInstall
}: {
  onOpenChangePassword: () => void;
  onOpenMembers: () => void;
  onOpenGitAccess: () => void;
  onOpenWorkerInstall?: () => void;
}) {
  return (
    <div className="space-y-2">
      <ActionRow
        icon={KeyRound}
        title="Cambiar contraseña"
        description="Define una nueva contraseña para tu cuenta."
        onClick={onOpenChangePassword}
      />
      <ActionRow
        icon={Users}
        title="Miembros del workspace"
        description="Invita o revoca acceso a personas del equipo."
        onClick={onOpenMembers}
      />
      <ActionRow
        icon={FolderGit2}
        title="Acceso Git (Forgejo)"
        description="Tokens y URLs de clone. Abre la sección dedicada del modal."
        onClick={onOpenGitAccess}
      />
      {onOpenWorkerInstall && (
        <ActionRow
          icon={Cpu}
          title="Mi computadora como worker"
          description="Convertí tu laptop en un worker Linux (Fedora/Podman, Ubuntu/Arch/Docker)."
          onClick={onOpenWorkerInstall}
        />
      )}
    </div>
  );
}

interface GitMeRepo {
  fullName: string;
  cloneUrl: string | null;
  sshUrl: string | null;
  htmlUrl: string | null;
  private: boolean | null;
}
interface GitMeData {
  login: string;
  webUrl: string | null;
  apiUrl: string | null;
  org: string;
  repos: GitMeRepo[];
}

function GitAccessSection() {
  const [info, setInfo] = useState<GitMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{ login: string; token: string; tokenName: string } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importName, setImportName] = useState('');
  const [importToken, setImportToken] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/git/me');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setInfo({
        login: typeof raw?.login === 'string' ? raw.login : '',
        webUrl: typeof raw?.webUrl === 'string' ? raw.webUrl : null,
        apiUrl: typeof raw?.apiUrl === 'string' ? raw.apiUrl : null,
        org: typeof raw?.org === 'string' ? raw.org : '',
        repos: Array.isArray(raw?.repos) ? raw.repos : []
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const issueToken = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/git/me', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIssuedToken({ login: data.login, token: data.token, tokenName: data.tokenName });
      setShowToken(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(null), 1500);
    } catch { /* noop */ }
  };

  const submitImport = async () => {
    const url = importUrl.trim();
    if (!url) { setImportError('URL requerida'); return; }
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await authFetch('/api/git/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          name: importName.trim() || undefined,
          authToken: importToken.trim() || undefined,
          private: true,
          mirror: false
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setImportOpen(false);
      setImportUrl(''); setImportName(''); setImportToken('');
      await load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally { setImportBusy(false); }
  };

  const buildAuthedClone = (cloneUrl: string | null, login: string, token: string) => {
    if (!cloneUrl) return '';
    return cloneUrl.replace(/^https?:\/\//, (proto) => `${proto}${encodeURIComponent(login)}:${encodeURIComponent(token)}@`);
  };

  const repos = info?.repos ?? [];
  const reposCount = repos.length;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <SectionHelper>Genera tokens para git push/clone HTTPS y administra los repos del usuario en Forgejo.</SectionHelper>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="rounded p-1 text-surface-400 hover:bg-surface-700/50 disabled:opacity-50">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && (
        <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300">{error}</div>
      )}
      {loading && !info && (
        <div className="flex items-center gap-2 text-surface-400"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      )}
      {info && (
        <>
          <section className="space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Tu cuenta Forgejo</h3>
            <SettingsField label="Usuario" value={info.login} onCopy={(v) => copy('login', v)} copied={copied === 'login'} />
            {info.webUrl && (
              <SettingsField
                label="URL del servidor"
                value={info.webUrl}
                rightSlot={(
                  <a href={info.webUrl} target="_blank" rel="noreferrer noopener" className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10" aria-label="Abrir Forgejo">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                onCopy={(v) => copy('webUrl', v)}
                copied={copied === 'webUrl'}
              />
            )}
            <p className="text-[11px] text-surface-500">El token actúa como contraseña para git y la web. Inicia sesión en Forgejo con tu usuario y un token.</p>
          </section>

          <section className="space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Token de acceso</h3>
              <button type="button" onClick={() => void issueToken()} disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
                {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : '+'} Generar token nuevo
              </button>
            </div>
            {!issuedToken && (
              <p className="text-[11px] text-surface-500">Cada vez que generas uno, los anteriores siguen activos. Revócalos desde la web de Forgejo.</p>
            )}
            {issuedToken && (
              <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
                <p className="text-[11px] font-medium text-amber-200">Guárdalo ahora. Solo se muestra una vez.</p>
                <div className="flex items-center gap-1 rounded bg-surface-950 px-2 py-1 font-mono text-[11px] text-emerald-300">
                  <span className="flex-1 truncate">{showToken ? issuedToken.token : '•'.repeat(40)}</span>
                  <button type="button" onClick={() => setShowToken((v) => !v)} className="rounded p-1 text-surface-300 hover:bg-surface-800" aria-label="Mostrar/ocultar">
                    {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button type="button" onClick={() => void copy('token', issuedToken.token)} className="rounded p-1 text-surface-300 hover:bg-surface-800" aria-label="Copiar">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                {copied === 'token' && <p className="text-[10px] text-emerald-400">Copiado.</p>}
                <p className="text-[10px] text-surface-400">Nombre: <code>{issuedToken.tokenName}</code></p>
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-md border border-surface-700/40 bg-surface-925/30 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Repositorios ({reposCount})</h3>
              <button type="button" onClick={() => { setImportOpen(true); setImportError(null); }} className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500">
                <Download className="h-3 w-3" /> Importar repo
              </button>
            </div>
            {importOpen && (
              <div className="space-y-2 rounded border border-sky-500/40 bg-sky-500/10 p-2">
                <p className="text-[11px] font-medium text-sky-200">Importar repositorio externo</p>
                <input type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://github.com/usuario/repo.git" className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1 text-[11px] text-surface-100" />
                <input type="text" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Nombre opcional (default: del URL)" className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1 text-[11px] text-surface-100" />
                <input type="password" value={importToken} onChange={(e) => setImportToken(e.target.value)} placeholder="Token (sólo si el repo es privado)" className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1 text-[11px] text-surface-100" />
                {importError && <p className="text-[10px] text-red-400">{importError}</p>}
                <div className="flex gap-1">
                  <button type="button" onClick={() => void submitImport()} disabled={importBusy || !importUrl.trim()} className="flex-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-50">
                    {importBusy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Importar'}
                  </button>
                  <button type="button" onClick={() => { setImportOpen(false); setImportError(null); }} disabled={importBusy} className="rounded border border-surface-700 px-2 py-1 text-[11px] text-surface-200">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {reposCount === 0 && (
              <p className="text-[11px] text-surface-500">Aún no tienes repos. Cada workspace genera uno al activar Git.</p>
            )}
            {repos.map((r) => {
              const httpsUrl = r.cloneUrl
                ? (issuedToken ? buildAuthedClone(r.cloneUrl, issuedToken.login, issuedToken.token) : r.cloneUrl)
                : '';
              const cloneCommand = httpsUrl ? `git clone ${httpsUrl}` : '';
              const vscodeUrl = r.cloneUrl ? `vscode://vscode.git/clone?url=${encodeURIComponent(r.cloneUrl)}` : '';
              return (
                <div key={r.fullName} className="rounded border border-surface-700/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-surface-100">{r.fullName}</span>
                    {r.htmlUrl && (
                      <a href={r.htmlUrl} target="_blank" rel="noreferrer noopener" className="text-emerald-400 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {cloneCommand && (
                    <div className="mt-2 flex gap-1">
                      <button type="button" onClick={() => void copy(`cmd-${r.fullName}`, cloneCommand)} className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500">
                        {copied === `cmd-${r.fullName}` ? <Check className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                        {copied === `cmd-${r.fullName}` ? 'Copiado' : 'Copiar git clone'}
                      </button>
                      {vscodeUrl && (
                        <a href={vscodeUrl} className="flex items-center justify-center gap-1 rounded border border-surface-700 bg-surface-925 px-2 py-1.5 text-[11px] font-medium text-surface-200 hover:bg-surface-800" title="Abrir en VS Code (requiere VS Code instalado)">
                          VS Code
                        </a>
                      )}
                    </div>
                  )}
                  {!issuedToken && cloneCommand && (
                    <p className="mt-1 text-[10px] text-amber-300">Sin token, te pedirá usuario+contraseña. Genera uno arriba para copiar el comando con auth incluida.</p>
                  )}
                  {httpsUrl && (
                    <SettingsField label="HTTPS" value={httpsUrl} mono small onCopy={(v) => copy(`https-${r.fullName}`, v)} copied={copied === `https-${r.fullName}`} />
                  )}
                  {r.sshUrl && (
                    <SettingsField label="SSH" value={r.sshUrl} mono small onCopy={(v) => copy(`ssh-${r.fullName}`, v)} copied={copied === `ssh-${r.fullName}`} />
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

interface SettingsFieldProps {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  onCopy: (v: string) => void;
  copied: boolean;
  rightSlot?: React.ReactNode;
}

function SettingsField({ label, value, mono, small, onCopy, copied, rightSlot }: SettingsFieldProps) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wide text-surface-500">{label}</label>
        {copied && <span className="text-[10px] text-emerald-400">copiado</span>}
      </div>
      <div className={`flex items-center gap-1 rounded border border-surface-700/40 bg-surface-950 px-2 ${small ? 'py-0.5' : 'py-1'}`}>
        <span className={`flex-1 truncate ${mono ? 'font-mono' : ''} text-surface-200`}>{value}</span>
        <button type="button" onClick={() => onCopy(value)} className="rounded p-0.5 text-surface-400 hover:bg-surface-800" aria-label="Copiar">
          <Copy className="h-3 w-3" />
        </button>
        {rightSlot}
      </div>
    </div>
  );
}

function ToolPermissionRow({
  tool,
  onToggle,
  onReset
}: {
  tool: ToolPermissionRowModel;
  onToggle: (enabled: boolean) => void;
  onReset: () => void;
}) {
  const manual = tool.source === 'tool';
  const sourceLabel = manual ? 'Manual' : tool.source === 'capability' ? 'Perfil' : 'Libre';

  return (
    <div
      className={`flex min-h-11 items-stretch gap-1 rounded-md border transition ${
        tool.enabled
          ? 'border-surface-700/50 bg-surface-900/70'
          : 'border-surface-800/70 bg-surface-950/60 opacity-70'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(!tool.enabled)}
        className="flex min-w-0 flex-1 items-start justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-surface-800/50"
        aria-pressed={tool.enabled}
        title={tool.description}
      >
        <span className="min-w-0">
          <span className="block truncate font-mono text-[11px] font-semibold text-surface-100">{tool.name}</span>
          <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-surface-500">{tool.description}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
            manual ? 'bg-mandy-500/10 text-mandy-200' : 'bg-surface-800 text-surface-400'
          }`}>
            {sourceLabel}
          </span>
          <span
            aria-hidden
            className={`relative h-4 w-7 rounded-full transition ${
              tool.enabled ? 'bg-mandy-500/80' : 'bg-surface-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                tool.enabled ? 'left-3' : 'left-0.5'
              }`}
            />
          </span>
        </span>
      </button>
      {manual && (
        <button
          type="button"
          onClick={onReset}
          className="my-1 mr-1 shrink-0 rounded border border-surface-700 px-2 text-[10px] text-surface-400 transition hover:border-surface-600 hover:text-surface-100"
        >
          Heredar
        </button>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  description
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-md border border-surface-700/40 bg-surface-925/40 px-3 py-2 text-left text-xs transition hover:bg-surface-800/40"
      aria-pressed={checked}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-surface-100">{label}</span>
        {description && <span className="text-[10px] text-surface-500">{description}</span>}
      </span>
      <span
        aria-hidden
        className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition ${
          checked ? 'bg-mandy-500/80' : 'bg-surface-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? 'left-3' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  onClick
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md border border-surface-700/40 bg-surface-925/40 px-3 py-2.5 text-left transition hover:bg-surface-800/40"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-mandy-300" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-surface-100">{title}</span>
        <span className="text-xs text-surface-500">{description}</span>
      </span>
    </button>
  );
}

function SectionHelper({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-surface-400 leading-relaxed">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-surface-100">{children}</h3>;
}
