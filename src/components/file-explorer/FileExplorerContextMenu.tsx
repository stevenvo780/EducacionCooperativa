import React from 'react';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { Copy, Download, FolderOpen, Star, Pencil, FolderInput, Trash2 } from 'lucide-react';
import type { DocItem, FolderItem } from '../FileExplorer';

export interface FileExplorerContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  data: {
    type: 'doc' | 'folder';
    id?: string;
    path?: string;
    folder?: FolderItem;
    doc?: DocItem;
  };
  docMap: Map<string, DocItem>;
  favoriteDocIdSet: Set<string>;
  onOpenDoc?: (doc: DocItem) => void;
  onDuplicateDoc?: (doc: DocItem) => void;
  onDownloadDoc?: (doc: DocItem) => void;
  onToggleFavorite?: (doc: DocItem) => void;
  onRenameDoc?: (doc: DocItem) => void;
  onMoveDocPrompt?: (doc: DocItem) => void;
  onDeleteDoc?: (docId: string) => void;
  onDownloadFolder?: (folderPath: string) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
}

export const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  onClose,
  data,
  docMap,
  favoriteDocIdSet,
  onOpenDoc,
  onDuplicateDoc,
  onDownloadDoc,
  onToggleFavorite,
  onRenameDoc,
  onMoveDocPrompt,
  onDeleteDoc,
  onDownloadFolder,
  onDeleteFolder
}) => {
  return (
    <ContextMenu
      x={x}
      y={y}
      onClose={onClose}
      sections={data.type === 'doc' ? [
        {
          actions: [
            ...(onOpenDoc ? [{
              label: 'Abrir',
              icon: <FolderOpen className="w-4 h-4" />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onOpenDoc(doc); }
            }] : []),
            ...(onDuplicateDoc ? [{
              label: 'Duplicar',
              icon: <Copy className="w-4 h-4" />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onDuplicateDoc(doc); }
            }] : []),
            ...(onDownloadDoc ? [{
              label: 'Descargar',
              icon: <Download className="w-4 h-4" />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onDownloadDoc(doc); }
            }] : []),
            ...(onToggleFavorite ? [{
              label: (data.id && favoriteDocIdSet.has(data.id)) ? 'Quitar de favoritos' : 'Fijar en favoritos',
              icon: <Star className={`w-4 h-4 ${(data.id && favoriteDocIdSet.has(data.id)) ? 'fill-current text-amber-300' : ''}`} />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onToggleFavorite(doc); }
            }] : []),
            ...(onRenameDoc ? [{
              label: 'Renombrar',
              icon: <Pencil className="w-4 h-4" />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onRenameDoc(doc); }
            }] : []),
            ...(onMoveDocPrompt ? [{
              label: 'Mover a...',
              icon: <FolderInput className="w-4 h-4" />,
              onClick: () => { const doc = data.doc || (data.id ? docMap.get(data.id) : null); if (doc) onMoveDocPrompt(doc); }
            }] : [])
          ]
        },
        {
          actions: [
            ...(onDeleteDoc ? [{
              label: 'Eliminar',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => { if (data.id) onDeleteDoc(data.id); },
              destructive: true
            }] : [])
          ]
        }
      ] : [
        {
          actions: [
            ...(onDownloadFolder ? [{
              label: 'Descargar Carpeta',
              icon: <Download className="w-4 h-4" />,
              onClick: () => { if (data.path) onDownloadFolder(data.path); }
            }] : []),
            ...(onRenameDoc && data.folder?.docId ? [{
              label: 'Renombrar Carpeta',
              icon: <Pencil className="w-4 h-4" />,
              onClick: () => { const doc = docMap.get(data.folder!.docId!); if (doc) onRenameDoc(doc); }
            }] : [])
          ]
        },
        {
          actions: [
            ...(onDeleteFolder && data.folder && data.folder.kind !== 'system' ? [{
              label: 'Eliminar Carpeta',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => { if (data.folder) onDeleteFolder(data.folder); },
              destructive: true
            }] : [])
          ]
        }
      ]}
    />
  );
};
