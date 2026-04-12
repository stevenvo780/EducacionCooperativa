'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Mostramos el Toast reportando el crash inesperado en la UI
    toast.error('Error del sistema', {
      description: 'Ha ocurrido un problema al renderizar la interfaz.'
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
          <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-lg max-w-lg">
            <h2 className="text-xl font-bold text-red-500 mb-2">Algo salió mal</h2>
            <p className="text-gray-300 text-sm mb-4">
              {this.state.error?.message || 'Error inesperado al cargar esta sección.'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Intentar nuevamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
