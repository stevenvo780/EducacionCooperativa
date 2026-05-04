import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEditorToolbarVisibility } from '@/store/dashboardSlice';
import { selectEditorToolbarVisibility } from '@/store/dashboard.selectors';
import { DEFAULT_TOOLBAR_VISIBILITY, TOOLBAR_VISIBILITY_STORAGE_KEY } from './constants';
import type { ToolbarVisibility } from './types';

interface UseEditorUIOptions {
  editorShellRef: RefObject<HTMLDivElement | null>;
  embedded: boolean;
  roomId: string;
}

export function useEditorUI({ editorShellRef, embedded, roomId }: UseEditorUIOptions) {
  const dispatch = useAppDispatch();
  const toolbarVisibility = useAppSelector(selectEditorToolbarVisibility);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSnippetGallery, setShowSnippetGallery] = useState(false);
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [rawScrollPos, setRawScrollPos] = useState({ top: 0, left: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Load toolbar visibility from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawValue = window.localStorage.getItem(TOOLBAR_VISIBILITY_STORAGE_KEY);
      if (!rawValue) return;
      const parsed = JSON.parse(rawValue) as Partial<ToolbarVisibility>;
      dispatch(setEditorToolbarVisibility({ ...DEFAULT_TOOLBAR_VISIBILITY, ...parsed }));
    } catch {}
  }, [dispatch]);

  // Persist toolbar visibility to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TOOLBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(toolbarVisibility));
    } catch {}
  }, [toolbarVisibility]);

  // Fullscreen state detection
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement;
      const frameElement = typeof window !== 'undefined' ? window.frameElement : null;
      setIsFullscreen(Boolean(
        fullscreenElement
        && (
          fullscreenElement === document.documentElement
          || fullscreenElement === document.body
          || (editorShellRef.current && (fullscreenElement === editorShellRef.current || fullscreenElement.contains(editorShellRef.current)))
          || (frameElement && (fullscreenElement === frameElement || fullscreenElement.contains(frameElement)))
        )
      ));
    };

    updateFullscreenState();
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  // embedded and roomId are used as reset signals, matching the original behavior
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, roomId]);

  const applyToolbarVisibility = useCallback((nextVisibility: ToolbarVisibility) => {
    dispatch(setEditorToolbarVisibility(nextVisibility));
  }, [dispatch]);

  const toggleCompactMenu = useCallback(() => {
    if (!showCompactMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowCompactMenu(prev => !prev);
  }, [showCompactMenu]);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Error exiting fullscreen:', err);
      }
    } else {
      const target = editorShellRef.current;
      if (target) {
        try {
          await target.requestFullscreen();
        } catch (error) {
          console.error('Error toggling fullscreen editor:', error);
          try {
            await document.documentElement.requestFullscreen();
          } catch (e2) {
            console.error('Critical fullscreen error:', e2);
          }
        }
      }
    }
  }, [editorShellRef]);

  return {
    toolbarVisibility,
    applyToolbarVisibility,
    isFullscreen,
    showSnippetGallery,
    setShowSnippetGallery,
    showCompactMenu,
    setShowCompactMenu,
    menuPos,
    rawScrollPos,
    setRawScrollPos,
    zoomLevel,
    setZoomLevel,
    menuBtnRef,
    toggleCompactMenu,
    toggleFullscreen
  };
}
