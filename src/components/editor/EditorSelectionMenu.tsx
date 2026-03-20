'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { BookMarked, BookmarkPlus, Briefcase, FilePlus2, Link2, Network, Quote, Scissors, Sparkles } from 'lucide-react';
import type { EditorSelectionSnapshot } from '@/hooks/useEditorSelectionActions';
import type { SemanticConceptRecord } from '@/services/editorSemanticStore';

interface LinkableDocument {
  id: string;
  name: string;
  folder?: string;
}

type MenuMode = 'actions' | 'concepts' | 'documents';

interface EditorSelectionMenuProps {
  selection: EditorSelectionSnapshot;
  concepts: SemanticConceptRecord[];
  documents: LinkableDocument[];
  loadingDocuments: boolean;
  busyAction: string | null;
  onClose: () => void;
  onDefineConcept: () => void;
  onCreateAnalyticalCard: () => void;
  onCreateSemanticBlock: () => void;
  onCreateTask: () => void;
  onMarkEvidence: () => void;
  onPinFragment: () => void;
  onOpenConcepts: () => void;
  onOpenDocuments: () => void;
  onRelateConcept: (conceptId: string) => void;
  onLinkDocument: (document: LinkableDocument) => void;
  onSaveAsSnippet: () => void;
}

const excerpt = (value: string, maxLength = 110) => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
};

export function EditorSelectionMenu({
  selection,
  concepts,
  documents,
  loadingDocuments,
  busyAction,
  onClose,
  onDefineConcept,
  onCreateAnalyticalCard,
  onCreateSemanticBlock,
  onCreateTask,
  onMarkEvidence,
  onPinFragment,
  onOpenConcepts,
  onOpenDocuments,
  onRelateConcept,
  onLinkDocument,
  onSaveAsSnippet
}: EditorSelectionMenuProps) {
  const [mode, setMode] = useState<MenuMode>('actions');
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode('actions');
    setQuery('');
  }, [selection.id]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const position = useMemo(() => {
    const menuWidth = 320;
    const menuHeight = mode === 'actions' ? 336 : 340;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;

    const desiredLeft = selection.rect.left + selection.rect.width / 2 - menuWidth / 2;
    const desiredTop = selection.rect.bottom + 12;

    return {
      left: Math.min(Math.max(12, desiredLeft), viewportWidth - menuWidth - 12),
      top: Math.min(Math.max(12, desiredTop), viewportHeight - menuHeight - 12)
    };
  }, [mode, selection.rect.bottom, selection.rect.left, selection.rect.width]);

  const filteredConcepts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return concepts;
    return concepts.filter((concept) => (
      concept.title.toLowerCase().includes(normalizedQuery)
      || concept.excerpt.toLowerCase().includes(normalizedQuery)
    ));
  }, [concepts, query]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return documents;
    return documents.filter((document) => {
      const label = `${document.name} ${document.folder || ''}`.toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [documents, query]);

  const renderActions = () => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton icon={<Sparkles className="h-3.5 w-3.5" />} label="Definir concepto" busy={busyAction === 'define-concept'} onClick={onDefineConcept} />
        <ActionButton icon={<Network className="h-3.5 w-3.5" />} label="Relacionar" busy={busyAction === 'relate-concept'} onClick={() => { onOpenConcepts(); setMode('concepts'); }} />
        <ActionButton icon={<FilePlus2 className="h-3.5 w-3.5" />} label="Bloque semántico" busy={busyAction === 'semantic-block'} onClick={onCreateSemanticBlock} />
        <ActionButton icon={<Briefcase className="h-3.5 w-3.5" />} label="Enviar a tarea" busy={busyAction === 'create-task'} onClick={onCreateTask} />
        <ActionButton icon={<Quote className="h-3.5 w-3.5" />} label="Marcar evidencia" busy={busyAction === 'mark-evidence'} onClick={onMarkEvidence} />
        <ActionButton icon={<BookmarkPlus className="h-3.5 w-3.5" />} label="Fijar fragmento" busy={busyAction === 'pin-fragment'} onClick={onPinFragment} />
        <ActionButton icon={<Scissors className="h-3.5 w-3.5" />} label="Guardar snippet" busy={busyAction === 'save-snippet'} onClick={onSaveAsSnippet} />
      </div>
      <button
        type="button"
        onClick={onCreateAnalyticalCard}
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-900"
      >
        <span className="flex items-center gap-2"><BookMarked className="h-3.5 w-3.5 text-blue-300" /> Ficha analítica</span>
        <span className="text-[11px] text-slate-500">Compuesta</span>
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenDocuments();
          setMode('documents');
        }}
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-900"
      >
        <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5 text-blue-300" /> Enlazar a documento</span>
        <span className="text-[11px] text-slate-500">Interno</span>
      </button>
    </>
  );

  const renderConcepts = () => (
    <SelectionList
      title="Relacionar con concepto"
      placeholder="Buscar concepto..."
      query={query}
      onQueryChange={setQuery}
      onBack={() => setMode('actions')}
      emptyLabel={concepts.length === 0 ? 'Todavía no hay conceptos creados desde el editor.' : 'No hay conceptos que coincidan con esa búsqueda.'}
      items={filteredConcepts.map((concept) => ({
        id: concept.id,
        title: concept.title,
        subtitle: concept.excerpt,
        meta: concept.docName,
        onClick: () => onRelateConcept(concept.id)
      }))}
      busy={busyAction === 'relate-concept'}
    />
  );

  const renderDocuments = () => (
    <SelectionList
      title="Enlazar a documento"
      placeholder="Buscar documento..."
      query={query}
      onQueryChange={setQuery}
      onBack={() => setMode('actions')}
      emptyLabel={loadingDocuments ? 'Cargando documentos del workspace...' : 'No hay documentos disponibles para enlazar.'}
      items={filteredDocuments.map((document) => ({
        id: document.id,
        title: document.name,
        subtitle: document.folder || 'Sin carpeta',
        meta: document.id,
        onClick: () => onLinkDocument(document)
      }))}
      busy={busyAction === 'link-document' || loadingDocuments}
    />
  );

  const content = (
    <div
      ref={menuRef}
      className="fixed z-[100000] w-[320px] rounded-xl border border-slate-700 bg-slate-950/98 p-3 shadow-2xl shadow-black/60 backdrop-blur"
      style={{ left: position.left, top: position.top }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            <BookMarked className="h-3.5 w-3.5" /> Menú semántico
          </div>
          <p className="text-xs leading-5 text-slate-300">{excerpt(selection.text)}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-200">Cerrar</button>
      </div>

      {mode === 'actions' && renderActions()}
      {mode === 'concepts' && renderConcepts()}
      {mode === 'documents' && renderDocuments()}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(content, document.body);
}

function ActionButton({ icon, label, onClick, busy }: { icon: React.ReactNode; label: string; onClick: () => void; busy: boolean; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-900 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="text-blue-300">{icon}</span>
      <span className="leading-5">{busy ? 'Procesando...' : label}</span>
    </button>
  );
}

function SelectionList({
  title,
  placeholder,
  query,
  onQueryChange,
  onBack,
  emptyLabel,
  items,
  busy
}: {
  title: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onBack: () => void;
  emptyLabel: string;
  items: Array<{ id: string; title: string; subtitle: string; meta: string; onClick: () => void; }>;
  busy: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100">← Volver</button>
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</span>
      </div>
      <input
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
      />
      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm leading-6 text-slate-500">{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              onClick={item.onClick}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left transition hover:border-blue-500/40 hover:bg-slate-900 disabled:cursor-wait disabled:opacity-60"
            >
              <div className="mb-1 text-sm font-medium text-slate-100">{item.title}</div>
              <div className="text-xs leading-5 text-slate-400">{item.subtitle}</div>
              <div className="mt-1 text-[11px] text-slate-500">{item.meta}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
