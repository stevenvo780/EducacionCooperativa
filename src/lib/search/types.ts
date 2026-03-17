export const SEARCH_RESULT_KINDS = ['document', 'concept', 'fragment', 'author', 'work'] as const;

export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];
export type SearchResultFilter = 'all' | SearchResultKind;

export interface SearchSourceDocument {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal' | 'files' | 'board' | 'st-runner';
  folder?: string;
  workspaceId?: string;
  mimeType?: string;
  url?: string;
  storagePath?: string;
  ownerId?: string;
  updatedAt?: unknown;
  size?: number;
}

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  preview?: string;
  badge: string;
  score: number;
  matchedTerms: string[];
  sourceDoc: SearchSourceDocument;
}

export interface SemanticSearchRequest {
  query: string;
  workspaceId: string;
  limit?: number;
  kinds?: SearchResultKind[];
}

export interface SemanticSearchResponse {
  results: SearchResultItem[];
  meta: {
    query: string;
    workspaceId: string;
    scannedDocuments: number;
    totalCandidates: number;
    mode: 'heuristic-v1';
  };
}

export const SEARCH_KIND_LABELS: Record<SearchResultKind, string> = {
  document: 'Documento',
  concept: 'Concepto',
  fragment: 'Fragmento',
  author: 'Autor',
  work: 'Obra'
};

export const SEARCH_KIND_BADGES: Record<SearchResultKind, string> = {
  document: 'DOC',
  concept: 'CON',
  fragment: 'FRG',
  author: 'AUT',
  work: 'OBR'
};
