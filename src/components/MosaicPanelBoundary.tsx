'use client';

import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface MosaicPanelBoundaryProps {
  children: React.ReactNode;
  panelId: string;
  panelName: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class MosaicPanelBoundary extends React.Component<MosaicPanelBoundaryProps, State> {
  state: State = { hasError: false, error: null };

  private alreadyReported = false;

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void info;
    if (this.alreadyReported || typeof window === 'undefined') return;
    this.alreadyReported = true;
    void import('@/lib/diagnostics-bus').then((m) => {
      m.publishDiagnostics(`mosaic-panel:${this.props.panelId}`, 'global', [{
        severity: 'error',
        message: `Falló el panel del mosaico ${this.props.panelName}: ${error.message}`,
        detail: error.stack
      }]);
    }).catch(() => undefined);
  }

  componentDidUpdate(prevProps: MosaicPanelBoundaryProps): void {
    if (prevProps.panelId !== this.props.panelId && this.state.hasError) {
      this.alreadyReported = false;
      this.setState({ hasError: false, error: null });
    }
  }

  reset = () => {
    this.alreadyReported = false;
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-900 px-6 py-4 text-center text-xs text-surface-300">
        <AlertTriangle className="h-6 w-6 text-rose-400" />
        <div>
          <p className="text-sm font-medium text-surface-100">Panel {this.props.panelName} no disponible</p>
          <p className="mt-1 text-[11px] text-surface-500">
            {this.state.error?.message ?? 'Error inesperado al renderizar el panel.'}
          </p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded border border-surface-700 px-2 py-1 text-surface-200 transition hover:border-mandy-500/40 hover:text-white"
        >
          <RotateCw className="h-3 w-3" />
          Reintentar este panel
        </button>
      </div>
    );
  }
}
