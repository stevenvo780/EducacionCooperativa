import { extractDefinitions, type STDefinition } from '@/lib/st-definitions-extract';

export type { STDefinition } from '@/lib/st-definitions-extract';

type Listener = (definitions: STDefinition[]) => void;

class STDefinitionsRegistryClass {
  private _fileDefinitions = new Map<string, STDefinition[]>();
  private _listeners = new Set<Listener>();
  private _nameIndex = new Map<string, STDefinition>();
  private _nameIndexDirty = true;
  private _version = 0;
  private _lastConflictsByVersion: {
    version: number;
    conflicts: Array<{ name: string; definitions: STDefinition[] }>;
  } | null = null;

  private _rebuildNameIndex(): void {
    this._nameIndex.clear();
    for (const defs of this._fileDefinitions.values()) {
      for (const def of defs) {
        if (!this._nameIndex.has(def.name)) this._nameIndex.set(def.name, def);
      }
    }
    this._nameIndexDirty = false;
  }

  get version(): number {
    return this._version;
  }

  private _filePerFileEqual(fileId: string, next: STDefinition[]): boolean {
    const prev = this._fileDefinitions.get(fileId);
    if (!prev || prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
      const a = prev[i];
      const b = next[i];
      if (!a || !b) return false;
      if (a.name !== b.name || a.kind !== b.kind || a.detail !== b.detail || a.line !== b.line) {
        return false;
      }
    }
    return true;
  }

  setFileDefinitions(fileId: string, definitions: STDefinition[]): void {
    if (this._filePerFileEqual(fileId, definitions)) {
      return;
    }
    this._fileDefinitions.set(fileId, definitions);
    this._nameIndexDirty = true;
    this._version += 1;
    this._notify();
  }

  removeFile(fileId: string): void {
    if (this._fileDefinitions.delete(fileId)) {
      this._nameIndexDirty = true;
      this._version += 1;
      this._notify();
    }
  }

  getAllDefinitions(): STDefinition[] {
    const all: STDefinition[] = [];
    for (const defs of this._fileDefinitions.values()) {
      all.push(...defs);
    }
    return all;
  }

  getRegisteredFiles(): string[] {
    return Array.from(this._fileDefinitions.keys());
  }

  getFileDefinitions(fileId: string): STDefinition[] {
    return this._fileDefinitions.get(fileId) ?? [];
  }

  getDefinedNames(): Set<string> {
    const names = new Set<string>();
    for (const defs of this._fileDefinitions.values()) {
      for (const definition of defs) {
        names.add(definition.name);
      }
    }
    return names;
  }

  getCrossDocumentConflicts(): Array<{ name: string; definitions: STDefinition[] }> {
    if (this._lastConflictsByVersion && this._lastConflictsByVersion.version === this._version) {
      return this._lastConflictsByVersion.conflicts;
    }
    const nameMap = new Map<string, STDefinition[]>();
    for (const defs of this._fileDefinitions.values()) {
      for (const def of defs) {
        const list = nameMap.get(def.name);
        if (list) list.push(def);
        else nameMap.set(def.name, [def]);
      }
    }
    const conflicts: Array<{ name: string; definitions: STDefinition[] }> = [];
    for (const [name, defs] of nameMap) {
      if (defs.length < 2) continue;
      const signatures = new Set<string>();
      let hasConflict = false;
      for (const def of defs) {
        const signature = `${def.kind}|${def.detail ?? ''}`;
        signatures.add(signature);
        if (signatures.size > 1) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) conflicts.push({ name, definitions: defs });
    }
    this._lastConflictsByVersion = { version: this._version, conflicts };
    return conflicts;
  }

  lookup(name: string): STDefinition | undefined {
    if (this._nameIndexDirty) this._rebuildNameIndex();
    return this._nameIndex.get(name);
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  clear(): void {
    if (this._fileDefinitions.size === 0 && this._nameIndex.size === 0 && !this._lastConflictsByVersion) {
      return;
    }
    this._fileDefinitions.clear();
    this._nameIndex.clear();
    this._nameIndexDirty = true;
    this._lastConflictsByVersion = null;
    this._version += 1;
    this._notify();
  }

  extractFromSource(code: string, fileId: string): STDefinition[] {
    return extractDefinitions(code, fileId);
  }

  private _notify(): void {
    const all = this.getAllDefinitions();
    for (const listener of this._listeners) {
      listener(all);
    }
  }
}

export const STDefinitionsRegistry = new STDefinitionsRegistryClass();
