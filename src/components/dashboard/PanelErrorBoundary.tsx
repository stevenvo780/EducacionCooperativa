'use client';

import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface PanelErrorBoundaryProps {
  children: React.ReactNode;
  /** Identificador del panel para mensajes (ej. "Agora AI", "Esquema"). */
  name: string;
  /** Acción opcional al hacer click en "Reintentar". */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Aisla un panel del crash global. Si el render del panel lanza, el
 * boundary muestra un mensaje con botón "Reintentar" en lugar de
 * tumbar todo el dashboard. El stack se publica al diagnostics-bus.
 */
export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, State> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void info;
    if (typeof window !== 'undefined') {
      void import('@/lib/diagnostics-bus').then((m) => {
        m.publishDiagnostics(`panel:${this.props.name}`, 'global', [{
          severity: 'error',
          message: `Falló el panel ${this.props.name}: ${error.message}`,
          detail: error.stack
        }]);
      });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-xs text-surface-300 bg-surface-900">
        <AlertTriangle className="h-6 w-6 text-rose-400" />
        <div>
          <p className="text-sm font-medium text-surface-100">El panel {this.props.name} falló</p>
          <p className="mt-1 text-[11px] text-surface-500">{this.state.error?.message ?? 'Error desconocido'}</p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="flex items-center gap-1.5 rounded border border-surface-700 px-2 py-1 text-surface-200 transition hover:border-mandy-500/40 hover:text-white"
        >
          <RotateCw className="h-3 w-3" />
          Reintentar
        </button>
      </div>
    );
  }
}
