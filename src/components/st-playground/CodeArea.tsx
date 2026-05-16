'use client';

import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';

interface CodeAreaProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}

const baseTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      height: '100%'
    },
    '.cm-content': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Code", "Source Code Pro", monospace',
      fontSize: '13px',
      caretColor: '#a78bfa'
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

export default function CodeArea({ value, onChange, ariaLabel }: CodeAreaProps) {
  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange],
  );

  return (
    <div className="h-full w-full overflow-hidden" aria-label={ariaLabel}>
      <CodeMirror
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
        style={{ height: '100%' }}
      />
    </div>
  );
}
