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

// Mutex: mermaid.render() is NOT safe for concurrent calls — serialize them
let renderQueue: Promise<void> = Promise.resolve();
function queueRender<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    renderQueue = renderQueue.then(() => fn().then(resolve, reject), () => fn().then(resolve, reject));
  });
}

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
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          // Light node backgrounds — ensures dark text is readable
          primaryColor: '#dbeafe',
          primaryTextColor: '#0f172a',
          primaryBorderColor: '#3b82f6',
          lineColor: '#60a5fa',
          secondaryColor: '#e0f2fe',
          tertiaryColor: '#f0f9ff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '14px',
          nodeBorder: '#3b82f6',
          mainBkg: '#dbeafe',
          nodeTextColor: '#0f172a',
          // Clusters/subgraphs — dark to contrast with light nodes
          clusterBkg: '#1e293b',
          clusterBorder: '#475569',
          // Edge labels — on dark container bg
          edgeLabelBackground: '#1e293b',
          // Extra
          background: '#0f172a',
          titleColor: '#e2e8f0',
          actorTextColor: '#0f172a',
          actorBkg: '#dbeafe',
          actorBorder: '#3b82f6',
          signalColor: '#e2e8f0',
          signalTextColor: '#0f172a',
          labelBoxBkgColor: '#dbeafe',
          labelBoxBorderColor: '#3b82f6',
          labelTextColor: '#0f172a',
          noteBkgColor: '#fef3c7',
          noteBorderColor: '#f59e0b',
          noteTextColor: '#0f172a',
          sectionBkgColor: '#1e293b',
          sectionBkgColor2: '#0f172a',
          altSectionBkgColor: '#1e293b',
          taskBkgColor: '#dbeafe',
          taskTextColor: '#0f172a',
          taskBorderColor: '#3b82f6',
          activeTaskBkgColor: '#bfdbfe',
          activeTaskBorderColor: '#2563eb',
          gridColor: '#475569',
          doneTaskBkgColor: '#bbf7d0',
          doneTaskBorderColor: '#16a34a',
          critBkgColor: '#fecaca',
          critBorderColor: '#dc2626',
          todayLineColor: '#f59e0b',
          // Pie chart
          pie1: '#3b82f6',
          pie2: '#f59e0b',
          pie3: '#10b981',
          pie4: '#ef4444',
          pie5: '#8b5cf6',
          pie6: '#ec4899',
          pie7: '#06b6d4',
          pie8: '#f97316',
          pieTitleTextSize: '16px',
          pieTitleTextColor: '#e2e8f0',
          pieSectionTextSize: '14px',
          pieSectionTextColor: '#0f172a',
          pieLegendTextSize: '14px',
          pieLegendTextColor: '#e2e8f0',
          pieStrokeColor: '#0f172a',
          // State diagram
          labelColor: '#e2e8f0',
          altBackground: '#1e293b'
        },
        flowchart: { curve: 'basis', padding: 16, htmlLabels: true, useMaxWidth: true },
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
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [svgHtml, setSvgHtml] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const idRef = useRef(0);

  const renderDiagram = useCallback(async () => {
    setState('loading');
    setSvgHtml('');
    setErrorMsg('');

    try {
      const mermaid = await loadMermaid();

      // Unique ID per render (mermaid requires unique IDs)
      idRef.current += 1;
      const id = `mmd-${Date.now()}-${idRef.current}`;

      // render() is NOT safe for concurrent calls — use mutex queue
      const { svg } = await queueRender(() =>
        Promise.race([
          mermaid.render(id, chart.trim()),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('Timeout renderizando diagrama')), RENDER_TIMEOUT)
          )
        ])
      );

      if (!svg || !svg.includes('<svg')) {
        throw new Error('Mermaid no generó SVG válido');
      }

      // Store SVG in React state so it survives re-renders
      setSvgHtml(svg);
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
      {state === 'ok' && svgHtml && (
        <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
      )}
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
