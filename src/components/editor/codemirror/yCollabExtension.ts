'use client';

import { yCollab } from 'y-codemirror.next';
import type { Extension } from '@codemirror/state';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Extension de CodeMirror 6 que sincroniza el contenido con
 * `ydoc.getText('content')` y muestra los cursores remotos vía Awareness.
 */
export function buildCollabExtension(
  ydoc: Y.Doc,
  awareness: Awareness
): Extension {
  const ytext = ydoc.getText('content');
  return yCollab(ytext, awareness);
}
