'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import STRunner from '../STRunner';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';
import { Loader2 } from 'lucide-react';

interface STFileEditorProps {
  docId: string;
  docName: string;
}

export default function STFileEditor({ docId, docName }: STFileEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef(content);

  // Keep ref in sync
  useEffect(() => {
    latestContent.current = content;
  }, [content]);

  // ── Load document content ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDocumentRawApi(docId)
      .then((text) => {
        if (!cancelled) {
          setContent(text ?? '');
          setDirty(false);
        }
      })
      .catch((err) => {
        console.error('[STFileEditor] Failed to load', docId, err);
        if (!cancelled) setContent('// Error al cargar el documento');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [docId]);

  // ── Auto-save with debounce (2s) ──
  const scheduleAutoSave = useCallback((value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateDocumentApi(docId, { content: value });
        setDirty(false);
      } catch (err) {
        console.error('[STFileEditor] Auto-save failed', err);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [docId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // ── Handle change ──
  const handleChange = useCallback((value: string) => {
    setContent(value);
    setDirty(true);
    scheduleAutoSave(value);
  }, [scheduleAutoSave]);

  // ── Manual save (Ctrl+S) ──
  const handleSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      setSaving(true);
      await updateDocumentApi(docId, { content: latestContent.current });
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
      className="h-full border-0 rounded-none"
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
