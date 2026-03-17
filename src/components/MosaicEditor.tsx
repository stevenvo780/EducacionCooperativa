'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  MDXEditor,
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
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  HighlightToggle,
  InsertAdmonition,
  InsertFrontmatter,
  InsertImage,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  InsertCodeBlock,
  StrikeThroughSupSubToggles,
  UndoRedo,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEditorToolbarVisibility } from '@/store/dashboardSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';
import type { ViewMode, SearchState, EditorProps, ToolbarGroupKey, ToolbarVisibility, MarkdownDocMeta } from '@/components/mosaic-editor/types';
import { TOOLBAR_VISIBILITY_STORAGE_KEY, DEFAULT_TOOLBAR_VISIBILITY, TOOLBAR_GROUP_LABELS, QUICK_INSERTS } from '@/components/mosaic-editor/constants';
import {
  isMarkdownName, isMarkdownMime, isImageMime, isVideoMime, isAudioMime, isPdfMime,
  stripQueryAndHash, isExternalMarkdownHref, isBrowserNavigationHref,
  normalizeRelativeMarkdownPath, ensureMarkdownCandidateNames,
  buildWorkspaceAwarePathCandidates, extractWorkspaceSegments
} from '@/components/mosaic-editor/utils';
import { MarkdownPreview } from '@/components/mosaic-editor/MarkdownPreview';
import { ToolbarShortcutButton, TableGridPicker } from '@/components/mosaic-editor/ToolbarControls';
import { useKatexOverlayDecorations } from '@/components/mosaic-editor/useKatexOverlayDecorations';
import { mosaicEditorStyles } from '@/components/mosaic-editor/styles';
import { Check, Cloud, Search, ArrowUp, ArrowDown, X, Settings2, Sparkles, MoreHorizontal, Maximize2, Minimize2, Monitor, PenLine, FileCode2, Quote, ListTodo, Sigma, Library, KanbanSquare, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';
import SnippetGallery from '@/components/SnippetGallery';
import { authFetch, getAuthToken } from '@/services/apiClient';
import { createBoardCardApi, fetchBoardApi } from '@/services/boardApi';
import type { BoardCard } from '@/components/dashboard/types';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useEditorSelectionActions } from '@/hooks/useEditorSelectionActions';
import { normalizePath } from '@/lib/folder-utils';
import { EditorSelectionMenu } from '@/components/editor/EditorSelectionMenu';
import {
  attachLinkedDocumentToSelection,
  getRecentSemanticItems,
  loadSemanticWorkspaceState,
  markSelectionAsEvidence,
  pinSelectionFragment,
  registerConceptFromSelection,
  registerSemanticBlock,
  relateSelectionToConcept,
  type SemanticWorkspaceState
} from '@/services/editorSemanticStore';

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
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [docName, setDocName] = useState('');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('personal');
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [semanticState, setSemanticState] = useState<SemanticWorkspaceState>({ concepts: [], fragments: [], relations: [], updatedAt: 0 });
  const [semanticNotice, setSemanticNotice] = useState<string | null>(null);
  const [semanticBusyAction, setSemanticBusyAction] = useState<string | null>(null);
  const [linkableDocuments, setLinkableDocuments] = useState<Array<{ id: string; name: string; folder?: string }>>([]);
  const [loadingLinkableDocuments, setLoadingLinkableDocuments] = useState(false);

  // Search state
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setInternalSearchTerm;
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const lastReportedSearchStateRef = useRef<SearchState | null>(null);
  const renderToolbarContentsRef = useRef<(() => React.ReactNode) | null>(null);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const dispatch = useAppDispatch();
  const toolbarVisibility = useAppSelector(selectEditorToolbarVisibility);
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
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showSnippetGallery, setShowSnippetGallery] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<BoardCard[]>([]);

  const semanticStoreContext = useMemo(() => ({
    workspaceId: currentWorkspaceId || 'personal',
    userId: user?.uid ?? null
  }), [currentWorkspaceId, user?.uid]);

  const semanticOverview = useMemo(() => getRecentSemanticItems(semanticState), [semanticState]);

  const {
    selection: semanticSelection,
    restoreSelection,
    clearSelection: clearSemanticSelection
  } = useEditorSelectionActions({
    editorShellRef,
    docId: roomId ?? null,
    enabled: docType !== 'file' && viewMode !== 'preview'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawValue = window.localStorage.getItem(TOOLBAR_VISIBILITY_STORAGE_KEY);
      if (!rawValue) return;
      const parsed = JSON.parse(rawValue) as Partial<ToolbarVisibility>;
      dispatch(setEditorToolbarVisibility({ ...DEFAULT_TOOLBAR_VISIBILITY, ...parsed }));
    } catch {
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TOOLBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(toolbarVisibility));
    } catch {
    }
  }, [toolbarVisibility]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement;
      const frameElement = typeof window !== 'undefined' ? window.frameElement : null;
      setIsFullscreen(Boolean(
        fullscreenElement
        && (
          fullscreenElement === document.documentElement
          || fullscreenElement === document.body
          || fullscreenElement === editorShellRef.current
          || fullscreenElement === frameElement
        )
      ));
    };

    updateFullscreenState();
    document.addEventListener('fullscreenchange', updateFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
    };
  }, [embedded, roomId]);

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
    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime('');
    setCurrentWorkspaceId('personal');
    setEditorContent('');
    currentDocMetaRef.current = { workspaceId: null, folder: '', name: '' };
    hasLoadedRef.current = true;
  }, [setEditorContent]);

  const maybeLoadRawContent = useCallback(async (key: string | null) => {
    if (!roomId || !key) return;
    if (rawLoadInFlightRef.current || key === lastRawKeyRef.current) return;
    rawLoadInFlightRef.current = true;
    lastRawKeyRef.current = key;
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
    }
  }, [roomId, setEditorContent]);

  const applyDocData = useCallback((data: any) => {
    if (!data) {
      if (!hasUnsavedLocalChanges()) {
        resetDocState();
      }
      return;
    }

    const type = data.type ?? 'text';
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
    setCurrentWorkspaceId(workspaceId || 'personal');

    if (type === 'file' && !isMarkdown) {
      setDocType('file');
      setFileUrl(url);
      setFileName(name || 'Archivo');
      setFileMime(mimeType);
      setDocName(name || 'Archivo');
      contentRef.current = '';
      setStatsContent('');
      hasLoadedRef.current = true;
      return;
    }

    setDocType('text');
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
    } else if (type === 'file' && (url || storagePath)) {
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

  useEffect(() => {
    setSemanticState(loadSemanticWorkspaceState(semanticStoreContext));
  }, [semanticStoreContext]);

  useEffect(() => {
    if (!semanticNotice) return;
    const timeout = window.setTimeout(() => setSemanticNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [semanticNotice]);

  useEffect(() => {
    setLinkableDocuments([]);
  }, [currentWorkspaceId, roomId]);

  const loadDoc = useCallback(async () => {
    if (!roomId) return;
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

  // SSE stream for real-time updates
  useEffect(() => {
    if (embedded) return;
    if (!roomId || !isPageVisible) return;
    const controller = new AbortController();
    let cancelled = false;

    const init = async () => {
      const token = await getAuthToken();
      if (cancelled) return;

      try {
        const res = await fetch(`/api/documents/${roomId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });

        if (!res.ok) throw new Error('Stream connection failed');
        if (!res.body) throw new Error('No body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data?.type === 'snapshot') {
                  applyDocData(data.data);
                } else if (data?.type === 'deleted') {
                  resetDocState();
                }
              } catch (_e) { /* ignore parse errors */ }
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError' && !cancelled) {
          console.error('Stream error:', e);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [embedded, roomId, loadDoc, applyDocData, resetDocState, isPageVisible]);

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
    if (!roomId || docType === 'file') return;
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
            type: 'text',
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
    }, 700);
  }, [roomId, user?.uid, docType]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

  // Notify parent of search state changes
  useEffect(() => {
    if (!onSearchStateChange) return;
    const nextState = { currentMatch, totalMatches };
    const previousState = lastReportedSearchStateRef.current;
    if (previousState && previousState.currentMatch === nextState.currentMatch && previousState.totalMatches === nextState.totalMatches) {
      return;
    }
    lastReportedSearchStateRef.current = nextState;
    onSearchStateChange(nextState);
  }, [currentMatch, totalMatches, onSearchStateChange]);

  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
    if (totalMatches === 0) return;
    setCurrentMatch(prev => {
      let next = direction === 'next' ? prev + 1 : prev - 1;
      if (next >= totalMatches) next = 0;
      if (next < 0) next = totalMatches - 1;
      return next;
    });
  }, [totalMatches]);

  useEffect(() => {
    if (searchNavRef) {
      searchNavRef.current = {
        next: () => navigateSearch('next'),
        prev: () => navigateSearch('prev')
      };
    }
    return () => {
      if (searchNavRef) searchNavRef.current = null;
    };
  }, [searchNavRef, totalMatches, navigateSearch]);

  const stats = useMemo(() => {
    const trimmed = statsContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words, chars: statsContent.length };
  }, [statsContent]);

  const enabledToolbarGroupsCount = useMemo(
    () => Object.values(toolbarVisibility).filter(Boolean).length,
    [toolbarVisibility]
  );

  const applyToolbarVisibility = useCallback((nextVisibility: ToolbarVisibility) => {
    dispatch(setEditorToolbarVisibility(nextVisibility));
  }, [dispatch]);

  const toggleToolbarGroup = useCallback((group: ToolbarGroupKey) => {
    applyToolbarVisibility({
      ...toolbarVisibility,
      [group]: !toolbarVisibility[group]
    });
  }, [applyToolbarVisibility, toolbarVisibility]);

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
          workspaceIdsToSearch.add('personal');
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
        const matchedDoc = await findDocInWorkspace('personal', cleanedHref);
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

  const updateSemanticState = useCallback((nextState: SemanticWorkspaceState) => {
    setSemanticState(nextState);
  }, []);

  const getSemanticPayload = useCallback((text: string) => ({
    text,
    docId: roomId ?? null,
    docName: docName || currentDocMetaRef.current.name || 'Documento',
    workspaceId: currentWorkspaceId || 'personal'
  }), [currentWorkspaceId, docName, roomId]);

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
        workspaceId: currentWorkspaceId || 'personal',
        view: 'list',
        excludeContent: 'true'
      });
      const res = await authFetch(`/api/documents?${search.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('No se pudo cargar la lista de documentos');
      }
      const docs = await res.json() as Array<{ id: string; name?: string; folder?: string; type?: string }>;
      setLinkableDocuments(
        docs
          .filter((doc) => doc.id !== roomId && doc.type !== 'folder')
          .map((doc) => ({ id: doc.id, name: doc.name || 'Documento', folder: doc.folder || '' }))
      );
    } catch (error) {
      console.error('Error loading linkable documents:', error);
      setSemanticNotice('No pude cargar documentos para enlazar.');
    } finally {
      setLoadingLinkableDocuments(false);
    }
  }, [currentWorkspaceId, linkableDocuments.length, loadingLinkableDocuments, roomId]);

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
      const workspaceId = currentDocMetaRef.current.workspaceId || 'personal';
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
      const workspaceId = currentDocMetaRef.current.workspaceId || 'personal';
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
      const workspaceId = currentDocMetaRef.current.workspaceId || 'personal';
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
    void runSemanticAction('define-concept', () => {
      const nextState = registerConceptFromSelection(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Concepto registrado desde la selección.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  const handleRelateConcept = useCallback((conceptId: string) => {
    if (!semanticSelection) return;
    void runSemanticAction('relate-concept', () => {
      const nextState = relateSelectionToConcept(semanticStoreContext, getSemanticPayload(semanticSelection.text), conceptId);
      updateSemanticState(nextState);
      setSemanticNotice('Fragmento relacionado con el concepto elegido.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  const handleCreateSemanticBlock = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('semantic-block', () => {
      const quoted = semanticSelection.text
        .split(/\r?\n/)
        .map((line) => `> ${line || ' '}`)
        .join('\n');
      const blockMarkdown = `${semanticSelection.text}\n\n> [!semantic] Fragmento académico\n${quoted}\n> origen: ${docName || 'Documento actual'}\n`;
      const inserted = applySelectionMarkdown(blockMarkdown);
      if (!inserted) {
        throw new Error('Selection block insertion failed');
      }
      const nextState = registerSemanticBlock(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Bloque semántico insertado en el documento.');
      clearSemanticSelection();
    });
  }, [applySelectionMarkdown, clearSemanticSelection, docName, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  const handleCreateTask = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('create-task', async () => {
      const board = await fetchBoardApi({ workspaceId: currentWorkspaceId || 'personal' });
      const targetColumn = board.columns.find((column) => /por hacer|to do|todo/i.test(column.name)) ?? board.columns[0];
      if (!targetColumn) {
        throw new Error('No board columns available');
      }
      const title = semanticSelection.text.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Fragmento del editor';
      await createBoardCardApi({
        workspaceId: currentWorkspaceId || 'personal',
        columnId: targetColumn.id,
        title,
        description: `Origen: ${docName || 'Documento'}\n\n${semanticSelection.text}`,
        ownerId: user?.uid ?? null,
        sourceDocId: roomId || undefined,
        sourceDocName: docName || 'Documento',
        sourceFragment: semanticSelection.text
      });
      setSemanticNotice(`Fragmento enviado a “${targetColumn.name}”.`);
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, currentWorkspaceId, docName, roomId, runSemanticAction, semanticSelection, user?.uid]);

  const handleMarkEvidence = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('mark-evidence', () => {
      const nextState = markSelectionAsEvidence(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Evidencia guardada en el panel semántico.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  const handlePinFragment = useCallback(() => {
    if (!semanticSelection) return;
    void runSemanticAction('pin-fragment', () => {
      const nextState = pinSelectionFragment(semanticStoreContext, getSemanticPayload(semanticSelection.text));
      updateSemanticState(nextState);
      setSemanticNotice('Fragmento fijado para acceso rápido.');
      clearSemanticSelection();
    });
  }, [clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  const handleLinkDocument = useCallback((documentItem: { id: string; name: string; folder?: string }) => {
    if (!semanticSelection) return;
    void runSemanticAction('link-document', () => {
      const markdownLink = `[${semanticSelection.text}](/editor/${encodeURIComponent(documentItem.id)})`;
      const inserted = applySelectionMarkdown(markdownLink);
      if (!inserted) {
        throw new Error('Document link insertion failed');
      }
      const nextState = attachLinkedDocumentToSelection(
        semanticStoreContext,
        getSemanticPayload(semanticSelection.text),
        documentItem.id,
        documentItem.name
      );
      updateSemanticState(nextState);
      setSemanticNotice(`Enlace interno creado hacia “${documentItem.name}”.`);
      clearSemanticSelection();
    });
  }, [applySelectionMarkdown, clearSemanticSelection, getSemanticPayload, runSemanticAction, semanticSelection, semanticStoreContext, updateSemanticState]);

  // Obsidian-style inline LaTeX rendering (extracted to hook)
  useKatexOverlayDecorations({ editorShellRef, viewMode });

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;

    const target = document.documentElement;

    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen editor:', error);
    }
  }, []);

  const renderToolbarContents = useCallback(() => {
    const sections: React.ReactNode[] = [];

    const pushSection = (key: ToolbarGroupKey, content: React.ReactNode) => {
      if (!toolbarVisibility[key]) return;
      if (sections.length > 0) {
        sections.push(<Separator key={`separator-${key}`} />);
      }
      sections.push(<React.Fragment key={key}>{content}</React.Fragment>);
    };

    pushSection('history', <UndoRedo />);
    pushSection('inline', (
      <>
        <BoldItalicUnderlineToggles />
        <CodeToggle />
        <HighlightToggle />
        <StrikeThroughSupSubToggles options={['Strikethrough', 'Sub', 'Sup']} />
      </>
    ));
    pushSection('structure', (
      <>
        <BlockTypeSelect />
        <ToolbarShortcutButton
          title="Insertar cita"
          icon={<Quote className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n> Escribe una cita aquí\n')}
        />
      </>
    ));
    pushSection('lists', (
      <>
        <ListsToggle />
        <ToolbarShortcutButton
          title="Insertar lista de tareas"
          icon={<ListTodo className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n- [ ] Primera tarea\n- [ ] Segunda tarea\n')}
        />
        <ToolbarShortcutButton
          title="Crear tarea en tablero"
          icon={isCreatingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KanbanSquare className="h-3.5 w-3.5" />}
          onClick={() => { void createTaskFromSelection(); }}
          disabled={isCreatingTask}
        />
        <ToolbarShortcutButton
          title="Detectar pendientes en texto"
          icon={isCreatingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          onClick={() => { void scanPendings(); }}
          disabled={isCreatingTask}
        />
      </>
    ));
    pushSection('media', (
      <>
        <CreateLink />
        <InsertImage />
      </>
    ));
    pushSection('insert', (
      <>
        <TableGridPicker portalContainer={editorShellRef.current} onInsert={(rows, cols) => {
          const header = `| ${Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ')} |`;
          const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
          const body = Array.from({ length: rows - 1 }, () =>
            `| ${Array.from({ length: cols }, () => '   ').join(' | ')} |`
          ).join('\n');
          const tableMd = `\n${header}\n${sep}\n${body}\n`;
          insertSnippet(tableMd);
        }} />
        <InsertThematicBreak />
        <InsertCodeBlock />
      </>
    ));
    pushSection('snippets', (
      <>
        <ToolbarShortcutButton
          title="LaTeX en línea"
          icon={<Sigma className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('$E = mc^2$')}
        />
        <ToolbarShortcutButton
          title="Bloque LaTeX"
          icon={<Sigma className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n')}
        />
        <ToolbarShortcutButton
          title="Galería de snippets"
          icon={<Library className="h-3.5 w-3.5" />}
          onClick={() => setShowSnippetGallery(s => !s)}
        />
      </>
    ));
    pushSection('advanced', (
      <>
        <InsertAdmonition />
        <InsertFrontmatter />
      </>
    ));

    return (
      <>
        {/* ── Custom controls ── */}
        <div className="relative shrink-0" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setShowCompactMenu(c => !c)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="Más opciones"
            aria-label="Más opciones del editor"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewModeWithSync(viewMode === 'raw' ? 'edit' : 'raw')}
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
              viewMode === 'raw'
                ? 'bg-violet-600/25 text-violet-300 hover:bg-violet-600/35'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
            aria-label={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
            aria-pressed={viewMode === 'raw'}
          >
            {viewMode === 'raw' ? <PenLine className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setViewModeWithSync(viewMode === 'preview' ? 'edit' : 'preview')}
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
              viewMode === 'preview'
                ? 'bg-blue-600/25 text-blue-300 hover:bg-blue-600/35'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title={viewMode === 'preview' ? 'Volver a editar' : 'Vista previa (LaTeX, Mermaid)'}
            aria-label={viewMode === 'preview' ? 'Volver al editor' : 'Abrir vista previa renderizada'}
            aria-pressed={viewMode === 'preview'}
          >
            {viewMode === 'preview' ? <PenLine className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        {showCompactMenu && ReactDOM.createPortal(
          <div
            className="table-grid-popover"
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99998 }}
            onClick={() => setShowCompactMenu(false)}
          >
            <div
              style={{ position: 'fixed', top: 34, left: 8, zIndex: 99999 }}
              className="min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" title={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} aria-label={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} onClick={() => { setShowToolsPanel(c => !c); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Settings2 className="h-3.5 w-3.5 text-slate-400" />{showToolsPanel ? 'Ocultar herramientas' : 'Editar herramientas'}
              </button>
              <button type="button" title="Restaurar todos los botones de la barra" aria-label="Restaurar todos los botones de la barra" onClick={() => { applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />Restaurar barra completa
              </button>
              <button type="button" title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} onClick={() => { void toggleFullscreen(); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-slate-400" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-400" />}
                {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
              </button>
              <div className="my-1 h-px bg-slate-700" />
              <button type="button" title="Abrir galería de snippets" aria-label="Abrir galería de snippets" onClick={() => { setShowSnippetGallery(s => !s); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Library className="h-3.5 w-3.5 text-blue-400" />Galería de snippets
              </button>
              {QUICK_INSERTS.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  title={snippet.title}
                  aria-label={snippet.title}
                  onClick={() => { insertSnippet(snippet.markdown); setShowCompactMenu(false); }}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Sparkles className="h-3 w-3 text-blue-400" />{snippet.title}
                </button>
              ))}
            </div>
          </div>,
          editorShellRef.current ?? document.body
        )}

        {/* ── MDXEditor toolbar groups ── */}
        {sections}
      </>
    );
  }, [applyToolbarVisibility, toolbarVisibility, showCompactMenu, isFullscreen, showToolsPanel, viewMode, insertSnippet, toggleFullscreen, setShowCompactMenu, setShowToolsPanel, setViewModeWithSync, createTaskFromSelection, isCreatingTask, scanPendings]);

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
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
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
        <div className="flex-1 p-4 bg-slate-900 flex items-center justify-center">
          {!fileUrl && <div className="text-sm text-slate-400">No se pudo cargar el archivo.</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {fileUrl && isImage && <img src={fileUrl} alt={safeName} className="max-h-full max-w-full rounded shadow" />}
          {fileUrl && isVideo && <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />}
          {fileUrl && isAudio && <audio src={fileUrl} controls className="w-full max-w-xl" />}
          {fileUrl && !isImage && !isVideo && !isAudio && (
            <iframe src={fileUrl} className={`w-full h-full border border-slate-700 rounded bg-white ${isPdf ? '' : 'min-h-[70vh]'}`} title={safeName} />
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
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">Lo que guardas desde el menú contextual vive aquí: conceptos, evidencias, fijados y relaciones rápidas.</p>
                </div>
                <div className="text-[11px] text-slate-500">{semanticState.concepts.length} conceptos · {semanticState.fragments.length} fragmentos</div>
              </div>

              <div className="grid gap-3 lg:grid-cols-4">
                <SemanticPanelColumn
                  title="Conceptos"
                  emptyLabel="Aún no defines conceptos desde una selección."
                  items={semanticOverview.concepts.map((concept) => ({ title: concept.title, subtitle: concept.excerpt, meta: concept.docName }))}
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
              workspaceId={currentDocMetaRef.current.workspaceId || 'personal'}
              onInsert={(md: string) => { insertSnippet(md); }}
              onClose={() => setShowSnippetGallery(false)}
            />
          </div>
        )}

        {/* ── Editor area ── */}
        <div className="flex-1 relative overflow-hidden">
          {viewMode === 'preview' ? (
            <>
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('edit')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30"
                  title="Volver al editor visual"
                  aria-label="Volver al editor visual"
                >
                  <PenLine className="h-3 w-3" />
                  Editor visual
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('raw')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-600/15 px-3 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25"
                  title="Ver Markdown puro"
                  aria-label="Ver Markdown puro"
                >
                  <FileCode2 className="h-3 w-3" />
                  Markdown puro
                </button>
                <span className="text-[11px] text-slate-500">Vista previa — LaTeX, Mermaid y tablas se renderizan aquí</span>
              </div>
              <MarkdownPreview content={statsContent || contentRef.current} onOpenInternalLink={openInternalMarkdownLink} />
            </>
          ) : viewMode === 'raw' ? (
            <>
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('edit')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30"
                  title="Volver al editor visual"
                  aria-label="Volver al editor visual"
                >
                  <PenLine className="h-3 w-3" />
                  Editor visual
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeWithSync('preview')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-600/15 px-3 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25"
                  title="Abrir vista previa renderizada"
                  aria-label="Abrir vista previa renderizada"
                >
                  <Monitor className="h-3 w-3" />
                  Vista previa
                </button>
                <span className="text-[11px] text-slate-500">Markdown puro — aquí ves y editas el texto exacto del documento</span>
              </div>
              <textarea
                value={statsContent}
                onChange={(event) => handleContentChange(event.target.value)}
                spellCheck={false}
                className="markdown-raw-textarea h-full w-full resize-none border-0 bg-slate-950/95 px-5 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none"
                placeholder="# Markdown puro\n\nEscribe aquí el contenido exacto del documento..."
              />
            </>
          ) : (
            <MDXEditor
              key={editorKey}
              ref={mdxEditorRef}
              markdown={initialMarkdown}
              onChange={handleMdxChange}
              plugins={editorPlugins}
              contentEditableClassName="mdx-content-editable"
              className="mdx-editor-root h-full"
              placeholder="Escribe aquí... Usa Markdown como en Obsidian"
            />
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
            <span>{stats.words} palabras</span>
            <span>{stats.chars} car.</span>
          </div>
          <div className="flex items-center gap-2">
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
          onCreateSemanticBlock={handleCreateSemanticBlock}
          onCreateTask={handleCreateTask}
          onMarkEvidence={handleMarkEvidence}
          onPinFragment={handlePinFragment}
          onOpenConcepts={() => undefined}
          onOpenDocuments={() => { void loadDocumentsForSemanticLinking(); }}
          onRelateConcept={handleRelateConcept}
          onLinkDocument={handleLinkDocument}
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

function ChevronLeft(props: any) {
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
