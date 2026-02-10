'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const LOAD_TIMEOUT = 15000;
const RENDER_TIMEOUT = 10000;

interface MermaidGlobal {
  initialize: (config: Record<string, unknown>) => void;
  run: (opts: { nodes: Element[]; suppressErrors?: boolean }) => Promise<void>;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
}

let loadPromise: Promise<MermaidGlobal> | null = null;

// Mermaid render() needs a visible sandbox in the DOM for SVG dimension calculations
function ensureSandbox(): void {
  if (document.getElementById('mermaid-sandbox')) return;
  const sandbox = document.createElement('div');
  sandbox.id = 'mermaid-sandbox';
  sandbox.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:2000px;height:2000px;visibility:hidden;z-index:-1;';
  document.body.appendChild(sandbox);
}

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
      ensureSandbox();
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const idRef = useRef(0);

  const renderDiagram = useCallback(async () => {
    setState('loading');
    setErrorMsg('');

    try {
      const mermaid = await loadMermaid();

      // Unique ID per render (mermaid requires unique IDs)
      idRef.current += 1;
      const id = `mmd-${Date.now()}-${idRef.current}`;

      // render() works in memory — no need for a visible DOM node
      const { svg } = await Promise.race([
        mermaid.render(id, chart.trim()),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('Timeout renderizando diagrama')), RENDER_TIMEOUT)
        )
      ]);

      if (!svg || !svg.includes('<svg')) {
        throw new Error('Mermaid no generó SVG válido');
      }

      // Inject SVG into container
      const el = containerRef.current;
      if (el) {
        el.innerHTML = svg;
      }

      setState('ok');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMsg(msg);
      setState('error');
    }
  }, [chart]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div className="mermaid-container">
      <div ref={containerRef} style={{ display: state === 'ok' ? 'block' : 'none' }} />
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
