declare module '@mdxeditor/editor/dist/plugins/codeblock/CodeBlockNode.js' {
  export function useCodeBlockEditorContext(): {
    parentEditor: {
      update: (fn: () => void) => void;
      dispatchCommand: (command: unknown, payload: unknown) => void;
    };
    lexicalNode: {
      remove: () => void;
      setLanguage: (language: string) => void;
      setMeta: (meta: string) => void;
      getLatest: () => { select: () => void };
    };
    setCode: (code: string) => void;
    setLanguage: (language: string) => void;
    setMeta: (meta: string) => void;
  };
}
