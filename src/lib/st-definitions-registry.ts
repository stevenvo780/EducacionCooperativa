/**
 * ST Definitions Registry — Singleton global que rastrea definiciones
 * extraídas de archivos .st abiertos para integración cross-doc con Markdown.
 *
 * Las definiciones incluyen:
 * - define/definir (macros semánticas)
 * - axiom/axioma
 * - theorem/teorema
 * - let/sea (aliases de fórmula)
 * - source/fuente (fuentes bibliográficas)
 * - theory/teoria (bloques reutilizables)
 * - fn/funcion (funciones)
 */

export interface STDefinition {
  /** Nombre del símbolo definido */
  name: string;
  /** Tipo de definición */
  kind: 'define' | 'axiom' | 'theorem' | 'let' | 'source' | 'theory' | 'function' | 'interpretation';
  /** Fórmula o detalle */
  detail?: string;
  /** Descripción en lenguaje natural (si tiene @) */
  description?: string;
  /** Término en lenguaje natural para buscar en markdown (ej: texto del interpret) */
  naturalName?: string;
  /** Archivo .st de origen */
  file: string;
  /** Línea donde está declarado */
  line: number;
}

type Listener = (definitions: STDefinition[]) => void;

class STDefinitionsRegistryClass {
  /** Map: fileId → definiciones de ese archivo */
  private _fileDefinitions = new Map<string, STDefinition[]>();
  private _listeners = new Set<Listener>();

  /** Registra (o actualiza) las definiciones de un archivo .st */
  setFileDefinitions(fileId: string, definitions: STDefinition[]): void {
    this._fileDefinitions.set(fileId, definitions);
    this._notify();
  }

  /** Elimina las definiciones de un archivo (cuando se cierra) */
  removeFile(fileId: string): void {
    if (this._fileDefinitions.delete(fileId)) {
      this._notify();
    }
  }

  /** Devuelve todas las definiciones combinadas de todos los archivos */
  getAllDefinitions(): STDefinition[] {
    const all: STDefinition[] = [];
    for (const defs of this._fileDefinitions.values()) {
      all.push(...defs);
    }
    return all;
  }

  /** Devuelve la lista de archivos registrados */
  getRegisteredFiles(): string[] {
    return Array.from(this._fileDefinitions.keys());
  }

  /** Devuelve las definiciones de un archivo específico */
  getFileDefinitions(fileId: string): STDefinition[] {
    return this._fileDefinitions.get(fileId) ?? [];
  }

  /** Devuelve solo los nombres únicos definidos (para búsqueda rápida) */
  getDefinedNames(): Set<string> {
    const names = new Set<string>();
    for (const defs of this._fileDefinitions.values()) {
      for (const d of defs) {
        names.add(d.name);
      }
    }
    return names;
  }

  /** Busca una definición por nombre */
  lookup(name: string): STDefinition | undefined {
    for (const defs of this._fileDefinitions.values()) {
      const found = defs.find(d => d.name === name);
      if (found) return found;
    }
    return undefined;
  }

  /** Suscribirse a cambios */
  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /** Extrae definiciones del código fuente .st usando regex (ligero, sin parser) */
  extractFromSource(code: string, fileId: string): STDefinition[] {
    const defs: STDefinition[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const lineNum = i + 1;

      // define / definir (con descripción opcional vía @ o description)
      const defineMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:define|definir)\s+(\w+)(?:\([^)]*\))?\s*:?=\s*(.+?)(?:\s*(?:@|description)\s*"([^"]*)")?$/
      );
      if (defineMatch) {
        defs.push({
          name: defineMatch[1],
          kind: 'define',
          detail: defineMatch[2].trim(),
          description: defineMatch[3],
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // axiom / axioma
      const axiomMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:axiom|axioma)\s+(\w+)\s*[=:](.+)/i
      );
      if (axiomMatch) {
        defs.push({
          name: axiomMatch[1],
          kind: 'axiom',
          detail: axiomMatch[2].trim(),
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // theorem / teorema
      const theoremMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:theorem|teorema)\s+(\w+)\s*[=:](.+)/i
      );
      if (theoremMatch) {
        defs.push({
          name: theoremMatch[1],
          kind: 'theorem',
          detail: theoremMatch[2].trim(),
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // let / sea
      const letMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:let|sea)\s+(\w+)\s*=(.+)/i
      );
      if (letMatch) {
        defs.push({
          name: letMatch[1],
          kind: 'let',
          detail: letMatch[2].trim(),
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // theory / teoria
      const theoryMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:theory|teoria)\s+(\w+)/i
      );
      if (theoryMatch) {
        defs.push({
          name: theoryMatch[1],
          kind: 'theory',
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // fn / funcion
      const fnMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:fn|funcion)\s+(\w+)\s*\(([^)]*)\)/i
      );
      if (fnMatch) {
        defs.push({
          name: fnMatch[1],
          kind: 'function',
          detail: `(${fnMatch[2]})`,
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // source / fuente
      const sourceMatch = trimmed.match(
        /^(?:(?:export|exportar)\s+)?(?:source|fuente)\s+(\w+)/i
      );
      if (sourceMatch) {
        defs.push({
          name: sourceMatch[1],
          kind: 'source',
          file: fileId,
          line: lineNum
        });
        continue;
      }

      // interpret / interpretar
      const interpretMatch = trimmed.match(
        /^(?:interpret|interpretar)\s+"((?:\\.|[^"\\])*)"\s+(?:as|como)\s+(.+)/i
      );
      if (interpretMatch) {
        const fullText = unescapeSTString(interpretMatch[1]);
        const stId = interpretMatch[2].trim();
        defs.push({
          name: stId,
          kind: 'interpretation',
          detail: fullText,
          naturalName: fullText,
          file: fileId,
          line: lineNum
        });
        continue;
      }
    }

    return defs;
  }

  private _notify(): void {
    const all = this.getAllDefinitions();
    for (const listener of this._listeners) {
      listener(all);
    }
  }
}

function unescapeSTString(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
}

/** Singleton global del registry de definiciones ST */
export const STDefinitionsRegistry = new STDefinitionsRegistryClass();
