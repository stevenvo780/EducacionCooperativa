import type { CodeCell, CellOutput } from '@/types/stnb';
import type { STNotebookWorkerResponse } from './st-eval.worker';

const CELL_TIMEOUT_MS = 6_000;

interface Pending {
  resolve: (outputs: CellOutput[]) => void;
  timer: ReturnType<typeof setTimeout>;
  cellId: string;
}

let workerInstance: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

function timeoutOutputs(): CellOutput[] {
  return [
    {
      type: 'error',
      data: {
        valid: false,
        message:
          'Ejecución abortada: tardó demasiado (posible bucle en `show:`). La celda se detuvo a los 6s.'
      },
      metadata: { executionTime: CELL_TIMEOUT_MS }
    }
  ];
}

function errorOutputs(message: string): CellOutput[] {
  return [
    {
      type: 'error',
      data: { valid: false, message },
      metadata: { executionTime: 0 }
    }
  ];
}

/**
 * Destruye el worker y resuelve todas las llamadas pendientes con un output
 * de error. Se usa al exceder el timeout (worker colgado en un `show:` que
 * hace OOM) y cuando el worker emite onerror.
 */
function killWorker(reason: 'timeout' | 'error'): void {
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {
      /* noop */
    }
    workerInstance = null;
  }
  const outputs = reason === 'timeout' ? timeoutOutputs() : errorOutputs('Error en el worker de ejecución ST.');
  for (const [, slot] of pending) {
    clearTimeout(slot.timer);
    slot.resolve(outputs);
  }
  pending.clear();
}

function getWorker(): Worker | null {
  if (workerInstance) return workerInstance;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(new URL('./st-eval.worker.ts', import.meta.url), {
      type: 'module'
    });
    w.onmessage = (event: MessageEvent<STNotebookWorkerResponse>) => {
      const message = event.data;
      if (!message || message.type !== 'execute-cell-result') return;
      const slot = pending.get(message.requestId);
      if (!slot) return;
      pending.delete(message.requestId);
      clearTimeout(slot.timer);
      slot.resolve(message.outputs);
    };
    w.onerror = () => {
      killWorker('error');
    };
    workerInstance = w;
    return w;
  } catch {
    return null;
  }
}

/**
 * Ejecuta una celda de código en el Web Worker con timeout. Si el worker se
 * cuelga (OOM por `show:`), se aborta a los 6s, se destruye el worker y se
 * devuelve un output de error legible. El main thread nunca se bloquea.
 *
 * Devuelve siempre `CellOutput[]` — el mismo shape que `executeCell` de
 * st-lang — para no romper el render de CellEditor ni la persistencia.
 */
export function runCellInWorker(cell: CodeCell, defaultProfile: string): Promise<CellOutput[]> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(
      errorOutputs('El worker de ejecución ST no está disponible en este navegador.')
    );
  }
  return new Promise<CellOutput[]>((resolve) => {
    const requestId = nextRequestId++;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      killWorker('timeout');
      resolve(timeoutOutputs());
    }, CELL_TIMEOUT_MS);
    pending.set(requestId, { resolve, timer, cellId: cell.id });
    try {
      w.postMessage({ type: 'execute-cell', requestId, cell, defaultProfile });
    } catch (err) {
      clearTimeout(timer);
      pending.delete(requestId);
      const message = err instanceof Error ? err.message : String(err);
      resolve(errorOutputs(message));
    }
  });
}
