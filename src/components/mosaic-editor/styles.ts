export const mosaicEditorStyles = `
        /* ─── MDXEditor Dark Theme ─── */
        .mdx-editor-dark .mdxeditor {
          --baseTextContrast-color: #e2e8f0;
          --baseBg: #0f172a;
          --baseBorder: #334155;
          --baseBgSubtle: #1e293b;
          --baseBgActive: #334155;
          --baseBgHover: #1e293b;
          --baseTextSubtle-color: #94a3b8;
          --baseText-color: #e2e8f0;
          --accentBase-color: #3b82f6;
          --accentBgSubtle-color: #1e3a5f;
          --accentText-color: #60a5fa;
          --accentSolid-color: #3b82f6;
          --accentTextContrast-color: #ffffff;
          --admonitionTipBg: rgba(34, 197, 94, 0.08);
          --admonitionTipBorder: #22c55e;
          --admonitionInfoBg: rgba(59, 130, 246, 0.08);
          --admonitionInfoBorder: #3b82f6;
          --admonitionCautionBg: rgba(234, 179, 8, 0.08);
          --admonitionCautionBorder: #eab308;
          --admonitionDangerBg: rgba(239, 68, 68, 0.08);
          --admonitionDangerBorder: #ef4444;
          --admonitionNoteBg: rgba(168, 85, 247, 0.08);
          --admonitionNoteBorder: #a855f7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e2e8f0;
          background: #0f172a;
        }

        .mdx-editor-dark .mdxeditor,
        .mdx-editor-dark [class*="_toolbarRoot"] {
          background: #0f172a !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark toolbar,
        .mdx-editor-dark [role="toolbar"],
        .mdx-editor-dark [class*="_toolbar"] {
          background: #1e293b !important;
          border-bottom: 1px solid #334155 !important;
          padding: 2px 4px !important;
          min-height: 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent !important;
          -ms-overflow-style: auto !important;
          justify-content: flex-start !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar {
          height: 8px !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar-thumb,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar-thumb,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45) !important;
          border-radius: 999px !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar-track,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar-track,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent !important;
          -ms-overflow-style: auto !important;
          justify-content: flex-start !important;
          scrollbar-gutter: stable !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"]::-webkit-scrollbar {
          height: 8px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"]::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45) !important;
          border-radius: 999px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] > div {
          flex-wrap: nowrap !important;
          align-items: center !important;
          width: max-content !important;
          min-width: max-content !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] {
          padding: 2px 3px !important;
          min-width: 24px !important;
          min-height: 24px !important;
          height: 24px !important;
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          outline: none !important;
          text-decoration: none !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleSingleGroup"],
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleSingleGroupButton"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-state],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-orientation],
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toolbarToggle"],
        .mdx-editor-dark [class*="_toolbarRoot"] > *,
        .mdx-editor-dark [class*="_toolbarRoot"] > * > *,
        .mdx-editor-dark [class*="_toolbarRoot"] > * > * > * {
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          text-decoration: none !important;
          outline: none !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          width: 14px !important;
          height: 14px !important;
        }

        .mdx-editor-dark .lucide {
          fill: none !important;
          stroke: currentColor !important;
          stroke-width: 2.2 !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_selectTrigger"] {
          padding: 1px 5px !important;
          height: 24px !important;
          font-size: 11px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_separator"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="separator"] {
          height: 16px !important;
          margin: 0 3px !important;
          width: 1px !important;
          border: none !important;
          background: #334155 !important;
          display: inline-block !important;
          flex-shrink: 0 !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleGroupRoot"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="group"] {
          gap: 0 !important;
        }

        .scrollbar-none::-webkit-scrollbar { height: 8px; width: 8px; }
        .scrollbar-none { -ms-overflow-style: auto; scrollbar-width: thin; }

        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"],
        .mdx-editor-dark [class*="_toolbarRoot"] button *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] span,
        .mdx-editor-dark [class*="_toolbarRoot"] label,
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          color: #94a3b8 !important;
          fill: none !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] button:hover *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover * {
          background: #334155 !important;
          color: #e2e8f0 !important;
          fill: none !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"] * {
          background: #3b82f6 !important;
          color: #ffffff !important;
          fill: none !important;
        }

        .mdx-editor-dark [class*="_selectTrigger"],
        .mdx-editor-dark [class*="_selectContent"],
        .mdx-editor-dark select {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_selectTrigger"] *,
        .mdx-editor-dark [class*="_selectContent"] *,
        .mdx-editor-dark [class*="_selectItem"] *,
        .mdx-editor-dark [data-radix-popper-content-wrapper] *,
        .mdx-editor-dark [role="listbox"] *,
        .mdx-editor-dark [role="option"] * {
          color: #e2e8f0 !important;
          fill: currentColor !important;
        }

        .mdx-editor-dark [class*="_selectItem"]:hover,
        .mdx-editor-dark [class*="_selectItem"][data-highlighted] {
          background: #334155 !important;
        }

        .mdx-editor-dark [class*="_selectTrigger"] svg,
        .mdx-editor-dark [class*="_toolbarRoot"] svg,
        .mdx-editor-dark [data-radix-popper-content-wrapper] svg {
          color: #cbd5e1 !important;
          fill: none !important;
          stroke: currentColor !important;
        }

        .mdx-editor-dark .mdxeditor,
        .mdx-editor-dark .mdxeditor > div,
        .mdx-editor-dark [class*="_rootContentEditableWrapper"],
        .mdx-editor-dark [class*="_contentEditable"] {
          min-width: 0 !important;
        }

        .mdx-editor-dark .mdxeditor :where([data-radix-popper-content-wrapper]) {
          z-index: 100000 !important;
        }

        .markdown-preview-container,
        .markdown-raw-textarea,
        .mdx-content-editable {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
        }

        .markdown-preview-container::-webkit-scrollbar,
        .markdown-raw-textarea::-webkit-scrollbar,
        .mdx-content-editable::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .markdown-preview-container::-webkit-scrollbar-thumb,
        .markdown-raw-textarea::-webkit-scrollbar-thumb,
        .mdx-content-editable::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45);
          border-radius: 999px;
        }

        .markdown-preview-container::-webkit-scrollbar-track,
        .markdown-raw-textarea::-webkit-scrollbar-track,
        .mdx-content-editable::-webkit-scrollbar-track {
          background: transparent;
        }

        .table-grid-popover button {
          padding: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: auto !important;
        }

        .mdx-content-editable {
          color: #e2e8f0;
          font-size: 15px;
          line-height: 1.75;
          padding: 0.9rem 2rem 1.5rem;
          min-height: 100%;
          max-width: 100%;
          outline: none;
          caret-color: #60a5fa;
        }

        .mdx-content-editable > :first-child {
          margin-top: 0 !important;
        }

        .mdx-content-editable h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 0.6em 0 0.5em;
          color: #f1f5f9;
          border-bottom: 1px solid #334155;
          padding-bottom: 0.3em;
        }

        .mdx-content-editable h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.8em 0 0.4em;
          color: #f1f5f9;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 0.2em;
        }

        .mdx-content-editable h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.7em 0 0.3em;
          color: #e2e8f0;
        }

        .mdx-content-editable h4,
        .mdx-content-editable h5,
        .mdx-content-editable h6 {
          font-weight: 600;
          margin: 0.6em 0 0.3em;
          color: #cbd5e1;
        }

        .mdx-content-editable p {
          margin: 0.5em 0;
        }

        .mdx-content-editable,
        .markdown-preview-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: var(--preview-font-size, 15px);
          line-height: 1.75;
          letter-spacing: 0;
          word-break: break-word;
        }

        .mdx-content-editable a {
          color: #60a5fa;
          text-decoration: underline;
          text-decoration-color: rgba(96, 165, 250, 0.4);
          transition: text-decoration-color 0.2s;
        }

        .mdx-content-editable a:hover {
          text-decoration-color: #60a5fa;
        }

        .mdx-content-editable strong {
          color: #f1f5f9;
          font-weight: 600;
        }

        .mdx-content-editable em {
          color: #cbd5e1;
        }

        .mdx-content-editable code {
          background: #1e293b;
          color: #f472b6;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: 'Fira Code', 'JetBrains Mono', monospace;
        }

        .mdx-content-editable pre {
          background: #1e293b !important;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 1em;
          margin: 1em 0;
          overflow-x: auto;
        }

        .mdx-content-editable pre code {
          background: transparent !important;
          color: #e2e8f0;
          padding: 0;
          font-size: 0.88em;
        }

        .mdx-content-editable blockquote {
          border-left: 4px solid #3b82f6;
          margin: 1em 0;
          padding: 0.5em 1em;
          background: rgba(59, 130, 246, 0.05);
          color: #94a3b8;
        }

        .mdx-content-editable blockquote p {
          margin: 0.3em 0;
        }

        .mdx-content-editable ul,
        .mdx-content-editable ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }

        .mdx-content-editable li {
          margin: 0.25em 0;
        }

        .mdx-content-editable li::marker {
          color: #64748b;
        }

        .mdx-content-editable ul li {
          list-style-type: disc;
        }

        .mdx-content-editable ol li {
          list-style-type: decimal;
        }

        .mdx-content-editable hr {
          border: none;
          border-top: 1px solid #334155;
          margin: 1.5em 0;
        }

        .mdx-content-editable table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }

        .mdx-content-editable th,
        .mdx-content-editable td {
          border: 1px solid #334155;
          padding: 0.5em 0.75em;
          text-align: left;
        }

        .mdx-content-editable th {
          background: #1e293b;
          font-weight: 600;
          color: #f1f5f9;
        }

        .mdx-content-editable td {
          background: #0f172a;
        }

        .mdx-content-editable tr:hover td {
          background: #1e293b;
        }

        .mdx-content-editable img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1em 0;
        }

        .mdx-content-editable input[type="checkbox"] {
          accent-color: #3b82f6;
          margin-right: 0.5em;
        }

        .mdx-editor-root.h-full {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .mdx-editor-root.h-full .mdxeditor {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .mdx-editor-root.h-full [class*="_rootContentEditableWrapper"],
        .mdx-editor-root.h-full [class*="_contentEditable"] {
          flex: 1;
          overflow-y: auto;
        }

        .mdx-content-editable::-webkit-scrollbar,
        .mdx-editor-root ::-webkit-scrollbar {
          width: 8px;
        }

        .mdx-content-editable::-webkit-scrollbar-track,
        .mdx-editor-root ::-webkit-scrollbar-track {
          background: #0f172a;
        }

        .mdx-content-editable::-webkit-scrollbar-thumb,
        .mdx-editor-root ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }

        .mdx-content-editable::-webkit-scrollbar-thumb:hover,
        .mdx-editor-root ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        .mdx-editor-dark .cm-editor {
          background: #0f172a !important;
          height: 100% !important;
        }

        .mdx-editor-dark .cm-gutters {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark .cm-activeLineGutter {
          background: #334155 !important;
        }

        .mdx-editor-dark .cm-activeLine {
          background: rgba(59, 130, 246, 0.05) !important;
        }

        .mdx-editor-dark .cm-content {
          color: #e2e8f0 !important;
          caret-color: #60a5fa !important;
        }

        .mdx-editor-dark .cm-cursor {
          border-left-color: #60a5fa !important;
        }

        .mdx-editor-dark .cm-line {
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark .cm-gutterElement {
          color: #475569 !important;
        }

        .mdx-editor-dark .cm-selectionBackground {
          background: rgba(59, 130, 246, 0.2) !important;
        }

        .mdx-editor-dark [class*="_dialogContent"],
        .mdx-editor-dark [class*="_popoverContent"],
        .mdx-editor-dark [class*="_dialogOverlay"] + div {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_dialogContent"] input,
        .mdx-editor-dark [class*="_popoverContent"] input {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_primaryButton"],
        .mdx-editor-dark [class*="_dialogContent"] button[type="submit"] {
          background: #3b82f6 !important;
          color: white !important;
        }

        .mdx-editor-dark [class*="_secondaryButton"] {
          background: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_codeMirrorToolbar"],
        .mdx-editor-dark [class*="_codeBlockToolbar"] {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_codeMirrorToolbar"] select,
        .mdx-editor-dark [class*="_codeBlockToolbar"] select {
          background: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }

        .editor-embedded .mosaic-window-toolbar {
          display: none !important;
        }

        .mdx-editor-dark [class*="_viewMode"] {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_viewMode"] button {
          color: #94a3b8 !important;
        }

        .mdx-editor-dark [class*="_viewMode"] button[data-state="on"] {
          background: #3b82f6 !important;
          color: #ffffff !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] {
          border: 1px solid #334155 !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          position: relative !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > thead {
          line-height: 0 !important;
          font-size: 0 !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > thead th,
        .mdx-editor-dark [class*="_tableEditor"] > thead td {
          padding: 0 !important;
          height: 14px !important;
          overflow: hidden !important;
          line-height: 14px !important;
          font-size: 0 !important;
          border: none !important;
          border-bottom: 1px solid #1e293b !important;
          background: #151e2d !important;
        }

        .mdx-editor-dark [class*="_toolCell"],
        .mdx-editor-dark [class*="_tableToolsColumn"] {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
          padding: 0 !important;
          background: #151e2d !important;
          transition: background 0.15s ease !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > colgroup > col:first-child {
          width: 16px !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > colgroup > col:last-child {
          width: 16px !important;
        }

        .mdx-editor-dark [class*="_tableColumnEditorTrigger"],
        .mdx-editor-dark [class*="_tableRowEditorTrigger"],
        .mdx-editor-dark [class*="_toolCell"] button,
        .mdx-editor-dark [class*="_tableToolsColumn"] button,
        .mdx-editor-dark thead [data-tool-cell="true"] button {
          opacity: 0.35 !important;
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          border: none !important;
          background: transparent !important;
          color: #94a3b8 !important;
          cursor: pointer !important;
          transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .mdx-editor-dark [class*="_tableColumnEditorTrigger"] svg,
        .mdx-editor-dark [class*="_tableRowEditorTrigger"] svg,
        .mdx-editor-dark [class*="_toolCell"] button svg,
        .mdx-editor-dark [class*="_tableToolsColumn"] button svg,
        .mdx-editor-dark thead [data-tool-cell="true"] button svg,
        .mdx-editor-dark [class*="_iconButton"] svg {
          width: 10px !important;
          height: 10px !important;
        }

        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_tableColumnEditorTrigger"],
        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_tableRowEditorTrigger"],
        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_toolCell"] button,
        .mdx-editor-dark [class*="_tableEditor"]:hover thead button {
          opacity: 0.6 !important;
        }

        .mdx-editor-dark [class*="_toolCell"] button:hover,
        .mdx-editor-dark thead [data-tool-cell="true"] button:hover,
        .mdx-editor-dark [class*="_tableToolsColumn"] button:hover {
          opacity: 1 !important;
          background: rgba(148, 163, 184, 0.15) !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_toolCell"]:hover,
        .mdx-editor-dark thead th:hover {
          background: #1c2a3a !important;
        }

        .mdx-editor-dark [class*="_iconButton"] {
          background: transparent !important;
          color: #64748b !important;
          padding: 0 !important;
          border-radius: 50% !important;
          transition: all 0.15s ease !important;
        }

        .mdx-editor-dark [class*="_iconButton"]:hover {
          opacity: 1 !important;
          background: rgba(239, 68, 68, 0.12) !important;
          color: #ef4444 !important;
        }

        .mdx-editor-dark [class*="_addRowButton"],
        .mdx-editor-dark [class*="_addColumnButton"] {
          background: transparent !important;
          border: 1px dashed #2d3d50 !important;
          color: #475569 !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 0 !important;
        }

        .mdx-editor-dark [class*="_addRowButton"] {
          height: 14px !important;
          min-height: 14px !important;
          max-height: 14px !important;
        }

        .mdx-editor-dark [class*="_addColumnButton"] {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
        }

        .mdx-editor-dark [class*="_addRowButton"] svg,
        .mdx-editor-dark [class*="_addColumnButton"] svg {
          width: 8px !important;
          height: 8px !important;
          opacity: 0.4 !important;
          transition: opacity 0.15s ease !important;
        }

        .mdx-editor-dark [class*="_addRowButton"]:hover,
        .mdx-editor-dark [class*="_addColumnButton"]:hover {
          background: rgba(59, 130, 246, 0.08) !important;
          border-color: #3b82f6 !important;
          color: #60a5fa !important;
        }

        .mdx-editor-dark [class*="_addRowButton"]:hover svg,
        .mdx-editor-dark [class*="_addColumnButton"]:hover svg {
          opacity: 1 !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] th[data-tool-cell="true"]:last-child,
        .mdx-editor-dark [class*="_tableEditor"] td[data-tool-cell="true"]:last-child {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
          padding: 0 !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > tfoot th,
        .mdx-editor-dark [class*="_tableEditor"] > tfoot td {
          padding: 0 !important;
          height: 14px !important;
          overflow: hidden !important;
          border: none !important;
          border-top: 1px solid #1e293b !important;
        }

        .mdx-editor-dark [class*="_placeholder"] {
          color: #475569 !important;
        }

        .mdx-editor-dark [class*="_linkDialogPopoverContent"],
        .mdx-editor-dark [class*="_tooltipContent"],
        .mdx-editor-dark [class*="_linkDialogEditForm"] {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_linkDialogEditForm"] input {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_codeBlockEditorWrapper"],
        .mdx-editor-dark [class*="_codeMirrorWrapper"] {
          background: #1e293b !important;
          border-color: #334155 !important;
          border-radius: 8px !important;
          overflow: visible;
          min-height: 2.5em;
        }

        /* Ensure CodeMirror content inside code blocks is always visible */
        .mdx-editor-dark [class*="_codeBlockEditorWrapper"] .cm-editor,
        .mdx-editor-dark [class*="_codeMirrorWrapper"] .cm-editor {
          min-height: 1.5em !important;
          overflow: visible !important;
        }
        .mdx-editor-dark [class*="_codeBlockEditorWrapper"] .cm-content,
        .mdx-editor-dark [class*="_codeMirrorWrapper"] .cm-content {
          min-height: 1.5em !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
          font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace !important;
        }
        .mdx-editor-dark [class*="_codeBlockEditorWrapper"] .cm-line,
        .mdx-editor-dark [class*="_codeMirrorWrapper"] .cm-line {
          font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace !important;
          font-size: 0.88em !important;
          line-height: 1.6 !important;
        }
        /* Ensure the code block never collapses to zero height */
        .mdx-editor-dark [class*="_codeBlockEditorWrapper"] .cm-scroller {
          min-height: 1.5em !important;
          overflow: auto !important;
        }

        .mdx-editor-dark [class*="_diffSourceWrapper"] {
          height: 100% !important;
        }

        .mdx-editor-dark [class*="_diffSourceWrapper"] > div {
          height: 100% !important;
        }

        .markdown-raw-textarea {
          tab-size: 2;
          white-space: pre-wrap;
          word-break: break-word;
          caret-color: #60a5fa;
        }

        .markdown-raw-textarea::selection {
          background: rgba(96, 165, 250, 0.35);
        }

        .markdown-preview-container {
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.9rem 2rem 1.5rem;
        }
        .markdown-preview-container h1,
        .markdown-preview-container h2,
        .markdown-preview-container h3,
        .markdown-preview-container h4 {
          color: #f1f5f9;
          font-weight: 700;
          margin-top: 0.6em;
          margin-bottom: 0.5em;
        }
        .markdown-preview-container > :first-child { margin-top: 0 !important; }
        .markdown-preview-container h1 { font-size: 2em; border-bottom: 1px solid #334155; padding-bottom: 0.3em; margin-top: 0.6em; }
        .markdown-preview-container h2 { font-size: 1.5em; font-weight: 600; border-bottom: 1px solid #1e293b; padding-bottom: 0.2em; margin: 0.8em 0 0.4em; }
        .markdown-preview-container h3 { font-size: 1.25em; font-weight: 600; margin: 0.7em 0 0.3em; color: #e2e8f0; }
        .markdown-preview-container h4,
        .markdown-preview-container h5,
        .markdown-preview-container h6 { font-weight: 600; margin: 0.6em 0 0.3em; color: #cbd5e1; }
        .markdown-preview-container p { margin: 0.5em 0; }
        .markdown-preview-container a { color: #60a5fa; text-decoration: underline; text-decoration-color: rgba(96, 165, 250, 0.4); transition: text-decoration-color 0.2s; }
        .markdown-preview-container a:hover { text-decoration-color: #60a5fa; }
        .markdown-preview-container strong { color: #f1f5f9; font-weight: 600; }
        .markdown-preview-container em { color: #cbd5e1; }
        .markdown-preview-container code:not(pre code) {
          background: #1e293b;
          border-radius: 4px;
          padding: 0.15em 0.4em;
          font-size: 0.9em;
          color: #f472b6;
        }
        .markdown-preview-container pre {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-preview-container pre code {
          background: none;
          border: none;
          padding: 0;
          color: #e2e8f0;
          font-size: 0.875em;
        }
        .markdown-preview-container blockquote {
          border-left: 4px solid #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          padding: 0.5em 1em;
          margin: 1em 0;
          color: #94a3b8;
        }
        .markdown-preview-container table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .markdown-preview-container th,
        .markdown-preview-container td {
          border: 1px solid #334155;
          padding: 8px 12px;
          text-align: left;
        }
        .markdown-preview-container th {
          background: #1e293b;
          font-weight: 600;
          color: #f1f5f9;
        }
        .markdown-preview-container tr:nth-child(even) {
          background: #0f172a;
        }
        .markdown-preview-container tr:nth-child(odd) {
          background: #1e293b40;
        }
        .markdown-preview-container ul,
        .markdown-preview-container ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .markdown-preview-container li { margin: 0.25em 0; }
        .markdown-preview-container hr {
          border: none;
          border-top: 1px solid #334155;
          margin: 2em 0;
        }
        .markdown-preview-container img {
          max-width: 100%;
          border-radius: 8px;
        }

        .markdown-preview-container .katex { color: #e2e8f0; font-size: 1.1em; }
        .markdown-preview-container .katex-display { margin: 1em 0; overflow-x: auto; }
        .markdown-preview-container .katex-display > .katex {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 12px 16px;
          display: inline-block;
        }

        .markdown-preview-container .mermaid-container {
          margin: 1em 0;
          padding: 16px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          text-align: center;
          overflow-x: auto;
        }
        .markdown-preview-container .mermaid-container svg {
          max-width: 100%;
          height: auto;
        }
        .mermaid-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 13px;
          padding: 12px;
        }
        .mermaid-loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #334155;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mermaid-error {
          background: #1e293b;
          border: 1px solid #ef4444;
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
        }
        .mermaid-error-label {
          color: #ef4444;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .mermaid-error-detail,
        .mermaid-error-source {
          font-size: 12px;
          color: #94a3b8;
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .snippet-gallery-sidebar {
          scrollbar-width: thin;
          scrollbar-color: #475569 transparent;
        }
        .snippet-gallery-sidebar::-webkit-scrollbar {
          width: 4px;
        }
        .snippet-gallery-sidebar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 2px;
        }

        .snippet-mini-preview {
          font-size: 11px;
          line-height: 1.4;
          max-height: 80px;
          overflow: hidden;
          color: #94a3b8;
        }
        .snippet-mini-preview .katex {
          font-size: 0.85em;
        }
        .snippet-mini-preview p {
          margin: 0 0 4px 0;
        }

        .katex-overlay-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 0;
          overflow: visible;
          pointer-events: none;
          z-index: 10;
        }
        .katex-block-overlay {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 6px;
          padding: 12px 16px;
          cursor: pointer;
          pointer-events: auto;
          animation: katexFadeIn 0.15s ease-out;
          box-sizing: border-box;
        }
        .katex-block-overlay:hover {
          border-color: rgba(59, 130, 246, 0.35);
          background: #0c1222;
        }
        .katex-block-overlay .katex {
          color: #e2e8f0;
          font-size: 1.15em;
        }
        .katex-block-overlay .katex-display {
          margin: 0;
        }

        .katex-inline-overlay {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          border-radius: 3px;
          padding: 1px 4px;
          cursor: pointer;
          pointer-events: auto;
          animation: katexFadeIn 0.12s ease-out;
          box-sizing: border-box;
          white-space: nowrap;
        }
        .katex-inline-overlay:hover {
          background: #1e293b;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
        }
        .katex-inline-overlay .katex {
          color: #93c5fd;
          font-size: 1.05em;
        }

        [data-katex-editing="1"] {
          background: rgba(59, 130, 246, 0.05) !important;
          border-radius: 4px;
          outline: 1px dashed rgba(59, 130, 246, 0.25);
        }
        @keyframes katexFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ─── Linked Tasks ─── */
        .linked-tasks-section {
          background: #0f172a;
          border-top: 1px solid #1e293b;
          padding: 8px 12px;
          max-height: 120px;
          overflow-y: auto;
        }
        .linked-task-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          color: #94a3b8;
          transition: background 0.2s;
        }
        .linked-task-item:hover {
          background: #1e293b;
          color: #e2e8f0;
        }

        /* Hit areas are full bounding-box rectangles; hover effects
           are handled via JS mouseenter/mouseleave, not CSS :hover,
           to avoid geometry changes that cause cursor oscillation. */

        /* ─── ASCII-art diagram blocks (preview) ─── */
        .markdown-preview-container .ascii-diagram-block {
          background: #1e293b;
          border: 1px solid #475569;
          border-radius: 8px;
          padding: 16px 20px;
          margin: 1em 0;
          overflow-x: auto;
          line-height: 1.35;
        }
        .markdown-preview-container .ascii-diagram-block code {
          background: none !important;
          border: none !important;
          padding: 0 !important;
          color: #93c5fd !important;
          font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace !important;
          font-size: 0.85em !important;
          white-space: pre !important;
          display: block;
          tab-size: 4;
        }

        /* ─── Code blocks in preview: ensure monospace & proper spacing ─── */
        .markdown-preview-container pre code {
          font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace !important;
          white-space: pre !important;
          tab-size: 4;
          display: block;
        }

        /* ─── KaTeX rendering fixes ─── */
        .markdown-preview-container .katex-html {
          white-space: normal;
        }
        .markdown-preview-container .katex .base {
          display: inline-block;
        }
        .markdown-preview-container .katex-error {
          color: #f87171 !important;
          font-size: 0.85em;
          border: 1px dashed #ef4444;
          border-radius: 4px;
          padding: 2px 6px;
          background: rgba(239, 68, 68, 0.08);
        }
`;
