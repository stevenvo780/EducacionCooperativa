'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, hoverTooltip, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {
  autocompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete';
import {
  linter,
  lintGutter,
  type Diagnostic as CmDiagnostic
} from '@codemirror/lint';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  type LspCompletionItem,
  type LspDiagnostic
} from '@/lib/st-lsp-client';

export interface LspEditorHandle {
  focus: () => void;
  goto: (line: number, character: number) => void;
  triggerCompletion: () => void;
  setValue: (next: string) => void;
}

interface LspEditorProps {
  value: string;
  diagnostics: LspDiagnostic[];
  completions: LspCompletionItem[];
  onChange: (next: string) => void;
  onHover: (
    line: number,
    character: number,
    x: number,
    y: number
  ) => void | Promise<void>;
  onClearHover: () => void;
  onGotoDefinition: (line: number, character: number) => void | Promise<void>;
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
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(99, 102, 241, 0.12)'
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(99, 102, 241, 0.25) !important'
    },
    '.cm-focused': { outline: 'none' },
    '.cm-tooltip': {
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: '6px'
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(139, 92, 246, 0.25)'
    }
  },
  { dark: true }
);

function mapCmSeverity(s: DiagnosticSeverity): CmDiagnostic['severity'] {
  switch (s) {
    case DiagnosticSeverity.Error:
      return 'error';
    case DiagnosticSeverity.Warning:
      return 'warning';
    case DiagnosticSeverity.Hint:
      return 'hint';
    default:
      return 'info';
  }
}

function offsetFromPosition(
  doc: EditorState['doc'],
  line: number,
  character: number
): number {
  const safeLine = Math.min(Math.max(0, line), doc.lines - 1);
  const lineInfo = doc.line(safeLine + 1);
  const ch = Math.min(Math.max(0, character), lineInfo.to - lineInfo.from);
  return lineInfo.from + ch;
}

function positionFromOffset(
  doc: EditorState['doc'],
  offset: number
): { line: number; character: number } {
  const lineInfo = doc.lineAt(offset);
  return { line: lineInfo.number - 1, character: offset - lineInfo.from };
}

function completionKindToCm(kind: CompletionItemKind): Completion['type'] {
  switch (kind) {
    case CompletionItemKind.Keyword:
      return 'keyword';
    case CompletionItemKind.Snippet:
      return 'text';
    case CompletionItemKind.Function:
      return 'function';
    case CompletionItemKind.Method:
      return 'method';
    case CompletionItemKind.Variable:
      return 'variable';
    case CompletionItemKind.Constant:
      return 'constant';
    case CompletionItemKind.Operator:
      return 'property';
    default:
      return 'text';
  }
}

const LspEditor = forwardRef<LspEditorHandle, LspEditorProps>(function LspEditor(
  {
    value,
    diagnostics,
    completions,
    onChange,
    onHover,
    onClearHover,
    onGotoDefinition
  },
  ref
) {
  const cmRef = useRef<ReactCodeMirrorRef | null>(null);

  // Refs estables para que las extensiones no se recreen en cada render.
  const diagnosticsRef = useRef(diagnostics);
  const completionsRef = useRef(completions);
  const onHoverRef = useRef(onHover);
  const onClearHoverRef = useRef(onClearHover);
  const onGotoRef = useRef(onGotoDefinition);

  useEffect(() => {
    diagnosticsRef.current = diagnostics;
    // Force re-lint cuando cambian los diagnósticos.
    const view = cmRef.current?.view;
    if (view) {
      // Dispara una transacción no-op para que el linter se reevalúe.
      view.dispatch({ effects: [] });
    }
  }, [diagnostics]);
  useEffect(() => {
    completionsRef.current = completions;
  }, [completions]);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);
  useEffect(() => {
    onClearHoverRef.current = onClearHover;
  }, [onClearHover]);
  useEffect(() => {
    onGotoRef.current = onGotoDefinition;
  }, [onGotoDefinition]);

  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange]
  );

  const extensions = useMemo(() => {
    const stLinter = linter((view) => {
      const ds = diagnosticsRef.current;
      const doc = view.state.doc;
      const out: CmDiagnostic[] = [];
      for (const d of ds) {
        try {
          const from = offsetFromPosition(doc, d.range.start.line, d.range.start.character);
          const to = Math.max(
            from + 1,
            offsetFromPosition(doc, d.range.end.line, d.range.end.character)
          );
          out.push({
            from,
            to,
            severity: mapCmSeverity(d.severity),
            message: d.suggestion
              ? `${d.message}\n\nSugerencia: ${d.suggestion}`
              : d.message,
            source: d.source
          });
        } catch {
          // posición fuera de rango: ignoramos
        }
      }
      return out;
    });

    const stCompletion = autocompletion({
      override: [
        (ctx: CompletionContext): CompletionResult | null => {
          const word = ctx.matchBefore(/[\w∧∨¬→↔∀∃□◇.]+/);
          if (!word && !ctx.explicit) return null;
          const items = completionsRef.current.map<Completion>((c) => ({
            label: c.label,
            type: completionKindToCm(c.kind),
            detail: c.detail,
            info: c.documentation,
            apply: c.insertText
          }));
          const from = word ? word.from : ctx.pos;
          return {
            from,
            options: items,
            validFor: /^[\w∧∨¬→↔∀∃□◇.]*$/
          };
        }
      ],
      activateOnTyping: false,
      closeOnBlur: true
    });

    const stHoverTooltip = hoverTooltip(async (view, pos) => {
      const { line, character } = positionFromOffset(view.state.doc, pos);
      // Disparamos el hover del LSP externamente; devolvemos null porque
      // la UI muestra el popup en su propia capa (no como tooltip nativo CM)
      // para soportar Markdown sin sandbox.
      const coords = view.coordsAtPos(pos);
      if (coords) {
        void onHoverRef.current(line, character, coords.left, coords.bottom);
      }
      return null;
    });

    const customKeymap = keymap.of([
      {
        key: 'F12',
        run: (view) => {
          const pos = view.state.selection.main.head;
          const { line, character } = positionFromOffset(view.state.doc, pos);
          void onGotoRef.current(line, character);
          return true;
        }
      },
      {
        key: 'Ctrl-Space',
        mac: 'Cmd-Space',
        run: (view) => {
          startCompletion(view);
          return true;
        }
      }
    ]);

    const leaveHandler = EditorView.domEventHandlers({
      mouseleave: () => {
        onClearHoverRef.current();
        return false;
      }
    });

    return [
      baseTheme,
      EditorView.lineWrapping,
      stLinter,
      lintGutter(),
      stCompletion,
      stHoverTooltip,
      customKeymap,
      leaveHandler
    ];
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        cmRef.current?.view?.focus();
      },
      goto: (line, character) => {
        const view = cmRef.current?.view;
        if (!view) return;
        try {
          const offset = offsetFromPosition(view.state.doc, line, character);
          view.dispatch({
            selection: { anchor: offset, head: offset },
            scrollIntoView: true
          });
          view.focus();
        } catch {
          // ignoramos posiciones inválidas
        }
      },
      triggerCompletion: () => {
        const view = cmRef.current?.view;
        if (!view) return;
        startCompletion(view);
        view.focus();
      },
      setValue: (next: string) => {
        const view = cmRef.current?.view;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current === next) return;
        view.dispatch({
          changes: { from: 0, to: current.length, insert: next }
        });
      }
    }),
    []
  );

  return (
    <div className="h-full w-full min-w-0 overflow-hidden">
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={handleChange}
        theme="dark"
        extensions={extensions}
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
});

export default LspEditor;
