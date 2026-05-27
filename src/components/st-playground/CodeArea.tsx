'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject
} from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';

export interface CodeAreaHandle {
  setValue: (next: string) => void;
}

interface CodeAreaProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  editorRef?: MutableRefObject<CodeAreaHandle | null>;
}

const baseTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      height: '100%',
      width: '100%',
      minWidth: '0'
    },
    '.cm-scroller': {
      width: '100%',
      minWidth: '0',
      overflowX: 'auto'
    },
    '.cm-content': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Code", "Source Code Pro", monospace',
      fontSize: '13px',
      caretColor: '#a78bfa',
      minWidth: '0'
    },
    '.cm-gutters': {
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      color: '#64748b',
      border: 'none'
    },
    '.cm-activeLine': { backgroundColor: 'rgba(99, 102, 241, 0.08)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(99, 102, 241, 0.12)' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(99, 102, 241, 0.25) !important' },
    '.cm-focused': { outline: 'none' }
  },
  { dark: true },
);

export default function CodeArea({
  value,
  onChange,
  ariaLabel,
  editorRef
}: CodeAreaProps) {
  const cmRef = useRef<ReactCodeMirrorRef | null>(null);

  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange],
  );

  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      setValue: (next: string) => {
        const view = cmRef.current?.view;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current === next) return;
        view.dispatch({
          changes: { from: 0, to: current.length, insert: next }
        });
      }
    };
    return () => {
      editorRef.current = null;
    };
  }, [editorRef]);

  return (
    <div className="h-full w-full min-w-0 overflow-hidden" aria-label={ariaLabel}>
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={handleChange}
        theme="dark"
        extensions={[baseTheme, EditorView.lineWrapping]}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: false,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: false
        }}
        height="100%"
        width="100%"
        style={{ height: '100%', width: '100%', minWidth: '0' }}
      />
    </div>
  );
}
