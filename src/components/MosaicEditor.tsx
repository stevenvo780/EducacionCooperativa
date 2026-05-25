'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo, useDeferredValue, startTransition } from 'react';
import ReactDOM from 'react-dom';
import {
  AdmonitionDirectiveDescriptor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  directivesPlugin,
  frontmatterPlugin,
  toolbarPlugin,
  realmPlugin,
  createRootEditorSubscription$,
  $isCodeBlockNode,
  CodeBlockNode,
  type MDXEditorMethods,
  type RealmPlugin
} from '@mdxeditor/editor';
import { $nodesOfType, $getNodeByKey, HISTORIC_TAG, type LexicalEditor } from 'lexical';
import dynamic from 'next/dynamic';
import { DynamicMDXEditor } from '@/components/editor/DynamicMDXEditor';
import '@mdxeditor/editor/style.css';
const CodeMirrorPlain = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false });

import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import type { ViewMode, EditorProps, MarkdownDocMeta } from '@/components/mosaic-editor/types';
import { DEFAULT_TOOLBAR_VISIBILITY, SAVE_DEBOUNCE_MS, ST_DEBOUNCE_MS, SEMANTIC_NOTICE_TIMEOUT_MS } from '@/components/mosaic-editor/constants';
import {
  isMarkdownName, isMarkdownMime,
  stripQueryAndHash, isExternalMarkdownHref, isBrowserNavigationHref,
  normalizeRelativeMarkdownPath, ensureMarkdownCandidateNames,
  buildWorkspaceAwarePathCandidates, extractWorkspaceSegments, generateId,
  hasKatexContent,
  hasTableContent, hasImageContent, hasCodeBlockContent,
  hasDirectiveContent, hasFrontmatterContent
} from '@/components/mosaic-editor/utils';
import { useDeferredMount } from '@/hooks/useDeferredMount';
import { useEditorSearch } from '@/components/mosaic-editor/useEditorSearch';
import { useEditorUI } from '@/components/mosaic-editor/useEditorUI';
import { useEditorModals } from '@/components/mosaic-editor/useEditorModals';
import { useEditorSSEStream } from '@/components/mosaic-editor/useEditorSSEStream';
import { useSemanticStateSyncer } from '@/components/mosaic-editor/useSemanticStateSyncer';
import { useCompanionSTSync } from '@/components/mosaic-editor/useCompanionSTSync';
const MarkdownPreview = dynamic(
  () => import('@/components/mosaic-editor/MarkdownPreview').then((m) => m.MarkdownPreview),
  { ssr: false }
);
import { mermaidCodeBlockDescriptor } from '@/components/mosaic-editor/MermaidCodeBlockEditor';
import { useKatexOverlayDecorations } from '@/components/mosaic-editor/useKatexOverlayDecorations';
import { mosaicEditorStyles } from '@/components/mosaic-editor/styles';
import {
  BookMarked, Check, Cloud, Search, ArrowUp, ArrowDown, X, Sparkles,
  Monitor, PenLine, FileCode2,
  KanbanSquare, Loader2, Ruler,
  ZoomIn, ZoomOut, ChevronLeft, Lock, Users
} from 'lucide-react';
import { useMosaicSemanticActions } from '@/components/mosaic-editor/useMosaicSemanticActions';
import { MosaicToolbarContents, type ToolbarGroupKey } from '@/components/mosaic-editor/MosaicToolbarContents';
import { FilePreviewPane } from '@/components/mosaic-editor/FilePreviewPane';
import clsx from 'clsx';

import { createSnippet } from '@/services/snippetApi';
import { fetchZod } from '@/lib/fetch-zod';
import { documentListSchema } from '@agora/contracts';
import { authFetch } from '@/services/apiClient';
import { fetchDocumentRawApi } from '@/services/dashboardApi';
import { createBoardCardApi, fetchBoardApi } from '@/services/boardApi';
import type { BoardCard } from '@/components/dashboard/types';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useEditorSelectionActions } from '@/hooks/useEditorSelectionActions';
import { useMarkdownLinter, type LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import { useSTDefinitionsLinter } from '@/hooks/useSTDefinitionsLinter';
import { useSTLinterRules } from '@/hooks/useSTLinterRules';
import { addToPersonalDictionary, getPersonalDictionary } from '@/lib/markdown-linter/spell-engine';
import { addSuppression } from '@/lib/markdown-linter/suppressions';
import { MarkdownLinterRegistry } from '@/lib/markdown-linter/registry';
import { normalizePath } from '@/lib/folder-utils';
import { buildSTFromSemantic, companionSTName, formalizeText } from '@/lib/buildSTFromSemantic';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { semanticBrowserBus } from '@/lib/semantic-browser-bus';
import { DocumentType, type DocumentTypeId } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';
import useYjsDoc from '@/hooks/useYjsDoc';
import { EditorSelectionMenu } from '@/components/editor/EditorSelectionMenu';
import { EditorUtilityMenu } from '@/components/editor/EditorUtilityMenu';
import type { LinterActionRequest } from '@/components/mosaic-editor/LinterConfirmModal';
const LinterOverlay = dynamic(
  () => import('@/components/editor/LinterOverlay').then((m) => ({ default: m.LinterOverlay })),
  { ssr: false }
);
const LinterPlugin = dynamic(
  () => import('@/components/mosaic-editor/LinterPlugin').then((m) => ({ default: m.LinterPlugin })),
  { ssr: false }
);
const LinterConfirmModal = dynamic(
  () => import('@/components/mosaic-editor/LinterConfirmModal').then((m) => ({ default: m.LinterConfirmModal })),
  { ssr: false }
);
const LinterConfigPanel = dynamic(
  () => import('@/components/mosaic-editor/LinterConfigPanel').then((m) => ({ default: m.LinterConfigPanel })),
  { ssr: false }
);
import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  filterSemanticWorkspaceStateByDocument,
  hasSemanticWorkspaceStateChanged,
  mergeSemanticWorkspaceStates,
  normalizeSemanticWorkspaceState,
  type SemanticFragmentRecord
} from '@/lib/semantic/workspace-state';
import {
  loadSemanticWorkspaceState,
  saveSemanticWorkspaceState,
  registerConceptFromSelection,
  saveSelectionNote,
  type SemanticWorkspaceState
} from '@/services/editorSemanticStore';
import {
  fetchSemanticWorkspaceStateApi,
  saveSemanticWorkspaceStateApi
} from '@/services/semanticStateApi';
const SnippetGallery = dynamic(() => import('@/components/SnippetGallery'), { ssr: false });
const SnippetEditorModal = dynamic(
  () => import('@/components/SnippetGallery').then((m) => ({ default: m.SnippetEditorModal })),
  { ssr: false }
);
import { registerStatusSegment, forceUnregisterStatusSegment } from '@/lib/status-bus';
import { dispatchOpenSettings } from '@/lib/settings-events';
import { AGORA_EVENTS, dispatchAgoraEvent, subscribeAgoraEvent } from '@/lib/agora-events';

function parseWorkspacesForEditor(raw: unknown): { workspaces: Array<{ id: string; name?: string }>; invites: Array<{ id: string; name?: string }> } {
  if (typeof raw !== 'object' || raw === null) throw new Error('parseWorkspacesForEditor: respuesta no es un objeto');
  const r = raw as Record<string, unknown>;
  return {
    workspaces: Array.isArray(r['workspaces']) ? (r['workspaces'] as Array<{ id: string; name?: string }>) : [],
    invites: Array.isArray(r['invites']) ? (r['invites'] as Array<{ id: string; name?: string }>) : []
  };
}

// Insertar un code block es 1 paso de history y cada keystroke dentro del
// CodeMirror anidado es otro; al deshacer, el texto se vacía pero el nodo
// (insertado en un paso anterior) queda como bloque fantasma porque el editor
// anidado se come el último undo. Cuando un undo deja un CodeBlockNode con
// código vacío, lo removemos en el mismo flujo historic (sin crear un nuevo
// paso de history). Solo removemos un bloque que el undo *acaba de vaciar*
// (vacío ahora, con código antes): así un bloque vacío recién creado mientras
// el usuario tipea, o uno que el usuario dejó vacío a propósito, nunca se borra.
// No usamos el dirty-set porque el nodo decorador no siempre figura en él al
// cambiar su __code; comparar contra prevEditorState es lo fiable.
const removeEmptyCodeBlockOnUndoPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootEditorSubscription$, (rootEditor: LexicalEditor) =>
      rootEditor.registerUpdateListener(({ tags, prevEditorState, editorState }) => {
        if (!tags.has(HISTORIC_TAG)) return;
        const wasNonEmpty = (key: string) =>
          prevEditorState.read(() => {
            const prev = $getNodeByKey(key);
            return $isCodeBlockNode(prev) && prev.getCode() !== '';
          });
        const orphanKeys = editorState.read(() =>
          $nodesOfType(CodeBlockNode)
            .filter((node) => node.getCode() === '' && wasNonEmpty(node.getKey()))
            .map((node) => node.getKey())
        );
        if (orphanKeys.length === 0) return;
        queueMicrotask(() => {
          rootEditor.update(
            () => {
              for (const key of orphanKeys) {
                const node = $getNodeByKey(key);
                if ($isCodeBlockNode(node) && node.getCode() === '') node.remove();
              }
            },
            { tag: HISTORIC_TAG }
          );
        });
      })
    );
  }
});

export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef,
  hideInlineStatus = false
}: EditorProps) {
  // MDXEditor is UNCONTROLLED: `markdown` prop is only read on mount.
  // We use `initialMarkdown` + `editorKey` for mount/remount,
  // and `contentRef` + `statsContent` for tracking without re-render loops.
  const [initialMarkdown, setInitialMarkdown] = useState(initialContent);
  const [editorKey, setEditorKey] = useState(0);
  const [statsContent, setStatsContent] = useState(initialContent); // only for stats display
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<DocumentType.Text | DocumentType.File>(DocumentType.Text);
  // True para archivos texto-plano sin sintaxis markdown (.gitignore, .syncignore,
  // .env, .yml, etc.). Se renderiza con CodeMirror en lugar del editor MDX rich.
  const [isPlainText, setIsPlainText] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [docName, setDocName] = useState('');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(PERSONAL_WORKSPACE_ID);
  const [semanticState, setSemanticState] = useState<SemanticWorkspaceState>(EMPTY_SEMANTIC_WORKSPACE_STATE);
  const [semanticNotice, setSemanticNotice] = useState<string | null>(null);
  const [semanticBusyAction, setSemanticBusyAction] = useState<string | null>(null);
  const [linkableDocuments, setLinkableDocuments] = useState<Array<{ id: string; name: string; folder?: string }>>([]);
  const [loadingLinkableDocuments, setLoadingLinkableDocuments] = useState(false);
  const [isDocLoading, setIsDocLoading] = useState(false);
  // Cuando el doc devuelve 401/403/404 dejamos de reintentar loadDoc y stream
  // hasta que cambie roomId. Evita bucles infinitos sobre docs sin permiso.
  const [docUnavailable, setDocUnavailable] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<BoardCard[]>([]);
  const [companionStDocId, setCompanionStDocId] = useState<string | null>(null);
  const [editorUtilityMenu, setEditorUtilityMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [linterAction, setLinterAction] = useState<LinterActionRequest | null>(null);
  // El server rechaza writes de quien no es miembro/owner del workspace (403).
  // En ese caso el editor pasa a solo-lectura: bloqueamos la edición, mostramos
  // un banner y dejamos de prometer "Guardado" (no hay nada que persistir).
  const [readOnly, setReadOnly] = useState(false);
  const readOnlyRef = useRef(false);
  useEffect(() => { readOnlyRef.current = readOnly; }, [readOnly]);

  const renderToolbarContentsRef = useRef<(() => React.ReactNode) | null>(null);
  const semanticStateRef = useRef<SemanticWorkspaceState>(EMPTY_SEMANTIC_WORKSPACE_STATE);
  const semanticSyncRequestIdRef = useRef(0);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const isPageVisible = usePageVisibility();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Debounce del broadcast 'agora:document-content' (Bug 5: cada keystroke
  // dispatchaba un CustomEvent que pateaba OutlineView y otros listeners).
  const contentBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const contentRef = useRef(initialContent);
  const lastSyncedContentRef = useRef(initialContent);
  const pendingLocalChangeRef = useRef(false);
  const hasLocalEditsThisSessionRef = useRef(false);
  const lastRawKeyRef = useRef<string | null>(null);
  const rawLoadInFlightRef = useRef(false);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);
  const isNormalizingRef = useRef(false);
  const saveRequestIdRef = useRef(0);
  const saveAbortRef = useRef<AbortController | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const currentDocMetaRef = useRef<MarkdownDocMeta>({ workspaceId: null, folder: '', name: '' });

  const {
    searchTerm,
    setSearchTerm,
    currentMatch,
    totalMatches,
    setTotalMatches: _setTotalMatches,
    navigateSearch
  } = useEditorSearch({ externalSearchTerm, onSearchStateChange, searchNavRef });

  const {
    toolbarVisibility,
    applyToolbarVisibility,
    isFullscreen,
    showSnippetGallery,
    setShowSnippetGallery,
    showCompactMenu,
    setShowCompactMenu,
    menuPos,
    rawScrollPos,
    setRawScrollPos,
    zoomLevel,
    setZoomLevel,
    menuBtnRef,
    toggleCompactMenu,
    toggleFullscreen
  } = useEditorUI({ editorShellRef, embedded, roomId });

  const {
    defineConceptDraft,
    setDefineConceptDraft,
    autologicPreview,
    setAutologicPreview,
    snippetDraft,
    setSnippetDraft,
    noteDraft,
    setNoteDraft
  } = useEditorModals();

  const { stDefinitionsRule } = useSTDefinitionsLinter();
  const { stUndefinedRefRule, stUnusedTheoremRule, stCrossDocConflictRule } = useSTLinterRules();
  const linterRules = useMemo(
    () => [stDefinitionsRule, stUndefinedRefRule, stUnusedTheoremRule, stCrossDocConflictRule],
    [stDefinitionsRule, stUndefinedRefRule, stUnusedTheoremRule, stCrossDocConflictRule]
  );
  const { diagnostics: markdownDiagnostics, runLint, linterStatus } = useMarkdownLinter(statsContent, linterRules, roomId ?? null);

  const deferredNoteFragments = useDeferredValue(semanticState.fragments);
  const deferredNoteContent = useDeferredValue(statsContent);

  const noteDiagnostics = useMemo<LinterDiagnostic[]>(() => {
    const diags: LinterDiagnostic[] = [];
    const activeDocId = roomId ?? null;
    const activeDocName = docName || currentDocMetaRef.current.name || null;
    const notes: SemanticFragmentRecord[] = [];
    for (const f of deferredNoteFragments) {
      if (f.kind !== 'note' || !f.note || !f.text) continue;
      const matchesDoc = activeDocId
        ? (f.docId === activeDocId || (!f.docId && f.docName === activeDocName))
        : (!f.docId);
      if (!matchesDoc) continue;
      notes.push(f);
    }
    if (notes.length === 0) return diags;

    const lineStarts: number[] = [0];
    for (let i = 0; i < deferredNoteContent.length; i++) {
      if (deferredNoteContent.charCodeAt(i) === 10) lineStarts.push(i + 1);
    }

    const offsetToLineCol = (offset: number): { line: number; column: number } => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        const start = lineStarts[mid] ?? 0;
        if (start <= offset) lo = mid;
        else hi = mid - 1;
      }
      const lineStart = lineStarts[lo] ?? 0;
      return { line: lo + 1, column: offset - lineStart + 1 };
    };

    for (const n of notes) {
      if (!n.note || !n.text) continue;
      const idx = deferredNoteContent.indexOf(n.text);
      if (idx === -1) continue;

      const { line, column } = offsetToLineCol(idx);
      const isSingleLine = n.text.indexOf('\n') === -1;
      const endColumn = isSingleLine ? column + n.text.length : undefined;

      diags.push({
        line,
        column,
        ...(endColumn ? { endColumn } : {}),
        severity: 'info',
        message: n.note,
        source: 'Nota',
        text: n.text
      });
    }
    return diags;
  }, [deferredNoteFragments, deferredNoteContent, roomId, docName]);

  const allDiagnostics = useMemo(() => {
    return [...markdownDiagnostics, ...noteDiagnostics];
  }, [markdownDiagnostics, noteDiagnostics]);

  const effectiveWorkspaceId = useMemo(
    () => currentWorkspaceId || PERSONAL_WORKSPACE_ID,
    [currentWorkspaceId]
  );

  const semanticStoreContext = useMemo(() => ({
    workspaceId: effectiveWorkspaceId,
    userId: user?.uid ?? null
  }), [effectiveWorkspaceId, user?.uid]);

  // Edición colaborativa en vivo (Yjs sobre RTDB /collab/<wsId>/<docId>).
  // Solo en workspaces compartidos (en personal hay un único usuario), sobre
  // docs de texto markdown (no archivos binarios ni texto-plano CodeMirror).
  // MDXEditor es uncontrolled y no expone el CollaborationPlugin de Lexical,
  // así que sincronizamos a nivel de texto: el Y.Text es la fuente de verdad
  // compartida, y propagamos cambios remotos vía setMarkdown cuando el usuario
  // local no tiene ediciones sin guardar. Esto da propagación en vivo sin
  // recrear el modelo Lexical interno (que rompería KaTeX/Mermaid/plugins).
  const collabEligible = !!(
    roomId
    && user?.uid
    && !isPersonalWorkspaceId(currentWorkspaceId)
    && docType === DocumentType.Text
    && !isPlainText
    && !readOnly
  );
  const { ydoc: collabYdoc, status: collabStatus, provider: collabProvider } = useYjsDoc({
    workspaceId: collabEligible ? currentWorkspaceId : null,
    docId: collabEligible ? (roomId ?? null) : null,
    userId: user?.uid ?? null,
    displayName: user?.displayName ?? user?.email ?? null,
    enabled: collabEligible
  });
  const collabSeedDoneRef = useRef(false);
  const collabApplyingRemoteRef = useRef(false);
  useEffect(() => { collabSeedDoneRef.current = false; }, [roomId]);

  const semanticItemCount = useMemo(() => (
    semanticState.concepts.length + semanticState.fragments.length + semanticState.relations.length
  ), [semanticState]);

  useEffect(() => {
    semanticStateRef.current = semanticState;
  }, [semanticState]);

  const { syncCompanionST } = useCompanionSTSync({
    companionStDocId,
    setCompanionStDocId,
    setSemanticNotice
  });

  // Auto-register ST definitions from semantic state so the linter works on page load.
  // Include concepts even when they only have a title/excerpt, because `buildSTFromSemantic`
  // can still project them into hoverable ST interpretations without requiring a manual formula.
  // Debounced to avoid rebuilds on every small semantic change.
  const prevConceptsHashRef = useRef('');
  const prevConceptsSummaryRef = useRef<{
    count: number;
    fragCount: number;
    totalConcepts: number;
    sumUpdatedAt: number;
    sumConfidence: number;
    sumTitleLength: number;
  }>({ count: 0, fragCount: 0, totalConcepts: 0, sumUpdatedAt: 0, sumConfidence: 0, sumTitleLength: 0 });
  useEffect(() => {
    const currentName = docName || currentDocMetaRef.current.name || 'Documento';
    // Summary numérico: O(N) sin allocation pesada. Si las sumas matchean,
    // los proyected concepts no cambiaron — saltamos el JSON.stringify caro
    // (que es el 99% de los casos cuando solo cambian timestamps no-relevantes).
    let sumUpdatedAt = 0;
    let sumConfidence = 0;
    let sumTitleLength = 0;
    for (const concept of semanticState.concepts) {
      sumUpdatedAt += concept.updatedAt || 0;
      sumConfidence += concept.confidence ?? 0;
      sumTitleLength += concept.title?.length ?? 0;
    }
    const summary = {
      count: semanticState.concepts.length,
      fragCount: semanticState.fragments.length,
      totalConcepts: semanticState.concepts.length + semanticState.relations.length,
      sumUpdatedAt,
      sumConfidence,
      sumTitleLength
    };
    const prevSummary = prevConceptsSummaryRef.current;
    const summaryUnchanged = (
      summary.count === prevSummary.count &&
      summary.fragCount === prevSummary.fragCount &&
      summary.totalConcepts === prevSummary.totalConcepts &&
      summary.sumUpdatedAt === prevSummary.sumUpdatedAt &&
      summary.sumConfidence === prevSummary.sumConfidence &&
      summary.sumTitleLength === prevSummary.sumTitleLength
    );
    if (summaryUnchanged) return;

    // Defer ALL heavy work al setTimeout. Antes el filter+map+stringify
    // corrían en el body del effect → cada poll de 15s sincronizaba state
    // y bloqueaba el frame en tablets, aunque el debounce evitaba reparses.
    const timer = setTimeout(() => {
      const scopedSemanticState = filterSemanticWorkspaceStateByDocument(semanticState, {
        docId: roomId ?? null,
        docName: currentName
      });
      const projectedConcepts = scopedSemanticState.concepts;
      const sourceFragmentById = new Map(
        scopedSemanticState.fragments.map((fragment) => [fragment.id, fragment.text])
      );
      const hash = JSON.stringify(projectedConcepts.map((concept) => ({
        id: concept.id,
        title: concept.title,
        definition: concept.definition || '',
        formula: concept.formula || '',
        logicProfile: concept.logicProfile || '',
        excerpt: concept.excerpt || '',
        sourceText: concept.sourceFragmentId ? sourceFragmentById.get(concept.sourceFragmentId) || '' : ''
      })));
      if (hash === prevConceptsHashRef.current) {
        prevConceptsSummaryRef.current = summary;
        return;
      }
      prevConceptsHashRef.current = hash;
      prevConceptsSummaryRef.current = summary;
      const stFileName = companionSTName(currentName);
      if (projectedConcepts.length > 0) {
        const stContent = buildSTFromSemantic(scopedSemanticState, currentName);
        const definitions = STDefinitionsRegistry.extractFromSource(stContent, stFileName);
        if (definitions.length > 0) {
          STDefinitionsRegistry.setFileDefinitions(stFileName, definitions);
        } else {
          STDefinitionsRegistry.removeFile(stFileName);
        }
      } else {
        STDefinitionsRegistry.removeFile(stFileName);
      }
    }, ST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [docName, roomId, semanticState]);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentName = docName || currentDocMetaRef.current.name || 'Documento';
      STDefinitionsRegistry.removeFile(companionSTName(currentName));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    selection: semanticSelection,
    restoreSelection,
    clearSelection: clearSemanticSelection
  } = useEditorSelectionActions({
    editorShellRef,
    docId: roomId ?? null,
    enabled: docType !== 'file' && viewMode !== 'preview',
    onContextMenuWithoutSelection: ({ x, y }) => {
      clearSemanticSelection();
      setShowCompactMenu(false);
      setEditorUtilityMenu({ id: generateId(), x, y });
    }
  });

  const dictionaryCandidate = useMemo(() => {
    if (!semanticSelection) return null;
    const value = semanticSelection.text.replace(/\s+/g, ' ').trim();
    if (!value) return null;
    if (!/^[\p{L}\p{M}'’-]+$/u.test(value)) return null;
    return value;
  }, [semanticSelection]);

  const canAddSelectionToDictionary = useMemo(() => {
    if (!dictionaryCandidate) return false;
    return !new Set(getPersonalDictionary()).has(dictionaryCandidate.toLowerCase());
  }, [dictionaryCandidate]);

  useEffect(() => {
    if (semanticSelection) {
      setEditorUtilityMenu(null);
    }
  }, [semanticSelection]);

  useEffect(() => {
    if (docType === 'file' || viewMode === 'preview') {
      setEditorUtilityMenu(null);
    }
  }, [docType, viewMode]);

  /** Helper: update the editor content (remount with new key) */
  const setEditorContent = useCallback((md: string) => {
    contentRef.current = md;
    lastSyncedContentRef.current = md;
    pendingLocalChangeRef.current = false;
    hasLocalEditsThisSessionRef.current = false;
    setInitialMarkdown(md);
    setStatsContent(md);
    setEditorKey(k => k + 1); // force MDXEditor remount with new markdown
  }, []);

  const hasUnsavedLocalChanges = useCallback(() => {
    return pendingLocalChangeRef.current || contentRef.current !== lastSyncedContentRef.current;
  }, []);

  const resetDocState = useCallback(() => {
    setDocType(DocumentType.Text);
    setFileUrl(null);
    setFileName('');
    setFileMime('');
    setCurrentWorkspaceId(PERSONAL_WORKSPACE_ID);
    setEditorContent('');
    currentDocMetaRef.current = { workspaceId: null, folder: '', name: '' };
    hasLoadedRef.current = true;
  }, [setEditorContent]);

  const maybeLoadRawContent = useCallback(async (key: string | null) => {
    if (!roomId || !key) return;
    if (rawLoadInFlightRef.current) return;
    // Skip solo si ya tenemos contenido cargado para este key. Si contentRef
    // está vacío (remount, transición cerrar→abrir), forzamos re-fetch
    // aunque lastRawKeyRef coincida — sino el editor queda en blanco.
    if (key === lastRawKeyRef.current && contentRef.current !== '') return;
    rawLoadInFlightRef.current = true;
    lastRawKeyRef.current = key;
    // Importante: mientras carga el raw, no consideremos el editor "cargado"
    // — eso evita que handleContentChange dispare un autosave con texto
    // vacío (estado inicial) y tire 409 refused-empty-overwrite.
    hasLoadedRef.current = false;
    setIsDocLoading(true);
    try {
      // fetchDocumentRawApi: (a) cachea en IndexedDB, (b) sirve desde cache si offline.
      const text = await fetchDocumentRawApi(roomId);
      // Cargar incluso si está vacío para sincronizar lastSyncedContentRef.
      if (text !== contentRef.current) {
        setEditorContent(text);
      }
      contentRef.current = text;
      lastSyncedContentRef.current = text;
      pendingLocalChangeRef.current = false;
      setStatsContent(text);
    } catch (e) {
      console.error('Error loading raw content:', e);
    } finally {
      rawLoadInFlightRef.current = false;
      setIsDocLoading(false);
      hasLoadedRef.current = true;
    }
  }, [roomId, setEditorContent]);

  const applyDocData = useCallback((data: {
    type?: DocumentTypeId;
    name?: string;
    mimeType?: string;
    url?: string | null;
    storagePath?: string | null;
    folder?: string;
    workspaceId?: string | null;
    content?: string;
    lastUpdatedBy?: string;
  } | null | undefined) => {
    if (!data) {
      if (!hasUnsavedLocalChanges()) {
        resetDocState();
      }
      return;
    }

    const type = data.type ?? DocumentType.Text;
    const name = data.name ?? '';
    const mimeType = data.mimeType ?? '';
    const url = data.url ?? null;
    const storagePath = data.storagePath ?? null;
    const folder = typeof data.folder === 'string' ? data.folder : '';
    const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : null;
    const isMarkdown = isMarkdownMime(mimeType) || isMarkdownName(name);
    // Dotfile: nombre tipo `.gitignore`, `.syncignore`, `.env`, `.editorconfig`
    // (sin segunda extensión). Siempre se trata como texto plano, sin importar
    // qué `type`/`mimeType` haya quedado en Firestore — algunos docs viejos
    // quedaron con type='file' o mime='application/octet-stream'.
    const isDotfile = name.startsWith('.') && name.indexOf('.', 1) === -1;
    const isPlainTextLike = (
      isDotfile
      || mimeType.startsWith('text/')
      || mimeType === 'application/json'
    );

    currentDocMetaRef.current = {
      workspaceId,
      folder,
      name
    };
    setCurrentWorkspaceId(workspaceId || PERSONAL_WORKSPACE_ID);

    if (type === DocumentType.File && !isMarkdown && !isPlainTextLike && !isDotfile) {
      setDocType(DocumentType.File);
      setIsPlainText(false);
      setFileUrl(url);
      setFileName(name || 'Archivo');
      setFileMime(mimeType);
      setDocName(name || 'Archivo');
      contentRef.current = '';
      setStatsContent('');
      hasLoadedRef.current = true;
      return;
    }

    setDocType(DocumentType.Text);
    setIsPlainText(isPlainTextLike && !isMarkdown);
    setFileUrl(null);
    setFileName('');
    setFileMime(mimeType);
    setDocName(name || 'Documento');

    const incoming = typeof data.content === 'string' ? data.content : null;
    if (incoming !== null) {
      const same = incoming === contentRef.current;
      const isOutOfOrderOwnSnapshot = hasLocalEditsThisSessionRef.current
        && data.lastUpdatedBy === user?.uid
        && incoming !== contentRef.current;

      if (isOutOfOrderOwnSnapshot) {
        return;
      }

      const hasUnsavedChanges = hasUnsavedLocalChanges();
      if (!same && hasUnsavedChanges) {
        return;
      }

      // CodeMirror plain text: SIEMPRE setEditorContent al recibir contenido
      // del API, sin importar el flag `same`. El cache contentRef puede
      // sobrevivir al remount del componente y dejar el editor visualmente
      // vacío aunque la ref diga lo contrario.
      const isPlainTextNow = isPlainTextLike && !isMarkdown;
      if (!same || isPlainTextNow) {
        if (!isPlainTextNow && mdxEditorRef.current) {
          // MDX rich: update sin remount.
          contentRef.current = incoming;
          lastSyncedContentRef.current = incoming;
          pendingLocalChangeRef.current = false;
          setStatsContent(incoming);
          mdxEditorRef.current.setMarkdown(incoming);
          // Necesario: si editorKey causa remount (lazy-plugins bump), MDXEditor lee `markdown={initialMarkdown}` y quedaría vacío sin esto.
          setInitialMarkdown(incoming);
        } else {
          setEditorContent(incoming);
        }
      }
    } else if (storagePath || url) {
      // El snapshot viene sin `content` inline (caso normal con MinIO data plane).
      // Cargar contenido real desde /raw. NO marcar hasLoaded hasta que el raw
      // termine — si lo marcáramos ahora, handleContentChange dispararía un
      // autosave con texto vacío antes de que llegue el contenido real,
      // causando 409 refused-empty-overwrite y spinner infinito.
      const rawKey = storagePath || url;
      maybeLoadRawContent(rawKey);
      return;
    }
    // Si no hay storagePath ni url y no hay content — no tocar el editor.

    hasLoadedRef.current = true;
  }, [hasUnsavedLocalChanges, maybeLoadRawContent, resetDocState, setEditorContent, user?.uid]);

  const persistSemanticStateRemotely = useCallback(async (stateToPersist: SemanticWorkspaceState) => {
    const requestId = ++semanticSyncRequestIdRef.current;
    try {
      const remoteState = await saveSemanticWorkspaceStateApi(
        semanticStoreContext.workspaceId,
        stateToPersist
      );
      const mergedState = mergeSemanticWorkspaceStates(
        stateToPersist,
        remoteState ?? EMPTY_SEMANTIC_WORKSPACE_STATE
      );
      saveSemanticWorkspaceState(semanticStoreContext, mergedState);
      if (
        requestId === semanticSyncRequestIdRef.current
        && hasSemanticWorkspaceStateChanged(semanticStateRef.current, mergedState)
      ) {
        setSemanticState(mergedState);
      }
    } catch (error) {
      console.error('Error syncing semantic workspace state:', error);
      setSemanticNotice((current) => current ?? 'La mesa semantica quedo en cache local; no se pudo sincronizar con el workspace.');
    }
  }, [semanticStoreContext]);

  const loadSemanticStateFromWorkspace = useCallback(async (options?: {
    seedFromLocal?: boolean;
    persistMerged?: boolean;
  }) => {
    const seedFromLocal = options?.seedFromLocal ?? true;
    const localState = loadSemanticWorkspaceState(semanticStoreContext);

    if (seedFromLocal && hasSemanticWorkspaceStateChanged(semanticStateRef.current, localState)) {
      setSemanticState(localState);
    }

    try {
      const remoteState = await fetchSemanticWorkspaceStateApi(semanticStoreContext.workspaceId);
      const mergedState = mergeSemanticWorkspaceStates(
        remoteState ?? EMPTY_SEMANTIC_WORKSPACE_STATE,
        localState
      );
      saveSemanticWorkspaceState(semanticStoreContext, mergedState);

      if (hasSemanticWorkspaceStateChanged(semanticStateRef.current, mergedState)) {
        setSemanticState(mergedState);
      }

      if (
        options?.persistMerged
        && hasSemanticWorkspaceStateChanged(
          remoteState ?? EMPTY_SEMANTIC_WORKSPACE_STATE,
          mergedState
        )
      ) {
        await persistSemanticStateRemotely(mergedState);
      }
    } catch (error) {
      console.error('Error loading semantic workspace state:', error);
      if (seedFromLocal && hasSemanticWorkspaceStateChanged(semanticStateRef.current, localState)) {
        setSemanticState(localState);
      }
    }
  }, [persistSemanticStateRemotely, semanticStoreContext]);

  useSemanticStateSyncer({
    userId: user?.uid,
    isPageVisible,
    loadSemanticStateFromWorkspace,
    setSemanticState
  });

  useEffect(() => {
    if (!semanticNotice) return;
    const timeout = window.setTimeout(() => setSemanticNotice(null), SEMANTIC_NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [semanticNotice]);

  useEffect(() => {
    setLinkableDocuments([]);
  }, [currentWorkspaceId, roomId]);

  const loadDoc = useCallback(async () => {
    if (!roomId) return;
    if (docUnavailable) return;
    setIsDocLoading(true);
    try {
      const res = await authFetch(`/api/documents/${roomId}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
          setDocUnavailable(true);
        }
        if (!hasUnsavedLocalChanges()) {
          resetDocState();
        }
        return;
      }
      const data = await res.json();
      applyDocData(data);
    } catch (e) {
      console.error('Error loading document:', e);
    } finally {
      setIsDocLoading(false);
    }
  }, [roomId, docUnavailable, applyDocData, hasUnsavedLocalChanges, resetDocState]);

  useEffect(() => {
    if (!roomId) return;
    hasLoadedRef.current = false;
    pendingLocalChangeRef.current = false;
    hasLocalEditsThisSessionRef.current = false;
    lastRawKeyRef.current = null;
    setDocUnavailable(false);
    setReadOnly(false);
    loadDoc();
  }, [roomId, loadDoc]);

  // Listen for real-time document changes via TerminalContext.
  // Skip if hay edits locales sin guardar — un loadDoc en ese estado pisa
  // lo que el usuario está escribiendo. El autosave eventualmente sincroniza.
  useEffect(() => {
    if (!onDocChangeCallback || !roomId || !isPageVisible) return;
    return onDocChangeCallback((event) => {
      if (event.docId !== roomId) return;
      if (event.action !== 'updated' && event.action !== 'created') return;
      if (pendingLocalChangeRef.current || hasUnsavedLocalChanges()) return;
      loadDoc();
    });
  }, [onDocChangeCallback, roomId, loadDoc, isPageVisible, hasUnsavedLocalChanges]);

  // SSE stream for real-time updates (Firestore onSnapshot via server).
  // Igual: si hay cambios locales pendientes, ignorar el snapshot remoto.
  const handleSSESnapshot = useCallback((data: unknown) => {
    if (pendingLocalChangeRef.current || hasUnsavedLocalChanges()) return;
    applyDocData(data as Parameters<typeof applyDocData>[0]);
  }, [applyDocData, hasUnsavedLocalChanges]);

  const handleStreamUnavailable = useCallback((status: number) => {
    console.warn(`[MosaicEditor] stream no disponible (HTTP ${status}); deteniendo retries para doc ${roomId}`);
    setDocUnavailable(true);
  }, [roomId]);

  useEditorSSEStream({
    roomId: docUnavailable ? undefined : roomId,
    isPageVisible,
    onSnapshot: handleSSESnapshot,
    onDeleted: resetDocState,
    onUnavailable: handleStreamUnavailable
  });

  // Refresh al volver a la pestaña, también condicionado a no pisar edits.
  useEffect(() => {
    if (!isPageVisible || !roomId) return;
    if (docUnavailable) return;
    if (pendingLocalChangeRef.current || hasUnsavedLocalChanges()) return;
    loadDoc();
  }, [isPageVisible, roomId, docUnavailable, loadDoc, hasUnsavedLocalChanges]);

  useEffect(() => {
    if (viewMode === 'preview') {
      clearSemanticSelection();
    }
  }, [clearSemanticSelection, viewMode]);

  // Jump-to-line desde panel Problemas / linter overlay. MDXEditor no expone
  // API de scroll por línea; aproximamos por proporción line/totalLines sobre
  // el wrapper scrollable real (.mdxeditor-root-contentEditable). Si el evento
  // incluye docId, ignorar si no es este editor (multi-editor en mosaic).
  useEffect(() => {
    if (!roomId) return;
    return subscribeAgoraEvent(AGORA_EVENTS.jumpToLine, (detail) => {
      if (!detail) return;
      if (detail.docId && detail.docId !== roomId) return;
      const shell = editorShellRef.current;
      if (!shell) return;
      const candidates = Array.from(shell.querySelectorAll<HTMLElement>(
        '[class*="rootContentEditableWrapper"], [class*="mdxeditor-root"], .mdxeditor, [contenteditable="true"]'
      ));
      const scrollable = candidates.find(el => el.scrollHeight > el.clientHeight) ?? shell;
      const totalLines = Math.max(1, contentRef.current.split('\n').length);
      const line = Math.max(1, detail.line);
      const ratio = Math.min(1, (line - 1) / totalLines);
      const target = Math.max(0, Math.round(scrollable.scrollHeight * ratio) - scrollable.clientHeight / 3);
      scrollable.scrollTo({ top: target, behavior: 'smooth' });
    });
  }, [roomId]);

  const handleContentChange = useCallback((val: string) => {
    contentRef.current = val;
    // Bug 5: las re-renderizaciones derivadas (linter, preview, stats) son
    // pesadas en mobile. startTransition deja el keystroke commitear primero
    // y agenda el re-render con baja prioridad. Combinado con useDeferredValue
    // ya existente sobre statsContent quita el lag de ~2.7s por tecla.
    startTransition(() => setStatsContent(val));
    // Broadcast a OutlineView u otros listeners externos: debounce 200ms para
    // no spamear CustomEvents por tecla.
    if (roomId) {
      if (contentBroadcastTimeoutRef.current) clearTimeout(contentBroadcastTimeoutRef.current);
      contentBroadcastTimeoutRef.current = setTimeout(() => {
        dispatchAgoraEvent(AGORA_EVENTS.documentContent, { docId: roomId, content: val });
      }, 200);
    }
    if (!roomId || docType === DocumentType.File) return;
    if (!hasLoadedRef.current) return;
    // Solo-lectura: no agendamos autosave (el server lo rechazaría). El
    // editor ya está bloqueado a nivel UI; esto cubre rutas indirectas
    // (snippets, fixes del linter) que también pasan por aquí.
    if (readOnlyRef.current) return;

    const hasUnsavedChanges = val !== lastSyncedContentRef.current;
    if (hasUnsavedChanges) {
      hasLocalEditsThisSessionRef.current = true;
    }
    pendingLocalChangeRef.current = hasUnsavedChanges;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    if (!hasUnsavedChanges) {
      setSaving(false);
      return;
    }

    setSaving(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const requestId = ++saveRequestIdRef.current;
      // Cancela el PUT en vuelo anterior (si lo hay) antes de iniciar el nuevo
      // para que un save viejo no pueda completar después y pisar lastSynced.
      saveAbortRef.current?.abort();
      const controller = new AbortController();
      saveAbortRef.current = controller;
      let saveError: Error | null = null;
      try {
        const res = await authFetch(`/api/documents/${roomId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            content: val,
            type: DocumentType.Text,
            lastUpdatedBy: user?.uid
          })
        });
        if (requestId !== saveRequestIdRef.current) {
          // Llegó un save más nuevo; descartá esta respuesta sin tocar estado.
          return;
        }
        if (!res.ok) {
          let body: { error?: string; message?: string } | null = null;
          try { body = await res.json(); } catch { /* not json */ }
          if (res.status === 409 && body?.error === 'refused-empty-overwrite') {
            lastSyncedContentRef.current = val;
            pendingLocalChangeRef.current = false;
          } else if (res.status === 401 || res.status === 403) {
            // Sin permiso de escritura: el server descarta el write. Pasamos a
            // solo-lectura para no mostrar "Guardado" falso ni perder ediciones.
            setReadOnly(true);
            pendingLocalChangeRef.current = false;
          } else {
            saveError = new Error(`Save failed (${res.status}): ${body?.message ?? body?.error ?? res.statusText}`);
          }
        } else if (contentRef.current === val) {
          lastSyncedContentRef.current = val;
          pendingLocalChangeRef.current = false;
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') {
          return;
        }
        saveError = e instanceof Error ? e : new Error(String(e));
        console.error('Error saving:', saveError);
      } finally {
        if (saveAbortRef.current === controller) {
          saveAbortRef.current = null;
        }
        if (requestId === saveRequestIdRef.current) {
          const stillUnsaved = contentRef.current !== lastSyncedContentRef.current;
          pendingLocalChangeRef.current = stillUnsaved;
          setSaving(stillUnsaved);
          if (saveError) {
            console.warn('[autosave] continuing with local changes:', saveError.message);
          }
        }
      }
    }, SAVE_DEBOUNCE_MS);
  }, [roomId, user?.uid, docType]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (contentBroadcastTimeoutRef.current) clearTimeout(contentBroadcastTimeoutRef.current);
    saveAbortRef.current?.abort();
    saveAbortRef.current = null;
  }, []);

  const deferredStatsContent = useDeferredValue(statsContent);
  const stats = useMemo(() => {
    const trimmed = deferredStatsContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const lines = deferredStatsContent ? deferredStatsContent.split('\n').length : 0;
    return { words, chars: deferredStatsContent.length, lines };
  }, [deferredStatsContent]);

  useEffect(() => {
    if (!hideInlineStatus) return;
    registerStatusSegment({
      id: 'editor-stats',
      label: `${stats.words} palabras · ${stats.chars} car. · ${stats.lines} líneas`,
      slot: 'left',
      priority: 30,
      tone: 'muted',
      hideBelow: 'sm'
    });
    registerStatusSegment({
      id: 'editor-save',
      label: readOnly ? 'Solo lectura' : saving ? 'Guardando…' : 'Guardado',
      icon: readOnly ? Lock : saving ? Cloud : Check,
      slot: 'right',
      priority: 20,
      tone: readOnly ? 'warning' : saving ? 'info' : 'success'
    });
    return () => {
      forceUnregisterStatusSegment('editor-stats');
      forceUnregisterStatusSegment('editor-save');
    };
  }, [hideInlineStatus, stats.words, stats.chars, stats.lines, saving, readOnly]);

  const setViewModeWithSync = useCallback((nextMode: ViewMode) => {
    const editor = mdxEditorRef.current;
    const latestMarkdown = editor ? editor.getMarkdown() : contentRef.current;

    contentRef.current = latestMarkdown;
    setStatsContent(latestMarkdown);
    pendingLocalChangeRef.current = latestMarkdown !== lastSyncedContentRef.current;

    if (nextMode === 'edit') {
      setInitialMarkdown(latestMarkdown);
      setEditorKey((currentKey) => currentKey + 1);
    }

    setViewMode(nextMode);
  }, []);

  // Export a PDF vía el diálogo de impresión del navegador. Forzamos la vista
  // previa renderizada (KaTeX/Mermaid ya pintados) y aislamos el preview con
  // una clase en <body> que el CSS de @media print respeta. Sin libs extra.
  const handleExportPdf = useCallback(() => {
    setViewModeWithSync('preview');
    // Esperamos a que el preview monte y termine de pintar KaTeX/Mermaid antes
    // de abrir el diálogo. El render es async (dynamic import + mermaid).
    window.setTimeout(() => {
      document.body.classList.add('mosaic-printing');
      const cleanup = () => {
        document.body.classList.remove('mosaic-printing');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      try {
        window.print();
      } finally {
        // Fallback si afterprint no dispara (algunos navegadores móviles).
        window.setTimeout(cleanup, 1000);
      }
    }, 600);
  }, [setViewModeWithSync]);

  const openInternalMarkdownLink = useCallback(async (href: string) => {
    const cleanedHref = decodeURIComponent(stripQueryAndHash(href)).trim();
    if (!cleanedHref || cleanedHref.startsWith('#') || isExternalMarkdownHref(cleanedHref)) {
      return false;
    }

    const currentMeta = currentDocMetaRef.current;

    const findDocInWorkspace = async (workspaceId: string, searchHref: string) => {
      const search = new URLSearchParams({
        workspaceId,
        view: 'list',
        excludeContent: 'true'
      });
      const docs = await fetchZod(`/api/documents?${search.toString()}`, documentListSchema, { cache: 'no-store' });
      const currentFolder = normalizePath(currentMeta.folder);
      const normalizedH = searchHref.replace(/^\/+/, '');
      const resolvedPath = searchHref.startsWith('/')
        ? normalizeRelativeMarkdownPath(normalizedH)
        : normalizeRelativeMarkdownPath(currentFolder ? `${currentFolder}/${normalizedH}` : normalizedH);
      const basePath = normalizeRelativeMarkdownPath(normalizedH);
      const candidatePaths = new Set<string>([
        ...buildWorkspaceAwarePathCandidates(resolvedPath),
        ...buildWorkspaceAwarePathCandidates(basePath)
      ]);
      const candidateNames = new Set<string>([
        ...ensureMarkdownCandidateNames(basePath.split('/').pop() || ''),
        ...ensureMarkdownCandidateNames(resolvedPath.split('/').pop() || '')
      ]);

      const foundDoc = docs.find((doc) => {
        if (!doc || doc.type === 'folder') return false;
        const docName = typeof doc.name === 'string' ? doc.name : '';
        const docFolder = normalizePath(typeof doc.folder === 'string' ? doc.folder : '');
        const docPath = normalizeRelativeMarkdownPath(docFolder ? `${docFolder}/${docName}` : docName);
        return candidatePaths.has(docPath)
          || Array.from(candidatePaths).some((cp) => docPath.endsWith(`/${cp}`) || docPath === cp)
          || candidateNames.has(docName)
          || doc.id === searchHref;
      }) ?? null;
      return foundDoc;
    };

    const emitOpenDoc = (docId?: string) => {
      if (!docId) return false;
      if (embedded && typeof window !== 'undefined') {
        window.postMessage({ type: 'agora-open-doc', docId, sourceDocId: roomId }, window.location.origin);
        return true;
      }
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'agora-open-doc', docId, sourceDocId: roomId }, window.location.origin);
        return true;
      }
      window.location.assign(`/editor/${encodeURIComponent(docId)}`);
      return true;
    };

    try {
      // 1) Try current workspace first (fast path)
      if (currentMeta.workspaceId) {
        const matchedDoc = await findDocInWorkspace(currentMeta.workspaceId, cleanedHref);
        if (matchedDoc) return emitOpenDoc(matchedDoc.id);
      }

      // 2) If href looks like /workspace/{name}/..., resolve the target workspace
      const wsSegments = extractWorkspaceSegments(cleanedHref);
      if (wsSegments && wsSegments.targetPath) {
        const wsRes = await authFetch('/api/workspaces', { cache: 'no-store' });
        if (wsRes.ok) {
          const wsData = parseWorkspacesForEditor(await wsRes.json());
          const allWorkspaces = [
            ...(Array.isArray(wsData.workspaces) ? wsData.workspaces : []),
            ...(Array.isArray(wsData.invites) ? wsData.invites : [])
          ];
          const normalizedTargetWsName = wsSegments.workspaceName.toLowerCase();

          const matchedWs = allWorkspaces.find((ws) => {
            const wsName = typeof ws.name === 'string' ? ws.name.toLowerCase() : '';
            return wsName === normalizedTargetWsName || ws.id === wsSegments.workspaceName;
          });

          // Search matched workspace, then fallback to all workspaces
          const workspaceIdsToSearch = new Set<string>();
          if (matchedWs) workspaceIdsToSearch.add(matchedWs.id);
          workspaceIdsToSearch.add(PERSONAL_WORKSPACE_ID);
          allWorkspaces.forEach((ws) => workspaceIdsToSearch.add(ws.id));
          // Remove already-searched workspace
          if (currentMeta.workspaceId) workspaceIdsToSearch.delete(currentMeta.workspaceId);

          for (const wsId of workspaceIdsToSearch) {
            const matchedDoc = await findDocInWorkspace(wsId, wsSegments.targetPath);
            if (matchedDoc) return emitOpenDoc(matchedDoc.id);
          }
        }
      }

      // 3) If workspaceId was null and href is NOT a workspace path, try personal
      if (!currentMeta.workspaceId && !wsSegments) {
        const matchedDoc = await findDocInWorkspace(PERSONAL_WORKSPACE_ID, cleanedHref);
        if (matchedDoc) return emitOpenDoc(matchedDoc.id);
      }

      return false;
    } catch (error) {
      console.error('Error opening internal markdown link:', error);
      return false;
    }
  }, [embedded, roomId]);

  useEffect(() => {
    const editorShell = editorShellRef.current;
    if (!editorShell) return;

    const handleEditorLinkPointerDown = (event: MouseEvent) => {
      if (viewMode !== 'edit') return;
      if (event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('.mdx-content-editable a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleEditorLinkClick = (event: MouseEvent) => {
      if (viewMode !== 'edit') return;
      if (event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('.mdx-content-editable a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href')?.trim();
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void (async () => {
        if (href.startsWith('#')) return;

        if (isExternalMarkdownHref(href)) {
          window.open(href, '_blank', 'noopener,noreferrer');
          return;
        }

        const opened = await openInternalMarkdownLink(href);
        if (!opened && isBrowserNavigationHref(href)) {
          window.location.assign(href);
        }
      })();
    };

    editorShell.addEventListener('mousedown', handleEditorLinkPointerDown, true);
    editorShell.addEventListener('click', handleEditorLinkClick, true);

    return () => {
      editorShell.removeEventListener('mousedown', handleEditorLinkPointerDown, true);
      editorShell.removeEventListener('click', handleEditorLinkClick, true);
    };
  }, [openInternalMarkdownLink, viewMode]);

  const insertSnippet = useCallback((snippet: string) => {
    const editor = mdxEditorRef.current;
    if (!editor) return;
    editor.focus(() => {
      editor.insertMarkdown(snippet);
    }, { defaultSelection: 'rootEnd', preventScroll: false });
    handleContentChange(editor.getMarkdown());
  }, [handleContentChange]);

  const appendMarkdownBlock = useCallback((markdown: string) => {
    const normalizedBlock = markdown.trim();
    if (!normalizedBlock) return;

    if (viewMode === 'edit' && mdxEditorRef.current) {
      insertSnippet(`\n${normalizedBlock}\n`);
      return;
    }

    const baseContent = (statsContent || contentRef.current).trimEnd();
    const nextContent = baseContent
      ? `${baseContent}\n\n${normalizedBlock}\n`
      : `${normalizedBlock}\n`;

    handleContentChange(nextContent);
  }, [handleContentChange, insertSnippet, statsContent, viewMode]);

  useEffect(() => {
    return subscribeAgoraEvent(AGORA_EVENTS.insertSnippet, (detail) => {
      if (detail && typeof detail.markdown === 'string') {
        appendMarkdownBlock(detail.markdown);
      }
    });
  }, [appendMarkdownBlock]);

  const updateSemanticState = useCallback((nextState: SemanticWorkspaceState) => {
    const normalizedState = normalizeSemanticWorkspaceState(nextState);
    saveSemanticWorkspaceState(semanticStoreContext, normalizedState);
    setSemanticState(normalizedState);
    void persistSemanticStateRemotely(normalizedState);
  }, [persistSemanticStateRemotely, semanticStoreContext]);

  const getSemanticPayload = useCallback((text: string) => ({
    text,
    docId: roomId ?? null,
    docName: docName || currentDocMetaRef.current.name || 'Documento',
    workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID
  }), [currentWorkspaceId, docName, roomId]);

  const createSemanticDocBlockId = useCallback((kind: string) => generateId(kind), []);

  const applySelectionMarkdown = useCallback((markdown: string) => {
    const activeSelection = semanticSelection;
    if (!activeSelection) return false;

    if (activeSelection.kind === 'textarea') {
      const textarea = editorShellRef.current?.querySelector('textarea');
      if (!(textarea instanceof HTMLTextAreaElement) || !activeSelection.textareaRange) return false;
      textarea.focus();
      textarea.setSelectionRange(activeSelection.textareaRange.start, activeSelection.textareaRange.end);
      textarea.setRangeText(markdown, activeSelection.textareaRange.start, activeSelection.textareaRange.end, 'end');
      handleContentChange(textarea.value);
      return true;
    }

    const editor = mdxEditorRef.current;
    if (!editor) return false;
    restoreSelection(activeSelection);
    editor.focus(() => {
      editor.insertMarkdown(markdown);
    }, { defaultSelection: 'rootEnd', preventScroll: false });
    window.setTimeout(() => {
      handleContentChange(editor.getMarkdown());
    }, 0);
    return true;
  }, [handleContentChange, restoreSelection, semanticSelection]);

  const loadDocumentsForSemanticLinking = useCallback(async () => {
    if (loadingLinkableDocuments || linkableDocuments.length > 0) return;

    setLoadingLinkableDocuments(true);
    try {
      const search = new URLSearchParams({
        workspaceId: currentWorkspaceId || PERSONAL_WORKSPACE_ID,
        view: 'list',
        excludeContent: 'true'
      });
      const docs = await fetchZod(`/api/documents?${search.toString()}`, documentListSchema, { cache: 'no-store' });
      const filteredDocs = docs
        .filter((doc) => doc.id && doc.id !== roomId && doc.type !== 'folder')
        .map((doc) => ({ id: doc.id!, name: doc.name || 'Documento', folder: doc.folder || '' }));
      setLinkableDocuments(filteredDocs);

      // Detectar companion .st existente
      const currentName = docName || currentDocMetaRef.current.name || '';
      if (currentName) {
        const expectedSTName = companionSTName(currentName);
        const companion = filteredDocs.find((d) => d.name === expectedSTName);
        if (companion && companion.id) {
          setCompanionStDocId(companion.id);
        }
      }
    } catch (error) {
      console.error('Error loading linkable documents:', error);
      setSemanticNotice('No pude cargar documentos para enlazar.');
    } finally {
      setLoadingLinkableDocuments(false);
    }
  }, [currentWorkspaceId, docName, linkableDocuments.length, loadingLinkableDocuments, roomId]);

  const runSemanticAction = useCallback(async (actionKey: string, action: () => Promise<void> | void) => {
    setSemanticBusyAction(actionKey);
    try {
      await action();
    } catch (error) {
      console.error(`Semantic action failed: ${actionKey}`, error);
      setSemanticNotice('La acción semántica no se pudo completar.');
    } finally {
      setSemanticBusyAction(null);
    }
  }, []);

  const loadLinkedTasks = useCallback(async () => {
    if (!roomId) return;
    try {
      const workspaceId = currentDocMetaRef.current.workspaceId || PERSONAL_WORKSPACE_ID;
      const boardData = await fetchBoardApi({ workspaceId });
      const tasks = boardData.cards.filter(card => card.sourceDocId === roomId);
      setLinkedTasks(tasks);
    } catch (error) {
      console.error('Error loading linked tasks:', error);
    }
  }, [roomId]);

  useEffect(() => {
    loadLinkedTasks();
  }, [loadLinkedTasks]);

  const scanPendings = useCallback(async () => {
    if (!roomId) return;
    const content = mdxEditorRef.current?.getMarkdown() || contentRef.current;
    if (!content) return;

    const lines = content.split('\n');
    const pendings = lines
      .map(line => line.trim())
      .filter(line => /^[-*]\s+\[\s\]/.test(line))
      .map(line => line.replace(/^[-*]\s+\[\s\]\s*/, '').trim())
      .filter(Boolean);

    if (pendings.length === 0) return;

    setIsCreatingTask(true);
    try {
      const workspaceId = currentDocMetaRef.current.workspaceId || PERSONAL_WORKSPACE_ID;
      const boardData = await fetchBoardApi({ workspaceId });
      const firstColumn = boardData.columns.sort((a, b) => a.order - b.order)[0];

      if (!firstColumn) return;

      const docName = currentDocMetaRef.current.name || 'Documento';

      await Promise.all(pendings.map(pending =>
        createBoardCardApi({
          workspaceId,
          columnId: firstColumn.id,
          title: pending.substring(0, 100),
          description: `Pendiente detectado en ${docName}`,
          sourceDocId: roomId,
          sourceDocName: docName,
          sourceFragment: pending,
          sourcePath: currentDocMetaRef.current.folder
        })
      ));

      await loadLinkedTasks();
    } catch (error) {
      console.error('Error scanning pendings:', error);
    } finally {
      setIsCreatingTask(false);
    }
  }, [roomId, loadLinkedTasks]);

  const createTaskFromSelection = useCallback(async () => {
    const selection = window.getSelection()?.toString().trim();
    const docName = currentDocMetaRef.current.name || 'Documento';

    // Fallback to doc name if no selection
    const title = selection ? (selection.split('\n')[0] ?? '').substring(0, 100) : `Revisar: ${docName}`;
    const description = selection || `Tarea creada desde el documento ${docName}`;

    if (!roomId) return;

    setIsCreatingTask(true);
    try {
      const workspaceId = currentDocMetaRef.current.workspaceId || PERSONAL_WORKSPACE_ID;
      const boardData = await fetchBoardApi({ workspaceId });
      const firstColumn = boardData.columns.sort((a, b) => a.order - b.order)[0];

      if (!firstColumn) {
        console.error('No columns found in board');
        return;
      }

      await createBoardCardApi({
        workspaceId,
        columnId: firstColumn.id,
        title,
        description,
        sourceDocId: roomId,
        sourceDocName: docName,
        sourceFragment: selection || undefined,
        sourcePath: currentDocMetaRef.current.folder
      });

      await loadLinkedTasks();
    } catch (error) {
      console.error('Error creating task from selection:', error);
    } finally {
      setIsCreatingTask(false);
    }
  }, [roomId, loadLinkedTasks]);

  const handleDefineConcept = useCallback(() => {
    if (!semanticSelection) return;
    const text = semanticSelection.text;
    console.warn('[DefineConcept] semanticSelection.text:', text.length, 'chars | preview:', text.slice(0, 120));
    const compact = text.replace(/\s+/g, ' ').trim();
    const title = compact.length > 60 ? `${compact.slice(0, 59)}…` : compact;
    setDefineConceptDraft({ selectionText: text, title, definition: '', logicProfile: '', formula: '' });
    // Auto-preview con autologic
    try {
      const preview = formalizeText(text);
      setAutologicPreview(preview);
    } catch {
      setAutologicPreview(null);
    }
  }, [semanticSelection, setDefineConceptDraft, setAutologicPreview]);

  const handleAddSelectionToDictionary = useCallback(() => {
    if (!dictionaryCandidate) return;
    addToPersonalDictionary(dictionaryCandidate);
    runLint(contentRef.current);
    clearSemanticSelection();
  }, [clearSemanticSelection, dictionaryCandidate, runLint]);

  const handleLinterAddToDictionary = useCallback((word: string) => {
    setLinterAction({ type: 'dictionary', word });
  }, []);

  const handleLinterIgnoreRule = useCallback((ruleId: string, ruleName: string) => {
    setLinterAction({ type: 'ignoreRule', ruleId, ruleName });
  }, []);

  const handleLinterIgnoreDiagnostic = useCallback((ruleId: string, text: string, ruleName: string) => {
    setLinterAction({ type: 'ignoreDiag', ruleId, word: text, ruleName });
  }, []);

  const handleLinterActionConfirm = useCallback(() => {
    if (!linterAction) return;
    switch (linterAction.type) {
      case 'dictionary':
        if (linterAction.word) {
          addToPersonalDictionary(linterAction.word);
          runLint(contentRef.current);
        }
        break;
      case 'ignoreRule':
        if (linterAction.ruleId) {
          MarkdownLinterRegistry.setEnabled(linterAction.ruleId, false);
        }
        break;
      case 'ignoreDiag':
        if (linterAction.ruleId && linterAction.word) {
          addSuppression(linterAction.ruleId, linterAction.word);
          runLint(contentRef.current);
        }
        break;
    }
    setLinterAction(null);
  }, [linterAction, runLint]);

  const handleLinterActionCancel = useCallback(() => {
    setLinterAction(null);
  }, []);

  const closeEditorUtilityMenu = useCallback(() => {
    setEditorUtilityMenu(null);
  }, []);

  const handleOpenToolbarSettingsFromContextMenu = useCallback(() => {
    dispatchOpenSettings('editor-md');
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu]);

  const handleOpenSemanticDeskFromContextMenu = useCallback(() => {
    semanticBrowserBus.open(docName || currentDocMetaRef.current.name);
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, docName]);

  const handleResetToolbarFromContextMenu = useCallback(() => {
    applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY);
    closeEditorUtilityMenu();
  }, [applyToolbarVisibility, closeEditorUtilityMenu]);

  const handleToggleSnippetGalleryFromContextMenu = useCallback(() => {
    setShowSnippetGallery((current) => !current);
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, setShowSnippetGallery]);

  const handleToggleRawModeFromContextMenu = useCallback(() => {
    setViewModeWithSync(viewMode === 'raw' ? 'edit' : 'raw');
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, setViewModeWithSync, viewMode]);

  const handleTogglePreviewFromContextMenu = useCallback(() => {
    setViewModeWithSync(viewMode === 'preview' ? 'edit' : 'preview');
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, setViewModeWithSync, viewMode]);

  const handleScanPendingsFromContextMenu = useCallback(() => {
    void scanPendings();
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, scanPendings]);

  const handleConfirmDefineConcept = useCallback(() => {
    if (!defineConceptDraft) return;
    void runSemanticAction('define-concept', async () => {
      let formulaToUse = defineConceptDraft.formula.trim();
      if (!formulaToUse && autologicPreview?.ok && autologicPreview.formulaCount > 0) {
        const axiomMatch = autologicPreview.stCode.match(/axiom\s+\w+\s*=\s*(.+)/);
        if (axiomMatch?.[1]) formulaToUse = axiomMatch[1].trim();
      }

      const payload = getSemanticPayload(defineConceptDraft.selectionText);
      const nextState = registerConceptFromSelection(semanticStoreContext, payload, {
        title: defineConceptDraft.title.trim() || undefined,
        definition: defineConceptDraft.definition.trim() || undefined,
        logicProfile: defineConceptDraft.logicProfile || undefined,
        formula: formulaToUse || undefined
      });
      updateSemanticState(nextState);
      clearSemanticSelection();
      setDefineConceptDraft(null);
      setAutologicPreview(null);

      try {
        await syncCompanionST({
          semanticState: nextState,
          docName: docName || currentDocMetaRef.current.name || 'Documento',
          docId: roomId ?? null,
          folder: currentDocMetaRef.current.folder || 'Material',
          workspaceId: effectiveWorkspaceId,
          userId: user?.uid
        });
      } catch (error) {
        console.error('Error auto-generating ST companion:', error);
        setSemanticNotice('Concepto registrado, pero falló la generación del archivo ST.');
      }
    });
  }, [autologicPreview, clearSemanticSelection, defineConceptDraft, docName, effectiveWorkspaceId, getSemanticPayload, roomId, runSemanticAction, semanticStoreContext, syncCompanionST, updateSemanticState, user?.uid, setDefineConceptDraft, setAutologicPreview]);

  const {
    handleSaveAsSnippet,
    handleAddNote,
    handleCreateAnalyticalCard,
    handleRelateConcept,
    handleCreateSemanticBlock,
    handleCreateTask,
    handleSendToWorkbench: _handleSendToWorkbench,
    handleMarkEvidence,
    handlePinFragment,
    handleLinkDocument,
    handleInsertEvidenceMatrix: _handleInsertEvidenceMatrix
  } = useMosaicSemanticActions({
    semanticState,
    semanticStoreContext,
    semanticItemCount,
    semanticSelection,
    linkedTasks,
    docName,
    roomId,
    currentDocMetaRef,
    currentWorkspaceId,
    effectiveWorkspaceId,
    user: user ?? undefined,
    appendMarkdownBlock,
    applySelectionMarkdown,
    setSemanticNotice,
    clearSemanticSelection,
    updateSemanticState,
    runSemanticAction,
    getSemanticPayload,
    createSemanticDocBlockId,
    loadLinkedTasks,
    syncCompanionST,
    setDefineConceptDraft,
    setNoteDraft,
    setSnippetDraft
  });

  const handleConfirmSaveNote = useCallback(() => {
    if (!noteDraft?.note.trim()) return;
    void runSemanticAction('save-note', () => {
      const nextState = saveSelectionNote(
        semanticStoreContext,
        getSemanticPayload(noteDraft.selectionText),
        noteDraft.note
      );
      updateSemanticState(nextState);
      setNoteDraft(null);
      setSemanticNotice('Nota guardada en la mesa semántica y sincronizada con Firebase.');
    });
  }, [getSemanticPayload, noteDraft, runSemanticAction, semanticStoreContext, updateSemanticState, setNoteDraft, setSemanticNotice]);

  const handleConfirmSnippetSave = useCallback(async (data: { title: string; description: string; markdown: string; category: string }) => {
    const workspaceId = currentWorkspaceId || PERSONAL_WORKSPACE_ID;
    const created = await createSnippet({ ...data, workspaceId, order: 0 });
    if (created) {
      setSemanticNotice(`Snippet "${data.title}" guardado.`);
    } else {
      setSemanticNotice('No se pudo guardar el snippet.');
    }
    setSnippetDraft(null);
  }, [currentWorkspaceId, setSemanticNotice, setSnippetDraft]);

  const docNeedsKatex = useMemo(() => hasKatexContent(statsContent), [statsContent]);

  useKatexOverlayDecorations({ editorShellRef, viewMode, enabled: docNeedsKatex });

  // Disable native browser spellcheck on MDXEditor's contentEditable so only our
  // LinterPlugin underlines are shown (avoids conflicting red wavy + yellow marks).
  useEffect(() => {
    const shell = editorShellRef.current;
    if (!shell) return;
    const ce = shell.querySelector<HTMLElement>('[contenteditable="true"]');
    if (ce) {
      ce.setAttribute('spellcheck', 'false');
      ce.setAttribute('autocorrect', 'off');
      ce.setAttribute('autocapitalize', 'off');
    }
  }, [editorKey, viewMode]);

  const handleToggleFullscreenFromContextMenu = useCallback(() => {
    void toggleFullscreen();
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, toggleFullscreen]);

  const renderToolbarContents = useCallback(() => {
    return (
      <MosaicToolbarContents
        toolbarVisibility={toolbarVisibility as Record<ToolbarGroupKey, boolean>}
        showCompactMenu={showCompactMenu}
        menuPos={menuPos}
        isFullscreen={isFullscreen}
        viewMode={viewMode}
        isCreatingTask={isCreatingTask}
        docName={docName || ''}
        editorShellRef={editorShellRef}
        menuBtnRef={menuBtnRef}
        currentDocMetaRef={currentDocMetaRef}
        DEFAULT_TOOLBAR_VISIBILITY={DEFAULT_TOOLBAR_VISIBILITY as Record<ToolbarGroupKey, boolean>}
        applyToolbarVisibility={applyToolbarVisibility}
        insertSnippet={insertSnippet}
        toggleCompactMenu={toggleCompactMenu}
        toggleFullscreen={toggleFullscreen}
        setShowCompactMenu={setShowCompactMenu}
        setShowSnippetGallery={setShowSnippetGallery}
        setViewModeWithSync={setViewModeWithSync}
        createTaskFromSelection={createTaskFromSelection}
        scanPendings={scanPendings}
        onExportPdf={handleExportPdf}
      />
    );
  }, [applyToolbarVisibility, toolbarVisibility, showCompactMenu, menuPos, isFullscreen, viewMode, insertSnippet, toggleCompactMenu, toggleFullscreen, setShowCompactMenu, setShowSnippetGallery, setViewModeWithSync, createTaskFromSelection, isCreatingTask, scanPendings, docName, menuBtnRef, handleExportPdf]);

  // Keep ref in sync so the toolbar callback always calls the latest version
  // without recreating the plugins array (which would cause MDXEditor remount)
  renderToolbarContentsRef.current = renderToolbarContents;

  // Plugins pesados del MDXEditor (table/image/codeBlock/codeMirror/directives/
  // frontmatter) inflan native + code size en el primer mount. Estrategia:
  //
  // 1) Detección de contenido al montar: si el doc usa la sintaxis, el plugin
  //    se incluye desde T0 (sin glitch visual).
  // 2) Si NO usa la sintaxis, esperamos `useDeferredMount` (idle ~700ms) y
  //    luego incluimos los plugins. El editorKey bump remounta MDXEditor con
  //    el set completo — barato porque ya está la cadena lexical viva, sólo
  //    se reinicializa con plugins extra registrados.
  //
  // Para un .md trivial (sin tables/imgs/code/directives/frontmatter) el
  // primer paint sólo paga: headings + lists + quote + thematicBreak +
  // markdownShortcut + link + linkDialog + toolbar. Eso quita ~3-4MB de
  // heap (native+code) y ~150-200KB de chunk del dashboard.
  const pluginsDeferredReady = useDeferredMount(700);

  const needsHeavyPlugins = useMemo(() => {
    // initialMarkdown se setea en mount y al cambiar de doc. Detectores
    // baratos (regex) — sin allocations pesadas.
    return {
      table: hasTableContent(initialMarkdown),
      image: hasImageContent(initialMarkdown),
      codeBlock: hasCodeBlockContent(initialMarkdown),
      directives: hasDirectiveContent(initialMarkdown),
      frontmatter: hasFrontmatterContent(initialMarkdown)
    };
  }, [initialMarkdown]);

  // Cuando el deferred timer expire, bump editorKey para que MDXEditor
  // remonte con el set completo de plugins. Sin remount los plugins
  // añadidos al array no se registran (MDXEditor lee plugins al mount).
  const pluginsArmedRef = useRef(false);
  useEffect(() => {
    if (!pluginsDeferredReady) return;
    if (pluginsArmedRef.current) return;
    // Solo bump si actualmente faltaba algún plugin pesado.
    const allHeavyAlreadyIn =
      needsHeavyPlugins.table &&
      needsHeavyPlugins.image &&
      needsHeavyPlugins.codeBlock &&
      needsHeavyPlugins.directives &&
      needsHeavyPlugins.frontmatter;
    pluginsArmedRef.current = true;
    if (allHeavyAlreadyIn) return;
    setEditorKey(k => k + 1);
  }, [pluginsDeferredReady, needsHeavyPlugins]);

  // MDXEditor plugins configuration — la dependencia de `editorKey` garantiza
  // que el set se recalcule cuando bumpeamos por defer. Mantengo el
  // toolbar callback via ref para no remount por cambios de toolbar.
  const editorPlugins = useMemo(() => {
    const plugins: RealmPlugin[] = [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin()
    ];

    if (needsHeavyPlugins.table || pluginsDeferredReady) {
      plugins.push(tablePlugin());
    }
    if (needsHeavyPlugins.image || pluginsDeferredReady) {
      plugins.push(imagePlugin({ imageUploadHandler: async () => '/placeholder.png' }));
    }
    if (needsHeavyPlugins.codeBlock || pluginsDeferredReady) {
      plugins.push(
        codeBlockPlugin({ defaultCodeBlockLanguage: '', codeBlockEditorDescriptors: [mermaidCodeBlockDescriptor] }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            js: 'JavaScript',
            javascript: 'JavaScript',
            ts: 'TypeScript',
            typescript: 'TypeScript',
            python: 'Python',
            py: 'Python',
            css: 'CSS',
            html: 'HTML',
            json: 'JSON',
            bash: 'Bash',
            sh: 'Shell',
            sql: 'SQL',
            yaml: 'YAML',
            xml: 'XML',
            markdown: 'Markdown',
            mermaid: 'Mermaid',
            rust: 'Rust',
            go: 'Go',
            java: 'Java',
            cpp: 'C++',
            c: 'C',
            '': 'Texto plano'
          }
        }),
        removeEmptyCodeBlockOnUndoPlugin()
      );
    }
    if (needsHeavyPlugins.directives || pluginsDeferredReady) {
      plugins.push(
        directivesPlugin({
          directiveDescriptors: [AdmonitionDirectiveDescriptor]
        })
      );
    }
    if (needsHeavyPlugins.frontmatter || pluginsDeferredReady) {
      plugins.push(frontmatterPlugin());
    }

    plugins.push(
      toolbarPlugin({
        toolbarContents: () => renderToolbarContentsRef.current?.() ?? null
      })
    );
    return plugins;
    // editorKey en deps fuerza re-cálculo cuando bumpeamos para remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginsDeferredReady, needsHeavyPlugins, editorKey]);

  const handleLinterFix = useCallback((diag: LinterDiagnostic, replacement: string) => {
    const md = mdxEditorRef.current?.getMarkdown() ?? contentRef.current;
    const lines = md.split('\n');
    const lineIdx = diag.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];
    if (line === undefined) return;
    const startCol = diag.column - 1;
    const endCol = (diag.endColumn ?? diag.column) - 1;
    lines[lineIdx] = line.slice(0, startCol) + replacement + line.slice(endCol);

    const newMd = lines.join('\n');
    mdxEditorRef.current?.setMarkdown(newMd);
    handleContentChange(newMd);
  }, [handleContentChange]);

  const handleMdxChange = useCallback((md: string) => {
    // Skip if this is MDXEditor's initial markdown normalization
    if (isNormalizingRef.current) return;
    handleContentChange(md);
    // Empuja el cambio local al Y.Text compartido (si hay colab activo y el
    // cambio no proviene de aplicar un update remoto, para no rebotar).
    if (!collabApplyingRemoteRef.current && collabYdoc && collabSeedDoneRef.current) {
      const ytext = collabYdoc.getText('content');
      if (ytext.toString() !== md) {
        collabYdoc.transact(() => {
          ytext.delete(0, ytext.length);
          ytext.insert(0, md);
        });
      }
    }
  }, [handleContentChange, collabYdoc]);

  // Seed inicial del Y.Text compartido: igual patrón que STFileEditor. Solo el
  // ganador del seedLock siembra cuando el doc remoto está vacío; los demás
  // aceptan el estado remoto. Requiere que el contenido local ya esté cargado.
  useEffect(() => {
    if (!collabEligible || !collabYdoc || !collabProvider) return;
    if (collabStatus !== 'connected') return;
    if (collabSeedDoneRef.current) return;
    if (!hasLoadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const ytext = collabYdoc.getText('content');
        if (ytext.length > 0) {
          // El doc remoto ya tiene contenido: lo adoptamos como fuente de verdad.
          const remote = ytext.toString();
          if (!cancelled && remote !== contentRef.current && !hasUnsavedLocalChanges()) {
            collabApplyingRemoteRef.current = true;
            contentRef.current = remote;
            setStatsContent(remote);
            mdxEditorRef.current?.setMarkdown(remote);
            setInitialMarkdown(remote);
            collabApplyingRemoteRef.current = false;
          }
          collabSeedDoneRef.current = true;
          return;
        }
        const won = await collabProvider.claimSeedLock();
        if (cancelled) return;
        if (won && contentRef.current) {
          collabYdoc.transact(() => {
            ytext.insert(0, contentRef.current);
          });
        }
        collabSeedDoneRef.current = true;
      } catch (err) {
        console.warn('[MosaicEditor] collab seed failed', err);
        if (!cancelled) collabSeedDoneRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [collabEligible, collabYdoc, collabProvider, collabStatus, hasUnsavedLocalChanges]);

  // Observa updates remotas del Y.Text y las refleja en el editor. Solo aplica
  // cuando el usuario local NO tiene ediciones sin guardar — así no pisamos lo
  // que está escribiendo. Cuando está idle, ve los cambios del otro en vivo.
  useEffect(() => {
    if (!collabEligible || !collabYdoc) return;
    const ytext = collabYdoc.getText('content');
    const handler = () => {
      if (collabApplyingRemoteRef.current) return;
      if (!collabSeedDoneRef.current) return;
      const remote = ytext.toString();
      if (remote === contentRef.current) return;
      if (hasUnsavedLocalChanges()) return;
      collabApplyingRemoteRef.current = true;
      try {
        contentRef.current = remote;
        lastSyncedContentRef.current = remote;
        pendingLocalChangeRef.current = false;
        startTransition(() => setStatsContent(remote));
        if (viewMode === 'edit') {
          mdxEditorRef.current?.setMarkdown(remote);
        }
        setInitialMarkdown(remote);
      } finally {
        collabApplyingRemoteRef.current = false;
      }
    };
    ytext.observe(handler);
    return () => ytext.unobserve(handler);
  }, [collabEligible, collabYdoc, hasUnsavedLocalChanges, viewMode]);

  if (docType === 'file') {
    return (
      <FilePreviewPane
        fileName={fileName}
        fileMime={fileMime}
        fileUrl={fileUrl}
        docId={roomId}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      ref={editorShellRef}
      role="region"
      aria-label={`Editor: ${docName || currentDocMetaRef.current.name || 'Documento'}`}
      data-editor-room-id={roomId ?? undefined}
      className={clsx(
        'flex flex-col h-full bg-slate-950 text-slate-300 relative mdx-editor-dark',
        embedded && 'editor-embedded',
        isFullscreen && 'z-[9999]'
      )}
    >
      {!embedded && (
        <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onClose && (
              <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider shrink-0">
                <ChevronLeft className="w-4 h-4" /> Salir
              </button>
            )}
            <div className="h-4 w-px bg-slate-700 shrink-0" />
            <span className="text-xs font-medium text-slate-400 truncate max-w-[200px]" title={docName}>{docName || 'Documento'}</span>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2 mx-4">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-32"
              />
              {searchTerm && (
                <>
                  <span className="text-[10px] text-slate-500 font-mono px-1">
                    {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : '0/0'}
                  </span>
                  <button onClick={() => navigateSearch('prev')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Anterior">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => navigateSearch('next')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Siguiente">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => setSearchTerm('')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Limpiar">
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono shrink-0">
            <button
              type="button"
              onClick={() => semanticBrowserBus.open(docName || currentDocMetaRef.current.name)}
              className={clsx(
                'mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full border transition',
                'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              )}
              title={`Abrir mesa semántica (${semanticItemCount} elementos)`}
              aria-label={`Abrir mesa semántica (${semanticItemCount} elementos)`}
            >
              <BookMarked className="h-3.5 w-3.5" />
            </button>
            <LinterConfigPanel linterStatus={linterStatus} />
            {!hideInlineStatus && (
              <>
                <span className="w-px h-3 bg-slate-700 mx-1" />
                <span>{stats.words} palabras</span>
                <span>·</span>
                <span>{stats.chars} car.</span>
                <span className="w-px h-3 bg-slate-700 mx-1" />
                {readOnly ? (
                  <span className="text-amber-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</span>
                ) : saving ? (
                  <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Guardando</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>
                )}
                {collabEligible && collabStatus === 'connected' && (
                  <span className="text-blue-300 flex items-center gap-1" title="Edición colaborativa en vivo"><Users className="w-3 h-3" /> En vivo</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {semanticNotice && (
        <div className="shrink-0 border-b border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
          {semanticNotice}
        </div>
      )}

      {readOnly && (
        <div
          role="status"
          className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 flex items-center gap-2"
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>Modo solo lectura — no tenés permiso de edición en este documento.</span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden flex flex-row">
        {/* ── Snippet Gallery sidebar ── */}
        {showSnippetGallery && (
          <div className="snippet-gallery-sidebar w-72 shrink-0 border-r border-slate-700 overflow-y-auto bg-slate-900">
            <SnippetGallery
              workspaceId={currentDocMetaRef.current.workspaceId || PERSONAL_WORKSPACE_ID}
              onInsert={(md: string) => { insertSnippet(md); }}
              onClose={() => setShowSnippetGallery(false)}
            />
          </div>
        )}

        {/* ── Editor area ── */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {viewMode === 'preview' ? (
            <>
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('edit')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-500/50 bg-blue-600/20 text-blue-300 transition hover:bg-blue-600/30"
                  title="Volver al editor visual"
                  aria-label="Volver al editor visual"
                >
                  <PenLine className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('raw')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/40 bg-violet-600/15 text-violet-200 transition hover:bg-violet-600/25"
                  title="Ver Markdown puro"
                  aria-label="Ver Markdown puro"
                >
                  <FileCode2 className="h-3 w-3" />
                </button>
              </div>

              <div
                className="flex-1 relative overflow-hidden group/preview"
                style={{ '--preview-font-size': `${zoomLevel * 15}px` } as React.CSSProperties}
                onWheel={(e) => {
                  if (e.ctrlKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    setZoomLevel(prev => Math.min(3, Math.max(0.5, prev + delta)));
                  }
                }}
              >
                <MarkdownPreview content={statsContent || contentRef.current} onOpenInternalLink={openInternalMarkdownLink} />

                {/* Floating Zoom HUD */}
                <div className="absolute bottom-6 right-6 flex items-center gap-1.5 p-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl opacity-0 translate-y-2 transition-all duration-300 group-hover/preview:opacity-100 group-hover/preview:translate-y-0">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    title="Alejar (Ctrl + Scroll Down)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="px-2 min-w-[50px] text-center text-[11px] font-mono font-medium text-slate-300 hover:text-blue-400 transition-colors"
                    title="Restablecer zoom (100%)"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    title="Acercar (Ctrl + Scroll Up)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : viewMode === 'raw' ? (
            <>
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('edit')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-500/50 bg-blue-600/20 text-blue-300 transition hover:bg-blue-600/30"
                  title="Volver al editor visual"
                  aria-label="Volver al editor visual"
                >
                  <PenLine className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('preview')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/40 bg-violet-600/15 text-violet-200 transition hover:bg-violet-600/25"
                  title="Abrir vista previa renderizada"
                  aria-label="Abrir vista previa renderizada"
                >
                  <Monitor className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  value={statsContent}
                  onChange={(event) => handleContentChange(event.target.value)}
                  readOnly={readOnly}
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    setRawScrollPos({ top: target.scrollTop, left: target.scrollLeft });
                  }}
                  spellCheck={false}
                  className="markdown-raw-textarea h-full w-full resize-none border-0 bg-slate-950/95 px-5 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none"
                  placeholder="# Markdown puro\n\nEscribe aquí el contenido exacto del documento..."
                />
                <LinterOverlay
                  diagnostics={allDiagnostics}
                  content={statsContent}
                  lineHeight={24}
                  charWidth={7.825}
                  paddingTop={16}
                  paddingLeft={20}
                  scrollTop={rawScrollPos.top}
                  scrollLeft={rawScrollPos.left}
                  interactive={!semanticSelection && !editorUtilityMenu}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 relative overflow-hidden h-full">
              {isPlainText ? (
                <CodeMirrorPlain
                  key={editorKey}
                  value={initialMarkdown}
                  onChange={handleMdxChange}
                  readOnly={readOnly}
                  height="100%"
                  basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                  className="h-full"
                />
              ) : (
              <DynamicMDXEditor
                key={editorKey}
                ref={mdxEditorRef}
                markdown={initialMarkdown}
                onChange={handleMdxChange}
                readOnly={readOnly}
                plugins={editorPlugins}
                contentEditableClassName="mdx-content-editable"
                className="mdx-editor-root h-full"
                placeholder="Escribe aquí... Usa Markdown como en Obsidian"
              />
              )}
              <LinterPlugin
                diagnostics={allDiagnostics}
                editorShellRef={editorShellRef}
                viewMode="edit"
                content={statsContent}
                onApplyFix={handleLinterFix}
                onAddToDictionary={handleLinterAddToDictionary}
                onIgnoreRule={handleLinterIgnoreRule}
                onIgnoreDiagnostic={handleLinterIgnoreDiagnostic}
                interactive={!semanticSelection && !editorUtilityMenu}
              />
            </div>
          )}
          {isDocLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                <span className="text-xs text-slate-400">Cargando documento…</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {linkedTasks.length > 0 && (
        <div className="linked-tasks-section shrink-0 bg-slate-900 border-t border-slate-800 py-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tareas vinculadas</span>
            <button
              onClick={() => window.postMessage({ type: 'agora-open-board' }, window.location.origin)}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition"
            >
              Abrir tablero
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {linkedTasks.map(task => (
              <div key={task.id} className="linked-task-item bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded px-2 py-1 flex items-center gap-2 max-w-[200px] cursor-default">
                <KanbanSquare className="w-3 h-3 text-blue-400" />
                <span className="truncate flex-1" title={task.title}>{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status bar for embedded mode */}
      {embedded && !hideInlineStatus && (
        <div className="shrink-0 h-7 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[11px] text-slate-300">
          <div className="flex items-center gap-3">
            <span>Markdown</span>
            <LinterConfigPanel linterStatus={linterStatus} />
            <span>{stats.words} palabras</span>
            <span>{stats.chars} car.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => semanticBrowserBus.open(docName || currentDocMetaRef.current.name)}
              className={clsx(
                'inline-flex h-5 w-5 items-center justify-center rounded-full border transition',
                'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              )}
              title={`Abrir mesa semántica (${semanticItemCount} elementos)`}
              aria-label={`Abrir mesa semántica (${semanticItemCount} elementos)`}
            >
              <BookMarked className="h-3 w-3" />
            </button>
            {saving ? (
              <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Guardando</span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>
            )}
          </div>
        </div>
      )}

      {semanticSelection && viewMode !== 'preview' && (
        <EditorSelectionMenu
          selection={semanticSelection}
          concepts={semanticState.concepts}
          documents={linkableDocuments}
          loadingDocuments={loadingLinkableDocuments}
          busyAction={semanticBusyAction}
          onClose={clearSemanticSelection}
          onDefineConcept={handleDefineConcept}
          onCreateAnalyticalCard={handleCreateAnalyticalCard}
          onCreateSemanticBlock={handleCreateSemanticBlock}
          onCreateTask={handleCreateTask}
          onAddNote={handleAddNote}
          onMarkEvidence={handleMarkEvidence}
          onPinFragment={handlePinFragment}
          onOpenConcepts={() => undefined}
          onOpenDocuments={() => { void loadDocumentsForSemanticLinking(); }}
          onRelateConcept={handleRelateConcept}
          onLinkDocument={handleLinkDocument}
          onSaveAsSnippet={handleSaveAsSnippet}
          canAddToDictionary={canAddSelectionToDictionary}
          onAddToDictionary={handleAddSelectionToDictionary}
        />
      )}

      {editorUtilityMenu && !semanticSelection && viewMode !== 'preview' && (
        <EditorUtilityMenu
          anchor={editorUtilityMenu}
          isFullscreen={isFullscreen}
          showSnippetGallery={showSnippetGallery}
          viewMode={viewMode}
          onClose={closeEditorUtilityMenu}
          onOpenToolbarSettings={handleOpenToolbarSettingsFromContextMenu}
          onOpenSemanticDesk={handleOpenSemanticDeskFromContextMenu}
          onResetToolbar={handleResetToolbarFromContextMenu}
          onToggleFullscreen={handleToggleFullscreenFromContextMenu}
          onToggleSnippetGallery={handleToggleSnippetGalleryFromContextMenu}
          onToggleRawMode={handleToggleRawModeFromContextMenu}
          onTogglePreviewMode={handleTogglePreviewFromContextMenu}
          onScanPendings={handleScanPendingsFromContextMenu}
        />
      )}

      {defineConceptDraft && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setDefineConceptDraft(null); setAutologicPreview(null); } }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              Definir concepto
            </h3>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Nombre del concepto</label>
            <input
              type="text"
              value={defineConceptDraft.title}
              onChange={(e) => setDefineConceptDraft({ ...defineConceptDraft, title: e.target.value })}
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/60"
              autoFocus
            />
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Definición corta
              <span className="text-slate-600 ml-1">(se usa como identificador ST)</span>
            </label>
            <input
              type="text"
              value={defineConceptDraft.definition}
              onChange={(e) => setDefineConceptDraft({ ...defineConceptDraft, definition: e.target.value })}
              placeholder="Ej: técnica como necesidad"
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/60"
            />
            <details className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-400 select-none flex items-center gap-1.5">
                <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />Formalización ST</span>
                <span className="text-slate-600">(opcional)</span>
              </summary>
              <div className="px-3 pb-3 pt-1 space-y-2">
                <label className="block text-[11px] font-medium text-slate-500">Perfil lógico</label>
                <select
                  value={defineConceptDraft.logicProfile}
                  onChange={(e) => {
                    const newProfile = e.target.value;
                    setDefineConceptDraft({ ...defineConceptDraft, logicProfile: newProfile });
                    // Recalcular preview con el nuevo perfil
                    try {
                      const preview = formalizeText(defineConceptDraft.selectionText, newProfile || undefined);
                      setAutologicPreview(preview);
                    } catch {
                      setAutologicPreview(null);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/60"
                >
                  <option value="">Sin perfil (usa el del archivo)</option>
                  <option value="classical.propositional">Proposicional clásica</option>
                  <option value="classical.first_order">Primer orden clásica</option>
                  <option value="intuitionistic.propositional">Intuicionista</option>
                  <option value="modal.k">Modal K</option>
                  <option value="epistemic.s5">Epistémica S5</option>
                  <option value="deontic.standard">Deóntica</option>
                  <option value="temporal.ltl">Temporal LTL</option>
                  <option value="paraconsistent.belnap">Paraconsistente (Belnap)</option>
                  <option value="aristotelian.syllogistic">Silogística aristotélica</option>
                  <option value="arithmetic">Aritmética</option>
                  <option value="probabilistic.basic">Probabilística</option>
                </select>
                <label className="block text-[11px] font-medium text-slate-500">Fórmula ST</label>
                <textarea
                  value={defineConceptDraft.formula}
                  onChange={(e) => setDefineConceptDraft({ ...defineConceptDraft, formula: e.target.value })}
                  placeholder={'Ej: TECNICA_NO_LUJO -> NECESIDAD\nEj: forall x. (Humano(x) -> UsaTecnica(x))'}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-cyan-300 outline-none placeholder:text-slate-600 focus:border-blue-500/60"
                />
                <p className="text-[10px] leading-4 text-slate-600">
                  Si escribes una fórmula, se añadirá como axioma verificable en el archivo ST.
                  Si la dejas vacía, autologic generará una formalización automática.
                </p>
                {autologicPreview && !defineConceptDraft.formula.trim() && (
                  <details open className="rounded-lg border border-cyan-900/40 bg-cyan-950/20">
                    <summary className="cursor-pointer px-3 py-1.5 text-[10px] font-medium text-cyan-400 select-none flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      Preview autologic
                      {autologicPreview.ok && (
                        <span className="ml-auto text-[9px] text-cyan-600">
                          {autologicPreview.atomCount} átomos · {autologicPreview.formulaCount} fórmulas
                          {autologicPreview.patterns.length > 0 && ` · ${autologicPreview.patterns.join(', ')}`}
                        </span>
                      )}
                    </summary>
                    <pre className="px-3 pb-2 pt-1 text-[10px] leading-4 font-mono text-cyan-300/80 whitespace-pre-wrap max-h-32 overflow-auto">
                      {autologicPreview.ok ? autologicPreview.stCode.slice(0, 600) : '(no se pudo formalizar automáticamente)'}
                    </pre>
                  </details>
                )}
              </div>
            </details>
            <div className="text-[11px] text-slate-500 mb-4 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
              <span className="font-medium text-slate-400">Selección:</span>{' '}
              {defineConceptDraft.selectionText.length > 200
                ? `${defineConceptDraft.selectionText.slice(0, 197)}…`
                : defineConceptDraft.selectionText}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDefineConceptDraft(null); setAutologicPreview(null); }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDefineConcept}
                disabled={!defineConceptDraft.title.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Definir concepto
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {noteDraft && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setNoteDraft(null); } }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <PenLine className="h-4 w-4 text-amber-300" />
              Guardar nota semántica
            </h3>
            <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
              <span className="font-medium text-slate-300">Texto señalado:</span>{' '}
              {noteDraft.selectionText.length > 240
                ? `${noteDraft.selectionText.slice(0, 237)}…`
                : noteDraft.selectionText}
            </div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">Comentario</label>
            <textarea
              value={noteDraft.note}
              onChange={(e) => setNoteDraft({ ...noteDraft, note: e.target.value })}
              placeholder="Escribe una observación breve, una hipótesis o un recordatorio para este fragmento..."
              rows={5}
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
            />
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              La nota se guarda en la mesa semántica del workspace y queda persistida en Firebase para volver a verla desde cualquier sesión.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteDraft(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveNote}
                disabled={!noteDraft.note.trim()}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar nota
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {snippetDraft && (
        <SnippetEditorModal
          initial={{ markdown: snippetDraft.markdown }}
          onSave={(data) => { void handleConfirmSnippetSave(data); }}
          onCancel={() => setSnippetDraft(null)}
        />
      )}

      {linterAction && (
        <LinterConfirmModal
          action={linterAction}
          onConfirm={handleLinterActionConfirm}
          onCancel={handleLinterActionCancel}
        />
      )}

      {/* @ts-ignore styled-jsx props */}
      <style jsx global>{mosaicEditorStyles}</style>
    </div>
  );
}
