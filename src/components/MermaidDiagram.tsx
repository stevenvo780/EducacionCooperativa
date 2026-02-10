'use client';

import React, { useEffect, useRef, useState, useId } from 'react';

let mermaidInstance: typeof import('mermaid')['default'] | null = null;
let mermaidInitPromise: Promise<void> | null = null;

function ensureMermaid(): Promise<void> {
  if (mermaidInstance) return Promise.resolve();
  if (mermaidInitPromise) return mermaidInitPromise;

  mermaidInitPromise = import('mermaid').then((mod) => {
    mermaidInstance = mod.default;
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e293b',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#334155',
        lineColor: '#60a5fa',
        secondaryColor: '#0f172a',
        tertiaryColor: '#1e1b4b',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
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
  });

  return mermaidInitPromise;
}

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        await ensureMermaid();
        if (cancelled || !mermaidInstance) return;

        const { svg: rendered } = await mermaidInstance.render(
          `mermaid-${uniqueId}-${Date.now()}`,
          chart.trim()
        );

        if (!cancelled) {
          setSvg(rendered);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al renderizar diagrama');
          setSvg('');
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [chart, uniqueId]);

  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-label">⚠ Error en diagrama Mermaid</div>
        <pre className="mermaid-error-detail">{error}</pre>
        <pre className="mermaid-error-source">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-loading">
        <div className="mermaid-loading-spinner" />
        <span>Renderizando diagrama…</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default React.memo(MermaidDiagram);
