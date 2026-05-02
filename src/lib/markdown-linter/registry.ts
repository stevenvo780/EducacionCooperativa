/**
 * Registro de reglas de linting con persistencia de preferencias.
 *
 * - Administra qué reglas están habilitadas/deshabilitadas.
 * - Persiste preferencias en localStorage.
 * - Notifica a suscriptores cuando cambia la configuración.
 * - Singleton global (como STDefinitionsRegistry).
 */

import { type LinterRule, type LinterRuleMeta, type RuleCategory, type ProfileId } from './types';
import { ALL_BUILTIN_RULES } from './rules';

const STORAGE_KEY = 'agora:linter-config';
const PROFILE_STORAGE_KEY = 'agora:linter-profile';

type Listener = () => void;

type ProfileDefinition = {
  id: ProfileId;
  name: string;
  description: string;
  /** Categorías completamente habilitadas */
  enabledCategories: Set<RuleCategory>;
  /** IDs de reglas adicionales habilitadas aunque su categoría no lo esté */
  alsoEnable: Set<string>;
  /** IDs de reglas deshabilitadas aunque su categoría esté habilitada */
  alsoDisable: Set<string>;
};

const PROFILE_DEFINITIONS: ProfileDefinition[] = [
  {
    id: 'default',
    name: 'Por defecto',
    description: 'Reglas habilitadas por defecto. Equilibrio entre precisión y ruido.',
    enabledCategories: new Set(), // especial: usa defaultEnabled de cada regla
    alsoEnable: new Set(),
    alsoDisable: new Set()
  },
  {
    id: 'academic',
    name: 'Académico',
    description: 'Énfasis en calidad académica: ortografía, estructura y escritura formal.',
    enabledCategories: new Set<RuleCategory>(['spelling', 'structure', 'academic', 'readability', 'accessibility', 'citation']),
    alsoEnable: new Set([
      'structure_orphan_footnote', 'structure_frontmatter',
      'structure_duplicate_headings', 'structure_empty_list_item',
      'consistency_quote_style', 'consistency_terminology',
      'academic_passive_voice_es', 'academic_nominalization_es', 'academic_vague_quantifier_es',
      'readability_flesch_kincaid_es', 'readability_excessive_exclamation',
      'readability_sentence_start_conjunction',
      'accessibility_link_text_quality',
      'links_broken_internal',
      'semantic_st_definitions',
      'citation_apa_malformed', 'citation_missing_bibliography', 'citation_orphan_bibliography',
      'citation_doi_format', 'citation_missing_reference_section', 'citation_ibid_op_cit'
    ]),
    alsoDisable: new Set(['structure_frontmatter']) // deshabilitado por defecto salvo que el doc lo tenga
  },
  {
    id: 'blog',
    name: 'Blog / Web',
    description: 'Enfocado en legibilidad y estructura básica para contenido web.',
    enabledCategories: new Set<RuleCategory>(['spelling', 'structure', 'accessibility', 'links']),
    alsoEnable: new Set([
      'readability_long_paragraph', 'readability_long_sentence',
      'readability_excessive_exclamation',
      'academic_lexical_redundancy_es',
      'accessibility_link_text_quality',
      'links_broken_internal'
    ]),
    alsoDisable: new Set(['structure_frontmatter', 'structure_orphan_footnote'])
  },
  {
    id: 'technical',
    name: 'Técnico',
    description: 'Énfasis en estructura, código y enlaces. Sin reglas de estilo narrativo.',
    enabledCategories: new Set<RuleCategory>(['structure', 'links', 'whitespace', 'consistency']),
    alsoEnable: new Set([
      'structure_code_block_lang', 'structure_unclosed_fence',
      'structure_malformed_table', 'structure_duplicate_headings',
      'structure_empty_list_item', 'spelling_typos',
      'links_broken_internal',
      'accessibility_html_in_markdown'
    ]),
    alsoDisable: new Set(['academic_lexical_redundancy_es', 'readability_long_paragraph'])
  },
  {
    id: 'st-heavy',
    name: 'ST Intensivo',
    description: 'Máxima integración con definiciones ST y escritura formal rigurosa.',
    enabledCategories: new Set<RuleCategory>(['spelling', 'structure', 'semantic', 'academic', 'citation']),
    alsoEnable: new Set([
      'semantic_st_definitions', 'semantic_st_undefined_ref',
      'semantic_st_unused_theorem', 'semantic_st_cross_doc_conflict',
      'academic_nominalization_es', 'academic_lexical_redundancy_es',
      'structure_orphan_footnote', 'structure_duplicate_headings',
      'readability_long_sentence', 'readability_long_paragraph',
      'readability_excessive_exclamation',
      'links_broken_internal',
      'citation_apa_malformed', 'citation_missing_reference_section'
    ]),
    alsoDisable: new Set()
  },
  {
    id: 'thesis',
    name: 'Tesis académica',
    description: 'Perfil completo para tesis: estructura, citas APA, estilo formal y formato institucional.',
    enabledCategories: new Set<RuleCategory>([
      'spelling', 'structure', 'academic', 'readability',
      'accessibility', 'citation', 'thesis', 'semantic'
    ]),
    alsoEnable: new Set([
      // Estructura
      'structure_orphan_footnote', 'structure_frontmatter',
      'structure_code_block_lang', 'structure_malformed_table',
      'structure_duplicate_headings', 'structure_empty_list_item',
      // Legibilidad
      'readability_long_sentence', 'readability_long_paragraph', 'readability_flesch_kincaid_es',
      'readability_excessive_exclamation', 'readability_sentence_start_conjunction',
      // Académico
      'academic_passive_voice_es', 'academic_nominalization_es',
      'academic_vague_quantifier_es', 'academic_lexical_redundancy_es',
      // Citas — todas
      'citation_apa_malformed', 'citation_missing_bibliography', 'citation_orphan_bibliography',
      'citation_doi_format', 'citation_missing_reference_section', 'citation_ibid_op_cit',
      // Tesis — todas
      'thesis_missing_section', 'thesis_first_person_singular', 'thesis_weak_assertion',
      'thesis_hypothesis_statement', 'thesis_abstract_length', 'thesis_keywords', 'thesis_section_order',
      // ST
      'semantic_st_definitions', 'semantic_st_undefined_ref', 'semantic_st_cross_doc_conflict',
      // Consistencia
      'consistency_quote_style', 'consistency_terminology',
      // Links
      'links_broken_internal',
      // Accesibilidad
      'accessibility_link_text_quality'
    ]),
    alsoDisable: new Set()
  }
];

export interface RuleState {
  enabled: boolean;
  meta: LinterRuleMeta;
}

class MarkdownLinterRegistryClass {
  private _rules = new Map<string, LinterRule>();
  private _enabled = new Map<string, boolean>();
  private _listeners = new Set<Listener>();
  private _activeProfile: ProfileId = 'default';

  // Snapshot caches — invalidated on _notify()
  private _enabledRulesCache: LinterRule[] | null = null;
  private _allStatesCache: RuleState[] | null = null;

  constructor() {
    this._loadDefaults();
    this._loadFromStorage();
    this._loadProfileFromStorage();
  }

  private _loadDefaults(): void {
    for (const rule of ALL_BUILTIN_RULES) {
      this._rules.set(rule.id, rule);
      this._enabled.set(rule.id, rule.defaultEnabled);
    }
  }

  private _loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      for (const [id, enabled] of Object.entries(saved)) {
        if (this._rules.has(id)) {
          this._enabled.set(id, enabled);
        }
      }
    } catch {
      // corrupt localStorage — ignore
    }
  }

  private _saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, boolean> = {};
      for (const [id, enabled] of this._enabled) {
        obj[id] = enabled;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage unavailable
    }
  }

  /** Registra una regla custom (ej: desde un plugin externo) */
  registerRule(rule: LinterRule): void {
    this._rules.set(rule.id, rule);
    if (!this._enabled.has(rule.id)) {
      this._enabled.set(rule.id, rule.defaultEnabled);
    }
    this._saveToStorage();
    this._notify();
  }

  /** Desregistra una regla */
  unregisterRule(id: string): void {
    this._rules.delete(id);
    this._enabled.delete(id);
    this._saveToStorage();
    this._notify();
  }

  /** Habilita o deshabilita una regla */
  setEnabled(id: string, enabled: boolean): void {
    if (!this._rules.has(id)) return;
    this._enabled.set(id, enabled);
    this._saveToStorage();
    this._notify();
  }

  /** Toggle una regla */
  toggleRule(id: string): void {
    const current = this._enabled.get(id);
    if (current === undefined) return;
    this.setEnabled(id, !current);
  }

  /** Habilita/deshabilita todas las reglas de una categoría */
  setCategoryEnabled(category: RuleCategory, enabled: boolean): void {
    for (const [id, rule] of this._rules) {
      if (rule.category === category) {
        this._enabled.set(id, enabled);
      }
    }
    this._saveToStorage();
    this._notify();
  }

  /** Resetea todo a defaults */
  resetToDefaults(): void {
    for (const [id, rule] of this._rules) {
      this._enabled.set(id, rule.defaultEnabled);
    }
    this._saveToStorage();
    this._notify();
  }

  /** ¿Está habilitada una regla? */
  isEnabled(id: string): boolean {
    return this._enabled.get(id) ?? false;
  }

  /** Devuelve todas las reglas habilitadas (cached para useSyncExternalStore) */
  getEnabledRules(): LinterRule[] {
    if (this._enabledRulesCache) return this._enabledRulesCache;
    const rules: LinterRule[] = [];
    for (const [id, rule] of this._rules) {
      if (this._enabled.get(id)) {
        rules.push(rule);
      }
    }
    this._enabledRulesCache = rules;
    return rules;
  }

  /** Devuelve el estado de todas las reglas (cached para useSyncExternalStore) */
  getAllRuleStates(): RuleState[] {
    if (this._allStatesCache) return this._allStatesCache;
    const states: RuleState[] = [];
    for (const [id, rule] of this._rules) {
      states.push({
        enabled: this._enabled.get(id) ?? rule.defaultEnabled,
        meta: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          category: rule.category,
          defaultEnabled: rule.defaultEnabled
        }
      });
    }
    this._allStatesCache = states;
    return states;
  }

  /** Devuelve las reglas agrupadas por categoría */
  getRulesByCategory(): Map<RuleCategory, RuleState[]> {
    const grouped = new Map<RuleCategory, RuleState[]>();
    for (const state of this.getAllRuleStates()) {
      const cat = state.meta.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(state);
    }
    return grouped;
  }

  /** Número de reglas habilitadas */
  getEnabledCount(): number {
    let count = 0;
    for (const enabled of this._enabled.values()) {
      if (enabled) count++;
    }
    return count;
  }

  /** Total de reglas registradas */
  getTotalCount(): number {
    return this._rules.size;
  }

  getActiveProfile(): ProfileId {
    return this._activeProfile;
  }

  /** Aplica un perfil en bloque: establece enabled/disabled para todas las reglas conocidas. */
  applyProfile(profileId: ProfileId): void {
    const profile = PROFILE_DEFINITIONS.find((p) => p.id === profileId);
    if (!profile) return;

    for (const [id, rule] of this._rules) {
      let enabled: boolean;
      if (profileId === 'default') {
        enabled = rule.defaultEnabled;
      } else {
        const inCategory = profile.enabledCategories.has(rule.category);
        const alsoEnabled = profile.alsoEnable.has(id);
        const alsoDisabled = profile.alsoDisable.has(id);
        enabled = alsoDisabled ? false : alsoEnabled ? true : inCategory;
      }
      this._enabled.set(id, enabled);
    }

    this._activeProfile = profileId;
    this._saveToStorage();
    this._saveProfileToStorage();
    this._notify();
  }

  private _loadProfileFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY) as ProfileId | null;
      if (saved && PROFILE_DEFINITIONS.some((p) => p.id === saved)) {
        this._activeProfile = saved;
        // Don't re-apply the profile — _loadFromStorage already loaded per-rule state
      }
    } catch { /* ignore */ }
  }

  private _saveProfileToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, this._activeProfile);
    } catch { /* ignore */ }
  }

  /** Lista los perfiles disponibles para la UI. */
  getProfiles(): Array<{ id: ProfileId; name: string; description: string }> {
    return PROFILE_DEFINITIONS.map(({ id, name, description }) => ({ id, name, description }));
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _invalidateCaches(): void {
    this._enabledRulesCache = null;
    this._allStatesCache = null;
  }

  private _notify(): void {
    this._invalidateCaches();
    for (const listener of this._listeners) {
      listener();
    }
  }
}

/** Exporta la clase para testing (instancias fresh con localStorage custom) */
export { MarkdownLinterRegistryClass as _MarkdownLinterRegistryClass };

/** Singleton global del registro de reglas de linting */
export const MarkdownLinterRegistry = new MarkdownLinterRegistryClass();
