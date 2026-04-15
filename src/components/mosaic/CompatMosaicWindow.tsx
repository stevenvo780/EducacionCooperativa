'use client';

import classNames from 'classnames';
import React, { useCallback, useContext, useMemo, useRef } from 'react';
import { useDrag, useDrop, type DropTargetMonitor } from 'react-dnd';
import type { MosaicWindowProps } from 'react-mosaic-component/lib/MosaicWindow';
import { MosaicContext } from 'react-mosaic-component/lib/contextTypes';
import type { MosaicDragItem, MosaicDropData, MosaicDropTargetPosition } from 'react-mosaic-component/lib/internalTypes';
import { MosaicDropTarget } from 'react-mosaic-component/lib/MosaicDropTarget';
import { MosaicDragType, type MosaicKey } from 'react-mosaic-component/lib/types';
import { createDragToUpdates } from 'react-mosaic-component/lib/util/mosaicUpdates';

const DROP_POSITIONS: MosaicDropTargetPosition[] = ['top', 'bottom', 'left', 'right'];

const dropLastPathSegment = <T,>(value: T[]) => value.slice(0, -1);

const pathsAreEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => {
  if (left.length !== right.length) return false;
  return left.every((part, index) => part === right[index]);
};

export function CompatMosaicWindow<T extends MosaicKey = string>({
  title,
  path,
  children,
  className,
  toolbarControls,
  renderToolbar,
  draggable = true,
  renderPreview,
  onDragStart,
  onDragEnd
}: MosaicWindowProps<T>) {
  const { mosaicActions, mosaicId } = useContext(MosaicContext);
  const rootElementRef = useRef<HTMLDivElement | null>(null);
  const toolbarElementRef = useRef<HTMLDivElement | null>(null);
  const previewElementRef = useRef<HTMLDivElement | null>(null);

  const draggableAndNotRoot = Boolean(draggable && path.length > 0);

  const defaultPreview = useMemo(() => {
    if (renderPreview) return renderPreview({ title, path, children, className, toolbarControls, renderToolbar, draggable, renderPreview, onDragStart, onDragEnd });
    return (
      <div className="mosaic-preview">
        <div className="mosaic-window-toolbar">
          <div className="mosaic-window-title">{title}</div>
        </div>
        <div className="mosaic-window-body">
          <h4>{title}</h4>
        </div>
      </div>
    );
  }, [children, className, draggable, onDragEnd, onDragStart, path, renderPreview, renderToolbar, title, toolbarControls]);

  const [, dragRef, previewRef] = useDrag<MosaicDragItem>({
    type: MosaicDragType.WINDOW,
    item: () => {
      onDragStart?.();
      const hideTimer = window.setTimeout(() => mosaicActions.hide(path), 0);
      return { mosaicId, hideTimer };
    },
    end: (item, monitor) => {
      const { hideTimer } = item;
      window.clearTimeout(hideTimer);

      const dropResult = (monitor.getDropResult() || {}) as MosaicDropData;
      const { position, path: destinationPath } = dropResult;

      if (position !== null && position !== undefined && destinationPath !== null && destinationPath !== undefined && !pathsAreEqual(destinationPath, path)) {
        mosaicActions.updateTree(createDragToUpdates(mosaicActions.getRoot()!, path, destinationPath, position));
        onDragEnd?.('drop');
        return;
      }

      mosaicActions.updateTree([
        {
          path: dropLastPathSegment(path),
          spec: {
            splitPercentage: {
              $set: undefined
            }
          }
        }
      ]);
      onDragEnd?.('reset');
    }
  });

  const [{ isOver, draggedMosaicId }, dropRef] = useDrop({
    accept: MosaicDragType.WINDOW,
    collect: (monitor: DropTargetMonitor<MosaicDragItem>) => ({
      isOver: monitor.isOver(),
      draggedMosaicId: monitor.getItem()?.mosaicId
    })
  });

  const setRootRef = useCallback((element: HTMLDivElement | null) => {
    rootElementRef.current = element;
    dropRef(element);
  }, [dropRef]);

  const setToolbarRef = useCallback((element: HTMLDivElement | null) => {
    toolbarElementRef.current = element;
    if (draggableAndNotRoot) {
      dragRef(element);
    }
  }, [dragRef, draggableAndNotRoot]);

  const setPreviewElementRef = useCallback((element: HTMLDivElement | null) => {
    previewElementRef.current = element;
    previewRef(element);
  }, [previewRef]);

  const toolbar = renderToolbar
    ? renderToolbar({ title, path, children, className, toolbarControls, renderToolbar, draggable, renderPreview, onDragStart, onDragEnd }, draggable)
    : null;

  return (
    <div
      ref={setRootRef}
      className={classNames('mosaic-window mosaic-drop-target', className, {
        'drop-target-hover': isOver && draggedMosaicId === mosaicId
      })}
    >
      <div ref={setToolbarRef} className={classNames('mosaic-window-toolbar', { draggable: draggableAndNotRoot })}>
        {toolbar ?? (
          <>
            <div title={title} className="mosaic-window-title">{title}</div>
            {toolbarControls && <div className="mosaic-window-controls">{toolbarControls}</div>}
          </>
        )}
      </div>

      <div className="mosaic-window-body">{children}</div>

      <div
        ref={setPreviewElementRef}
        style={{ position: 'fixed', top: -10000, left: -10000, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {defaultPreview}
      </div>

      <div className="drop-target-container">
        {DROP_POSITIONS.map((position) => (
          <MosaicDropTarget key={position} position={position} path={path} />
        ))}
      </div>
    </div>
  );
}
