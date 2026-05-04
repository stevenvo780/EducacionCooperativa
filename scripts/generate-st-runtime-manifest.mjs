import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const outputFile = join(projectRoot, 'src/generated/st-runtime-manifest.ts');

const pkg = require(join(projectRoot, 'node_modules/@stevenvo780/st-lang/package.json'));
const runtime = require('@stevenvo780/st-lang');
const runtimeApi = require('@stevenvo780/st-lang/api');

function tryExec(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', cwd: projectRoot }).trim();
  } catch {
    return '';
  }
}

const completionItems = runtimeApi.completion();
const profileDetails = new Map();
completionItems.forEach((item) => {
  if (!item.label.startsWith('logic ')) return;
  const profileId = item.insertText.replace(/^logic\s+/, '').trim();
  if (!profileId || profileId === 'logic') return;
  if (!profileDetails.has(profileId)) {
    profileDetails.set(profileId, {
      id: profileId,
      label: item.label,
      detail: item.detail || '',
      insertText: item.insertText
    });
  }
});

const profileIds = runtimeApi.listProfiles();
const profiles = profileIds.map((id) => {
  const match = profileDetails.get(id);
  return {
    id,
    label: match?.label || `logic ${id}`,
    detail: match?.detail || '',
    insertText: match?.insertText || `logic ${id}`
  };
});

const keywordMap = runtime.KEYWORDS && typeof runtime.KEYWORDS === 'object'
  ? runtime.KEYWORDS
  : {};
const keywords = Object.keys(keywordMap).sort();

const validatedCommands = Array.from(new Set(completionItems
  .map((item) => item.label)
  .filter((label) => !label.startsWith('logic '))))
  .sort();

const supportedFeatures = [
  ['text-layer', ['claim', 'support', 'confidence', 'context', 'interpret', 'source', 'glossary']],
  ['definitions', ['define', 'unfold', 'fold', 'description']],
  ['theories', ['theory', 'import', 'export']],
  ['verification', ['check valid', 'check satisfiable', 'check equivalent', 'prove', 'countermodel', 'truth_table']],
  ['analysis', ['analyze', 'explain', 'render']]
].map(([feature, requiredLabels]) => ({
  id: feature,
  enabled: requiredLabels.every((label) => validatedCommands.includes(label))
}));

const cliVersion = tryExec(join(projectRoot, 'node_modules/.bin/st'), ['--version']);

const manifest = {
  generatedAt: new Date().toISOString(),
  canonicalVersion: pkg.version,
  packageVersion: pkg.version,
  cliVersion,
  versionMismatch: Boolean(cliVersion && cliVersion !== pkg.version),
  profiles,
  profileIds,
  keywords,
  validatedCommands,
  completionCount: completionItems.length,
  supportedFeatures
};

const source = `/* eslint-disable */
/**
 * Archivo generado por scripts/generate-st-runtime-manifest.mjs
 * No editar manualmente.
 */

export const ST_RUNTIME_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;

export type STRuntimeManifest = typeof ST_RUNTIME_MANIFEST;
export type STRuntimeProfileManifest = STRuntimeManifest['profiles'][number];
`;

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, source, 'utf8');
console.log(`[st-runtime-manifest] generado en ${outputFile}`);
