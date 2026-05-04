import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const examplesDir = join(projectRoot, 'public/downloads/st');
const runtimePkg = require(join(projectRoot, 'node_modules/@stevenvo780/st-lang/package.json'));
const { evaluate } = require('@stevenvo780/st-lang/api');

function tryExec(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', cwd: projectRoot }).trim();
  } catch {
    return '';
  }
}

const cliVersion = tryExec(join(projectRoot, 'node_modules/.bin/st'), ['--version']);
const files = readdirSync(examplesDir)
  .filter((file) => file.endsWith('.st'))
  .sort();

let failures = 0;

console.log('==> Validando scripts de documentación ST');
console.log(`    Runtime canónico: @stevenvo780/st-lang ${runtimePkg.version}`);
if (cliVersion && cliVersion !== runtimePkg.version) {
  console.log(`    CLI detectado: ${cliVersion} (desalineado; la validación usa la API canónica del paquete)`);
}

for (const file of files) {
  const filePath = join(examplesDir, file);
  const source = readFileSync(filePath, 'utf8');
  console.log(`\n---- ${file} ----`);

  try {
    const result = evaluate(source);
    const fatalDiagnostics = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.severity === 'error');

    if (!result.ok || fatalDiagnostics.length > 0) {
      failures += 1;
      fatalDiagnostics.forEach((diagnostic) => {
        console.error(`ERROR ${diagnostic.line ?? '?'}:${diagnostic.column ?? '?'} ${diagnostic.message}`);
      });
      if (!result.ok && fatalDiagnostics.length === 0) {
        console.error('ERROR La evaluación reportó un resultado no válido para el script completo.');
      }
      continue;
    }

    console.log(`OK ${result.results?.length ?? 0} resultado(s), ${result.diagnostics?.length ?? 0} diagnóstico(s)`);
  } catch (error) {
    failures += 1;
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} script(s) ST de documentación fallaron.`);
  process.exit(1);
}

console.log('\nTodos los scripts ST de documentación se ejecutaron correctamente.');
