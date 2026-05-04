'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerEmpty, ViewerError, ViewerLoading } from '@/components/file-viewers/ViewerStates';

interface MusicXmlViewerProps {
  docName: string;
  fileUrl: string | null;
  onClose?: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; error: string };

export default function MusicXmlViewer({ docName, fileUrl, onClose }: MusicXmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!fileUrl) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        let xml = '';
        const lower = docName.toLowerCase();
        if (lower.endsWith('.musicxml') || lower.endsWith('.xml')) {
          xml = new TextDecoder().decode(buffer);
        } else {
          // .mxl o .mscz → ZIP con MusicXML interno
          const JSZipModule = (await import('jszip')).default;
          const zip = await JSZipModule.loadAsync(buffer);
          // Para .mxl: leer META-INF/container.xml para encontrar rootfile.
          if (lower.endsWith('.mxl')) {
            const container = zip.file('META-INF/container.xml');
            if (container) {
              const containerXml = await container.async('string');
              const m = containerXml.match(/full-path="([^"]+)"/);
              const rootPath = m?.[1];
              if (rootPath && zip.file(rootPath)) {
                xml = await zip.file(rootPath)!.async('string');
              }
            }
            if (!xml) {
              const candidate = Object.keys(zip.files).find((n) => /\.(musicxml|xml)$/i.test(n) && !/META-INF/i.test(n));
              if (candidate) xml = await zip.file(candidate)!.async('string');
            }
          } else {
            // .mscz: contiene un .mscx (no es MusicXML real) → mostrar mensaje
            throw new Error('Los archivos .mscz contienen formato propietario MuseScore. Exporta como .musicxml o .mxl para visualizar la partitura.');
          }
        }

        if (!xml) throw new Error('No se encontró MusicXML');
        if (cancelled) return;

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled || !containerRef.current) return;
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          backend: 'svg'
        });
        await osmd.load(xml);
        osmd.render();
        if (cancelled) return;
        setState({ kind: 'ready' });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: 'error', error: error instanceof Error ? error.message : 'Error desconocido' });
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl, docName]);

  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      {!fileUrl ? (
        <ViewerEmpty icon={Music} message="No se pudo cargar la partitura." />
      ) : (
        <div className="relative h-full bg-white">
          {(state.kind === 'loading' || state.kind === 'idle') && (
            <div className="absolute inset-0 z-10 bg-white">
              <ViewerLoading label="Renderizando partitura..." />
            </div>
          )}
          {state.kind === 'error' && (
            <ViewerError message={state.error} hint="No se pudo renderizar la partitura" />
          )}
          <div ref={containerRef} className="h-full overflow-auto p-6" />
        </div>
      )}
    </FileViewerShell>
  );
}
