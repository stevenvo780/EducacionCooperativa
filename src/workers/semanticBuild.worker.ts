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

type ReqBuild = {
  type: 'build';
  requestId: number;
  state: SemanticWorkspaceState;
  docName: string;
  sourceDocument?: SemanticDocumentRef;
  runPairwise: boolean;
};

type ReqVerifyPairwise = {
  type: 'verify-pairwise';
  requestId: number;
  snapshots: PairwiseClaimSnapshot[];
};

type Request = ReqBuild | ReqVerifyPairwise;

export type SemanticBuildProgress =
  | { type: 'build-graph-progress'; requestId: number; stage: 'graph' | 'st-preview'; processed: number; total: number }
  | { type: 'build-graph-result'; requestId: number; graph: TheoryGraph; stPreview: string; pairwiseSnapshots: PairwiseClaimSnapshot[] }
  | { type: 'verify-pairwise-progress'; requestId: number; processed: number; total: number; diagnostics: TheoryGraphDiagnostic[] }
  | { type: 'verify-pairwise-result'; requestId: number; diagnostics: TheoryGraphDiagnostic[] }
  | { type: 'error'; requestId: number; message: string };

export type SemanticBuildRequest = Request;
export type SemanticBuildResponse = SemanticBuildProgress;

const PAIRWISE_BATCH_SIZE = 20;
const PAIRWISE_YIELD_MS = 16;

const post = (msg: SemanticBuildResponse) => {
  (self as unknown as { postMessage: (m: SemanticBuildResponse) => void }).postMessage(msg);
};

const sleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

async function handleBuild(req: ReqBuild): Promise<void> {
  try {
    post({
      type: 'build-graph-progress',
      requestId: req.requestId,
      stage: 'graph',
      processed: 0,
      total: req.state.concepts.length + req.state.fragments.length
    });

    const graph = buildTheoryGraphFromSemanticState(req.state, req.sourceDocument ? { sourceDocument: req.sourceDocument } : undefined);

    post({
      type: 'build-graph-progress',
      requestId: req.requestId,
      stage: 'st-preview',
      processed: graph.nodes.length,
      total: graph.nodes.length
    });

    const stPreview = buildSTFromSemantic(req.state, req.docName);
    const pairwiseSnapshots = req.runPairwise ? collectPairwiseClaimSnapshots(graph) : [];

    post({
      type: 'build-graph-result',
      requestId: req.requestId,
      graph,
      stPreview,
      pairwiseSnapshots
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', requestId: req.requestId, message });
  }
}

async function handleVerifyPairwise(req: ReqVerifyPairwise): Promise<void> {
  try {
    const snapshots = req.snapshots;
    const total = (snapshots.length * Math.max(0, snapshots.length - 1)) / 2;
    if (total === 0) {
      post({ type: 'verify-pairwise-result', requestId: req.requestId, diagnostics: [] });
      return;
    }

    const accumulated: TheoryGraphDiagnostic[] = [];
    let batch: TheoryGraphDiagnostic[] = [];
    let processed = 0;
    let lastYield = Date.now();

    for (let i = 0; i < snapshots.length; i += 1) {
      const left = snapshots[i];
      if (!left) continue;
      for (let j = i + 1; j < snapshots.length; j += 1) {
        const right = snapshots[j];
        if (!right) continue;
        const diagnostic = runPairwiseSatisfiabilityCheck(left, right);
        if (diagnostic) {
          batch.push(diagnostic);
          accumulated.push(diagnostic);
        }
        processed += 1;

        const now = Date.now();
        if (processed % PAIRWISE_BATCH_SIZE === 0 || now - lastYield > PAIRWISE_YIELD_MS) {
          post({
            type: 'verify-pairwise-progress',
            requestId: req.requestId,
            processed,
            total,
            diagnostics: batch
          });
          batch = [];
          lastYield = now;
          await sleep(0);
        }
      }
    }

    post({
      type: 'verify-pairwise-result',
      requestId: req.requestId,
      diagnostics: accumulated
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', requestId: req.requestId, message });
  }
}

self.onmessage = (event: MessageEvent<Request>) => {
  const message = event.data;
  if (!message) return;
  if (message.type === 'build') {
    void handleBuild(message);
    return;
  }
  if (message.type === 'verify-pairwise') {
    void handleVerifyPairwise(message);
  }
};
