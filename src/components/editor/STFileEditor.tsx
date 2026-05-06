'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import STRunner from '../STRunner';
import { fetchDocumentRawApi, updateDocumentApi } from '@/services/dashboardApi';
import { useTerminal } from '@/context/TerminalContext';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useAuth } from '@/context/AuthContext';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { registerStatusSegment, forceUnregisterStatusSegment } from '@/lib/status-bus';
import { Loader2, Cloud, Check, Users } from 'lucide-react';
import useYjsDoc from '@/hooks/useYjsDoc';
import useRemoteDocUpdates from '@/hooks/useRemoteDocUpdates';
import RemoteUpdateBanner from '@/components/dashboard/RemoteUpdateBanner';
import { AGORA_EVENTS, dispatchAgoraEvent, subscribeAgoraEvent } from '@/lib/agora-events';

interface STFileEditorProps {
  docId: string;
  docName: string;
  workspaceId?: string;
}

export default function STFileEditor({ docId, docName, workspaceId }: STFileEditorProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef(content);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const lastSyncedRef = useRef('');

  // Modo colaborativo: requiere docId, workspaceId y user identificado.
  // El Y.Doc vive solo durante esta sesión del editor; al desmontar se libera.
  const collabEnabled = !!(docId && workspaceId && user?.uid);
  const { ydoc, awareness, status: collabStatus, provider } = useYjsDoc({
    workspaceId: workspaceId ?? null,
    docId,
    userId: user?.uid ?? null,
    displayName: user?.displayName ?? user?.email ?? null,
    enabled: collabEnabled
  });

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
    setSeedDone(false);
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

  // Seed inicial del Y.Doc con el contenido del API. Usa un mutex distribuido
  // (seedLock en RTDB) para que solo UN cliente siembre cuando el doc es nuevo
  // y los demás esperen a las updates remotas.
  useEffect(() => {
    if (!collabEnabled || !ydoc || !provider || collabStatus !== 'connected') return;
    if (seedDone) return;
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const ytext = ydoc.getText('content');
        // Si el doc remoto ya tiene contenido (cargado por bootstrap), aceptamos
        // ese estado y NO sembramos.
        if (ytext.length > 0) {
          if (!cancelled) {
            setContent(ytext.toString());
            lastSyncedRef.current = ytext.toString();
            setSeedDone(true);
          }
          return;
        }
        // Doc vacío: pelea por el lock. Solo el ganador siembra.
        const won = await provider.claimSeedLock();
        if (cancelled) return;
        if (won && latestContent.current) {
          ytext.insert(0, latestContent.current);
        }
        setSeedDone(true);
      } catch (err) {
        console.warn('[STFileEditor] seed failed', err);
        if (!cancelled) setSeedDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [collabEnabled, ydoc, provider, collabStatus, loading, seedDone]);

  // Suscribe el editor al estado del Y.Text como fuente de verdad.
  useEffect(() => {
    if (!collabEnabled || !ydoc || !seedDone) return;
    const ytext = ydoc.getText('content');
    const handler = () => {
      const next = ytext.toString();
      latestContent.current = next;
      setContent(next);
      // Solo marca dirty si difiere del último guardado en server.
      if (next !== lastSyncedRef.current) {
        setDirty(true);
        scheduleAutoSaveRef.current(next);
      }
    };
    ytext.observe(handler);
    return () => ytext.unobserve(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabEnabled, ydoc, seedDone]);

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
    return subscribeAgoraEvent(AGORA_EVENTS.docContentUpdated, (detail) => {
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
    });
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
        dispatchAgoraEvent(AGORA_EVENTS.stSourceSaved, { docId, docName, content: value });
      } catch (err) {
        console.error('[STFileEditor] Auto-save failed', err);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [docId, docName]);

  // Ref del autosave para que los effects que escuchan el Y.Text puedan
  // referenciarlo sin meterse en el dependency loop.
  const scheduleAutoSaveRef = useRef(scheduleAutoSave);
  scheduleAutoSaveRef.current = scheduleAutoSave;

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

  useEffect(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const lines = content ? content.split('\n').length : 0;
    registerStatusSegment({
      id: 'editor-stats',
      label: `${words} tokens · ${content.length} car. · ${lines} líneas`,
      slot: 'left',
      priority: 30,
      tone: 'muted',
      hideBelow: 'sm'
    });
    registerStatusSegment({
      id: 'editor-save',
      label: saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado',
      icon: saving ? Cloud : Check,
      slot: 'right',
      priority: 20,
      tone: saving ? 'info' : dirty ? 'warning' : 'success',
      title: dirty ? 'Guardar (Ctrl+S)' : 'Sin cambios pendientes',
      onClick: dirty && !saving ? handleSave : undefined
    });
    return () => {
      forceUnregisterStatusSegment('editor-stats');
      forceUnregisterStatusSegment('editor-save');
    };
  }, [content, saving, dirty, handleSave]);

  // Indicador de estado colaborativo en la status bar (solo si está activo).
  useEffect(() => {
    if (!collabEnabled) {
      forceUnregisterStatusSegment('editor-collab');
      return;
    }
    const label = collabStatus === 'connected'
      ? 'Colab en vivo'
      : collabStatus === 'connecting'
        ? 'Conectando…'
        : 'Colab offline';
    const tone: 'success' | 'info' | 'warning' = collabStatus === 'connected'
      ? 'success'
      : collabStatus === 'connecting'
        ? 'info'
        : 'warning';
    registerStatusSegment({
      id: 'editor-collab',
      label,
      icon: Users,
      slot: 'right',
      priority: 25,
      tone,
      title: 'Edición colaborativa vía Firebase'
    });
    return () => forceUnregisterStatusSegment('editor-collab');
  }, [collabEnabled, collabStatus]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
        <span className="ml-2 text-surface-400 text-sm">Cargando {docName}…</span>
      </div>
    );
  }

  const collabProp = collabEnabled && ydoc && awareness && seedDone
    ? { ydoc, awareness }
    : undefined;

  return (
    <STFileEditorView
      content={content}
      docId={docId}
      docName={docName}
      workspaceId={workspaceId}
      dirty={dirty}
      saving={saving}
      collabProp={collabProp}
      onSave={handleSave}
      onContentChange={handleChange}
      onAcceptRemote={(text) => {
        // En colab Yjs ya aplicó el cambio; aquí solo cubrimos el caso no-colab
        // donde el banner pide recargar manualmente.
        setContent(text);
        latestContent.current = text;
        lastSyncedRef.current = text;
        setDirty(false);
      }}
    />
  );
}

interface STFileEditorViewProps {
  content: string;
  docId: string;
  docName: string;
  workspaceId?: string;
  dirty: boolean;
  saving: boolean;
  collabProp?: NonNullable<Parameters<typeof STRunner>[0]['collab']>;
  onSave: () => void;
  onContentChange: (value: string) => void;
  onAcceptRemote: (next: string) => void;
}

/**
 * Vista del editor de archivos ST. Aislada en componente para poder usar
 * el hook `useRemoteDocUpdates` con dependencias estables y mostrar el
 * banner de "alguien actualizó este doc" cuando estamos en modo NO-colab.
 */
function STFileEditorView({
  content, docId, docName, workspaceId, dirty, saving, collabProp,
  onSave, onContentChange, onAcceptRemote
}: STFileEditorViewProps) {
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const collabActive = !!collabProp;

  useRemoteDocUpdates({
    docId,
    onRemoteUpdate: () => {
      // En colab Yjs maneja la sync; el banner solo aporta cuando no hay colab
      // o cuando hay cambios locales sin guardar (riesgo de overwrite).
      if (collabActive) return;
      if (dirty) setRemoteAvailable(true);
      else triggerReload();
    }
  });

  const triggerReload = useCallback(async () => {
    try {
      const text = await fetchDocumentRawApi(docId);
      if (text !== null) onAcceptRemote(text);
    } catch (err) {
      console.warn('[STFileEditor] reload failed', err);
    } finally {
      setRemoteAvailable(false);
    }
  }, [docId, onAcceptRemote]);

  return (
    <div className="flex h-full w-full flex-col">
      <RemoteUpdateBanner
        visible={remoteAvailable}
        docName={docName}
        onReload={triggerReload}
        onDismiss={() => setRemoteAvailable(false)}
      />
      <div className="flex-1 min-h-0">
        <STRunner
          initialCode={content}
          workspaceId={workspaceId}
          className="h-full border-0 rounded-none"
          dockToWorkspace
          collab={collabProp}
          fileMode={{
            docName,
            isDirty: dirty,
            isSaving: saving,
            onSave,
            onContentChange
          }}
        />
      </div>
    </div>
  );
}
