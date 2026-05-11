import {
  buildTheoryGraphFromSemanticState,
  collectPairwiseClaimSnapshots,
  runPairwiseSatisfiabilityCheck,
  type PairwiseClaimSnapshot,
  type TheoryGraph,
  type TheoryGraphDiagnostic
} from '@/lib/semantic/theory-graph';
import { buildSTFromSemantic } from '@/lib/buildSTFromSemantic';
import type { SemanticDocumentRef, SemanticWorkspaceState } from '@/lib/semantic/workspace-state';
import type { SemanticBuildResponse } from '@/workers/semanticBuild.worker';

export interface BuildResult {
  graph: TheoryGraph;
  stPreview: string;
  pairwiseSnapshots: PairwiseClaimSnapshot[];
}

export interface VerifyProgressEvent {
  processed: number;
  total: number;
  partial: TheoryGraphDiagnostic[];
}

export interface BuildOptions {
  state: SemanticWorkspaceState;
  docName: string;
  sourceDocument?: SemanticDocumentRef;
  runPairwise?: boolean;
}

export interface VerifyOptions {
  snapshots: PairwiseClaimSnapshot[];
  onProgress?: (event: VerifyProgressEvent) => void;
  signal?: AbortSignal;
}

type PendingBuild = {
  kind: 'build';
  resolve: (result: BuildResult) => void;
  reject: (err: Error) => void;
};

type PendingVerify = {
  kind: 'verify';
  resolve: (diagnostics: TheoryGraphDiagnostic[]) => void;
  reject: (err: Error) => void;
  onProgress?: (event: VerifyProgressEvent) => void;
};

type Pending = PendingBuild | PendingVerify;

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 2;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

const failAllPending = (message: string) => {
  for (const [, slot] of pending) {
    slot.reject(new Error(message));
  }
  pending.clear();
};

const getWorker = (): Worker | null => {
  if (workerInstance) return workerInstance;
  if (workerUnavailable) return null;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    const w = new Worker(
      new URL('../../workers/semanticBuild.worker.ts', import.meta.url),
      { type: 'module' }
    );
    w.onmessage = (event: MessageEvent<SemanticBuildResponse>) => {
      const message = event.data;
      if (!message) return;
      consecutiveFailures = 0;
      const slot = pending.get(message.requestId);
      if (!slot) return;
      if (message.type === 'build-graph-result' && slot.kind === 'build') {
        pending.delete(message.requestId);
        slot.resolve({
          graph: message.graph,
          stPreview: message.stPreview,
          pairwiseSnapshots: message.pairwiseSnapshots
        });
        return;
      }
      if (message.type === 'verify-pairwise-progress' && slot.kind === 'verify') {
        slot.onProgress?.({
          processed: message.processed,
          total: message.total,
          partial: message.diagnostics
        });
        return;
      }
      if (message.type === 'verify-pairwise-result' && slot.kind === 'verify') {
        pending.delete(message.requestId);
        slot.resolve(message.diagnostics);
        return;
      }
      if (message.type === 'error') {
        pending.delete(message.requestId);
        slot.reject(new Error(message.message));
      }
    };
    w.onerror = () => {
      consecutiveFailures += 1;
      try { w.terminate(); } catch { /* noop */ }
      workerInstance = null;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) workerUnavailable = true;
      failAllPending('semantic worker error');
    };
    workerInstance = w;
    return w;
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) workerUnavailable = true;
    return null;
  }
};

const buildInline = (opts: BuildOptions): BuildResult => {
  const graph = buildTheoryGraphFromSemanticState(opts.state, opts.sourceDocument ? { sourceDocument: opts.sourceDocument } : undefined);
  const stPreview = buildSTFromSemantic(opts.state, opts.docName);
  const pairwiseSnapshots = opts.runPairwise !== false ? collectPairwiseClaimSnapshots(graph) : [];
  return { graph, stPreview, pairwiseSnapshots };
};

const verifyInline = (
  snapshots: PairwiseClaimSnapshot[],
  onProgress?: (event: VerifyProgressEvent) => void,
  signal?: AbortSignal
): Promise<TheoryGraphDiagnostic[]> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const accumulated: TheoryGraphDiagnostic[] = [];
    const total = (snapshots.length * Math.max(0, snapshots.length - 1)) / 2;
    if (total === 0) {
      resolve([]);
      return;
    }
    let i = 0;
    let j = 1;
    let processed = 0;
    const batchPartial: TheoryGraphDiagnostic[] = [];

    const tick = () => {
      if (signal?.aborted) {
        reject(new Error('aborted'));
        return;
      }
      const sliceStart = Date.now();
      while (i < snapshots.length) {
        const left = snapshots[i];
        if (!left) { i += 1; j = i + 1; continue; }
        if (j >= snapshots.length) { i += 1; j = i + 1; continue; }
        const right = snapshots[j];
        if (right) {
          const diagnostic = runPairwiseSatisfiabilityCheck(left, right);
          if (diagnostic) {
            batchPartial.push(diagnostic);
            accumulated.push(diagnostic);
          }
        }
        j += 1;
        processed += 1;
        if (Date.now() - sliceStart > 12) break;
      }
      if (i >= snapshots.length) {
        if (batchPartial.length > 0) {
          onProgress?.({ processed, total, partial: batchPartial.splice(0) });
        }
        resolve(accumulated);
        return;
      }
      onProgress?.({ processed, total, partial: batchPartial.splice(0) });
      const idle: ((cb: () => void) => void) = typeof (self as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback === 'function'
        ? (cb) => (self as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb)
        : (cb) => { setTimeout(cb, 0); };
      idle(tick);
    };

    tick();
  });
};

export const buildSemanticGraphAsync = (opts: BuildOptions): Promise<BuildResult> => {
  const w = getWorker();
  if (!w) return Promise.resolve(buildInline(opts));
  return new Promise((resolve, reject) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { kind: 'build', resolve, reject });
    w.postMessage({
      type: 'build',
      requestId,
      state: opts.state,
      docName: opts.docName,
      sourceDocument: opts.sourceDocument,
      runPairwise: opts.runPairwise !== false
    });
  });
};

export const verifyPairwiseAsync = (opts: VerifyOptions): Promise<TheoryGraphDiagnostic[]> => {
  const w = getWorker();
  if (!w) return verifyInline(opts.snapshots, opts.onProgress, opts.signal);
  return new Promise((resolve, reject) => {
    const requestId = nextRequestId++;
    const slot: PendingVerify = {
      kind: 'verify',
      resolve,
      reject,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {})
    };
    pending.set(requestId, slot);
    if (opts.signal) {
      const handler = () => {
        pending.delete(requestId);
        reject(new Error('aborted'));
      };
      if (opts.signal.aborted) {
        handler();
        return;
      }
      opts.signal.addEventListener('abort', handler, { once: true });
    }
    w.postMessage({
      type: 'verify-pairwise',
      requestId,
      snapshots: opts.snapshots
    });
  });
};

export const isSemanticWorkerAvailable = (): boolean => !workerUnavailable && getWorker() !== null;
