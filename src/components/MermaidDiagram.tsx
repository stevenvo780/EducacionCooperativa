'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const LOAD_TIMEOUT = 15000;
const RENDER_TIMEOUT = 10000;

interface MermaidGlobal {
  initialize: (config: Record<string, unknown>) => void;
  run: (opts: { nodes: Element[]; suppressErrors?: boolean }) => Promise<void>;
}

let loadPromise: Promise<MermaidGlobal> | null = null;

function loadMermaid(): Promise<MermaidGlobal> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<MermaidGlobal>((resolve, reject) => {
    // Already loaded?
    const win = window as unknown as Record<string, unknown>;
    if (win.mermaid) {
      resolve(win.mermaid as unknown as MermaidGlobal);
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Timeout cargando mermaid desde CDN'));
    }, LOAD_TIMEOUT);

    const script = document.createElement('script');
    script.src = MERMAID_CDN;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      const m = win.mermaid as unknown as MermaidGlobal;
      if (!m) {
        reject(new Error('mermaid no se inicializó correctamente'));
        return;
      }
      m.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#1e293b',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#334155',
          lineColor: '#60a5fa',
          secondaryColor: '#0f172a',
          tertiaryColor: '#1e1b4b',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '14px',
          nodeBorder: '#475569',
          mainBkg: '#1e293b',
          clusterBkg: '#0f172a',
          clusterBorder: '#334155',
          edgeLabelBackground: '#0f172a',
          nodeTextColor: '#e2e8f0'
        },
        flowchart: { curve: 'basis', padding: 16 },
        sequence: { mirrorActors: false },
        gantt: { axisFormat: '%Y-%m-%d' }
      });
      resolve(m);
    };
    script.onerror = () => {
      clearTimeout(timer);
      loadPromise = null; // allow retry
      reject(new Error('No se pudo cargar mermaid desde CDN'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const renderDiagram = useCallback(async () => {
    const el = mermaidRef.current;
    if (!el) return;

    setState('loading');
    setErrorMsg('');

    try {
      const mermaid = await loadMermaid();

      // Wipe previous render and set raw mermaid code
      el.innerHTML = '';
      el.removeAttribute('data-processed');
      const pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = chart.trim();
      el.appendChild(pre);

      // Timeout race
      await Promise.race([
        mermaid.run({ nodes: [pre], suppressErrors: true }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('Timeout renderizando diagrama')), RENDER_TIMEOUT)
        )
      ]);

      setState('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      setState('error');
    }
  }, [chart]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div className="mermaid-container">
      {/* This div is exclusively managed by mermaid — React never touches its children */}
      <div ref={mermaidRef} style={{ display: state === 'ok' ? 'block' : 'none' }} />
      {state === 'loading' && (
        <div className="mermaid-loading">
          <div className="mermaid-loading-spinner" />
          <span>Renderizando diagrama…</span>
        </div>
      )}
      {state === 'error' && (
        <div className="mermaid-error">
          <div className="mermaid-error-label">⚠ Error en diagrama Mermaid</div>
          <pre className="mermaid-error-detail">{errorMsg}</pre>
          <pre className="mermaid-error-source">{chart}</pre>
        </div>
      )}
    </div>
  );
};

export default React.memo(MermaidDiagram);
