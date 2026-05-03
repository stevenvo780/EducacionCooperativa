'use client';

import { useEffect, useState } from 'react';
import { X, Settings as SettingsIcon, Wrench, Sparkles, Code2, Shield, FolderGit2, KeyRound, Users, type LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEditorToolbarVisibility } from '@/store/dashboardSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';
import { TOOLBAR_GROUP_LABELS, DEFAULT_TOOLBAR_VISIBILITY, TOOLBAR_VISIBILITY_STORAGE_KEY } from '@/components/mosaic-editor/constants';
import type { ToolbarGroupKey, ToolbarVisibility } from '@/components/mosaic-editor/types';
import {
  loadConfig as loadStEditorConfig,
  saveConfig as saveStEditorConfig,
  FEATURE_LABELS as ST_FEATURE_LABELS,
  ALL_FEATURES as ST_ALL_FEATURES,
  type EditorConfig as StEditorConfig
} from '@/components/editor/codemirror/st-editor-config';
import { LinterRegistry } from '@/lib/linters/registry';
import { MarkdownLinterRegistry, type RuleState } from '@/lib/markdown-linter/registry';
import { RULE_CATEGORY_LABELS, type RuleCategory } from '@/lib/markdown-linter/types';

type SectionId = 'editor-md' | 'editor-st' | 'ai' | 'linter' | 'cuenta';

interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

const SECTIONS: Section[] = [
  { id: 'editor-md', label: 'Editor Markdown', icon: Wrench, description: 'Toolbar y módulos visibles' },
  { id: 'editor-st', label: 'Editor ST', icon: Code2, description: 'Comportamiento del editor de código' },
  { id: 'ai', label: 'Agora IA', icon: Sparkles, description: 'Proveedor, modelo y API key' },
  { id: 'linter', label: 'Linter Markdown', icon: Shield, description: 'Reglas activas y diccionario personal' },
  { id: 'cuenta', label: 'Cuenta y permisos', icon: KeyRound, description: 'Contraseña, miembros, acceso Git' }
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SectionId;
  onOpenChangePassword: () => void;
  onOpenMembers: () => void;
  onOpenGitAccess: () => void;
  onOpenAIConfig: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  initialSection = 'editor-md',
  onOpenChangePassword,
  onOpenMembers,
  onOpenGitAccess,
  onOpenAIConfig
}: SettingsModalProps) {
  const [section, setSection] = useState<SectionId>(initialSection);

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
            {section === 'ai' && (
              <ExternalSection
                title="Configuración de Agora IA"
                description="Provider, modelo, API key y temperatura. Por su tamaño se gestiona en su propio modal."
                buttonLabel="Abrir configuración de IA"
                onOpen={() => { onOpenAIConfig(); onClose(); }}
              />
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
      return next;
    });
  };

  if (!config) return <div className="text-xs text-surface-500">Cargando…</div>;

  return (
    <div className="space-y-4">
      <SectionHelper>
        Toggles que se aplican a los archivos .st (lenguaje formal).
        Los cambios surten efecto al volver a abrir el archivo.
      </SectionHelper>
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

function ExternalSection({
  title,
  description,
  buttonLabel,
  onOpen,
  hint
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onOpen: () => void;
  hint?: string;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-surface-100">{title}</h4>
      <p className="text-xs text-surface-400 leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md bg-mandy-500/15 px-3 py-1.5 text-xs font-medium text-mandy-200 hover:bg-mandy-500/25 transition"
      >
        {buttonLabel}
      </button>
      {hint && <p className="text-[11px] text-surface-500">{hint}</p>}
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
