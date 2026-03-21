/**
 * Registro de reglas de linting con persistencia de preferencias.
 *
 * - Administra qué reglas están habilitadas/deshabilitadas.
 * - Persiste preferencias en localStorage.
 * - Notifica a suscriptores cuando cambia la configuración.
 * - Singleton global (como STDefinitionsRegistry).
 */

import { type LinterRule, type LinterRuleMeta, type RuleCategory } from './types';
import { ALL_BUILTIN_RULES } from './rules';

const STORAGE_KEY = 'agora:linter-config';

type Listener = () => void;

export interface RuleState {
  enabled: boolean;
  meta: LinterRuleMeta;
}

class MarkdownLinterRegistryClass {
  private _rules = new Map<string, LinterRule>();
  private _enabled = new Map<string, boolean>();
  private _listeners = new Set<Listener>();

  // Snapshot caches — invalidated on _notify()
  private _enabledRulesCache: LinterRule[] | null = null;
  private _allStatesCache: RuleState[] | null = null;

  constructor() {
    this._loadDefaults();
    this._loadFromStorage();
  }

  // ── Inicialización ──────────────────────────────────────

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

  // ── API pública ─────────────────────────────────────────

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

  // ── Suscripción reactiva ────────────────────────────────

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
