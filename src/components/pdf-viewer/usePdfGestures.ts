import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clampZoomLevel } from './pdfStorage';

interface UsePdfGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  useIframeFallback: boolean;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
}

export function usePdfGestures({ containerRef, useIframeFallback, setZoomLevel }: UsePdfGesturesProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const lastTouchDistRef = useRef<number | null>(null);

  // Ctrl+rueda para zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || useIframeFallback) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? 1 / 1.15 : 1.15;
      setZoomLevel((current) => clampZoomLevel(Number((current * delta).toFixed(2))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, useIframeFallback, setZoomLevel]);

  // Atajos de teclado
  useEffect(() => {
    if (useIframeFallback) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        setZoomLevel((current) => clampZoomLevel(Number((current * 1.25).toFixed(2))));
      } else if (event.key === '-') {
        event.preventDefault();
        setZoomLevel((current) => clampZoomLevel(Number((current / 1.25).toFixed(2))));
      } else if (event.key === '0') {
        event.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [useIframeFallback, setZoomLevel]);

  // Arrastrar para mover (pan)
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    // Solo arrastrar con botón izquierdo y si hay overflow
    if (event.button !== 0) return;
    if (container.scrollWidth <= container.clientWidth && container.scrollHeight <= container.clientHeight) return;
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
    setIsDragging(true);
  }, [containerRef]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    container.scrollLeft = dragStartRef.current.scrollLeft - dx;
    container.scrollTop = dragStartRef.current.scrollTop - dy;
  }, [containerRef]);

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Pellizco táctil para zoom
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const t0 = event.touches[0];
      const t1 = event.touches[1];
      if (!t0 || !t1) return;
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      lastTouchDistRef.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || lastTouchDistRef.current === null) return;
    const t0 = event.touches[0];
    const t1 = event.touches[1];
    if (!t0 || !t1) return;
    event.preventDefault();
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / lastTouchDistRef.current;
    lastTouchDistRef.current = dist;
    setZoomLevel((current) => clampZoomLevel(Number((current * ratio).toFixed(2))));
  }, [setZoomLevel]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null;
  }, []);

  return {
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}
