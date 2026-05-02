'use client';

import { useState, useEffect, useMemo } from 'react';
import { STDefinitionsRegistry, type STDefinition } from '@/lib/st-definitions-registry';
import type { LinterRule, LinterDiagnostic } from '@/hooks/useMarkdownLinter';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCodeLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('```') || t.startsWith('~~~');
}

/**
 * Hook que genera reglas de linter semánticas basadas en el registro ST:
 *
 * - `semantic_st_undefined_ref` — nombres cualificados (Theory.Name) no definidos
 * - `semantic_st_unused_theorem` — teoremas/axiomas ST nunca referenciados en el texto
 * - `semantic_st_cross_doc_conflict` — términos definidos diferente en múltiples archivos .st
 *
 * Uso:
 *   const { stUndefinedRefRule, stUnusedTheoremRule, stCrossDocConflictRule } = useSTLinterRules();
 *   const { diagnostics } = useMarkdownLinter(content, [stDefinitionsRule, stUndefinedRefRule, ...]);
 */
export function useSTLinterRules() {
  const [definitions, setDefinitions] = useState<STDefinition[]>(() =>
    STDefinitionsRegistry.getAllDefinitions()
  );

  useEffect(() => {
    setDefinitions(STDefinitionsRegistry.getAllDefinitions());
    return STDefinitionsRegistry.subscribe(setDefinitions);
  }, []);

  // Conjunto de nombres definidos (para lookup O(1))
  const definedNamesSet = useMemo(() => {
    const s = new Set<string>();
    for (const def of definitions) s.add(def.name);
    return s;
  }, [definitions]);

  // Teoremas y axiomas para la regla de "no referenciados"
  const theoremsAndAxioms = useMemo(
    () => definitions.filter((d) => d.kind === 'theorem' || d.kind === 'axiom'),
    [definitions]
  );

  const stUndefinedRefRule: LinterRule = useMemo(() => ({
    id: 'semantic_st_undefined_ref',
    name: 'Referencias ST sin definir',
    description: 'Detecta nombres cualificados (Teoría.Nombre) no encontrados en el registro ST.',
    category: 'semantic' as const,
    defaultEnabled: true,
    supportsIncremental: true,
    check: (text: string): LinterDiagnostic[] => {
      if (definedNamesSet.size === 0) return [];
      const results: LinterDiagnostic[] = [];
      const lines = text.split('\n');

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        if (isCodeLine(lines[lineIdx])) continue;
        const line = lines[lineIdx];

        // Buscar nombres cualificados: MayúsculaInicial.MayúsculaInicial
        const regex = /\b[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ0-9]+\.[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ0-9]+\b/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          const name = match[0];
          if (!definedNamesSet.has(name)) {
            results.push({
              message: `Referencia cualificada "${name}" no encontrada en el registro ST.`,
              suggestion: 'Verifica el nombre o defínelo en un archivo .st del espacio de trabajo.',
              severity: 'warning',
              line: lineIdx + 1,
              column: match.index + 1,
              endLine: lineIdx + 1,
              endColumn: match.index + 1 + name.length,
              source: 'ST-Semantic'
            });
          }
        }
      }
      return results;
    }
  }), [definedNamesSet]);

  const stUnusedTheoremRule: LinterRule = useMemo(() => ({
    id: 'semantic_st_unused_theorem',
    name: 'Teoremas ST no referenciados',
    description: 'Detecta teoremas o axiomas ST definidos pero nunca mencionados en el texto.',
    category: 'semantic' as const,
    defaultEnabled: false,
    supportsIncremental: false,
    check: (text: string): LinterDiagnostic[] => {
      if (theoremsAndAxioms.length === 0) return [];
      const results: LinterDiagnostic[] = [];

      for (const def of theoremsAndAxioms) {
        const shortName = def.name.includes('.')
          ? def.name.split('.').pop()!
          : def.name;

        if (!text.includes(shortName) && !text.includes(def.name)) {
          const kindLabel = def.kind === 'theorem' ? 'Teorema' : 'Axioma';
          results.push({
            message: `${kindLabel} "${def.name}" (en ${def.file}) no se referencia en este documento.`,
            suggestion: 'Considera citarlo o verificar si pertenece a otro documento.',
            severity: 'info',
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
            source: 'ST-Semantic'
          });
        }
      }
      return results;
    }
  }), [theoremsAndAxioms]);

  const stCrossDocConflictRule: LinterRule = useMemo(() => ({
    id: 'semantic_st_cross_doc_conflict',
    name: 'Conflictos entre definiciones ST',
    description: 'Detecta términos definidos de forma diferente en múltiples archivos .st.',
    category: 'semantic' as const,
    defaultEnabled: true,
    supportsIncremental: false,
    check: (text: string): LinterDiagnostic[] => {
      const conflicts = STDefinitionsRegistry.getCrossDocumentConflicts();
      if (conflicts.length === 0) return [];

      const results: LinterDiagnostic[] = [];
      const lines = text.split('\n');

      for (const { name, definitions: conflictDefs } of conflicts) {
        const files = [...new Set(conflictDefs.map((d) => d.file))].join(', ');
        const shortName = name.includes('.') ? name.split('.').pop()! : name;
        if (shortName.length < 3) continue; // evitar falsos positivos en nombres muy cortos

        const regex = new RegExp(`\\b${escapeRegex(shortName)}\\b`, 'g');
        let reported = false;
        for (let lineIdx = 0; lineIdx < lines.length && !reported; lineIdx++) {
          if (isCodeLine(lines[lineIdx])) continue;
          let match;
          while ((match = regex.exec(lines[lineIdx])) !== null) {
            results.push({
              message: `"${name}" está definido de forma diferente en: ${files}.`,
              suggestion: 'Revisa la coherencia de las definiciones entre archivos .st del workspace.',
              severity: 'warning',
              line: lineIdx + 1,
              column: match.index + 1,
              endLine: lineIdx + 1,
              endColumn: match.index + 1 + shortName.length,
              source: 'ST-Semantic'
            });
            reported = true; // una advertencia por conflicto es suficiente
            break;
          }
        }
      }
      return results;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []); // conflicts come from registry, not from definitions array directly

  return { stUndefinedRefRule, stUnusedTheoremRule, stCrossDocConflictRule };
}
