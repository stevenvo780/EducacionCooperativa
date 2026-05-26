import { executeCell, type CodeCell, type CellOutput } from '@stevenvo780/st-lang/format/stnb';

type Request = {
  type: 'execute-cell';
  requestId: number;
  cell: CodeCell;
  defaultProfile: string;
};

type Response = {
  type: 'execute-cell-result';
  requestId: number;
  outputs: CellOutput[];
};

export type STNotebookWorkerRequest = Request;
export type STNotebookWorkerResponse = Response;

self.onmessage = (event: MessageEvent<Request>) => {
  const message = event.data;
  if (!message || message.type !== 'execute-cell') return;

  let outputs: CellOutput[];
  try {
    outputs = executeCell(message.cell, message.defaultProfile);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    outputs = [
      {
        type: 'error',
        data: { valid: false, message: errorMessage },
        metadata: { executionTime: 0 }
      }
    ];
  }

  const response: Response = {
    type: 'execute-cell-result',
    requestId: message.requestId,
    outputs
  };
  self.postMessage(response);
};
