'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import STRunner from '../STRunner';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';
import { useTerminal } from '@/context/TerminalContext';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { Loader2 } from 'lucide-react';

interface STFileEditorProps {
  docId: string;
  docName: string;
  workspaceId?: string;
}

export default function STFileEditor({ docId, docName, workspaceId }: STFileEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef(content);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const lastSyncedRef = useRef('');

  const { onDocChangeCallback } = useTerminal();
  const isPageVisible = usePageVisibility();

  // Keep refs in sync
  useEffect(() => {
    latestContent.current = content;
  }, [content]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  const fetchContent = useCallback(async () => {
    try {
      const text = await fetchDocumentRawApi(docId);
      return text ?? '';
    } catch (err) {
      console.error('[STFileEditor] Failed to fetch', docId, err);
      return null;
    }
  }, [docId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchContent()
      .then((text) => {
        if (cancelled || text === null) return;
        setContent(text);
        lastSyncedRef.current = text;
        setDirty(false);
      })
      .catch((err) => {
        console.error('[STFileEditor] Failed to load', docId, err);
        if (!cancelled) setContent('// Error al cargar el documento');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [docId, fetchContent]);

  useEffect(() => {
    if (!onDocChangeCallback || !docId) return;
    return onDocChangeCallback((event) => {
      if (event.docId !== docId) return;
      if (event.action !== 'updated' && event.action !== 'created') return;

      // Skip if we have unsaved local edits or a save is in-flight
      if (dirtyRef.current || savingRef.current) {
        return;
      }

      // Re-fetch content from API
      fetchContent().then((text) => {
        if (text === null) return;
        // Only update if content actually differs from what we have
        if (text !== latestContent.current) {
          setContent(text);
          lastSyncedRef.current = text;
          setDirty(false);
        }
      });
    });
  }, [onDocChangeCallback, docId, fetchContent]);

  useEffect(() => {
    if (!docId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ docId?: string; docName?: string }>).detail;
      /* Match by docId OR by docName (covers duplicate companion files) */
      const matchesId = detail?.docId === docId;
      const matchesName = !!docName && !!detail?.docName && detail.docName === docName;
      if (!matchesId && !matchesName) return;
      // Skip if we have unsaved local edits or a save is in-flight
      if (dirtyRef.current || savingRef.current) return;
      fetchContent().then((text) => {
        if (text === null) return;
        if (text !== latestContent.current) {
          setContent(text);
          lastSyncedRef.current = text;
          setDirty(false);
        }
      });
    };
    window.addEventListener('agora:doc-content-updated', handler);
    return () => window.removeEventListener('agora:doc-content-updated', handler);
  }, [docId, docName, fetchContent]);

  useEffect(() => {
    if (!isPageVisible || !docId || loading) return;
    // Only refresh if there are no local edits
    if (dirtyRef.current || savingRef.current) return;

    fetchContent().then((text) => {
      if (text === null) return;
      if (text !== latestContent.current) {
        setContent(text);
        lastSyncedRef.current = text;
        setDirty(false);
      }
    });
  }, [isPageVisible, docId, loading, fetchContent]);

  const scheduleAutoSave = useCallback((value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateDocumentApi(docId, { content: value });
        lastSyncedRef.current = value;
        setDirty(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agora:st-source-saved', {
            detail: { docId, docName, content: value }
          }));
        }
      } catch (err) {
        console.error('[STFileEditor] Auto-save failed', err);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [docId, docName]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setDirty(true);
    scheduleAutoSave(value);
  }, [scheduleAutoSave]);

  useEffect(() => {
    if (content) {
      const fileId = docName || docId;
      const defs = STDefinitionsRegistry.extractFromSource(content, fileId);
      STDefinitionsRegistry.setFileDefinitions(fileId, defs);
    }
    return () => {
      const fileId = docName || docId;
      STDefinitionsRegistry.removeFile(fileId);
    };
  }, [content, docId, docName]);

  const handleSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      setSaving(true);
      await updateDocumentApi(docId, { content: latestContent.current });
      lastSyncedRef.current = latestContent.current;
      setDirty(false);
    } catch (err) {
      console.error('[STFileEditor] Save failed', err);
    } finally {
      setSaving(false);
    }
  }, [docId]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
        <span className="ml-2 text-surface-400 text-sm">Cargando {docName}…</span>
      </div>
    );
  }

  return (
    <STRunner
      initialCode={content}
      workspaceId={workspaceId}
      className="h-full border-0 rounded-none"
      dockToWorkspace
      fileMode={{
        docName,
        isDirty: dirty,
        isSaving: saving,
        onSave: handleSave,
        onContentChange: handleChange
      }}
    />
  );
}
