'use client';

/**
 * Registry global de linters por lenguaje. La idea es que añadir un linter
 * nuevo (json, yaml, typescript…) sea solo cuestión de registrar un
 * descriptor aquí — el resto de la UI se actualiza sola.
 *
 * Cada `LinterDescriptor` describe metadata visible al usuario; la lógica
 * de detección de issues sigue siendo del hook concreto (useMarkdownLinter,
 * useSTLinterRules…). Lo que centraliza este registry es:
 *
 * 1) El listado para el menú "Linters" en el StatusBar.
 * 2) El flag `enabled` persistido en localStorage por linter (no por regla).
 * 3) Filtrado por scope (extensión/lenguaje del archivo activo).
 *
 * Convención: el scope es la extensión sin punto, en lowercase
 * (ej: 'md', 'markdown', 'st').
 */

const STORAGE_KEY = 'agora.linters.enabled.v1';

export interface LinterDescriptor {
  /** Id único — usado en el storage y eventos. */
  id: string;
  /** Nombre visible al usuario. */
  displayName: string;
  /** Descripción corta del linter. */
  description: string;
  /** Lista de extensiones / lenguajes a los que aplica (lowercase, sin punto). */
  scope: string[];
  /** Estado inicial si nunca lo tocó el usuario. */
  defaultEnabled: boolean;
}

type Listener = () => void;

class LinterRegistryClass {
  private linters = new Map<string, LinterDescriptor>();
  private enabledOverrides = new Map<string, boolean>();
  private listeners = new Set<Listener>();
  private hydrated = false;

  /** Registra un linter — idempotente por id. */
  register(desc: LinterDescriptor): void {
    if (!this.hydrated) this.hydrate();
    this.linters.set(desc.id, desc);
    this.notify();
  }

  /** Quita un linter (no borra su flag persistido). */
  unregister(id: string): void {
    if (!this.linters.delete(id)) return;
    this.notify();
  }

  /** ¿Está habilitado este linter? */
  isEnabled(id: string): boolean {
    if (!this.hydrated) this.hydrate();
    const override = this.enabledOverrides.get(id);
    if (override !== undefined) return override;
    return this.linters.get(id)?.defaultEnabled ?? true;
  }

  /** Activa / desactiva un linter — persistido. */
  setEnabled(id: string, enabled: boolean): void {
    if (!this.hydrated) this.hydrate();
    this.enabledOverrides.set(id, enabled);
    this.persist();
    this.notify();
  }

  /** Lista de linters cuyos scopes incluyen la extensión dada. */
  forScope(scope: string | null | undefined): LinterDescriptor[] {
    if (!this.hydrated) this.hydrate();
    if (!scope) return [];
    const s = scope.toLowerCase();
    return Array.from(this.linters.values()).filter((l) =>
      l.scope.some((sc) => sc.toLowerCase() === s)
    );
  }

  /** Listado completo (para vistas de configuración global). */
  all(): LinterDescriptor[] {
    if (!this.hydrated) this.hydrate();
    return Array.from(this.linters.values());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private hydrate(): void {
    this.hydrated = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      for (const [id, enabled] of Object.entries(parsed)) {
        this.enabledOverrides.set(id, enabled);
      }
    } catch { /* ignore storage corruption */ }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, boolean> = {};
      for (const [id, en] of this.enabledOverrides) obj[id] = en;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try { l(); } catch { /* ignore listener error */ }
    });
  }
}

export const LinterRegistry = new LinterRegistryClass();

/* ── Linters de la plataforma — registrados en boot.
   Para añadir un linter nuevo basta con llamar a LinterRegistry.register
   desde su módulo. */

LinterRegistry.register({
  id: 'markdown',
  displayName: 'Markdown',
  description: 'Estilo, ortografía y consistencia en archivos .md.',
  scope: ['md', 'markdown'],
  defaultEnabled: true
});

LinterRegistry.register({
  id: 'st-definitions',
  displayName: 'ST · Definiciones',
  description: 'Detecta referencias indefinidas y nombres duplicados entre documentos .st.',
  scope: ['st'],
  defaultEnabled: true
});

LinterRegistry.register({
  id: 'st-rules',
  displayName: 'ST · Reglas estructurales',
  description: 'Verifica teoremas no usados y conflictos de definición cross-doc.',
  scope: ['st'],
  defaultEnabled: true
});
