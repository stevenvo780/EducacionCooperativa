'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Settings as SettingsIcon, Wrench, Sparkles, Code2, Shield, FolderGit2, KeyRound, Users, BookMarked, RotateCcw, type LucideIcon } from 'lucide-react';
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
import { MarkdownLinterRegistry, type RuleState } from '@/lib/markdown-linter/registry';
import { RULE_CATEGORY_LABELS, type RuleCategory } from '@/lib/markdown-linter/types';
import {
  AGENT_ACCESS_CAPABILITIES,
  AGENT_ACCESS_PROFILE_ORDER,
  AGENT_ACCESS_PROFILES,
  DEFAULT_CLIENT_AGENT_ACCESS_POLICY,
  normalizeAgentAccessPolicy
} from '@/lib/agora-ai/accessPolicy';
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
  type ModelCatalog
} from '@/lib/agora-ai/modelCatalog';
import type { AgentAccessCapability, AgentAccessPolicy, AIProvider } from '@/lib/agora-ai/types';
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
  { id: 'cuenta', label: 'Cuenta y permisos', icon: KeyRound, description: 'Contraseña, miembros, acceso Git' }
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  activeWorkspaceId?: string;
  activeUserId?: string;
  onOpenChangePassword: () => void;
  onOpenMembers: () => void;
  onOpenGitAccess: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  initialSection = 'editor-md',
  activeWorkspaceId,
  activeUserId,
  onOpenChangePassword,
  onOpenMembers,
  onOpenGitAccess
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
              className="flex h-7 w-7 items-center justify-center rounded text-surface-400 hover:bg-surface-800/70 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {section === 'editor-md' && <EditorMdSection />}
            {section === 'editor-st' && <EditorStSection />}
            {section === 'semantic' && (
              <SemanticSection activeWorkspaceId={activeWorkspaceId} activeUserId={activeUserId} />
            )}
            {section === 'ai' && (
              <AISection activeWorkspaceId={activeWorkspaceId} />
            )}
            {section === 'linter' && <LintersSection />}
            {section === 'cuenta' && (
              <CuentaSection
                onOpenChangePassword={() => { onOpenChangePassword(); onClose(); }}
                onOpenMembers={() => { onOpenMembers(); onClose(); }}
                onOpenGitAccess={() => { onOpenGitAccess(); onClose(); }}
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
    description: 'Listar, buscar, resumir y analizar documentos.'
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
    description: 'Consultar status e historial de commits.'
  },
  gitWrite: {
    label: 'Git commit',
    description: 'Crear commits del workspace, con confirmación.'
  },
  workerRead: {
    label: 'Worker lectura',
    description: 'Ver estado y listar archivos reales del worker.'
  },
  workerCommand: {
    label: 'Comandos worker',
    description: 'Ejecutar comandos shell en /workspace, con confirmación.'
  },
  uiControl: {
    label: 'Control de interfaz',
    description: 'Abrir paneles como Git, Terminal, Problemas o Board.'
  },
  debug: {
    label: 'Debug a Problemas',
    description: 'Publicar diagnósticos del agente en el bus de Problemas.'
  }
};

function AISection({ activeWorkspaceId }: { activeWorkspaceId?: string }) {
  const [config, setConfig] = useState<AIProviderConfig>(() => loadAIProviderConfig());
  const [accessPolicy, setAccessPolicy] = useState<AgentAccessPolicy>(() => loadAgentAccessPolicy());
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>(getModelCatalogSync);
  const [userInstructionsDraft, setUserInstructionsDraft] = useState<string>('');
  const [userInstructionsSavedAt, setUserInstructionsSavedAt] = useState<number | null>(null);
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

  const updateConfig = (partial: Partial<AIProviderConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveAIProviderConfig(next);
      return next;
    });
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
      }
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHelper>
          Configuración local del asistente. La API key se guarda solo en sessionStorage del navegador.
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
        {meta.needsKey && (
          <label className="block text-xs">
            <span className="mb-1 block text-surface-400">API Key</span>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              placeholder={`Pega tu ${meta.label} API key`}
              className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 placeholder:text-surface-400 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
            />
          </label>
        )}

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
          <span className="mb-1 block text-surface-400">Modelo</span>
          {providerModels.length > 0 ? (
            <>
              <select
                value={providerModels.some((m) => m.id === config.model) ? config.model : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') return;
                  updateConfig({ model: e.target.value });
                }}
                className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
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
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                placeholder={meta.modelPlaceholder}
                className="mt-1 w-full rounded-md border border-surface-700/50 bg-surface-900 px-2 py-1 font-mono text-[11px] text-surface-200 placeholder:text-surface-500 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
              />
            </>
          ) : (
            <input
              type="text"
              value={config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              placeholder={meta.modelPlaceholder}
              className="w-full rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 font-mono text-xs text-surface-50 placeholder:text-surface-400 focus:border-mandy-400 focus:outline-none focus:ring-1 focus:ring-mandy-400/40"
            />
          )}
          <span className="mt-1 block text-[10px] text-surface-500">
            Por defecto: {meta.defaultModel}
            {modelCatalog.lastUpdated !== 'fallback' ? ` · catálogo ${modelCatalog.lastUpdated}` : ''}
          </span>
        </label>
      </div>

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
      window.dispatchEvent(new CustomEvent('agora:st-editor-config-changed', { detail: next }));
      return next;
    });
  };

  const resetDefaults = () => {
    const next = getDefaultStEditorConfig();
    saveStEditorConfig(next);
    window.dispatchEvent(new CustomEvent('agora:st-editor-config-changed', { detail: next }));
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agora:semantic-preferences-changed', {
        detail: { workspaceId, preferences: nextState.preferences }
      }));
    }
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
        const q = query.toLowerCase();
        return r.meta.name.toLowerCase().includes(q)
          || r.meta.description.toLowerCase().includes(q)
          || r.meta.id.toLowerCase().includes(q);
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
  onOpenGitAccess
}: {
  onOpenChangePassword: () => void;
  onOpenMembers: () => void;
  onOpenGitAccess: () => void;
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
        description="Genera tokens y revoca credenciales del repo del workspace."
        onClick={onOpenGitAccess}
      />
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
