'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import STCodeEditor from './STCodeEditor';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';
import { Save, Loader2, Play } from 'lucide-react';
import { transpile } from '@stevenvo780/st-lang';

interface STFileEditorProps {
  docId: string;
  docName: string;
}

interface RunResultOk { ok: true; output: string }
interface RunResultErr { ok: false; error: string }
type RunResult = RunResultOk | RunResultErr;

export default function STFileEditor({ docId, docName }: STFileEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);
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

  // ── Run ST code ──
  const handleRun = useCallback(() => {
    try {
      const result = transpile(latestContent.current);
      setRunResult({ ok: true, output: JSON.stringify(result, null, 2) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunResult({ ok: false, error: msg });
    }
    setShowOutput(true);
  }, []);

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Ctrl+Enter → run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }, [handleSave, handleRun]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#1a1b26]">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
        <span className="ml-2 text-surface-400 text-sm">Cargando {docName}…</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#1a1b26]">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/80 border-b border-surface-700/50 shrink-0">
        <span className="text-xs text-surface-400 font-mono truncate flex-1">
          {docName}
        </span>

        <button
          onClick={handleRun}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition"
          title="Ejecutar (Ctrl+Enter)"
        >
          <Play className="w-3 h-3" /> Ejecutar
        </button>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
            dirty
              ? 'bg-sky-600/20 text-sky-400 hover:bg-sky-600/30'
              : 'bg-surface-700/30 text-surface-500'
          }`}
          title="Guardar (Ctrl+S)"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
        </button>
      </div>

      {/* ── Editor ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <STCodeEditor
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="// Escribe tu código ST aquí..."
          className="h-full"
        />
      </div>

      {/* ── Output panel ── */}
      {showOutput && runResult && (
        <div className="shrink-0 border-t border-surface-700/50 max-h-[30%] overflow-auto">
          <div className="flex items-center justify-between px-3 py-1 bg-surface-800/80">
            <span className={`text-xs font-medium ${runResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {runResult.ok ? '✓ Resultado' : '✗ Error'}
            </span>
            <button
              onClick={() => setShowOutput(false)}
              className="text-surface-500 hover:text-surface-300 text-xs"
            >
              Cerrar
            </button>
          </div>
          <pre className={`px-3 py-2 text-xs font-mono whitespace-pre-wrap ${
            runResult.ok ? 'text-surface-300' : 'text-red-300'
          }`}>
            {runResult.ok ? runResult.output : runResult.error}
          </pre>
        </div>
      )}
    </div>
  );
}
