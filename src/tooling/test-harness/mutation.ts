export function mutateNumber(n: number): number[] {
  return [n + 1, n - 1, 0, -n, 2 * n];
}

export function mutateString(s: string): string[] {
  const out: string[] = [];
  out.push('');
  out.push(`${s} `);
  if (s.length > 0) {
    out.push(s.slice(0, -1));
    out.push(s.slice(1));
    out.push(s.toUpperCase() === s ? s.toLowerCase() : s.toUpperCase());
  } else {
    out.push('x');
    out.push('xx');
    out.push('X');
  }
  return out;
}

export function mutateBoolean(b: boolean): boolean[] {
  return [!b];
}
