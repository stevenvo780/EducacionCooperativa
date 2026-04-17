import { parse, type Program, type Statement } from '@/lib/st-api';
import { formulaToString } from '@stevenvo780/st-lang';

export interface STDefinition {
  name: string;
  kind: 'define' | 'axiom' | 'theorem' | 'let' | 'source' | 'theory' | 'function' | 'interpretation' | 'claim' | 'passage';
  detail?: string;
  description?: string;
  naturalName?: string;
  file: string;
  line: number;
  column?: number;
}

type Listener = (definitions: STDefinition[]) => void;

const safeFormulaToString = (formula: unknown) => {
  if (!formula) return undefined;
  try {
    return formulaToString(formula as Parameters<typeof formulaToString>[0]);
  } catch {
    return undefined;
  }
};

const flattenStatements = (program: Program): Array<{ statement: Statement; qualifiedNamePrefix?: string }> => {
  const items: Array<{ statement: Statement; qualifiedNamePrefix?: string }> = [];

  const walk = (statements: Statement[], prefix?: string) => {
    statements.forEach((statement) => {
      items.push({ statement, qualifiedNamePrefix: prefix });
      if (statement.kind === 'theory_decl') {
        const nextPrefix = prefix ? `${prefix}.${statement.name}` : statement.name;
        walk(statement.members.map((member) => member.statement), nextPrefix);
      }
    });
  };

  walk(program.statements);
  return items;
};

const qualifyName = (name: string, prefix?: string) => (prefix ? `${prefix}.${name}` : name);

const extractFromAst = (program: Program, fileId: string): STDefinition[] => {
  const definitions: STDefinition[] = [];

  flattenStatements(program).forEach(({ statement, qualifiedNamePrefix }) => {
    const line = statement.source.line;
    const column = statement.source.column;

    switch (statement.kind) {
      case 'define_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'define',
          detail: safeFormulaToString(statement.body),
          description: statement.description,
          file: fileId,
          line,
          column
        });
        break;
      case 'axiom_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'axiom',
          detail: safeFormulaToString(statement.formula),
          file: fileId,
          line,
          column
        });
        break;
      case 'theorem_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'theorem',
          detail: safeFormulaToString(statement.formula),
          file: fileId,
          line,
          column
        });
        break;
      case 'claim_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'claim',
          detail: statement.value,
          description: statement.formula ? safeFormulaToString(statement.formula) : undefined,
          file: fileId,
          line,
          column
        });
        break;
      case 'let_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: statement.letType === 'passage' ? 'passage' : 'let',
          detail: statement.letType === 'description'
            ? statement.description
            : statement.letType === 'passage'
              ? statement.anchorPath
              : statement.letType === 'formalize'
                ? safeFormulaToString(statement.formula)
                : statement.letType === 'formula'
                  ? safeFormulaToString(statement.formula)
                  : statement.letType,
          description: statement.letType === 'description' ? statement.description : undefined,
          file: fileId,
          line,
          column
        });
        break;
      case 'theory_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'theory',
          detail: `${statement.members.length} miembro(s)`,
          file: fileId,
          line,
          column
        });
        break;
      case 'fn_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'function',
          detail: `(${statement.params.join(', ')})`,
          file: fileId,
          line,
          column
        });
        break;
      case 'source_decl':
        definitions.push({
          name: qualifyName(statement.name, qualifiedNamePrefix),
          kind: 'source',
          detail: statement.fields.map((field) => `${field.key} ${field.value}`).join(' · '),
          file: fileId,
          line,
          column
        });
        break;
      case 'interpret_cmd':
        definitions.push({
          name: qualifyName(statement.text.slice(0, 64), qualifiedNamePrefix),
          kind: 'interpretation',
          detail: safeFormulaToString(statement.formula),
          naturalName: statement.text,
          file: fileId,
          line,
          column
        });
        break;
      default:
        break;
    }
  });

  return definitions;
};

class STDefinitionsRegistryClass {
  private _fileDefinitions = new Map<string, STDefinition[]>();
  private _listeners = new Set<Listener>();

  setFileDefinitions(fileId: string, definitions: STDefinition[]): void {
    this._fileDefinitions.set(fileId, definitions);
    this._notify();
  }

  removeFile(fileId: string): void {
    if (this._fileDefinitions.delete(fileId)) {
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

  /**
   * Devuelve nombres definidos en múltiples archivos con kind o detail diferente.
   * Útil para detectar inconsistencias semánticas entre archivos .st del workspace.
   */
  getCrossDocumentConflicts(): Array<{ name: string; definitions: STDefinition[] }> {
    const nameMap = new Map<string, STDefinition[]>();
    for (const defs of this._fileDefinitions.values()) {
      for (const def of defs) {
        if (!nameMap.has(def.name)) nameMap.set(def.name, []);
        nameMap.get(def.name)!.push(def);
      }
    }
    const conflicts: Array<{ name: string; definitions: STDefinition[] }> = [];
    for (const [name, defs] of nameMap) {
      if (defs.length < 2) continue;
      const hasConflict = defs.some((d, i) =>
        defs.slice(i + 1).some((other) => d.kind !== other.kind || d.detail !== other.detail)
      );
      if (hasConflict) conflicts.push({ name, definitions: defs });
    }
    return conflicts;
  }

  lookup(name: string): STDefinition | undefined {
    for (const defs of this._fileDefinitions.values()) {
      const found = defs.find((definition) => definition.name === name);
      if (found) return found;
    }
    return undefined;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  extractFromSource(code: string, fileId: string): STDefinition[] {
    try {
      const parsed = parse(code, fileId);
      if (parsed.ok && parsed.program) {
        return extractFromAst(parsed.program, fileId);
      }
    } catch {
      // Fallback below.
    }

    return extractWithRegexFallback(code, fileId);
  }

  private _notify(): void {
    const all = this.getAllDefinitions();
    for (const listener of this._listeners) {
      listener(all);
    }
  }
}

function extractWithRegexFallback(code: string, fileId: string): STDefinition[] {
  const defs: STDefinition[] = [];
  const lines = code.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const lineNum = index + 1;

    const defineMatch = trimmed.match(
      /^(?:(?:export|exportar)\s+)?(?:define|definir)\s+(\w+)(?:\([^)]*\))?\s*=?\s*(.+?)(?:\s*(?:@|description)\s*"([^"]*)")?$/
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

    const axiomMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:axiom|axioma)\s+(\w+)\s*[:=](.+)/i);
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

    const theoremMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theorem|teorema)\s+(\w+)\s*[:=](.+)/i);
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

    const claimMatch = trimmed.match(/^(?:claim|afirmacion)\s+(\w+)\s*=\s*(.+)$/i);
    if (claimMatch) {
      defs.push({
        name: claimMatch[1],
        kind: 'claim',
        detail: claimMatch[2].trim(),
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const letMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:let|sea)\s+(\w+)\s*=(.+)/i);
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

    const theoryMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theory|teoria)\s+(\w+)/i);
    if (theoryMatch) {
      defs.push({
        name: theoryMatch[1],
        kind: 'theory',
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const fnMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:fn|funcion)\s+(\w+)\s*\(([^)]*)\)/i);
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

    const sourceMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:source|fuente)\s+(\w+)/i);
    if (sourceMatch) {
      defs.push({
        name: sourceMatch[1],
        kind: 'source',
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const interpretMatch = trimmed.match(/^(?:interpret|interpretar)\s+"((?:\\.|[^"\\])*)"\s+(?:as|como)\s+(.+)/i);
    if (interpretMatch) {
      const fullText = unescapeSTString(interpretMatch[1]);
      defs.push({
        name: fullText.slice(0, 64),
        kind: 'interpretation',
        detail: interpretMatch[2].trim(),
        naturalName: fullText,
        file: fileId,
        line: lineNum
      });
    }
  }

  return defs;
}

function unescapeSTString(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
}

export const STDefinitionsRegistry = new STDefinitionsRegistryClass();
