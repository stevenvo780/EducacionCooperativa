export type ObligationStatus = 'verified' | 'pending' | 'failed' | 'unknown';

export interface ProofStep {
  formula: string;
  justification: string;
}

export interface ProofObligation {
  id: string;
  title: string;
  formula: string;
  profile: string;
  status: ObligationStatus;
  dependencies: string[];
  proof?: { steps: ProofStep[] };
  countermodel?: Record<string, boolean | string>;
}
