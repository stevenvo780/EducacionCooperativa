import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const projectRoot = process.cwd();
const nextDir = join(projectRoot, '.next');

/**
 * Corrige ownership de .next si hay archivos de root (causado por sudo).
 * Estrategia: intenta chown; si falla, borra .next entero para arrancar limpio.
 */
function fixNextDirPermissions() {
  if (!existsSync(nextDir)) return;

  try {
    const badFiles = execSync(
      `find "${nextDir}" -not -user "$(whoami)" 2>/dev/null | head -1`,
      { encoding: 'utf8' }
    ).trim();

    if (!badFiles) return; // todo OK

    console.warn('[prepare-next] Detectados archivos con owner incorrecto en .next');

    // Intento 1: chown sin sudo (funciona si el user tiene permisos en el dir)
    try {
      execSync(`chown -R "$(whoami):$(id -gn)" "${nextDir}" 2>/dev/null`, { stdio: 'pipe' });
      console.log('[prepare-next] Permisos corregidos.');
      return;
    } catch { /* sin permisos, siguiente intento */ }

    // Intento 2: sudo -n (no pide password)
    try {
      execSync(`sudo -n chown -R "$(whoami):$(id -gn)" "${nextDir}" 2>/dev/null`, { stdio: 'pipe' });
      console.log('[prepare-next] Permisos corregidos con sudo.');
      return;
    } catch { /* sudo requiere password, siguiente intento */ }

    // Intento 3: eliminar .next entero
    console.warn('[prepare-next] Eliminando .next para arrancar limpio...');
    try {
      rmSync(nextDir, { recursive: true, force: true });
      console.log('[prepare-next] .next eliminado.');
    } catch {
      // Intento 4: sudo rm
      try {
        execSync(`sudo -n rm -rf "${nextDir}" 2>/dev/null`, { stdio: 'pipe' });
        console.log('[prepare-next] .next eliminado con sudo.');
      } catch {
        console.error('[prepare-next] ⚠ No se pudo limpiar .next. Ejecuta: sudo chown -R $USER .next');
      }
    }
  } catch {
    // find no disponible o error inesperado, continuar
  }
}

fixNextDirPermissions();

try {
  execSync('node scripts/generate-st-runtime-manifest.mjs', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (error) {
  console.warn('[prepare-next] No se pudo generar st-runtime-manifest:', error instanceof Error ? error.message : error);
}

// Para builds: eliminar .next viejo para compilación limpia
if (process.argv.includes('--build')) {
  if (existsSync(nextDir)) {
    try {
      rmSync(nextDir, { recursive: true, force: true });
      console.log('[prepare-next] .next eliminado para build limpio.');
    } catch (err) {
      console.warn('[prepare-next] No se pudo eliminar .next:', err instanceof Error ? err.message : err);
    }
  }
}
