'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Image from 'next/image';
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
  type MDXEditorMethods
} from '@mdxeditor/editor';
import { DynamicMDXEditor } from '@/components/editor/DynamicMDXEditor';
import '@mdxeditor/editor/style.css';

import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import type { ViewMode, EditorProps, MarkdownDocMeta } from '@/components/mosaic-editor/types';
import { DEFAULT_TOOLBAR_VISIBILITY, TOOLBAR_GROUP_LABELS, QUICK_INSERTS, SAVE_DEBOUNCE_MS, ST_DEBOUNCE_MS, SEMANTIC_NOTICE_TIMEOUT_MS } from '@/components/mosaic-editor/constants';
import {
  isMarkdownName, isMarkdownMime, isImageMime, isVideoMime, isAudioMime, isPdfMime,
  stripQueryAndHash, isExternalMarkdownHref, isBrowserNavigationHref,
  normalizeRelativeMarkdownPath, ensureMarkdownCandidateNames,
  buildWorkspaceAwarePathCandidates, extractWorkspaceSegments, generateId
} from '@/components/mosaic-editor/utils';
import { useEditorSearch } from '@/components/mosaic-editor/useEditorSearch';
import { useEditorUI } from '@/components/mosaic-editor/useEditorUI';
import { useEditorModals } from '@/components/mosaic-editor/useEditorModals';
import { useEditorSSEStream } from '@/components/mosaic-editor/useEditorSSEStream';
import { useSemanticStateSyncer } from '@/components/mosaic-editor/useSemanticStateSyncer';
import { useCompanionSTSync } from '@/components/mosaic-editor/useCompanionSTSync';
import { MarkdownPreview } from '@/components/mosaic-editor/MarkdownPreview';
import { mermaidCodeBlockDescriptor } from '@/components/mosaic-editor/MermaidCodeBlockEditor';
import { useKatexOverlayDecorations } from '@/components/mosaic-editor/useKatexOverlayDecorations';
import { mosaicEditorStyles } from '@/components/mosaic-editor/styles';
import {
  BookMarked, Check, Cloud, Search, ArrowUp, ArrowDown, X, Sparkles,
  Monitor, PenLine, FileCode2,
  KanbanSquare, Loader2, Ruler, RefreshCw,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { useMosaicSemanticActions } from '@/components/mosaic-editor/useMosaicSemanticActions';
import { MosaicToolbarContents, type ToolbarGroupKey } from '@/components/mosaic-editor/MosaicToolbarContents';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';

import { createSnippet } from '@/services/snippetApi';
import { authFetch } from '@/services/apiClient';
import { createBoardCardApi, fetchBoardApi } from '@/services/boardApi';
import type { BoardCard } from '@/components/dashboard/types';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useEditorSelectionActions } from '@/hooks/useEditorSelectionActions';
import { useMarkdownLinter, type LinterDiagnostic } from '@/hooks/useMarkdownLinter';
import { useSTDefinitionsLinter } from '@/hooks/useSTDefinitionsLinter';
import { addToPersonalDictionary, getPersonalDictionary } from '@/lib/markdown-linter/spell-engine';
import { normalizePath } from '@/lib/folder-utils';
import { buildSTFromSemantic, companionSTName, formalizeText } from '@/lib/buildSTFromSemantic';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { semanticBrowserBus } from '@/lib/semantic-browser-bus';
import { DocumentType, type DocumentTypeId } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import { EditorSelectionMenu } from '@/components/editor/EditorSelectionMenu';
import { EditorUtilityMenu } from '@/components/editor/EditorUtilityMenu';
import { LinterOverlay } from '@/components/editor/LinterOverlay';
import { LinterPlugin } from '@/components/mosaic-editor/LinterPlugin';
import { LinterConfigPanel } from '@/components/mosaic-editor/LinterConfigPanel';
import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  filterSemanticWorkspaceStateByDocument,
  hasSemanticWorkspaceStateChanged,
  mergeSemanticWorkspaceStates,
  normalizeSemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import {
  getRecentSemanticItems,
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
import PdfViewer from '@/components/PdfViewer';
import SnippetGallery, { SnippetEditorModal } from '@/components/SnippetGallery';

export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef
}: EditorProps) {
  // MDXEditor is UNCONTROLLED: `markdown` prop is only read on mount.
  // We use `initialMarkdown` + `editorKey` for mount/remount,
  // and `contentRef` + `statsContent` for tracking without re-render loops.
  const [initialMarkdown, setInitialMarkdown] = useState(initialContent);
  const [editorKey, setEditorKey] = useState(0);
  const [statsContent, setStatsContent] = useState(initialContent); // only for stats display
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<DocumentType.Text | DocumentType.File>(DocumentType.Text);
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
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<BoardCard[]>([]);
  const [companionStDocId, setCompanionStDocId] = useState<string | null>(null);
  const [editorUtilityMenu, setEditorUtilityMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const renderToolbarContentsRef = useRef<(() => React.ReactNode) | null>(null);
  const semanticStateRef = useRef<SemanticWorkspaceState>(EMPTY_SEMANTIC_WORKSPACE_STATE);
  const semanticSyncRequestIdRef = useRef(0);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const isPageVisible = usePageVisibility();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const currentDocMetaRef = useRef<MarkdownDocMeta>({ workspaceId: null, folder: '', name: '' });

  // ── Custom hooks ──
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
    toggleToolbarGroup,
    showToolsPanel,
    setShowToolsPanel,
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
  const linterRules = useMemo(() => [stDefinitionsRule], [stDefinitionsRule]);
  const { diagnostics: markdownDiagnostics, runLint } = useMarkdownLinter(statsContent, linterRules);

  const noteDiagnostics = useMemo<LinterDiagnostic[]>(() => {
    const diags: LinterDiagnostic[] = [];
    const notes = semanticState.fragments.filter(f => f.kind === 'note' && f.note && f.text);

    for (const n of notes) {
      if (!n.note || !n.text) continue;
      const idx = statsContent.indexOf(n.text);
      if (idx !== -1) {
         const before = statsContent.substring(0, idx);
         const lines = before.split('\n');
         const line = lines.length;
         const column = lines[lines.length - 1].length + 1;

         // Multi-line aware end column for single line fallbacks
         const textLines = n.text.split('\n');
         const endColumn = textLines.length === 1 ? column + n.text.length : undefined;

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
    }
    return diags;
  }, [semanticState.fragments, statsContent]);

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

  const semanticOverview = useMemo(() => getRecentSemanticItems(semanticState), [semanticState]);
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
  useEffect(() => {
    const currentName = docName || currentDocMetaRef.current.name || 'Documento';
    const scopedSemanticState = filterSemanticWorkspaceStateByDocument(semanticState, {
      docId: roomId ?? null,
      docName: currentName
    });
    const sourceFragmentById = new Map(
      scopedSemanticState.fragments.map((fragment) => [fragment.id, fragment.text])
    );
    const projectedConcepts = scopedSemanticState.concepts;
    const hash = JSON.stringify(projectedConcepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      definition: concept.definition || '',
      formula: concept.formula || '',
      logicProfile: concept.logicProfile || '',
      excerpt: concept.excerpt || '',
      sourceText: concept.sourceFragmentId ? sourceFragmentById.get(concept.sourceFragmentId) || '' : ''
    })));
    if (hash === prevConceptsHashRef.current) return;

    const timer = setTimeout(() => {
      prevConceptsHashRef.current = hash;
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
    if (rawLoadInFlightRef.current || key === lastRawKeyRef.current) return;
    rawLoadInFlightRef.current = true;
    lastRawKeyRef.current = key;
    setIsDocLoading(true);
    try {
      const res = await authFetch(`/api/documents/${roomId}/raw`, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      if (text && text !== contentRef.current) {
        setEditorContent(text);
      }
    } catch (e) {
      console.error('Error loading raw content:', e);
    } finally {
      rawLoadInFlightRef.current = false;
      setIsDocLoading(false);
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

    currentDocMetaRef.current = {
      workspaceId,
      folder,
      name
    };
    setCurrentWorkspaceId(workspaceId || PERSONAL_WORKSPACE_ID);

    if (type === DocumentType.File && !isMarkdown) {
      setDocType(DocumentType.File);
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

      if (!same) {
        // Use setMarkdown if editor is mounted (avoids full remount),
        // fall back to remount via setEditorContent
        if (mdxEditorRef.current) {
          contentRef.current = incoming;
          lastSyncedContentRef.current = incoming;
          pendingLocalChangeRef.current = false;
          setStatsContent(incoming);
          mdxEditorRef.current.setMarkdown(incoming);
        } else {
          setEditorContent(incoming);
        }
      }
    } else if (type === DocumentType.File && (url || storagePath)) {
      const rawKey = storagePath || url;
      maybeLoadRawContent(rawKey);
    } else if (!hasUnsavedLocalChanges()) {
      if (mdxEditorRef.current) {
        contentRef.current = '';
        lastSyncedContentRef.current = '';
        pendingLocalChangeRef.current = false;
        setStatsContent('');
        mdxEditorRef.current.setMarkdown('');
      } else {
        setEditorContent('');
      }
    }

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
    setIsDocLoading(true);
    try {
      const res = await authFetch(`/api/documents/${roomId}`, { cache: 'no-store' });
      if (!res.ok) {
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
  }, [roomId, applyDocData, hasUnsavedLocalChanges, resetDocState]);

  useEffect(() => {
    if (!roomId) return;
    hasLoadedRef.current = false;
    pendingLocalChangeRef.current = false;
    hasLocalEditsThisSessionRef.current = false;
    lastRawKeyRef.current = null;
    loadDoc();
  }, [roomId, loadDoc]);

  // Listen for real-time document changes
  useEffect(() => {
    if (!onDocChangeCallback || !roomId || !isPageVisible) return;
    return onDocChangeCallback((event) => {
      if (event.docId === roomId && (event.action === 'updated' || event.action === 'created')) {
        loadDoc();
      }
    });
  }, [onDocChangeCallback, roomId, loadDoc, isPageVisible]);

  // SSE stream for real-time updates (Firestore onSnapshot via server)
  useEditorSSEStream({
    roomId,
    isPageVisible,
    onSnapshot: (data) => applyDocData(data as Parameters<typeof applyDocData>[0]),
    onDeleted: resetDocState
  });

  useEffect(() => {
    if (!isPageVisible || !roomId) return;
    loadDoc();
  }, [isPageVisible, roomId, loadDoc]);

  useEffect(() => {
    if (viewMode === 'preview') {
      clearSemanticSelection();
    }
  }, [clearSemanticSelection, viewMode]);

  const handleContentChange = useCallback((val: string) => {
    contentRef.current = val;
    setStatsContent(val);
    if (!roomId || docType === DocumentType.File) return;
    if (!hasLoadedRef.current) return;

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

    saveTimeoutRef.current = setTimeout(async () => {
      const requestId = ++saveRequestIdRef.current;
      try {
        const res = await authFetch(`/api/documents/${roomId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: val,
            type: DocumentType.Text,
            lastUpdatedBy: user?.uid
          })
        });
        if (!res.ok) {
          throw new Error('Failed to save');
        }

        if (requestId === saveRequestIdRef.current && contentRef.current === val) {
          lastSyncedContentRef.current = val;
          pendingLocalChangeRef.current = false;
          setSaving(false);
        } else {
          pendingLocalChangeRef.current = contentRef.current !== lastSyncedContentRef.current;
          setSaving(pendingLocalChangeRef.current);
        }
      } catch (e) {
        console.error('Error saving:', e);
      } finally {
        if (requestId === saveRequestIdRef.current) {
          const stillUnsaved = contentRef.current !== lastSyncedContentRef.current;
          pendingLocalChangeRef.current = stillUnsaved;
          setSaving(stillUnsaved);
        }
      }
    }, SAVE_DEBOUNCE_MS);
  }, [roomId, user?.uid, docType]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

  const stats = useMemo(() => {
    const trimmed = statsContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words, chars: statsContent.length };
  }, [statsContent]);

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
      const res = await authFetch(`/api/documents?${search.toString()}`, { cache: 'no-store' });
      if (!res.ok) return null;

      const docs = await res.json() as Array<{ id: string; name?: string; folder?: string; type?: string }>;
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

    const emitOpenDoc = (docId: string) => {
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
          const wsData = await wsRes.json() as { workspaces?: Array<{ id: string; name?: string }>; invites?: Array<{ id: string; name?: string }> };
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
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ markdown?: unknown }>).detail;
      if (detail && typeof detail.markdown === 'string') {
        appendMarkdownBlock(detail.markdown);
      }
    };
    window.addEventListener('agora:insert-snippet' as keyof WindowEventMap, handler);
    return () => window.removeEventListener('agora:insert-snippet' as keyof WindowEventMap, handler);
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
      const res = await authFetch(`/api/documents?${search.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('No se pudo cargar la lista de documentos');
      }
      const docs = await res.json() as Array<{ id: string; name?: string; folder?: string; type?: string }>;
      const filteredDocs = docs
        .filter((doc) => doc.id !== roomId && doc.type !== 'folder')
        .map((doc) => ({ id: doc.id, name: doc.name || 'Documento', folder: doc.folder || '' }));
      setLinkableDocuments(filteredDocs);

      // Detectar companion .st existente
      const currentName = docName || currentDocMetaRef.current.name || '';
      if (currentName) {
        const expectedSTName = companionSTName(currentName);
        const companion = filteredDocs.find((d) => d.name === expectedSTName);
        if (companion) {
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
      .filter(line => line.startsWith('- [ ]'))
      .map(line => line.substring(5).trim())
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
    const title = selection ? selection.split('\n')[0].substring(0, 100) : `Revisar: ${docName}`;
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

  const closeEditorUtilityMenu = useCallback(() => {
    setEditorUtilityMenu(null);
  }, []);

  const handleToggleToolsPanelFromContextMenu = useCallback(() => {
    setShowToolsPanel((current) => !current);
    closeEditorUtilityMenu();
  }, [closeEditorUtilityMenu, setShowToolsPanel]);

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

  const handleInsertQuickSnippetFromContextMenu = useCallback((markdown: string) => {
    appendMarkdownBlock(markdown);
    closeEditorUtilityMenu();
  }, [appendMarkdownBlock, closeEditorUtilityMenu]);

  const handleConfirmDefineConcept = useCallback(() => {
    if (!defineConceptDraft) return;
    void runSemanticAction('define-concept', async () => {
      let formulaToUse = defineConceptDraft.formula.trim();
      if (!formulaToUse && autologicPreview?.ok && autologicPreview.formulaCount > 0) {
        const axiomMatch = autologicPreview.stCode.match(/axiom\s+\w+\s*=\s*(.+)/);
        if (axiomMatch) formulaToUse = axiomMatch[1].trim();
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
    handleInsertSemanticAtlas,
    handleInsertEvidenceMatrix: _handleInsertEvidenceMatrix,
    handleInsertResearchBrief,
    handleGenerateSTFile
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

  // Obsidian-style inline LaTeX rendering (extracted to hook)
  useKatexOverlayDecorations({ editorShellRef, viewMode });

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
        showToolsPanel={showToolsPanel}
        viewMode={viewMode}
        isCreatingTask={isCreatingTask}
        docName={docName || ''}
        editorShellRef={editorShellRef}
        menuBtnRef={menuBtnRef}
        currentDocMetaRef={currentDocMetaRef}
        DEFAULT_TOOLBAR_VISIBILITY={DEFAULT_TOOLBAR_VISIBILITY as Record<ToolbarGroupKey, boolean>}
        QUICK_INSERTS={QUICK_INSERTS}
        applyToolbarVisibility={applyToolbarVisibility}
        insertSnippet={insertSnippet}
        toggleCompactMenu={toggleCompactMenu}
        toggleFullscreen={toggleFullscreen}
        setShowCompactMenu={setShowCompactMenu}
        setShowSnippetGallery={setShowSnippetGallery}
        setShowToolsPanel={setShowToolsPanel}
        setViewModeWithSync={setViewModeWithSync}
        createTaskFromSelection={createTaskFromSelection}
        scanPendings={scanPendings}
      />
    );
  }, [applyToolbarVisibility, toolbarVisibility, showCompactMenu, menuPos, isFullscreen, showToolsPanel, viewMode, insertSnippet, toggleCompactMenu, toggleFullscreen, setShowCompactMenu, setShowSnippetGallery, setShowToolsPanel, setViewModeWithSync, createTaskFromSelection, isCreatingTask, scanPendings, docName, menuBtnRef]);

  // Keep ref in sync so the toolbar callback always calls the latest version
  // without recreating the plugins array (which would cause MDXEditor remount)
  renderToolbarContentsRef.current = renderToolbarContents;

  // MDXEditor plugins configuration — created once, toolbar uses a stable ref wrapper
  const editorPlugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    tablePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({ imageUploadHandler: async () => '/placeholder.png' }),
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
    directivesPlugin({
      directiveDescriptors: [AdmonitionDirectiveDescriptor]
    }),
    frontmatterPlugin(),
    toolbarPlugin({
      toolbarContents: () => renderToolbarContentsRef.current?.() ?? null
    })
  ], []);

  // ── Linter quick-fix: replace text at diagnostic position ──
  const handleLinterFix = useCallback((diag: LinterDiagnostic, replacement: string) => {
    const md = mdxEditorRef.current?.getMarkdown() ?? contentRef.current;
    const lines = md.split('\n');
    const lineIdx = diag.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];
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
  }, [handleContentChange]);

  // ── File viewer (non-markdown files) ──
  if (docType === 'file') {
    const safeName = fileName || 'Archivo';
    const lowerName = safeName.toLowerCase();
    const isImage = isImageMime(fileMime) || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName);
    const isPdf = isPdfMime(fileMime) || lowerName.endsWith('.pdf');
    const isVideo = isVideoMime(fileMime);
    const isAudio = isAudioMime(fileMime);

    return (
      <div className="flex flex-col h-full bg-slate-950 text-white">
        <div className="h-12 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            {onClose && (
              <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
            )}
            <div className="h-4 w-px bg-slate-700" />
            <span className="text-xs font-medium text-slate-400 truncate">{safeName}</span>
          </div>
          <div className="flex items-center gap-2">
            {fileUrl && (
              <>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700">
                  Abrir
                </a>
                <a href={fileUrl} download className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-500">
                  Descargar
                </a>
              </>
            )}
          </div>
        </div>
        <div className={clsx(
          'flex-1 bg-slate-900',
          isPdf ? 'min-h-0' : 'flex items-center justify-center p-4'
        )}>
          {!fileUrl && <div className="text-sm text-slate-400">No se pudo cargar el archivo.</div>}
          {fileUrl && isImage && (
            <div className="relative h-full w-full">
              <Image
                src={fileUrl}
                alt={safeName}
                fill
                unoptimized
                sizes="100vw"
                className="object-contain rounded shadow"
              />
            </div>
          )}
          {fileUrl && isVideo && <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />}
          {fileUrl && isAudio && <audio src={fileUrl} controls className="w-full max-w-xl" />}
          {fileUrl && isPdf && (
            <PdfViewer
              fileUrl={fileUrl}
              fileName={safeName}
              docId={roomId ?? undefined}
              storageKey={roomId ? `${roomId}:${fileUrl}` : fileUrl}
            />
          )}
          {fileUrl && !isPdf && !isImage && !isVideo && !isAudio && (
            <iframe src={fileUrl} className="w-full h-full min-h-[70vh] rounded border border-slate-700 bg-white" title={safeName} />
          )}
        </div>
      </div>
    );
  }

  // ── WYSIWYG Markdown Editor (tipo Obsidian) ──
  return (
    <div
      ref={editorShellRef}
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

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono shrink-0">
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
            <LinterConfigPanel />
            <span className="w-px h-3 bg-slate-700 mx-1" />
            <span>{stats.words} palabras</span>
            <span>·</span>
            <span>{stats.chars} car.</span>
            <span className="w-px h-3 bg-slate-700 mx-1" />
            {saving ? (
              <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Guardando</span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>
            )}
          </div>
        </div>
      )}

      {semanticNotice && (
        <div className="shrink-0 border-b border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
          {semanticNotice}
        </div>
      )}

      {showToolsPanel && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
          <div className="px-3 py-3">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
              <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Panel de visibilidad</h3>
                  <button
                    type="button"
                    onClick={() => applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY)}
                    className="text-[11px] text-slate-500 transition hover:text-slate-300"
                  >
                    Restaurar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TOOLBAR_GROUP_LABELS) as ToolbarGroupKey[]).map((group) => {
                    const active = toolbarVisibility[group];
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => toggleToolbarGroup(group)}
                        className={clsx(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          active
                            ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        )}
                      >
                        {TOOLBAR_GROUP_LABELS[group]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  Elige exactamente qué grupos aparecen en la barra principal: formato, bloques, listas, multimedia, inserciones, snippets y extras avanzados.
                </p>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Biblioteca de snippets</h3>
                  <button
                    type="button"
                    onClick={() => setShowSnippetGallery(s => !s)}
                    className="text-[11px] text-blue-400 transition hover:text-blue-300"
                  >
                    {showSnippetGallery ? 'Cerrar galería' : 'Abrir galería completa'}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {QUICK_INSERTS.map((snippet) => (
                    <button
                      key={snippet.id}
                      type="button"
                      onClick={() => insertSnippet(snippet.markdown)}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-left transition hover:border-blue-500/40 hover:bg-slate-900"
                    >
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                        {snippet.title}
                      </div>
                      <p className="text-[11px] leading-5 text-slate-500">{snippet.description}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Panel semántico</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">Lo que guardas desde el menú contextual vive aquí: conceptos, notas, evidencias, fijados y relaciones rápidas.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => semanticBrowserBus.open(docName || currentDocMetaRef.current.name)}
                      className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200 transition hover:bg-blue-500/20"
                    >
                      Abrir mesa semántica
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertSemanticAtlas}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      Insertar atlas
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertResearchBrief}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      Insertar bitácora
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateSTFile}
                      className="rounded-full border border-emerald-700/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                      title={companionStDocId ? 'Actualizar archivo .st companion' : 'Crear archivo .st con definiciones'}
                    >
                      {companionStDocId
                        ? <><RefreshCw className="w-3 h-3 inline mr-1" />Actualizar ST</>
                        : <><Ruler className="w-3 h-3 inline mr-1" />Generar ST</>}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">{semanticState.concepts.length} conceptos · {semanticState.fragments.length} fragmentos</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <SemanticPanelColumn
                  title="Conceptos"
                  emptyLabel="Aún no defines conceptos desde una selección."
                  items={semanticOverview.concepts.map((concept) => ({ title: concept.title, subtitle: concept.definition || concept.excerpt, meta: concept.definition ? `${concept.docName} · con def.` : concept.docName }))}
                />
                <SemanticPanelColumn
                  title="Notas"
                  emptyLabel="Todavía no hay notas rápidas guardadas."
                  items={semanticOverview.notes.map((item) => ({ title: item.note || 'Nota', subtitle: item.excerpt, meta: item.docName }))}
                />
                <SemanticPanelColumn
                  title="Fijados"
                  emptyLabel="Todavía no hay fragmentos fijados."
                  items={semanticOverview.pinned.map((item) => ({ title: item.excerpt, subtitle: item.docName, meta: 'Fragmento fijado' }))}
                />
                <SemanticPanelColumn
                  title="Evidencias"
                  emptyLabel="Todavía no hay evidencias marcadas."
                  items={semanticOverview.evidence.map((item) => ({ title: item.excerpt, subtitle: item.docName, meta: 'Evidencia' }))}
                />
                <SemanticPanelColumn
                  title="Relaciones"
                  emptyLabel="Todavía no hay relaciones con conceptos."
                  items={semanticOverview.relations.map((item) => ({ title: item.conceptTitle, subtitle: 'Fragmento relacionado', meta: item.relationType }))}
                />
              </div>
            </section>
          </div>
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
              <DynamicMDXEditor
                key={editorKey}
                ref={mdxEditorRef}
                markdown={initialMarkdown}
                onChange={handleMdxChange}
                plugins={editorPlugins}
                contentEditableClassName="mdx-content-editable"
                className="mdx-editor-root h-full"
                placeholder="Escribe aquí... Usa Markdown como en Obsidian"
              />
              <LinterPlugin
                diagnostics={allDiagnostics}
                editorShellRef={editorShellRef}
                viewMode="edit"
                content={statsContent}
                onApplyFix={handleLinterFix}
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
      {embedded && (
        <div className="shrink-0 h-7 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Markdown</span>
            <LinterConfigPanel />
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
          quickInserts={QUICK_INSERTS}
          isFullscreen={isFullscreen}
          showToolsPanel={showToolsPanel}
          showSnippetGallery={showSnippetGallery}
          viewMode={viewMode}
          onClose={closeEditorUtilityMenu}
          onToggleToolsPanel={handleToggleToolsPanelFromContextMenu}
          onOpenSemanticDesk={handleOpenSemanticDeskFromContextMenu}
          onResetToolbar={handleResetToolbarFromContextMenu}
          onToggleFullscreen={handleToggleFullscreenFromContextMenu}
          onToggleSnippetGallery={handleToggleSnippetGalleryFromContextMenu}
          onToggleRawMode={handleToggleRawModeFromContextMenu}
          onTogglePreviewMode={handleTogglePreviewFromContextMenu}
          onScanPendings={handleScanPendingsFromContextMenu}
          onInsertQuickSnippet={handleInsertQuickSnippetFromContextMenu}
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

      <style jsx global>{mosaicEditorStyles}</style>
    </div>
  );
}

function SemanticPanelColumn({
  title,
  emptyLabel,
  items
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ title: string; subtitle: string; meta: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] leading-5 text-slate-500">{emptyLabel}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-2">
              <div className="text-xs font-medium text-slate-200">{item.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-400">{item.subtitle}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.meta}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
