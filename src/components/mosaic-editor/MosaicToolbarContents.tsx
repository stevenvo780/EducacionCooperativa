import React from 'react';
import ReactDOM from 'react-dom';
import clsx from 'clsx';
import {
  Separator,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  HighlightToggle,
  StrikeThroughSupSubToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertThematicBreak,
  InsertCodeBlock,
  InsertAdmonition,
  InsertFrontmatter
} from '@mdxeditor/editor';
import {
  Quote,
  ListTodo,
  KanbanSquare,
  Loader2,
  Check,
  Sigma,
  Braces,
  Library,
  MoreHorizontal,
  PenLine,
  FileCode2,
  Monitor,
  Minimize2,
  Maximize2,
  Settings2,
  BookMarked,
  Sparkles
} from 'lucide-react';
import { ToolbarShortcutButton, TableGridPicker } from '@/components/mosaic-editor/ToolbarControls';
import type { QuickInsert } from '@/components/mosaic-editor/types';
import { semanticBrowserBus } from '@/lib/semantic-browser-bus';

export type ToolbarGroupKey = 'history' | 'inline' | 'structure' | 'lists' | 'media' | 'insert' | 'snippets' | 'advanced';

export interface MosaicToolbarContentsProps {
  toolbarVisibility: Record<ToolbarGroupKey, boolean>;
  showCompactMenu: boolean;
  menuPos: { top: number; left: number } | null;
  isFullscreen: boolean;
  showToolsPanel: boolean;
  viewMode: 'edit' | 'preview' | 'raw';
  isCreatingTask: boolean;
  docName: string;
  editorShellRef: React.RefObject<HTMLElement | null>;
  menuBtnRef: React.RefObject<HTMLButtonElement>;
  currentDocMetaRef: React.MutableRefObject<{ name?: string }>;
  DEFAULT_TOOLBAR_VISIBILITY: Record<ToolbarGroupKey, boolean>;
  QUICK_INSERTS: QuickInsert[];
  applyToolbarVisibility: (visibility: Record<ToolbarGroupKey, boolean>) => void;
  insertSnippet: (markdown: string) => void;
  toggleCompactMenu: (e: React.MouseEvent) => void;
  toggleFullscreen: () => void;
  setShowCompactMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSnippetGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowToolsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setViewModeWithSync: (mode: 'edit' | 'preview' | 'raw') => void;
  createTaskFromSelection: () => Promise<void>;
  scanPendings: () => Promise<void>;
}

export function MosaicToolbarContents({
  toolbarVisibility,
  showCompactMenu,
  menuPos,
  isFullscreen,
  showToolsPanel,
  viewMode,
  isCreatingTask,
  docName,
  editorShellRef,
  menuBtnRef,
  currentDocMetaRef,
  DEFAULT_TOOLBAR_VISIBILITY,
  QUICK_INSERTS,
  applyToolbarVisibility,
  insertSnippet,
  toggleCompactMenu,
  toggleFullscreen,
  setShowCompactMenu,
  setShowSnippetGallery,
  setShowToolsPanel,
  setViewModeWithSync,
  createTaskFromSelection,
  scanPendings
}: MosaicToolbarContentsProps) {
  const sections: React.ReactNode[] = [];

  const pushSection = (key: ToolbarGroupKey, content: React.ReactNode) => {
    if (!toolbarVisibility[key]) return;
    if (sections.length > 0) {
      sections.push(<Separator key={`separator-${key}`} />);
    }
    sections.push(<React.Fragment key={key}>{content}</React.Fragment>);
  };

  pushSection('history', <UndoRedo />);
  pushSection('inline', (
    <>
      <BoldItalicUnderlineToggles />
      <CodeToggle />
      <HighlightToggle />
      <StrikeThroughSupSubToggles options={['Strikethrough', 'Sub', 'Sup']} />
    </>
  ));
  pushSection('structure', (
    <>
      <BlockTypeSelect />
      <ToolbarShortcutButton
        title="Insertar cita"
        icon={<Quote className="h-4 w-4" />}
        onClick={() => insertSnippet('\n> Escribe una cita aquí\n')}
      />
    </>
  ));
  pushSection('lists', (
    <>
      <ListsToggle />
      <ToolbarShortcutButton
        title="Insertar lista de tareas"
        icon={<ListTodo className="h-4 w-4" />}
        onClick={() => insertSnippet('\n- [ ] Primera tarea\n- [ ] Segunda tarea\n')}
      />
      <ToolbarShortcutButton
        title="Crear tarea en tablero"
        icon={isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <KanbanSquare className="h-4 w-4" />}
        onClick={() => { void createTaskFromSelection(); }}
        disabled={isCreatingTask}
      />
      <ToolbarShortcutButton
        title="Detectar pendientes en texto"
        icon={isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        onClick={() => { void scanPendings(); }}
        disabled={isCreatingTask}
      />
    </>
  ));
  pushSection('media', (
    <>
      <CreateLink />
      <InsertImage />
    </>
  ));
  pushSection('insert', (
    <>
      <TableGridPicker portalContainer={editorShellRef.current} onInsert={(rows: number, cols: number) => {
        const header = `| ${Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ')} |`;
        const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
        const body = Array.from({ length: rows - 1 }, () =>
          `| ${Array.from({ length: cols }, () => '   ').join(' | ')} |`
        ).join('\n');
        const tableMd = `\n${header}\n${sep}\n${body}\n`;
        insertSnippet(tableMd);
      }} />
      <InsertThematicBreak />
      <InsertCodeBlock />
    </>
  ));
  pushSection('snippets', (
    <>
      <ToolbarShortcutButton
        title="LaTeX en línea"
        icon={<Sigma className="h-4 w-4" />}
        onClick={() => insertSnippet('$E = mc^2$')}
      />
      <ToolbarShortcutButton
        title="Bloque LaTeX"
        icon={<Braces className="h-4 w-4" />}
        onClick={() => insertSnippet('\n$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n')}
      />
      <ToolbarShortcutButton
        title="Galería de snippets"
        icon={<Library className="h-4 w-4" />}
        onClick={() => setShowSnippetGallery(s => !s)}
      />
    </>
  ));
  pushSection('advanced', (
    <>
      <InsertAdmonition />
      <InsertFrontmatter />
    </>
  ));

  return (
    <>
      {/* ── Custom controls ── */}
      <div className="relative shrink-0" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button
          ref={menuBtnRef}
          type="button"
          onClick={toggleCompactMenu}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
          title="Más opciones"
          aria-label="Más opciones del editor"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewModeWithSync(viewMode === 'raw' ? 'edit' : 'raw')}
          className={clsx(
            'inline-flex h-8 w-8 items-center justify-center rounded-full transition',
            viewMode === 'raw'
              ? 'bg-violet-600/25 text-violet-300 hover:bg-violet-600/35'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          )}
          title={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
          aria-label={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
          aria-pressed={viewMode === 'raw'}
        >
          {viewMode === 'raw' ? <PenLine className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setViewModeWithSync(viewMode === 'preview' ? 'edit' : 'preview')}
          className={clsx(
            'inline-flex h-8 w-8 items-center justify-center rounded-full transition',
            viewMode === 'preview'
              ? 'bg-blue-600/25 text-blue-300 hover:bg-blue-600/35'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          )}
          title={viewMode === 'preview' ? 'Volver a editar' : 'Vista previa (LaTeX, Mermaid)'}
          aria-label={viewMode === 'preview' ? 'Volver al editor' : 'Abrir vista previa renderizada'}
          aria-pressed={viewMode === 'preview'}
        >
          {viewMode === 'preview' ? <PenLine className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      {showCompactMenu && menuPos && ReactDOM.createPortal(
        <div
          className="table-grid-popover"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99998 }}
          onClick={() => setShowCompactMenu(false)}
        >
          <div
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 99999 }}
            className="min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" title={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} aria-label={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} onClick={() => { setShowToolsPanel(c => !c); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
              <Settings2 className="h-4 w-4 text-slate-400" />{showToolsPanel ? 'Ocultar herramientas' : 'Editar herramientas'}
            </button>
            <button type="button" title="Abrir mesa semántica" aria-label="Abrir mesa semántica" onClick={() => { semanticBrowserBus.open(docName || currentDocMetaRef.current.name); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
              <BookMarked className="h-4 w-4 text-blue-400" />Mesa semántica
            </button>
            <button type="button" title="Restaurar todos los botones de la barra" aria-label="Restaurar todos los botones de la barra" onClick={() => { applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
              <Sparkles className="h-4 w-4 text-slate-400" />Restaurar barra completa
            </button>
            <button type="button" title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} onClick={() => { void toggleFullscreen(); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
              {isFullscreen ? <Minimize2 className="h-4 w-4 text-slate-400" /> : <Maximize2 className="h-4 w-4 text-slate-400" />}
              {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
            </button>
            <div className="my-1 h-px bg-slate-700" />
            <button type="button" title="Abrir galería de snippets" aria-label="Abrir galería de snippets" onClick={() => { setShowSnippetGallery(s => !s); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
              <Library className="h-4 w-4 text-blue-400" />Galería de snippets
            </button>
            {QUICK_INSERTS.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                title={snippet.title}
                aria-label={snippet.title}
                onClick={() => { insertSnippet(snippet.markdown); setShowCompactMenu(false); }}
                className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              >
                <Sparkles className="h-3 w-3 text-blue-400" />{snippet.title}
              </button>
            ))}
          </div>
        </div>,
        editorShellRef.current || document.body
      )}

      {/* ── MDXEditor toolbar groups ── */}
      {sections}
    </>
  );
}
