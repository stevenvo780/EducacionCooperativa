'use client';

import { useEffect } from 'react';

/**
 * Activa el polyfill de drag & drop para dispositivos táctiles. El código de
 * FileExplorer usa la HTML5 Drag API nativa (onDragStart/onDragEnd) que no
 * dispara en touch; este polyfill traduce gestos touch a eventos HTML5 drag
 * sin tocar el resto del código.
 */
export default function MobileDragDropPolyfill() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('ontouchstart' in window)) return; // solo dispositivos táctiles
        let cancelled = false;
        (async () => {
            try {
                const mod = await import('mobile-drag-drop');
                if (cancelled) return;
                mod.polyfill({
                    holdToDrag: 350,
                    dragImageTranslateOverride: undefined
                });
            } catch (e) {
                console.warn('[mobile-drag-drop] polyfill failed:', (e as Error).message);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    return null;
}
