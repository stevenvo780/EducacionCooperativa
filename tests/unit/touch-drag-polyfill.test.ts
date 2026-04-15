import { afterEach, describe, expect, it, vi } from 'vitest';

import { destroyTouchDragPolyfill, initTouchDragPolyfill } from '@/lib/touch-drag-polyfill';

type TouchLike = {
  clientX: number;
  clientY: number;
  target: EventTarget | null;
};

function createTouchEvent(type: string, touch: TouchLike): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  const touches = type === 'touchend' ? [] : [touch];

  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: touches
  });
  Object.defineProperty(event, 'changedTouches', {
    configurable: true,
    value: [touch]
  });

  return event;
}

describe('touch drag polyfill', () => {
  afterEach(() => {
    destroyTouchDragPolyfill();
    document.body.innerHTML = '';
  });

  it('starts touch dragging from sources that only expose data-drag-doc-id', () => {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: null
    });

    const source = document.createElement('div');
    source.setAttribute('data-drag-doc-id', 'doc-1');
    source.setAttribute('data-drag-label', 'Documento 1');

    const child = document.createElement('button');
    child.textContent = 'Mover';
    source.appendChild(child);

    const dropZone = document.createElement('div');
    dropZone.setAttribute('data-drop-zone', 'doc-2');
    dropZone.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })) as typeof dropZone.getBoundingClientRect;

    document.body.append(source, dropZone);

    const elementFromPoint = vi.fn(() => dropZone);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    const dragStart = vi.fn();
    const drop = vi.fn();
    window.addEventListener('agora:touch-drag-start', dragStart);
    window.addEventListener('agora:touch-drop', drop);

    initTouchDragPolyfill();

    document.dispatchEvent(createTouchEvent('touchstart', { clientX: 20, clientY: 20, target: child }));
    document.dispatchEvent(createTouchEvent('touchmove', { clientX: 100, clientY: 100, target: child }));
    document.dispatchEvent(createTouchEvent('touchend', { clientX: 100, clientY: 100, target: child }));

    expect(dragStart).toHaveBeenCalledTimes(1);
    expect((dragStart.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ docId: 'doc-1' });
    expect(drop).toHaveBeenCalledTimes(1);
    expect((drop.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      docId: 'doc-1',
      tileId: 'doc-2',
      position: 'replace'
    });

    window.removeEventListener('agora:touch-drag-start', dragStart);
    window.removeEventListener('agora:touch-drop', drop);
  });

  it('bridges native drag handlers on touch with a synthetic dataTransfer payload', () => {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: null
    });

    const source = document.createElement('button');
    source.setAttribute('draggable', 'true');
    source.textContent = 'Reordenar';
    source.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-doc-reorder', 'doc-9');
      event.dataTransfer?.setData('text/plain', 'doc-9');
    });

    const dragOver = vi.fn((event: DragEvent) => {
      event.preventDefault();
    });
    const drop = vi.fn((event: DragEvent) => {
      event.preventDefault();
    });

    const dropZone = document.createElement('div');
    dropZone.addEventListener('dragover', dragOver);
    dropZone.addEventListener('drop', drop);
    document.body.append(source, dropZone);

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => dropZone)
    });

    initTouchDragPolyfill();

    document.dispatchEvent(createTouchEvent('touchstart', { clientX: 20, clientY: 20, target: source }));
    document.dispatchEvent(createTouchEvent('touchmove', { clientX: 80, clientY: 80, target: source }));
    document.dispatchEvent(createTouchEvent('touchmove', { clientX: 120, clientY: 120, target: source }));
    document.dispatchEvent(createTouchEvent('touchend', { clientX: 120, clientY: 120, target: source }));

    expect(dragOver).toHaveBeenCalled();
    expect(drop).toHaveBeenCalledTimes(1);
    expect(drop.mock.calls[0]?.[0].dataTransfer?.types).toContain('application/x-doc-reorder');
    expect(drop.mock.calls[0]?.[0].dataTransfer?.getData('application/x-doc-reorder')).toBe('doc-9');
    expect(drop.mock.calls[0]?.[0].dataTransfer?.getData('text/plain')).toBe('doc-9');
  });

  it('resolves layout drop zones by geometry even when elementFromPoint misses the tile shell', () => {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: null
    });

    const source = document.createElement('div');
    source.setAttribute('data-drag-doc-id', 'doc-1');
    source.textContent = 'Documento';

    const unrelated = document.createElement('div');
    unrelated.textContent = 'overlay';

    const dropZone = document.createElement('div');
    dropZone.setAttribute('data-drop-zone', 'doc-2');
    dropZone.getBoundingClientRect = vi.fn(() => ({
      left: 40,
      top: 40,
      right: 240,
      bottom: 240,
      width: 200,
      height: 200,
      x: 40,
      y: 40,
      toJSON: () => ({})
    })) as typeof dropZone.getBoundingClientRect;

    document.body.append(source, dropZone, unrelated);

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => unrelated)
    });

    const drop = vi.fn();
    window.addEventListener('agora:touch-drop', drop);

    initTouchDragPolyfill();

    document.dispatchEvent(createTouchEvent('touchstart', { clientX: 20, clientY: 20, target: source }));
    document.dispatchEvent(createTouchEvent('touchmove', { clientX: 120, clientY: 120, target: source }));
    document.dispatchEvent(createTouchEvent('touchend', { clientX: 120, clientY: 120, target: source }));

    expect(drop).toHaveBeenCalledTimes(1);
    expect((drop.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      docId: 'doc-1',
      tileId: 'doc-2',
      position: 'replace'
    });

    window.removeEventListener('agora:touch-drop', drop);
  });

  it('falls back to the last hovered layout zone when touchend misses the tile', () => {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: null
    });

    const source = document.createElement('div');
    source.setAttribute('data-drag-doc-id', 'doc-1');
    source.textContent = 'Documento';

    const dropZone = document.createElement('div');
    dropZone.setAttribute('data-drop-zone', 'doc-2');
    dropZone.getBoundingClientRect = vi.fn(() => ({
      left: 40,
      top: 40,
      right: 240,
      bottom: 240,
      width: 200,
      height: 200,
      x: 40,
      y: 40,
      toJSON: () => ({})
    })) as typeof dropZone.getBoundingClientRect;

    document.body.append(source, dropZone);

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((x: number, y: number) => {
        if (x === 120 && y === 120) return dropZone;
        return document.body;
      })
    });

    const drop = vi.fn();
    window.addEventListener('agora:touch-drop', drop);

    initTouchDragPolyfill();

    document.dispatchEvent(createTouchEvent('touchstart', { clientX: 20, clientY: 20, target: source }));
    document.dispatchEvent(createTouchEvent('touchmove', { clientX: 120, clientY: 120, target: source }));
    document.dispatchEvent(createTouchEvent('touchend', { clientX: 280, clientY: 280, target: source }));

    expect(drop).toHaveBeenCalledTimes(1);
    expect((drop.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      docId: 'doc-1',
      tileId: 'doc-2',
      position: 'replace'
    });

    window.removeEventListener('agora:touch-drop', drop);
  });
});
