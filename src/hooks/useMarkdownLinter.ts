'use client';

import { useState, useCallback, useEffect } from 'react';

export type LinterSeverity = 'error' | 'warning' | 'info';

export interface LinterDiagnostic {
  message: string;
  severity: LinterSeverity;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source: string;
  suggestion?: string;
}

export interface LinterRule {
    name: string;
    check: (text: string) => LinterDiagnostic[];
}

// ── Built-in Rules ──────────────────────────────────────────

const spellcheckRule: LinterRule = {
    name: 'Spellcheck',
    check: (text: string) => {
        const results: LinterDiagnostic[] = [];
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
            'ahi': 'ahí'
        };

        const lines = text.split('\n');
        lines.forEach((line, lineIdx) => {
            Object.keys(commonTypos).forEach(typo => {
                const regex = new RegExp(`\\b${typo}\\b`, 'gi');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    results.push({
                        message: `Posible error de ortografía: "${match[0]}"`,
                        suggestion: `¿Quisiste decir "${commonTypos[typo.toLowerCase()]}"?`,
                        severity: 'warning',
                        line: lineIdx + 1,
                        column: match.index + 1,
                        endLine: lineIdx + 1,
                        endColumn: match.index + 1 + match[0].length,
                        source: 'Spellcheck'
                    });
                }
            });
        });
        return results;
    }
};

const markdownStructureRule: LinterRule = {
    name: 'MarkdownStructure',
    check: (text: string) => {
        const results: LinterDiagnostic[] = [];
        const lines = text.split('\n');
        lines.forEach((line, lineIdx) => {
            if (line.startsWith('#') && !line.includes(' ') && line.length > 1) {
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
        });
        return results;
    }
};

const linksRule: LinterRule = {
    name: 'Links',
    check: (text: string) => {
        const results: LinterDiagnostic[] = [];
        const lines = text.split('\n');
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        lines.forEach((line, lineIdx) => {
            let match;
            while ((match = linkRegex.exec(line)) !== null) {
                if (match[2].includes(' ')) {
                    results.push({
                        message: 'Las URLs en los enlaces no deben contener espacios.',
                        suggestion: 'Usa %20 en lugar de espacios.',
                        severity: 'error',
                        line: lineIdx + 1,
                        column: match.index + match[0].indexOf(match[2]) + 1,
                        endLine: lineIdx + 1,
                        endColumn: match.index + match[0].indexOf(match[2]) + 1 + match[2].length,
                        source: 'Links'
                    });
                }
            }
        });
        return results;
    }
};

// ── Registry ────────────────────────────────────────────────

const defaultRules = [spellcheckRule, markdownStructureRule, linksRule];

export function useMarkdownLinter(content: string, customRules: LinterRule[] = []) {
  const [diagnostics, setDiagnostics] = useState<LinterDiagnostic[]>([]);

  const runLint = useCallback((text: string) => {
    const allRules = [...defaultRules, ...customRules];
    const results = allRules.flatMap(rule => rule.check(text));

    // Sort and deduplicate (optional, but good for performance)
    const sortedResults = results.sort((a, b) => a.line - b.line || a.column - b.column);
    setDiagnostics(sortedResults);
  }, [customRules]);

  useEffect(() => {
    const timer = setTimeout(() => {
        runLint(content);
    }, 800);
    return () => clearTimeout(timer);
  }, [content, runLint]);

  return { diagnostics, runLint };
}
