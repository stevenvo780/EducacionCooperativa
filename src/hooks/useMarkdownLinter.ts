'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface LinterDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source: string;
}

export function useMarkdownLinter(content: string) {
  const [diagnostics, setDiagnostics] = useState<LinterDiagnostic[]>([]);

  const runLint = useCallback((text: string) => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');

    // 1. Basic Spellcheck (Simulated for common logic/docs words or typos)
    const commonTypos: Record<string, string> = {
        'entonses': 'entonces',
        'puedas': 'puedes',
        'halla': 'haya',
        'valla': 'vaya',
        'cooperatiba': 'cooperativa',
        'edicasion': 'educación',
        'st-lang': 'ST',
        'avierto': 'abierto',
        'abia': 'había',
        'estava': 'estaba',
        'hise': 'hice',
        'ubiera': 'hubiera',
        'alla': 'allá / haya',
        'ay': 'hay',
        'ahi': 'ahí',
    };

    lines.forEach((line, lineIdx) => {
        // Find typos
        Object.keys(commonTypos).forEach(typo => {
            const regex = new RegExp(`\\b${typo}\\b`, 'gi');
            let match;
            while ((match = regex.exec(line)) !== null) {
                results.push({
                    message: `Posible error de ortografía: "${match[0]}". ¿Quisiste decir "${commonTypos[typo]}"?`,
                    severity: 'warning',
                    line: lineIdx + 1,
                    column: match.index + 1,
                    endLine: lineIdx + 1,
                    endColumn: match.index + 1 + match[0].length,
                    source: 'Spellcheck'
                });
            }
        });

        // 2. Markdown structural checks
        if (line.startsWith('#') && !line.includes(' ')) {
             results.push({
                message: 'Los encabezados Markdown deben tener un espacio después de los "#".',
                severity: 'info',
                line: lineIdx + 1,
                column: 1,
                endLine: lineIdx + 1,
                endColumn: line.indexOf('#', 1) === -1 ? 2 : line.lastIndexOf('#') + 1,
                source: 'Structure'
            });
        }

        // 3. Link checks
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(line)) !== null) {
            if (linkMatch[2].includes(' ')) {
                results.push({
                    message: 'Las URLs en los enlaces no deben contener espacios. Usa %20.',
                    severity: 'error',
                    line: lineIdx + 1,
                    column: linkMatch.index + linkMatch[0].indexOf(linkMatch[2]) + 1,
                    endLine: lineIdx + 1,
                    endColumn: linkMatch.index + linkMatch[0].indexOf(linkMatch[2]) + 1 + linkMatch[2].length,
                    source: 'Links'
                });
            }
        }
    });

    setDiagnostics(results);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        runLint(content);
    }, 800);
    return () => clearTimeout(timer);
  }, [content, runLint]);

  return { diagnostics, runLint };
}
