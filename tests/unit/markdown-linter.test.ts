/**
 * Tests exhaustivos del sistema de linting Markdown con arquitectura de plugins.
 *
 * Cubre:
 *  - Cada regla individual (16 reglas) con casos positivos, negativos y edge cases
 *  - Helper getCodeBlockLines + escapeRegex
 *  - Registry: enable/disable, toggle, categorías, localStorage, subscribe
 *  - Edge cases: unicode, LaTeX, contenido vacío, bloques de código
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';

vi.mock('@/lib/markdown-linter/spell-engine', () => {
  const validWords = new Set([
    'entonces', 'vamos', 'conocer', 'la', 'verdad', 'y', 'cosas', 'linea', 'línea', 'algo', 'es', 'hecho',
    'texto', 'esta', 'está', 'escrito', 'por', 'calle', 'con', 'accion', 'acción', 'perro', 'corre',
    'esto', 'de', 'escritura', 'talento', 'para', 'innovar', 'innato'
  ]);

  const suggestions = new Map<string, string[]>([
    ['entonses', ['entonces']],
    ['conoser', ['conocer']],
    ['haser', ['hacer']],
    ['haver', ['haber', 'a ver']],
    ['echo', ['hecho']]
  ]);

  return {
    isSpellEngineReady: () => true,
    isCorrect: (word: string) => validWords.has(word.toLowerCase()),
    suggest: (word: string) => suggestions.get(word.toLowerCase()) ?? []
  };
});

import { getCodeBlockLines, escapeRegex, type LinterDiagnostic, type LinterRule, type RuleCategory } from '@/lib/markdown-linter/types';
import {
  spellingRule,
  doubledWordsRule,
  headingSpaceRule,
  headingHierarchyRule,
  multipleH1Rule,
  emptyHeadingRule,
  linkSpacesRule,
  emptyLinkRule,
  bareUrlRule,
  longParagraphRule,
  longSentenceRule,
  imageAltTextRule,
  mixedListMarkersRule,
  trailingWhitespaceRule,
  consecutiveBlankLinesRule,
  unclosedBracketsRule,
  todoMarkersRule,
  accentPatternRule,
  suspiciousPatternsRule,
  ALL_BUILTIN_RULES
} from '@/lib/markdown-linter/rules';
import { MarkdownLinterRegistry, _MarkdownLinterRegistryClass, type RuleState } from '@/lib/markdown-linter/registry';

// ── helpers ──────────────────────────────────────────────

/** Genera N líneas en blanco para separadores */
const blank = (n = 1) => '\n'.repeat(n);

/** Genera un párrafo con N palabras */
const wordsN = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

/** Comprueba que NO haya diagnósticos */
function expectClean(rule: LinterRule, text: string) {
  expect(rule.check(text)).toHaveLength(0);
}

/** Comprueba al menos un diagnóstico con source dado */
function expectHit(rule: LinterRule, text: string, source?: string) {
  const diags = rule.check(text);
  expect(diags.length).toBeGreaterThan(0);
  if (source) expect(diags[0].source).toBe(source);
  return diags;
}

// ═══════════════════════════════════════════════════════════
// 1. HELPERS: getCodeBlockLines, escapeRegex
// ═══════════════════════════════════════════════════════════

describe('getCodeBlockLines', () => {
  it('identifica bloques con triple backtick', () => {
    const lines = ['hola', '```', 'código', '```', 'fuera'];
    const codeLines = getCodeBlockLines(lines);
    expect(codeLines.has(0)).toBe(false);
    expect(codeLines.has(1)).toBe(true); // opening fence
    expect(codeLines.has(2)).toBe(true); // inside
    expect(codeLines.has(3)).toBe(true); // closing fence
    expect(codeLines.has(4)).toBe(false);
  });

  it('identifica bloques con triple tilde', () => {
    const lines = ['texto', '~~~', 'código', '~~~', 'más texto'];
    const codeLines = getCodeBlockLines(lines);
    expect(codeLines.has(0)).toBe(false);
    expect(codeLines.has(1)).toBe(true);
    expect(codeLines.has(2)).toBe(true);
    expect(codeLines.has(3)).toBe(true);
    expect(codeLines.has(4)).toBe(false);
  });

  it('maneja bloques con lenguaje especificado', () => {
    const lines = ['antes', '```typescript', 'const x = 1;', '```', 'después'];
    const codeLines = getCodeBlockLines(lines);
    expect(codeLines.has(1)).toBe(true);
    expect(codeLines.has(2)).toBe(true);
    expect(codeLines.has(3)).toBe(true);
  });

  it('maneja múltiples bloques de código', () => {
    const lines = ['```', 'a', '```', 'normal', '```', 'b', '```'];
    const codeLines = getCodeBlockLines(lines);
    expect(codeLines.has(0)).toBe(true);
    expect(codeLines.has(1)).toBe(true);
    expect(codeLines.has(2)).toBe(true);
    expect(codeLines.has(3)).toBe(false);
    expect(codeLines.has(4)).toBe(true);
    expect(codeLines.has(5)).toBe(true);
    expect(codeLines.has(6)).toBe(true);
  });

  it('devuelve set vacío para texto sin bloques', () => {
    const lines = ['hola', 'mundo'];
    expect(getCodeBlockLines(lines).size).toBe(0);
  });

  it('bloque sin cerrar: todo lo de abajo es código', () => {
    const lines = ['texto', '```', 'código', 'más código'];
    const codeLines = getCodeBlockLines(lines);
    expect(codeLines.has(0)).toBe(false);
    expect(codeLines.has(1)).toBe(true);
    expect(codeLines.has(2)).toBe(true);
    expect(codeLines.has(3)).toBe(true);
  });

  it('maneja array vacío', () => {
    expect(getCodeBlockLines([]).size).toBe(0);
  });
});

describe('escapeRegex', () => {
  it('escapa caracteres especiales de regex', () => {
    expect(escapeRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
    expect(escapeRegex('(foo)[bar]')).toBe('\\(foo\\)\\[bar\\]');
    expect(escapeRegex('$100')).toBe('\\$100');
    expect(escapeRegex('{a|b}')).toBe('\\{a\\|b\\}');
  });

  it('no modifica string sin caracteres especiales', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('maneja string vacío', () => {
    expect(escapeRegex('')).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════
// 2. REGLAS INDIVIDUALES
// ═══════════════════════════════════════════════════════════

// ── 2.1 spellingRule ─────────────────────────────────────

describe('spellingRule', () => {
  it('tiene metadatos correctos', () => {
    expect(spellingRule.id).toBe('spelling_typos');
    expect(spellingRule.category).toBe('spelling');
    expect(spellingRule.defaultEnabled).toBe(true);
  });

  it('detecta "entonses"', () => {
    const diags = expectHit(spellingRule, 'entonses vamos', 'Spelling');
    expect(diags[0].line).toBe(1);
    expect(diags[0].column).toBe(1);
    expect(diags[0].suggestion).toContain('entonces');
  });

  it('detecta múltiples errores en la misma línea', () => {
    const diags = spellingRule.check('conoser y haser cosas');
    expect(diags.length).toBe(2);
  });

  it('detecta errores case-insensitive', () => {
    const diags = spellingRule.check('ENTONSES vamos');
    expect(diags.length).toBe(1);
    expect(diags[0].message).toContain('ENTONSES');
  });

  it('no reporta dentro de bloques de código', () => {
    expectClean(spellingRule, '```\nentonses\n```');
  });

  it('ignora expresiones LaTeX inline', () => {
    expectClean(spellingRule, 'La $entonses + conoser$ verdad.');
  });

  it('ignora expresiones LaTeX en bloque', () => {
    expectClean(spellingRule, '$$\nentonses + conoser\n$$');
  });

  it('no reporta en texto correcto', () => {
    expectClean(spellingRule, 'Entonces vamos a conocer la verdad.');
  });

  it('detecta errores en múltiples líneas', () => {
    const diags = spellingRule.check('línea 1\nhaser algo\nlínea 3\nhaver cosas');
    expect(diags.length).toBe(2);
    expect(diags[0].line).toBe(2);
    expect(diags[1].line).toBe(4);
  });

  it('maneja texto vacío', () => {
    expectClean(spellingRule, '');
  });

  it('respeta fronteras de palabra (no matches parciales)', () => {
    // "echo" aparece en el diccionario de typos - probamos que no machee "echos"
    // pero "echo" debería matchear como palabra completa
    const diags = spellingRule.check('echo es hecho?');
    expect(diags.length).toBe(1);
    expect(diags[0].column).toBe(1);
  });
});

// ── 2.2 doubledWordsRule ────────────────────────────────

describe('doubledWordsRule', () => {
  it('tiene metadatos correctos', () => {
    expect(doubledWordsRule.id).toBe('spelling_doubled_words');
    expect(doubledWordsRule.category).toBe('spelling');
  });

  it('detecta "el el"', () => {
    const diags = expectHit(doubledWordsRule, 'vamos el el lunes', 'Spelling');
    expect(diags[0].message).toContain('el');
  });

  it('detecta "de de"', () => {
    expectHit(doubledWordsRule, 'hablamos de de eso');
  });

  it('no reporta palabras diferentes', () => {
    expectClean(doubledWordsRule, 'el perro de la casa');
  });

  it('no reporta en bloques de código', () => {
    expectClean(doubledWordsRule, '```\nel el\n```');
  });

  it('ignora palabras de 1 carácter', () => {
    // \w{2,} en el regex → no captura "a a"
    expectClean(doubledWordsRule, 'a a b');
  });

  it('detecta case insensitive', () => {
    const diags = doubledWordsRule.check('El El texto');
    expect(diags.length).toBe(1);
  });

  it('maneja texto vacío', () => {
    expectClean(doubledWordsRule, '');
  });
});

// ── 2.2b accentPatternRule ──────────────────────────────

describe('accentPatternRule', () => {
  it('tiene metadatos correctos', () => {
    expect(accentPatternRule.id).toBe('spelling_accent_patterns');
    expect(accentPatternRule.category).toBe('spelling');
  });

  it('detecta -cion sin tilde (alimentacion)', () => {
    const diags = accentPatternRule.check('La alimentacion es importante');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].replacements).toContain('alimentación');
  });

  it('detecta -sion sin tilde (emision)', () => {
    const diags = accentPatternRule.check('Una emision de radio');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].replacements).toContain('emisión');
  });

  it('detecta -gion sin tilde (region)', () => {
    const diags = accentPatternRule.check('En la region norte');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].replacements).toContain('región');
  });

  it('NO reporta si ya tiene tilde (investigación)', () => {
    expectClean(accentPatternRule, 'La investigación fue exitosa');
  });

  it('ignora bloques de código', () => {
    expectClean(accentPatternRule, '```\ninvestigacion\n```');
  });

  it('ignora palabras dentro de LaTeX', () => {
    expectClean(accentPatternRule, 'Fórmula: $investigacion + emision$');
  });

  it('detecta -logico sin tilde', () => {
    const diags = accentPatternRule.check('Es un problema biologico');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags.some(d => d.replacements?.some(r => r.includes('lógico')))).toBe(true);
  });

  it('detecta -grafico sin tilde', () => {
    const diags = accentPatternRule.check('El analisis demografico muestra');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags.some(d => d.replacements?.some(r => r.includes('gráfico')))).toBe(true);
  });

  it('maneja texto vacío', () => {
    expectClean(accentPatternRule, '');
  });
});

// ── 2.2c suspiciousPatternsRule ─────────────────────────

describe('suspiciousPatternsRule', () => {
  it('tiene metadatos correctos', () => {
    expect(suspiciousPatternsRule.id).toBe('spelling_suspicious_patterns');
    expect(suspiciousPatternsRule.category).toBe('spelling');
  });

  it('detecta consonantes dobles inválidas (hh, tt, pp, ff)', () => {
    const diags = suspiciousPatternsRule.check('La palahra ahhorrar');
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  it('permite consonantes dobles válidas (rr, ll, cc, nn)', () => {
    expectClean(suspiciousPatternsRule, 'El perro corre por la calle con acción');
  });

  it('detecta inicio de palabra imposible (nmal)', () => {
    const diags = suspiciousPatternsRule.check('Esto esta nmal escrito');
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  it('detecta triple letra', () => {
    const diags = suspiciousPatternsRule.check('errror de escritura');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0].severity).toBe('warning');
  });

  it('ignora bloques de código', () => {
    expectClean(suspiciousPatternsRule, '```\nnmal ahhorrar\n```');
  });

  it('ignora secuencias sospechosas dentro de LaTeX', () => {
    expectClean(suspiciousPatternsRule, 'Sea $ahhorrar + nmal$ una cadena de prueba');
  });

  it('permite palabras válidas con nn (innato, innovar)', () => {
    expectClean(suspiciousPatternsRule, 'Es un talento innato para innovar');
  });

  it('maneja texto vacío', () => {
    expectClean(suspiciousPatternsRule, '');
  });
});

// ── 2.3 headingSpaceRule ────────────────────────────────

describe('headingSpaceRule', () => {
  it('tiene metadatos correctos', () => {
    expect(headingSpaceRule.id).toBe('structure_heading_space');
    expect(headingSpaceRule.category).toBe('structure');
  });

  it('detecta "#Título" sin espacio', () => {
    const diags = expectHit(headingSpaceRule, '#Título', 'Structure');
    expect(diags[0].suggestion).toContain('# Título');
  });

  it('detecta "##Subtítulo"', () => {
    expectHit(headingSpaceRule, '##Subtítulo');
  });

  it('no reporta "# Título" correcto', () => {
    expectClean(headingSpaceRule, '# Título');
  });

  it('no reporta "## Subtítulo" correcto', () => {
    expectClean(headingSpaceRule, '## Subtítulo');
  });

  it('no reporta en bloques de código', () => {
    expectClean(headingSpaceRule, '```\n#Título\n```');
  });

  it('no reporta líneas que no son headings', () => {
    expectClean(headingSpaceRule, 'texto normal sin hash');
  });

  it('detecta hasta h6 sin espacio', () => {
    expectHit(headingSpaceRule, '######Texto');
  });

  it('no reporta "##" solo (sin texto)', () => {
    // "##" debería ser detectado por emptyHeading, no por headingSpace
    expectClean(headingSpaceRule, '##');
  });
});

// ── 2.4 headingHierarchyRule ────────────────────────────

describe('headingHierarchyRule', () => {
  it('detecta salto h1 → h3', () => {
    const diags = expectHit(headingHierarchyRule, '# Título\n### Subsección', 'Structure');
    expect(diags[0].message).toContain('h1 → h3');
  });

  it('no reporta h1 → h2 → h3', () => {
    expectClean(headingHierarchyRule, '# Título\n## Sección\n### Sub');
  });

  it('detecta h2 → h4', () => {
    const diags = headingHierarchyRule.check('## Sección\n#### Sub');
    expect(diags.length).toBe(1);
    expect(diags[0].message).toContain('h2 → h4');
  });

  it('no reporta si baja de nivel (h3 → h1)', () => {
    expectClean(headingHierarchyRule, '### Sub\n# Nuevo');
  });

  it('no reporta en bloques de código', () => {
    expectClean(headingHierarchyRule, '# Título\n```\n### Dentro\n```');
  });

  it('maneja primer heading como h3 (sin previo)', () => {
    // No hay heading previo, lastLevel = 0, salto de 0 → 3 = okay (primer heading)
    // Pero la regla dice lastLevel > 0 && level > lastLevel + 1 → no dispara
    expectClean(headingHierarchyRule, '### Primer heading');
  });
});

// ── 2.5 multipleH1Rule ─────────────────────────────────

describe('multipleH1Rule', () => {
  it('detecta segundo h1', () => {
    const diags = multipleH1Rule.check('# Primero\n# Segundo');
    expect(diags.length).toBe(1);
    expect(diags[0].line).toBe(2);
    expect(diags[0].message).toContain('#2');
  });

  it('detecta múltiples h1', () => {
    const diags = multipleH1Rule.check('# A\n# B\n# C');
    expect(diags.length).toBe(2);
  });

  it('no reporta un solo h1', () => {
    expectClean(multipleH1Rule, '# Título\n## Sección');
  });

  it('no reporta h2, h3 etc.', () => {
    expectClean(multipleH1Rule, '## A\n## B\n### C');
  });

  it('no reporta en bloques de código', () => {
    expectClean(multipleH1Rule, '# Título\n```\n# Otro\n```');
  });
});

// ── 2.6 emptyHeadingRule ────────────────────────────────

describe('emptyHeadingRule', () => {
  it('detecta "# " vacío', () => {
    expectHit(emptyHeadingRule, '# ', 'Structure');
  });

  it('detecta "##" sin nada', () => {
    expectHit(emptyHeadingRule, '##');
  });

  it('detecta "### " con solo espacios', () => {
    expectHit(emptyHeadingRule, '###   ');
  });

  it('no reporta heading con contenido', () => {
    expectClean(emptyHeadingRule, '# Título');
  });

  it('no reporta en bloque de código', () => {
    expectClean(emptyHeadingRule, '```\n##\n```');
  });
});

// ── 2.7 linkSpacesRule ──────────────────────────────────

describe('linkSpacesRule', () => {
  it('detecta espacios en URL', () => {
    const diags = expectHit(linkSpacesRule, '[texto](http://example.com/mi pagina)', 'Links');
    expect(diags[0].severity).toBe('error');
  });

  it('no reporta URL sin espacios', () => {
    expectClean(linkSpacesRule, '[texto](http://example.com/pagina)');
  });

  it('detecta múltiples links con espacios', () => {
    const diags = linkSpacesRule.check('[a](http://a .com) y [b](http://b .com)');
    expect(diags.length).toBe(2);
  });

  it('no reporta en bloques de código', () => {
    expectClean(linkSpacesRule, '```\n[texto](http://example.com/mi pagina)\n```');
  });
});

// ── 2.8 emptyLinkRule ───────────────────────────────────

describe('emptyLinkRule', () => {
  it('detecta link sin texto [](url)', () => {
    const diags = expectHit(emptyLinkRule, '[](http://example.com)', 'Links');
    expect(diags[0].message).toContain('sin texto');
  });

  it('detecta link sin URL [texto]()', () => {
    const diags = emptyLinkRule.check('[Click aquí]()');
    expect(diags.length).toBe(1);
    expect(diags[0].severity).toBe('error');
    expect(diags[0].message).toContain('sin URL');
  });

  it('detecta ambos vacíos []()', () => {
    const diags = emptyLinkRule.check('[]()');
    expect(diags.length).toBe(2); // sin texto + sin URL
  });

  it('no reporta link completo', () => {
    expectClean(emptyLinkRule, '[Click](http://example.com)');
  });

  it('no reporta en bloque de código', () => {
    expectClean(emptyLinkRule, '```\n[](http://x.com)\n```');
  });
});

// ── 2.9 bareUrlRule ─────────────────────────────────────

describe('bareUrlRule', () => {
  it('está deshabilitada por defecto', () => {
    expect(bareUrlRule.defaultEnabled).toBe(false);
  });

  it('detecta URL suelta en texto', () => {
    const diags = expectHit(bareUrlRule, 'Visita https://example.com para más info', 'Links');
    expect(diags[0].severity).toBe('info');
  });

  it('no reporta URL dentro de link markdown', () => {
    expectClean(bareUrlRule, '[ejemplo](https://example.com)');
  });

  it('no reporta URL dentro de angle brackets', () => {
    expectClean(bareUrlRule, '<https://example.com>');
  });

  it('no reporta en bloques de código', () => {
    expectClean(bareUrlRule, '```\nhttps://example.com\n```');
  });

  it('detecta múltiples URLs sueltas', () => {
    const diags = bareUrlRule.check('Ver https://a.com y http://b.com');
    expect(diags.length).toBe(2);
  });
});

// ── 2.10 longParagraphRule ──────────────────────────────

describe('longParagraphRule', () => {
  it('detecta párrafo de >300 palabras', () => {
    const bigParagraph = wordsN(301);
    const diags = expectHit(longParagraphRule, bigParagraph, 'Readability');
    expect(diags[0].message).toContain('301');
  });

  it('no reporta párrafo de 300 palabras', () => {
    expectClean(longParagraphRule, wordsN(300));
  });

  it('no reporta párrafo corto', () => {
    expectClean(longParagraphRule, 'Un texto breve.');
  });

  it('separa párrafos por línea en blanco', () => {
    const text = `${wordsN(200)}\n\n${wordsN(200)}`;
    expectClean(longParagraphRule, text);
  });

  it('separa párrafos por headings', () => {
    const text = `${wordsN(200)}\n## Sección\n${wordsN(200)}`;
    expectClean(longParagraphRule, text);
  });

  it('ignora bloques de código largos', () => {
    const text = `\`\`\`\n${wordsN(400)}\n\`\`\``;
    expectClean(longParagraphRule, text);
  });

  it('maneja texto vacío', () => {
    expectClean(longParagraphRule, '');
  });

  it('detecta párrafo largo multiline sin blanks', () => {
    // Varias líneas sin blank entre ellas = mismo párrafo
    const text = `${wordsN(160)}\n${wordsN(160)}`;
    const diags = longParagraphRule.check(text);
    expect(diags.length).toBe(1);
    expect(diags[0].message).toContain('320');
  });
});

// ── 2.11 longSentenceRule ───────────────────────────────

describe('longSentenceRule', () => {
  it('está deshabilitada por defecto', () => {
    expect(longSentenceRule.defaultEnabled).toBe(false);
  });

  it('detecta oración de >50 palabras', () => {
    const longSentence = wordsN(52);
    const diags = expectHit(longSentenceRule, longSentence, 'Readability');
    expect(diags[0].message).toContain('52');
  });

  it('no reporta oración de 50 palabras', () => {
    expectClean(longSentenceRule, wordsN(50));
  });

  it('no reporta oraciones separadas por punto', () => {
    const text = `${wordsN(25)}. ${wordsN(25)}`;
    expectClean(longSentenceRule, text);
  });

  it('ignora headings', () => {
    expectClean(longSentenceRule, `# ${wordsN(60)}`);
  });

  it('ignora listas', () => {
    expectClean(longSentenceRule, `- ${wordsN(60)}`);
  });

  it('no reporta en bloques de código', () => {
    expectClean(longSentenceRule, `\`\`\`\n${wordsN(60)}\n\`\`\``);
  });
});

// ── 2.12 imageAltTextRule ───────────────────────────────

describe('imageAltTextRule', () => {
  it('detecta imagen sin alt ![](url)', () => {
    const diags = expectHit(imageAltTextRule, '![](http://img.jpg)', 'Accessibility');
    expect(diags[0].severity).toBe('warning');
  });

  it('detecta alt con solo espacios', () => {
    expectHit(imageAltTextRule, '![   ](http://img.jpg)');
  });

  it('no reporta imagen con alt', () => {
    expectClean(imageAltTextRule, '![descripción](http://img.jpg)');
  });

  it('detecta múltiples imágenes sin alt', () => {
    const text = '![](a.jpg) texto ![](b.png)';
    expect(imageAltTextRule.check(text).length).toBe(2);
  });

  it('no reporta en bloques de código', () => {
    expectClean(imageAltTextRule, '```\n![](img.jpg)\n```');
  });
});

// ── 2.13 mixedListMarkersRule ───────────────────────────

describe('mixedListMarkersRule', () => {
  it('está deshabilitada por defecto', () => {
    expect(mixedListMarkersRule.defaultEnabled).toBe(false);
  });

  it('detecta mezcla de - y *', () => {
    const text = '- item 1\n- item 2\n* item 3';
    const diags = mixedListMarkersRule.check(text);
    expect(diags.length).toBe(1);
    expect(diags[0].message).toContain('*');
    expect(diags[0].message).toContain('-');
  });

  it('no reporta marcadores consistentes', () => {
    expectClean(mixedListMarkersRule, '- item 1\n- item 2\n- item 3');
  });

  it('no reporta un solo tipo', () => {
    expectClean(mixedListMarkersRule, '* solo\n* asteriscos');
  });

  it('no reporta en bloques de código', () => {
    expectClean(mixedListMarkersRule, '- fuera\n```\n* dentro\n```\n- fuera2');
  });

  it('identifica el marcador dominante', () => {
    const text = '- a\n- b\n- c\n* d';
    const diags = mixedListMarkersRule.check(text);
    expect(diags[0].suggestion).toContain('-'); // dominant
  });

  it('reporta todos los minoritarios con tres marcadores', () => {
    const text = '- a\n- b\n* c\n+ d';
    const diags = mixedListMarkersRule.check(text);
    expect(diags.length).toBe(2); // * and + are minorities
  });
});

// ── 2.14 trailingWhitespaceRule ─────────────────────────

describe('trailingWhitespaceRule', () => {
  it('está deshabilitada por defecto', () => {
    expect(trailingWhitespaceRule.defaultEnabled).toBe(false);
  });

  it('detecta trailing tabs', () => {
    expectHit(trailingWhitespaceRule, 'texto\t', 'Whitespace');
  });

  it('detecta trailing de más de 2 espacios', () => {
    expectHit(trailingWhitespaceRule, 'texto   ');
  });

  it('permite exactamente 2 espacios (markdown <br>)', () => {
    expectClean(trailingWhitespaceRule, 'texto  ');
  });

  it('detecta un solo espacio trailing', () => {
    expectHit(trailingWhitespaceRule, 'texto ');
  });

  it('no reporta líneas limpias', () => {
    expectClean(trailingWhitespaceRule, 'texto limpio');
  });

  it('no reporta en bloques de código', () => {
    expectClean(trailingWhitespaceRule, '```\ntexto   \n```');
  });
});

// ── 2.15 consecutiveBlankLinesRule ──────────────────────

describe('consecutiveBlankLinesRule', () => {
  it('está deshabilitada por defecto', () => {
    expect(consecutiveBlankLinesRule.defaultEnabled).toBe(false);
  });

  it('detecta 3+ líneas en blanco', () => {
    const text = 'texto\n\n\n\ntexto';
    const diags = expectHit(consecutiveBlankLinesRule, text, 'Whitespace');
    expect(diags.length).toBe(1);
  });

  it('no reporta exactamente 2 líneas en blanco', () => {
    expectClean(consecutiveBlankLinesRule, 'texto\n\n\ntexto');
  });

  it('no reporta 1 línea en blanco', () => {
    expectClean(consecutiveBlankLinesRule, 'texto\n\ntexto');
  });

  it('detecta múltiples grupos de blanks', () => {
    const text = 'a\n\n\n\nb\n\n\n\nc';
    const diags = consecutiveBlankLinesRule.check(text);
    expect(diags.length).toBe(2);
  });

  it('maneja texto sin líneas en blanco', () => {
    expectClean(consecutiveBlankLinesRule, 'línea 1\nlínea 2');
  });
});

// ── 2.16 unclosedBracketsRule ───────────────────────────

describe('unclosedBracketsRule', () => {
  it('detecta paréntesis sin cerrar', () => {
    const diags = expectHit(unclosedBracketsRule, 'texto (incompleto', 'Academic');
    expect(diags[0].message).toContain('(');
  });

  it('detecta paréntesis extra de cierre', () => {
    const diags = unclosedBracketsRule.check('texto) sobrante');
    expect(diags[0].message).toContain(')');
  });

  it('detecta corchetes sin cerrar', () => {
    expectHit(unclosedBracketsRule, 'texto [incompleto');
  });

  it('detecta llaves sin cerrar', () => {
    expectHit(unclosedBracketsRule, 'texto {incompleto');
  });

  it('no reporta paréntesis balanceados', () => {
    expectClean(unclosedBracketsRule, 'texto (completo) y [otro] más {este}');
  });

  it('no reporta en bloques de código', () => {
    expectClean(unclosedBracketsRule, '```\nfunc(x\n```');
  });

  it('detecta múltiples aberturas en una línea', () => {
    const diags = unclosedBracketsRule.check('((sin cerrar');
    expect(diags[0].message).toContain('2');
  });

  it('maneja anidamiento correcto', () => {
    expectClean(unclosedBracketsRule, 'f(g(x))');
  });

  it('maneja texto vacío', () => {
    expectClean(unclosedBracketsRule, '');
  });
});

// ── 2.17 todoMarkersRule ────────────────────────────────

describe('todoMarkersRule', () => {
  it('detecta TODO', () => {
    const diags = expectHit(todoMarkersRule, 'TODO: completar esto', 'Academic');
    expect(diags[0].message).toContain('TODO');
  });

  it('detecta FIXME', () => {
    expectHit(todoMarkersRule, 'FIXME: arreglar bug');
  });

  it('detecta PENDIENTE', () => {
    expectHit(todoMarkersRule, 'PENDIENTE: revisar sección');
  });

  it('detecta HACK', () => {
    expectHit(todoMarkersRule, 'HACK: temporal');
  });

  it('detecta XXX', () => {
    expectHit(todoMarkersRule, 'XXX: revisar');
  });

  it('detecta FALTA', () => {
    expectHit(todoMarkersRule, 'FALTA agregar bibliografía');
  });

  it('detecta COMPLETAR', () => {
    expectHit(todoMarkersRule, 'COMPLETAR esta sección');
  });

  it('detecta case-insensitive', () => {
    expectHit(todoMarkersRule, 'todo: revisar');
  });

  it('no reporta en bloques de código', () => {
    expectClean(todoMarkersRule, '```\nTODO: esto es código\n```');
  });

  it('no reporta texto sin marcadores', () => {
    expectClean(todoMarkersRule, 'Esta sección está completa.');
  });

  it('detecta múltiples en una línea', () => {
    const diags = todoMarkersRule.check('TODO y FIXME');
    expect(diags.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. ALL_BUILTIN_RULES array
// ═══════════════════════════════════════════════════════════

describe('ALL_BUILTIN_RULES', () => {
  it('contiene exactamente 19 reglas', () => {
    expect(ALL_BUILTIN_RULES.length).toBe(19);
  });

  it('cada regla tiene un id único', () => {
    const ids = ALL_BUILTIN_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada regla tiene metadatos completos', () => {
    for (const rule of ALL_BUILTIN_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(typeof rule.defaultEnabled).toBe('boolean');
      expect(typeof rule.check).toBe('function');
    }
  });

  it('cada regla maneja texto vacío sin explotar', () => {
    for (const rule of ALL_BUILTIN_RULES) {
      expect(() => rule.check('')).not.toThrow();
    }
  });

  it('cada regla devuelve array (nunca null/undefined)', () => {
    for (const rule of ALL_BUILTIN_RULES) {
      const result = rule.check('');
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('todas las reglas ignoran bloques de código', () => {
    const codeText = '```\nentonses haser [](bad url) el el TODO\n```';
    for (const rule of ALL_BUILTIN_RULES) {
      expectClean(rule, codeText);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 4. EDGE CASES TRANSVERSALES
// ═══════════════════════════════════════════════════════════

describe('Edge cases transversales', () => {
  it('unicode y emojis no rompen las reglas', () => {
    const text = '# 🎉 Título con émojis\n\nTexto con café, niño, ñandú.';
    for (const rule of ALL_BUILTIN_RULES) {
      expect(() => rule.check(text)).not.toThrow();
    }
  });

  it('LaTeX inline no dispara falsos positivos de brackets', () => {
    // Las fórmulas LaTeX usan llaves — unclosedBracketsRule revisa por línea, así que {x} está ok
    expectClean(unclosedBracketsRule, '$f(x) = \\frac{a}{b}$');
  });

  it('frontmatter YAML no causa errores', () => {
    const text = '---\ntitle: Test\ndate: 2024-01-01\n---\n# Título';
    for (const rule of ALL_BUILTIN_RULES) {
      expect(() => rule.check(text)).not.toThrow();
    }
  });

  it('contenido solo de código', () => {
    const text = '```python\ndef hello():\n  print("world")\n```';
    for (const rule of ALL_BUILTIN_RULES) {
      expectClean(rule, text);
    }
  });

  it('mixed tilde and backtick code blocks', () => {
    const text = '~~~\nbloque tilde\n~~~\n```\nbloque backtick\n```';
    for (const rule of ALL_BUILTIN_RULES) {
      expectClean(rule, text);
    }
  });

  it('tabla markdown no genera falsos positivos', () => {
    const text = '| Col A | Col B |\n|-------|-------|\n| dato  | dato  |';
    // Las tablas usan | que no debería generar errores
    for (const rule of ALL_BUILTIN_RULES) {
      expect(() => rule.check(text)).not.toThrow();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 5. REGISTRY (MarkdownLinterRegistry)
// ═══════════════════════════════════════════════════════════

describe('MarkdownLinterRegistry', () => {
  beforeEach(() => {
    // El setup de vitest ya limpia localStorage; reseteamos al estado default
    MarkdownLinterRegistry.resetToDefaults();
  });

  // ── Estado inicial ──────────────────────────────────────

  describe('estado inicial', () => {
    it('tiene todas las reglas built-in registradas', () => {
      expect(MarkdownLinterRegistry.getTotalCount()).toBe(ALL_BUILTIN_RULES.length);
    });

    it('las reglas con defaultEnabled=true están habilitadas', () => {
      const enabledRules = MarkdownLinterRegistry.getEnabledRules();
      const expectedEnabled = ALL_BUILTIN_RULES.filter(r => r.defaultEnabled);
      expect(enabledRules.length).toBe(expectedEnabled.length);
    });

    it('getEnabledCount refleja las reglas habilitadas', () => {
      const expected = ALL_BUILTIN_RULES.filter(r => r.defaultEnabled).length;
      expect(MarkdownLinterRegistry.getEnabledCount()).toBe(expected);
    });
  });

  // ── setEnabled / toggleRule ────────────────────────────

  describe('setEnabled / toggleRule', () => {
    it('habilita una regla deshabilitada', () => {
      const disabledRule = ALL_BUILTIN_RULES.find(r => !r.defaultEnabled)!;
      expect(MarkdownLinterRegistry.isEnabled(disabledRule.id)).toBe(false);
      MarkdownLinterRegistry.setEnabled(disabledRule.id, true);
      expect(MarkdownLinterRegistry.isEnabled(disabledRule.id)).toBe(true);
    });

    it('deshabilita una regla habilitada', () => {
      const enabledRule = ALL_BUILTIN_RULES.find(r => r.defaultEnabled)!;
      MarkdownLinterRegistry.setEnabled(enabledRule.id, false);
      expect(MarkdownLinterRegistry.isEnabled(enabledRule.id)).toBe(false);
    });

    it('toggle cambia el estado', () => {
      const rule = ALL_BUILTIN_RULES[0];
      const before = MarkdownLinterRegistry.isEnabled(rule.id);
      MarkdownLinterRegistry.toggleRule(rule.id);
      expect(MarkdownLinterRegistry.isEnabled(rule.id)).toBe(!before);
    });

    it('toggle doble restaura el estado', () => {
      const rule = ALL_BUILTIN_RULES[0];
      const before = MarkdownLinterRegistry.isEnabled(rule.id);
      MarkdownLinterRegistry.toggleRule(rule.id);
      MarkdownLinterRegistry.toggleRule(rule.id);
      expect(MarkdownLinterRegistry.isEnabled(rule.id)).toBe(before);
    });

    it('setEnabled ignora regla no existente', () => {
      expect(() => MarkdownLinterRegistry.setEnabled('non_existent', true)).not.toThrow();
      expect(MarkdownLinterRegistry.isEnabled('non_existent')).toBe(false);
    });

    it('toggleRule ignora regla no existente', () => {
      expect(() => MarkdownLinterRegistry.toggleRule('non_existent')).not.toThrow();
    });
  });

  // ── setCategoryEnabled ────────────────────────────────

  describe('setCategoryEnabled', () => {
    it('habilita toda una categoría', () => {
      MarkdownLinterRegistry.setCategoryEnabled('whitespace', true);
      const states = MarkdownLinterRegistry.getAllRuleStates();
      const whitespace = states.filter(s => s.meta.category === 'whitespace');
      for (const s of whitespace) {
        expect(s.enabled).toBe(true);
      }
    });

    it('deshabilita toda una categoría', () => {
      MarkdownLinterRegistry.setCategoryEnabled('spelling', false);
      const states = MarkdownLinterRegistry.getAllRuleStates();
      const spelling = states.filter(s => s.meta.category === 'spelling');
      for (const s of spelling) {
        expect(s.enabled).toBe(false);
      }
    });

    it('no afecta otras categorías', () => {
      const beforeLinks = MarkdownLinterRegistry.getAllRuleStates()
        .filter(s => s.meta.category === 'links')
        .map(s => s.enabled);
      MarkdownLinterRegistry.setCategoryEnabled('spelling', false);
      const afterLinks = MarkdownLinterRegistry.getAllRuleStates()
        .filter(s => s.meta.category === 'links')
        .map(s => s.enabled);
      expect(afterLinks).toEqual(beforeLinks);
    });
  });

  // ── resetToDefaults ────────────────────────────────────

  describe('resetToDefaults', () => {
    it('restaura todos los defaults después de cambios', () => {
      MarkdownLinterRegistry.setCategoryEnabled('spelling', false);
      MarkdownLinterRegistry.setCategoryEnabled('whitespace', true);
      MarkdownLinterRegistry.resetToDefaults();

      for (const rule of ALL_BUILTIN_RULES) {
        expect(MarkdownLinterRegistry.isEnabled(rule.id)).toBe(rule.defaultEnabled);
      }
    });
  });

  // ── getAllRuleStates / getRulesByCategory ──────────────

  describe('getAllRuleStates', () => {
    it('devuelve un RuleState por cada regla', () => {
      const states = MarkdownLinterRegistry.getAllRuleStates();
      expect(states.length).toBe(ALL_BUILTIN_RULES.length);
    });

    it('cada estado tiene meta completa', () => {
      const states = MarkdownLinterRegistry.getAllRuleStates();
      for (const state of states) {
        expect(state.meta.id).toBeTruthy();
        expect(state.meta.name).toBeTruthy();
        expect(state.meta.category).toBeTruthy();
        expect(typeof state.enabled).toBe('boolean');
      }
    });
  });

  describe('getRulesByCategory', () => {
    it('agrupa correctamente por categoría', () => {
      const grouped = MarkdownLinterRegistry.getRulesByCategory();
      // spelling tiene al menos 2 reglas
      expect(grouped.get('spelling')!.length).toBeGreaterThanOrEqual(2);
      // structure tiene al menos 4
      expect(grouped.get('structure')!.length).toBeGreaterThanOrEqual(4);
    });

    it('cada regla aparece exactamente una vez', () => {
      const grouped = MarkdownLinterRegistry.getRulesByCategory();
      let total = 0;
      for (const rules of grouped.values()) {
        total += rules.length;
      }
      expect(total).toBe(ALL_BUILTIN_RULES.length);
    });
  });

  // ── registerRule / unregisterRule (plugins custom) ────

  describe('registerRule / unregisterRule', () => {
    const customRule: LinterRule = {
      id: 'test_custom_rule',
      name: 'Test Custom',
      description: 'Regla custom de prueba',
      category: 'semantic',
      defaultEnabled: true,
      check: (text) => text.includes('CUSTOM')
        ? [{ message: 'Custom match', severity: 'info', line: 1, column: 1, source: 'Custom' }]
        : []
    };

    it('registerRule agrega la regla', () => {
      const before = MarkdownLinterRegistry.getTotalCount();
      MarkdownLinterRegistry.registerRule(customRule);
      expect(MarkdownLinterRegistry.getTotalCount()).toBe(before + 1);
      expect(MarkdownLinterRegistry.isEnabled(customRule.id)).toBe(true);
    });

    it('unregisterRule elimina la regla', () => {
      MarkdownLinterRegistry.registerRule(customRule);
      const before = MarkdownLinterRegistry.getTotalCount();
      MarkdownLinterRegistry.unregisterRule(customRule.id);
      expect(MarkdownLinterRegistry.getTotalCount()).toBe(before - 1);
      expect(MarkdownLinterRegistry.isEnabled(customRule.id)).toBe(false);
    });

    it('la regla registrada aparece en getEnabledRules', () => {
      MarkdownLinterRegistry.registerRule(customRule);
      const rules = MarkdownLinterRegistry.getEnabledRules();
      expect(rules.find(r => r.id === customRule.id)).toBeDefined();
      // cleanup
      MarkdownLinterRegistry.unregisterRule(customRule.id);
    });

    it('registerRule no duplica si ya existe (mantiene enabled state)', () => {
      MarkdownLinterRegistry.registerRule(customRule);
      MarkdownLinterRegistry.setEnabled(customRule.id, false);
      MarkdownLinterRegistry.registerRule(customRule); // re-register
      expect(MarkdownLinterRegistry.isEnabled(customRule.id)).toBe(false);
      MarkdownLinterRegistry.unregisterRule(customRule.id);
    });
  });

  // ── Persistencia localStorage ─────────────────────────

  describe('persistencia localStorage', () => {
    it('guarda cambios en localStorage', () => {
      MarkdownLinterRegistry.setEnabled('spelling_typos', false);
      const raw = localStorage.getItem('agora:linter-config');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed['spelling_typos']).toBe(false);
    });

    it('resetToDefaults actualiza localStorage', () => {
      MarkdownLinterRegistry.setEnabled('spelling_typos', false);
      MarkdownLinterRegistry.resetToDefaults();
      const raw = localStorage.getItem('agora:linter-config');
      const parsed = JSON.parse(raw!);
      expect(parsed['spelling_typos']).toBe(true);
    });

    it('sobrevive a localStorage corrupto al construir nueva instancia', () => {
      localStorage.setItem('agora:linter-config', '{{{{not json}}}}');
      // Crear nueva instancia — debe cargar defaults sin explotar
      const fresh = new _MarkdownLinterRegistryClass();
      expect(fresh.getTotalCount()).toBe(ALL_BUILTIN_RULES.length);
      expect(fresh.isEnabled('spelling_typos')).toBe(true);
    });

    it('carga preferencias guardadas al construir nueva instancia', () => {
      localStorage.setItem('agora:linter-config', JSON.stringify({ spelling_typos: false }));
      const fresh = new _MarkdownLinterRegistryClass();
      expect(fresh.isEnabled('spelling_typos')).toBe(false);
      // Las demás mantienen sus defaults
      expect(fresh.isEnabled('structure_heading_space')).toBe(true);
    });

    it('ignora reglas desconocidas en localStorage', () => {
      localStorage.setItem('agora:linter-config', JSON.stringify({ unknown_rule_xyz: true }));
      const fresh = new _MarkdownLinterRegistryClass();
      expect(fresh.isEnabled('unknown_rule_xyz')).toBe(false);
    });
  });

  // ── Subscribe (patrón reactivo) ───────────────────────

  describe('subscribe', () => {
    it('notifica a listeners al cambiar estado', () => {
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      MarkdownLinterRegistry.toggleRule('spelling_typos');
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('unsubscribe deja de notificar', () => {
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      unsub();
      MarkdownLinterRegistry.toggleRule('spelling_typos');
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifica a múltiples listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      const u1 = MarkdownLinterRegistry.subscribe(l1);
      const u2 = MarkdownLinterRegistry.subscribe(l2);
      MarkdownLinterRegistry.toggleRule('spelling_typos');
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
      u1();
      u2();
    });

    it('notifica en setCategoryEnabled', () => {
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      MarkdownLinterRegistry.setCategoryEnabled('spelling', false);
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('notifica en resetToDefaults', () => {
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      MarkdownLinterRegistry.resetToDefaults();
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('notifica en registerRule', () => {
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      MarkdownLinterRegistry.registerRule({
        id: 'test_sub_rule',
        name: 'test',
        description: 'test',
        category: 'spelling',
        defaultEnabled: true,
        check: () => []
      });
      expect(listener).toHaveBeenCalledTimes(1);
      MarkdownLinterRegistry.unregisterRule('test_sub_rule');
      unsub();
    });

    it('notifica en unregisterRule', () => {
      MarkdownLinterRegistry.registerRule({
        id: 'test_unsub_rule',
        name: 'test',
        description: 'test',
        category: 'spelling',
        defaultEnabled: true,
        check: () => []
      });
      const listener = vi.fn();
      const unsub = MarkdownLinterRegistry.subscribe(listener);
      MarkdownLinterRegistry.unregisterRule('test_unsub_rule');
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 6. INTERACCIÓN ENTRE REGLAS
// ═══════════════════════════════════════════════════════════

describe('Interacción entre reglas', () => {
  it('mismo texto dispara múltiples reglas simultáneamente', () => {
    const text = '#Título sin espacio\n\nentonses el el\n\n[]()\n\n![](img.jpg)\n\nTODO: pendiente';
    const allDiags: LinterDiagnostic[] = [];
    for (const rule of ALL_BUILTIN_RULES) {
      if (rule.defaultEnabled) {
        allDiags.push(...rule.check(text));
      }
    }
    // headingSpace + spelling + doubled + emptyLink + imageAlt + todo
    expect(allDiags.length).toBeGreaterThanOrEqual(6);
    // Verificar que hay de múltiples sources
    const sources = new Set(allDiags.map(d => d.source));
    expect(sources.size).toBeGreaterThanOrEqual(4);
  });

  it('las reglas devuelven diagnósticos con campos válidos', () => {
    const text = 'entonses el el\n#Hola\n[](http://bad url)\nTODO fix';
    for (const rule of ALL_BUILTIN_RULES) {
      const diags = rule.check(text);
      for (const d of diags) {
        expect(d.line).toBeGreaterThanOrEqual(1);
        expect(d.column).toBeGreaterThanOrEqual(1);
        expect(d.message).toBeTruthy();
        expect(d.source).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(d.severity);
      }
    }
  });
});
