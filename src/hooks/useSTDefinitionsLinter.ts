'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { STDefinitionsRegistry, type STDefinition } from '@/lib/st-definitions-registry';
import type { LinterRule, LinterDiagnostic } from '@/hooks/useMarkdownLinter';

/**
 * Icono según tipo de definición ST.
 */
function kindIcon(kind: STDefinition['kind']): string {
  switch (kind) {
    case 'define': return '📐';
    case 'axiom': return '📜';
    case 'theorem': return '🏛️';
    case 'let': return '📎';
    case 'source': return '📖';
    case 'theory': return '🏗️';
    case 'function': return '⚙️';
    case 'interpretation': return '🔍';
    default: return '🔹';
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

  useEffect(() => {
    // Inicializar con definiciones existentes
    setDefinitions(STDefinitionsRegistry.getAllDefinitions());

    // Suscribirse a cambios
    const unsub = STDefinitionsRegistry.subscribe((defs) => {
      setDefinitions(defs);
    });

    return unsub;
  }, []);

  /** Mapa de nombres definidos para búsqueda O(1) */
  const definedNamesMap = useMemo(() => {
    const map = new Map<string, STDefinition>();
    for (const def of definitions) {
      // Solo si el nombre tiene al menos 2 chars para evitar falsos positivos
      if (def.name.length >= 2) {
        map.set(def.name, def);
      }
    }
    return map;
  }, [definitions]);

  /** Regla de linter que detecta términos ST en markdown */
  const stDefinitionsRule: LinterRule = useMemo(() => ({
    name: 'STDefinitions',
    check: (text: string): LinterDiagnostic[] => {
      if (definedNamesMap.size === 0) return [];

      const results: LinterDiagnostic[] = [];
      const lines = text.split('\n');
      const seen = new Set<string>(); // Evitar duplicados por línea+nombre

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

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
      }

      return results;
    }
  }), [definedNamesMap]);

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
