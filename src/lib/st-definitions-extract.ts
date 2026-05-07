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

const safeFormulaToString = (formula: unknown): string | undefined => {
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

const qualifyName = (name: string, prefix?: string): string => (prefix ? `${prefix}.${name}` : name);

export function extractFromAst(program: Program, fileId: string): STDefinition[] {
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
      case 'interpret_cmd': {
        const alias = safeFormulaToString(statement.formula);
        definitions.push({
          name: qualifyName(alias || statement.text.slice(0, 64), qualifiedNamePrefix),
          kind: 'interpretation',
          detail: alias || statement.text,
          naturalName: statement.text,
          file: fileId,
          line,
          column
        });
        break;
      }
      default:
        break;
    }
  });

  return definitions;
}

export function extractWithRegexFallback(code: string, fileId: string): STDefinition[] {
  const defs: STDefinition[] = [];
  const lines = code.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = (lines[index] ?? '').trim();
    const lineNum = index + 1;

    const defineMatch = trimmed.match(
      /^(?:(?:export|exportar)\s+)?(?:define|definir)\s+(\w+)(?:\([^)]*\))?\s*=?\s*(.+?)(?:\s*(?:@|description)\s*"([^"]*)")?$/
    );
    if (defineMatch) {
      const name = defineMatch[1];
      const detail = defineMatch[2];
      if (!name || !detail) continue;
      defs.push({
        name,
        kind: 'define',
        detail: detail.trim(),
        description: defineMatch[3],
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const axiomMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:axiom|axioma)\s+(\w+)\s*[:=](.+)/i);
    if (axiomMatch) {
      const name = axiomMatch[1];
      const detail = axiomMatch[2];
      if (!name || !detail) continue;
      defs.push({
        name,
        kind: 'axiom',
        detail: detail.trim(),
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const theoremMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theorem|teorema)\s+(\w+)\s*[:=](.+)/i);
    if (theoremMatch) {
      const name = theoremMatch[1];
      const detail = theoremMatch[2];
      if (!name || !detail) continue;
      defs.push({
        name,
        kind: 'theorem',
        detail: detail.trim(),
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const claimMatch = trimmed.match(/^(?:claim|afirmacion)\s+(\w+)\s*=\s*(.+)$/i);
    if (claimMatch) {
      const name = claimMatch[1];
      const detail = claimMatch[2];
      if (!name || !detail) continue;
      defs.push({
        name,
        kind: 'claim',
        detail: detail.trim(),
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const letMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:let|sea)\s+(\w+)\s*=(.+)/i);
    if (letMatch) {
      const name = letMatch[1];
      const detail = letMatch[2];
      if (!name || !detail) continue;
      defs.push({
        name,
        kind: 'let',
        detail: detail.trim(),
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const theoryMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theory|teoria)\s+(\w+)/i);
    if (theoryMatch) {
      const name = theoryMatch[1];
      if (!name) continue;
      defs.push({
        name,
        kind: 'theory',
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const fnMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:fn|funcion)\s+(\w+)\s*\(([^)]*)\)/i);
    if (fnMatch) {
      const name = fnMatch[1];
      if (!name) continue;
      defs.push({
        name,
        kind: 'function',
        detail: `(${fnMatch[2] ?? ''})`,
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const sourceMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:source|fuente)\s+(\w+)/i);
    if (sourceMatch) {
      const name = sourceMatch[1];
      if (!name) continue;
      defs.push({
        name,
        kind: 'source',
        file: fileId,
        line: lineNum
      });
      continue;
    }

    const interpretMatch = trimmed.match(/^(?:interpret|interpretar)\s+"((?:\\.|[^"\\])*)"\s+(?:as|como)\s+(.+)/i);
    if (interpretMatch) {
      const rawText = interpretMatch[1];
      const detail = interpretMatch[2];
      if (!rawText || !detail) continue;
      const fullText = unescapeSTString(rawText);
      defs.push({
        name: fullText.slice(0, 64),
        kind: 'interpretation',
        detail: detail.trim(),
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

export function extractDefinitions(code: string, fileId: string): STDefinition[] {
  try {
    const parsed = parse(code, fileId);
    if (parsed.ok && parsed.program) {
      return extractFromAst(parsed.program, fileId);
    }
  } catch {
    return extractWithRegexFallback(code, fileId);
  }
  return [];
}
