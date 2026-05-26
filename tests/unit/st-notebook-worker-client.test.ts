import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeCell } from '@/types/stnb';

/**
 * El client de ejecución de notebook corre executeCell en un Web Worker con
 * timeout de 6s. Si el worker se cuelga (OOM por `show:`) debe abortar,
 * terminar el worker y devolver un CellOutput[] de error legible — nunca
 * dejar colgar el main thread. Mockeamos globalThis.Worker para controlar
 * el comportamiento (responde, cuelga, o falla).
 */

type WorkerHandler = (instance: FakeWorker, data: unknown) => void;

let handler: WorkerHandler = () => {};
const terminated: FakeWorker[] = [];

class FakeWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  terminatedFlag = false;
  postMessage(data: unknown) {
    handler(this, data);
  }
  terminate() {
    this.terminatedFlag = true;
    terminated.push(this);
  }
}

function makeCell(): CodeCell {
  return { id: 'c1', type: 'code', source: 'show: ⊤.', outputs: [] };
}

describe('runCellInWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    terminated.length = 0;
    handler = () => {};
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('devuelve los outputs del worker cuando responde a tiempo', async () => {
    handler = (instance, data) => {
      const req = data as { requestId: number };
      queueMicrotask(() => {
        instance.onmessage?.({
          data: {
            type: 'execute-cell-result',
            requestId: req.requestId,
            outputs: [{ type: 'result', data: { valid: true, stdout: 'ok', results: [] } }]
          }
        });
      });
    };
    const { runCellInWorker } = await import('@/components/st-notebook/st-eval-worker-client');
    const promise = runCellInWorker(makeCell(), 'classical.propositional');
    await vi.advanceTimersByTimeAsync(1);
    const outputs = await promise;
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.type).toBe('result');
    expect(terminated).toHaveLength(0);
  });

  it('aborta y termina el worker tras el timeout (bucle en show:)', async () => {
    // El worker nunca responde → simula el OOM colgado.
    handler = () => {};
    const { runCellInWorker } = await import('@/components/st-notebook/st-eval-worker-client');
    const promise = runCellInWorker(makeCell(), 'classical.propositional');
    await vi.advanceTimersByTimeAsync(6_000);
    const outputs = await promise;
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.type).toBe('error');
    expect(String((outputs[0]?.data as Record<string, unknown>)['message'])).toMatch(/abortada/i);
    expect(terminated.length).toBeGreaterThanOrEqual(1);
  });

  it('preserva el shape CellOutput[] (type/data/metadata)', async () => {
    handler = () => {};
    const { runCellInWorker } = await import('@/components/st-notebook/st-eval-worker-client');
    const promise = runCellInWorker(makeCell(), 'classical.propositional');
    await vi.advanceTimersByTimeAsync(6_000);
    const [out] = await promise;
    expect(out).toMatchObject({
      type: 'error',
      data: expect.objectContaining({ valid: false, message: expect.any(String) }),
      metadata: expect.objectContaining({ executionTime: expect.any(Number) })
    });
  });
});
