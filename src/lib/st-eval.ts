import {
  evaluate,
  check,
  listProfiles,
  type STEvalResult
} from '@stevenvo780/st-lang';
import type {
  Diagnostic,
  LogicStatus,
  RunResult,
  Severity
} from '@stevenvo780/st-lang/api';

export type StPlaygroundProfile = string;

export interface StPlaygroundDiagnostic {
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  suggestion?: string;
}

export interface StPlaygroundRunResult {
  status: LogicStatus;
  output?: string;
  hasProof: boolean;
  hasCounterModel: boolean;
  hasTruthTable: boolean;
  reasoningType?: string;
  reasoningSchema?: string;
  formulaClassification?: string;
  diagnostics: StPlaygroundDiagnostic[];
}

export interface StPlaygroundStats {
  profile: string | null;
  results: number;
  premises: number;
  clauses: number;
  diagnostics: number;
  errors: number;
  warnings: number;
  durationMs: number;
}

export interface StPlaygroundEvalResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  results: StPlaygroundRunResult[];
  diagnostics: StPlaygroundDiagnostic[];
  stats: StPlaygroundStats;
  threwError: boolean;
}

const MAX_OUTPUT_CHARS = 16_000;

function clamp(value: string | undefined, max = MAX_OUTPUT_CHARS): string {
  if (!value) return '';
  return value.length <= max
    ? value
    : `${value.slice(0, max)}\n… (output truncado, ${value.length - max} chars omitidos)`;
}

function toPlaygroundDiagnostic(d: Diagnostic): StPlaygroundDiagnostic {
  return {
    severity: d.severity,
    message: d.message,
    line: d.line,
    column: d.column,
    endLine: d.endLine,
    endColumn: d.endColumn,
    code: d.code,
    suggestion: d.suggestion
  };
}

function toPlaygroundResult(r: RunResult): StPlaygroundRunResult {
  return {
    status: r.status,
    output: clamp(r.output, 4_000),
    hasProof: Boolean(r.proof),
    hasCounterModel: Boolean(r.model),
    hasTruthTable: Boolean(r.truthTable),
    reasoningType: r.reasoningType,
    reasoningSchema: r.reasoningSchema,
    formulaClassification: r.formulaClassification,
    diagnostics: (r.diagnostics ?? []).map(toPlaygroundDiagnostic)
  };
}

function detectProfileLine(source: string): string | null {
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('//') || line === '') continue;
    if (line.startsWith('logic ')) {
      return line.slice('logic '.length).trim().replace(/[;\s].*$/, '') || null;
    }
    break;
  }
  return null;
}

function countPremises(source: string): number {
  let count = 0;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('axiom ') || line.startsWith('premise ') || line.startsWith('hypothesis ')) {
      count += 1;
    }
  }
  return count;
}

function countClauses(source: string): number {
  let count = 0;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    count += 1;
  }
  return count;
}

function summarize(
  source: string,
  evalResult: STEvalResult,
  durationMs: number,
  profileOverride: string | null,
): StPlaygroundStats {
  const diagnostics = evalResult.diagnostics ?? [];
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  return {
    profile: profileOverride ?? detectProfileLine(source),
    results: evalResult.results.length,
    premises: countPremises(source),
    clauses: countClauses(source),
    diagnostics: diagnostics.length,
    errors,
    warnings,
    durationMs
  };
}

export function getAvailableProfiles(): string[] {
  try {
    const profiles = listProfiles();
    return Array.isArray(profiles) && profiles.length > 0
      ? profiles
      : FALLBACK_PROFILES;
  } catch {
    return FALLBACK_PROFILES;
  }
}

const FALLBACK_PROFILES: string[] = [
  'classical.propositional',
  'classical.first-order',
  'modal.k',
  'paraconsistent.belnap',
  'intuitionistic.propositional'
];

function withProfileOverride(source: string, profile: string | null): {
  source: string;
  override: string | null;
} {
  if (!profile) return { source, override: null };
  const detected = detectProfileLine(source);
  if (detected === profile) return { source, override: profile };
  if (detected) {
    const replaced = source.replace(/^[\s]*logic[^\n]*\n?/m, `logic ${profile}\n`);
    return { source: replaced, override: profile };
  }
  return { source: `logic ${profile}\n${source}`, override: profile };
}

export function evalStInBrowser(
  source: string,
  profile: string | null = null,
): StPlaygroundEvalResult {
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  try {
    const { source: effectiveSource, override } = withProfileOverride(source, profile);
    const result = evaluate(effectiveSource);
    const durationMs = Math.max(
      0,
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start,
    );

    return {
      ok: result.ok,
      stdout: clamp(result.stdout),
      stderr: clamp(result.stderr),
      exitCode: result.exitCode,
      results: result.results.map(toPlaygroundResult),
      diagnostics: (result.diagnostics ?? []).map(toPlaygroundDiagnostic),
      stats: summarize(effectiveSource, result, durationMs, override),
      threwError: false
    };
  } catch (err) {
    const durationMs = Math.max(
      0,
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start,
    );
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stdout: '',
      stderr: `Excepción no controlada: ${message}`,
      exitCode: 99,
      results: [],
      diagnostics: [
        {
          severity: 'error',
          message,
          code: 'st-eval/threw'
        }
      ],
      stats: {
        profile: profile ?? detectProfileLine(source),
        results: 0,
        premises: countPremises(source),
        clauses: countClauses(source),
        diagnostics: 1,
        errors: 1,
        warnings: 0,
        durationMs
      },
      threwError: true
    };
  }
}

export function syntaxCheck(source: string): StPlaygroundDiagnostic[] {
  try {
    const r = check(source);
    return (r.diagnostics ?? []).map(toPlaygroundDiagnostic);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ severity: 'error', message, code: 'st-check/threw' }];
  }
}
