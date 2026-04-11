import { useState } from 'react';

export interface DefineConceptDraft {
  selectionText: string;
  title: string;
  definition: string;
  logicProfile: string;
  formula: string;
}

export interface AutologicPreview {
  ok: boolean;
  stCode: string;
  patterns: string[];
  atomCount: number;
  formulaCount: number;
}

export function useEditorModals() {
  const [defineConceptDraft, setDefineConceptDraft] = useState<DefineConceptDraft | null>(null);
  const [autologicPreview, setAutologicPreview] = useState<AutologicPreview | null>(null);
  const [snippetDraft, setSnippetDraft] = useState<{ markdown: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ selectionText: string; note: string } | null>(null);

  return {
    defineConceptDraft,
    setDefineConceptDraft,
    autologicPreview,
    setAutologicPreview,
    snippetDraft,
    setSnippetDraft,
    noteDraft,
    setNoteDraft
  };
}
