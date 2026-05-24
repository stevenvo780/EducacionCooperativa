export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface Suggestion {
  id: string;
  kind: string;
  label: string;
  formula?: string;
}
