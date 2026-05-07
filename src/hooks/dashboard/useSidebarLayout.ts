'use client';

import { useCallback, useEffect, useState } from 'react';

const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 600;
const SIDEBAR_DEFAULT_WIDTH = 260;
const LAST_WIDTH_STORAGE_KEY = 'agora:sidebar-last-width';

export function readPersistedSidebarWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(LAST_WIDTH_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(Math.max(parsed, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

export interface UseSidebarLayoutResult {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isResizingSidebar: boolean;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  startResizingSidebar: (event: React.MouseEvent) => void;
  stopResizingSidebar: () => void;
}

/**
 * Estado y handlers de la sidebar resizable del dashboard. Encapsula:
 *   - Ancho con clamp [160, 600] px.
 *   - Drag/resize por mouse (escucha global mientras dura el drag).
 *   - Colapso/expansión.
 *   - Aplicación visual del estado de drag al `<body>` (cursor + class).
 *
 * Uso:
 *   const sidebar = useSidebarLayout();
 *   <div onMouseDown={sidebar.startResizingSidebar} ... />
 */
export function useSidebarLayout(initialWidth?: number): UseSidebarLayoutResult {
  const [sidebarWidth, setSidebarWidthState] = useState(() => initialWidth ?? readPersistedSidebarWidth());
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const setSidebarWidth = useCallback((width: number) => {
    if (!Number.isFinite(width)) return;
    const clamped = Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
    setSidebarWidthState(clamped);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(LAST_WIDTH_STORAGE_KEY, String(clamped)); } catch { /* noop */ }
    }
  }, []);

  const startResizingSidebar = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const stopResizingSidebar = useCallback(() => {
    setIsResizingSidebar(false);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(LAST_WIDTH_STORAGE_KEY, String(sidebarWidth)); } catch { /* noop */ }
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const onMove = (event: MouseEvent) => {
      const newWidth = event.clientX;
      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
        setSidebarWidthState(newWidth);
      }
    };
    const onUp = () => setIsResizingSidebar(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('sidebar-resizing-active', isResizingSidebar);
    document.body.style.cursor = isResizingSidebar ? 'col-resize' : '';
    return () => {
      document.body.classList.remove('sidebar-resizing-active');
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar]);

  return {
    sidebarWidth,
    setSidebarWidth,
    isResizingSidebar,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    startResizingSidebar,
    stopResizingSidebar
  };
}
