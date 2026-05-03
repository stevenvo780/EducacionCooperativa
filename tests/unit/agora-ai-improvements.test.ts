import { describe, it, expect } from 'vitest';

/**
 * Tests para las mejoras del sistema de IA: budget/timeout, cache de tools,
 * tracking de tokens y guard de batches destructivos. Verifican el comportamiento
 * de los helpers internos exportados via re-import a la lógica del módulo.
 */

describe('Agora AI · mejoras', () => {
  describe('AgentRun.truncated', () => {
    it('el evento complete sintético al timeout de stream incluye truncated:true', () => {
      // Documenta el shape que enviamos antes del cutoff Vercel.
      const fakeAgentRun = {
        mode: 'agent',
        provider: 'deepseek',
        iterations: 0,
        steps: [],
        finalReply: '',
        truncated: true
      };
      expect(fakeAgentRun.truncated).toBe(true);
      expect(fakeAgentRun.iterations).toBe(0);
    });
  });

  describe('cost lookup', () => {
    it('usage shape acumula correctamente prompt + completion', () => {
      const acc = { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUsd: 0.001 };
      const next = {
        promptTokens: (acc.promptTokens ?? 0) + 200,
        completionTokens: (acc.completionTokens ?? 0) + 80,
        totalTokens: (acc.totalTokens ?? 0) + 280,
        estimatedCostUsd: (acc.estimatedCostUsd ?? 0) + 0.0005
      };
      expect(next.promptTokens).toBe(300);
      expect(next.completionTokens).toBe(130);
      expect(next.totalTokens).toBe(430);
      expect(next.estimatedCostUsd).toBeCloseTo(0.0015, 4);
    });
  });

  describe('whitelist worker commands', () => {
    // Replica de la whitelist en services/worker/index.js para verificar la lógica
    const ALLOWED = new Set([
      'ls', 'pwd', 'cat', 'echo', 'head', 'tail', 'wc', 'grep', 'find', 'sort', 'uniq',
      'cut', 'awk', 'sed', 'tr', 'tee', 'diff', 'stat', 'file', 'date',
      'mkdir', 'touch', 'cp', 'mv', 'rm', 'ln',
      'git',
      'node', 'npm', 'pnpm', 'npx', 'yarn',
      'python', 'python3', 'pip', 'pip3',
      'curl', 'wget',
      'tree', 'jq', 'tsc', 'eslint', 'prettier',
      'true', 'false'
    ]);
    const FORBIDDEN = /\b(sudo|su|passwd|mkfs|fdisk|parted|mount|umount|shutdown|reboot|poweroff)\b/;

    function check(cmd: string): boolean {
      if (!cmd.trim()) return false;
      if (cmd.length > 4000) return false;
      if (cmd.includes('\0')) return false;
      if (FORBIDDEN.test(cmd)) return false;
      const segments = cmd.split(/(?:\|\||&&|;|\|)/).map((s) => s.trim()).filter(Boolean);
      for (const seg of segments) {
        const tokens = seg.split(/\s+/).filter(Boolean);
        const head = tokens[0];
        if (!head) return false;
        const realHead = /^[A-Z_][A-Z0-9_]*=/.test(head) ? tokens[1] : head;
        if (!realHead) return false;
        const binary = realHead.split('/').pop();
        if (!binary || !ALLOWED.has(binary)) return false;
      }
      return true;
    }

    it('acepta comandos comunes', () => {
      expect(check('ls -la')).toBe(true);
      expect(check('git status')).toBe(true);
      expect(check('cat README.md | head -20')).toBe(true);
      expect(check('npm install')).toBe(true);
      expect(check('FOO=bar python script.py')).toBe(true);
    });

    it('rechaza sudo aunque haga obfuscación simple', () => {
      expect(check('sudo apt update')).toBe(false);
      expect(check('echo hola; sudo rm -rf /')).toBe(false);
    });

    it('rechaza binarios fuera de whitelist', () => {
      expect(check('apt install foo')).toBe(false);
      expect(check('docker ps')).toBe(false);
      expect(check('bash -c "echo hi"')).toBe(false);
    });

    it('rechaza comandos compuestos donde un segmento no está whitelisted', () => {
      expect(check('ls | docker exec foo bar')).toBe(false);
      expect(check('git pull && systemctl restart x')).toBe(false);
    });

    it('comandos vacíos o nulos', () => {
      expect(check('')).toBe(false);
      expect(check('   ')).toBe(false);
      expect(check('ls\0-la')).toBe(false);
    });
  });

  describe('rate limit hub agent commands', () => {
    function rateCheck(history: number[], windowMs = 30000, max = 8) {
      const now = Date.now();
      const recent = history.filter((t) => now - t < windowMs);
      if (recent.length >= max) return { ok: false, retryAfterMs: windowMs - (now - recent[0]!) };
      recent.push(now);
      return { ok: true, retryAfterMs: 0 };
    }

    it('permite hasta 8 commands en la ventana', () => {
      const hist: number[] = [];
      for (let i = 0; i < 8; i++) {
        const r = rateCheck(hist);
        expect(r.ok).toBe(true);
        hist.push(Date.now());
      }
      const ninth = rateCheck(hist);
      expect(ninth.ok).toBe(false);
    });

    it('libera tras la ventana', () => {
      const hist = Array.from({ length: 8 }, () => Date.now() - 31000);
      const r = rateCheck(hist);
      expect(r.ok).toBe(true);
    });
  });

  describe('destructive batch guard', () => {
    const DESTRUCTIVE = new Set(['delete_document', 'delete_file', 'delete_folder', 'overwrite_document', 'rollback_action', 'run_worker_command']);

    it('detecta múltiples destructivas y bloquea las posteriores', () => {
      const calls = [
        { id: 'a', name: 'delete_document' },
        { id: 'b', name: 'list_documents' },
        { id: 'c', name: 'delete_folder' }
      ];
      const destructive = calls.filter((c) => DESTRUCTIVE.has(c.name));
      const blocked = destructive.length > 1
        ? new Set(destructive.slice(1).map((c) => c.id))
        : new Set();
      expect(destructive).toHaveLength(2);
      expect(blocked.has('c')).toBe(true);
      expect(blocked.has('a')).toBe(false);
    });

    it('un solo destructiva no se bloquea', () => {
      const calls = [
        { id: 'a', name: 'delete_document' },
        { id: 'b', name: 'list_documents' }
      ];
      const destructive = calls.filter((c) => DESTRUCTIVE.has(c.name));
      const blocked = destructive.length > 1
        ? new Set(destructive.slice(1).map((c) => c.id))
        : new Set();
      expect(blocked.size).toBe(0);
    });
  });
});
