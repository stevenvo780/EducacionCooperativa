/**
 * Función de scoring pura para la Command Palette. Extraída para que
 * pueda testearse sin React. Mismo algoritmo que CommandPalette pero
 * accesible desde tests.
 */

export interface SearchableCommand {
  label: string;
  category?: string;
  keywords?: string[];
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function scoreCommand(cmd: SearchableCommand, query: string): number {
  if (!query) return 1;
  const haystack = normalize(`${cmd.category ?? ''} ${cmd.label} ${(cmd.keywords ?? []).join(' ')}`);
  const needle = normalize(query);
  if (haystack.includes(needle)) {
    let bonus = 0;
    if (haystack.startsWith(needle)) bonus += 50;
    if (normalize(cmd.label).startsWith(needle)) bonus += 30;
    return 100 + bonus;
  }
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i >= needle.length) return 10;
  }
  return 0;
}

export function rankCommands<T extends SearchableCommand>(commands: T[], query: string): T[] {
  return commands
    .map((c) => ({ cmd: c, s: scoreCommand(c, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.cmd);
}
