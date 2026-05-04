'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { STDefinitionsRegistry, type STDefinition } from '@/lib/st-definitions-registry';
import { LinterRegistry } from '@/lib/linters/registry';
import type { LinterRule, LinterDiagnostic } from '@/hooks/useMarkdownLinter';

const LONG_INTERPRETATION_CHAR_THRESHOLD = 280;
const LONG_INTERPRETATION_WORD_THRESHOLD = 42;
const EXCERPT_MAX_WORDS = 12;
const EXCERPT_MAX_CHARS = 96;

/**
 * Icono según tipo de definición ST.
 */
function kindIcon(kind: STDefinition['kind']): string {
  switch (kind) {
    case 'define': return '[def]';
    case 'axiom': return '[axiom]';
    case 'theorem': return '[thm]';
    case 'claim': return '[claim]';
    case 'let': return '[let]';
    case 'source': return '[src]';
    case 'theory': return '[theory]';
    case 'function': return '[fn]';
    case 'passage': return '[passage]';
    case 'interpretation': return '[interp]';
    default: return '[·]';
  }
}

/**
 * Hook que genera una regla de linter para Markdown que resalta
 * palabras que coincidan con definiciones de archivos .st abiertos.
 *
 * Uso:
 *   const { stDefinitionsRule, definitions } = useSTDefinitionsLinter();
 *   const { diagnostics } = useMarkdownLinter(content, [stDefinitionsRule]);
 */
export function useSTDefinitionsLinter() {
  const [definitions, setDefinitions] = useState<STDefinition[]>([]);

  const prevDefsRef = useRef<STDefinition[]>([]);
  useEffect(() => {
    // Inicializar con definiciones existentes
    const initial = STDefinitionsRegistry.getAllDefinitions();
    prevDefsRef.current = initial;
    setDefinitions(initial);

    // Suscribirse a cambios — con comparación shallow para evitar re-renders innecesarios
    const unsub = STDefinitionsRegistry.subscribe((defs) => {
      const prev = prevDefsRef.current;
      if (prev.length === defs.length && prev.every((d, i) => {
        const next = defs[i];
        return next !== undefined && d.name === next.name && d.file === next.file && d.line === next.line;
      })) {
        return; // sin cambios reales
      }
      prevDefsRef.current = defs;
      setDefinitions(defs);
    });

    return unsub;
  }, []);

  /** Mapa de nombres definidos para búsqueda O(1) */
  const definedNamesMap = useMemo(() => {
    const map = new Map<string, STDefinition>();
    for (const def of definitions) {
      // Interpretations are matched via naturalPhrases below; skip here to avoid
      // overlapping diagnostics that cause tooltip flickering.
      if (def.kind === 'interpretation') continue;
      // Solo si el nombre tiene al menos 2 chars para evitar falsos positivos
      if (def.name.length >= 2) {
        map.set(def.name, def);
      }
    }
    return map;
  }, [definitions]);

  /** Frases en lenguaje natural extraídas de interpret (para buscar en markdown) */
  const naturalPhrases = useMemo(() => {
    const phrases: Array<{
      phrase: string;
      def: STDefinition;
      searchText: string;
      searchTextLower: string;
      isExcerpt: boolean;
    }> = [];
    for (const def of definitions) {
      if (def.naturalName && def.naturalName.length >= 8) {
        const searchText = buildInterpretationSearchText(def.naturalName);
        phrases.push({
          phrase: def.naturalName,
          def,
          searchText,
          searchTextLower: searchText.toLowerCase(),
          isExcerpt: searchText !== def.naturalName
        });
      }
    }
    return phrases;
  }, [definitions]);

  /** Regla de linter que detecta términos ST en markdown */
  const stDefinitionsRule: LinterRule = useMemo(() => ({
    id: 'semantic_st_definitions',
    name: 'STDefinitions',
    description: 'Resalta términos definidos en archivos .st del espacio de trabajo.',
    category: 'semantic' as const,
    defaultEnabled: true,
    check: (text: string): LinterDiagnostic[] => {
      if (!LinterRegistry.isEnabled('st-definitions')) return [];
      if (definedNamesMap.size === 0 && naturalPhrases.length === 0) return [];

      const results: LinterDiagnostic[] = [];
      const lines = text.split('\n');
      const seen = new Set<string>(); // Evitar duplicados por línea+nombre

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        if (line === undefined) continue;

        // Saltar líneas de código (fenced code blocks, inline code)
        if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) continue;

        for (const [name, def] of definedNamesMap) {
          // Buscar palabra completa (word boundary)
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
          let match;

          while ((match = regex.exec(line)) !== null) {
            const key = `${lineIdx}:${match.index}:${name}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const icon = kindIcon(def.kind);
            let message = `${icon} "${name}" está definido como ${def.kind} en ${def.file}`;
            if (def.detail) message += ` — ${def.detail}`;

            results.push({
              message,
              severity: 'info',
              line: lineIdx + 1,
              column: match.index + 1,
              endLine: lineIdx + 1,
              endColumn: match.index + 1 + name.length,
              source: 'ST-Definitions',
              suggestion: def.description || undefined
            });
          }
        }

        // Buscar frases naturales de interpret en el texto markdown
        const lineLower = line.toLowerCase();
        for (const { phrase, searchText, searchTextLower, def, isExcerpt } of naturalPhrases) {
          let startPos = 0;
          let idx: number;
          while ((idx = lineLower.indexOf(searchTextLower, startPos)) !== -1) {
            const key = `${lineIdx}:${idx}:natural:${phrase.slice(0, 20)}`;
            if (!seen.has(key)) {
              seen.add(key);
              const icon = kindIcon(def.kind);
              results.push({
                message: `${icon} ${isExcerpt ? 'Interpretación ST (fragmento)' : 'Interpretación ST'}: "${phrase.slice(0, 60)}${phrase.length > 60 ? '…' : ''}" → ${def.name}`,
                severity: 'info',
                line: lineIdx + 1,
                column: idx + 1,
                endLine: lineIdx + 1,
                endColumn: idx + 1 + searchText.length,
                source: 'ST-Definitions',
                suggestion: def.description || (isExcerpt
                  ? 'Definición larga: se usa un fragmento inicial como ancla visual.'
                  : undefined)
              });
            }
            startPos = idx + 1;
          }
        }
      }

      return results;
    }
  }), [definedNamesMap, naturalPhrases]);

  /** Función para registrar/actualizar definiciones de un archivo .st */
  const registerSTFile = useCallback((fileId: string, code: string) => {
    const defs = STDefinitionsRegistry.extractFromSource(code, fileId);
    STDefinitionsRegistry.setFileDefinitions(fileId, defs);
  }, []);

  /** Función para desregistrar un archivo .st */
  const unregisterSTFile = useCallback((fileId: string) => {
    STDefinitionsRegistry.removeFile(fileId);
  }, []);

  return {
    stDefinitionsRule,
    definitions,
    registerSTFile,
    unregisterSTFile
  };
}

/** Escapa caracteres especiales de regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildInterpretationSearchText(phrase: string): string {
  const normalized = phrase.trim().replace(/\s+/g, ' ');
  if (isQuotedInterpretation(normalized)) {
    return normalized;
  }

  const words = normalized.split(' ').filter(Boolean);
  const isLongInterpretation = normalized.length > LONG_INTERPRETATION_CHAR_THRESHOLD
    || words.length > LONG_INTERPRETATION_WORD_THRESHOLD;

  if (!isLongInterpretation) {
    return normalized;
  }

  const excerptWords = words.slice(0, EXCERPT_MAX_WORDS).join(' ');
  return excerptWords.length <= EXCERPT_MAX_CHARS
    ? excerptWords
    : `${excerptWords.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…`;
}

function isQuotedInterpretation(text: string) {
  if (text.length < 2) return false;
  const quoteChars = new Set(['"', "'", '“', '”', '«', '»', '„', '‟']);
  const first = text[0];
  const last = text[text.length - 1];
  return first !== undefined && last !== undefined && quoteChars.has(first) && quoteChars.has(last);
}
