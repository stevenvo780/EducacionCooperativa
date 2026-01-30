"use client";

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  ChevronRight,
  ChevronDown,
  Upload,
  FolderPlus,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Copy,
  FolderInput
} from 'lucide-react';

export interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal' | 'files';
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  mimeType?: string;
  updatedAt?: any;
  ownerId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'system' | 'record' | 'virtual';
}

interface FileExplorerProps {
  docs: DocItem[];
  folders: FolderItem[];
  onSelectDoc: (doc: DocItem) => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onDeleteDoc?: (docId: string) => void;
  onMoveDoc?: (docId: string, targetFolder: string) => void;
  currentWorkspaceName?: string;
  embedded?: boolean;
}

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: TreeNode[];
  doc?: DocItem;
  folder?: FolderItem;
}

const DEFAULT_FOLDER_NAME = 'No estructurado';

const FileExplorer: React.FC<FileExplorerProps> = ({
  docs,
  folders,
  onSelectDoc,
  onCreateFile,
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onDeleteDoc,
  onMoveDoc,
  currentWorkspaceName = 'Espacio Personal',
  embedded = false
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; docId: string } | null>(null);

  // Build tree structure
  const tree = useMemo(() => {
    const root: TreeNode = {
      id: 'root',
      name: currentWorkspaceName,
      path: '',
      type: 'folder',
      children: []
    };

    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set('', root);

    // Create folder nodes
    const sortedFolders = [...folders].sort((a, b) => a.path.localeCompare(b.path));
    
    sortedFolders.forEach(folder => {
      const node: TreeNode = {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        type: 'folder',
        children: [],
        folder
      };
      nodeMap.set(folder.path, node);

      // Find parent
      const parentPath = folder.parentPath;
      const parent = nodeMap.get(parentPath) || root;
      parent.children.push(node);
    });

    // Add files to their folders
    docs.forEach(doc => {
      if (doc.type === 'folder') return;
      
      const folderPath = doc.folder || DEFAULT_FOLDER_NAME;
      const parent = nodeMap.get(folderPath) || nodeMap.get(DEFAULT_FOLDER_NAME) || root;
      
      parent.children.push({
        id: doc.id,
        name: doc.name,
        path: `${folderPath}/${doc.name}`,
        type: 'file',
        children: [],
        doc
      });
    });

    // Sort children: folders first, then files, alphabetically
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root;
  }, [docs, folders, currentWorkspaceName]);

  // Filter by search
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;

    const query = searchQuery.toLowerCase();
    
    const filterNode = (node: TreeNode): TreeNode | null => {
      const nameMatches = node.name.toLowerCase().includes(query);
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null);

      if (nameMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return filterNode(tree) || tree;
  }, [tree, searchQuery]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (doc?: DocItem) => {
    if (!doc) return <FileIcon className="w-4 h-4 text-slate-400" />;
    
    const mimeType = doc.mimeType || '';
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    }
    if (doc.name.endsWith('.md') || doc.type === 'text') {
      return <FileText className="w-4 h-4 text-sky-400" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, docId });
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path) || node.path === '';
    const hasChildren = node.children.length > 0;
    const paddingLeft = depth * 16 + 8;

    if (node.type === 'folder') {
      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-surface-700/50 rounded cursor-pointer group transition-colors"
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.path)}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span className="text-sm text-slate-200 truncate flex-1">{node.name}</span>
            <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {node.children.filter(c => c.type === 'file').length}
            </span>
          </div>
          {isExpanded && hasChildren && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    return (
      <div
        key={node.id}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-surface-700/50 rounded cursor-pointer group transition-colors"
        style={{ paddingLeft }}
        onClick={() => node.doc && onSelectDoc(node.doc)}
        onContextMenu={(e) => node.doc && handleContextMenu(e, node.doc.id)}
      >
        <span className="w-4" />
        {getFileIcon(node.doc)}
        <span className="text-sm text-slate-300 truncate flex-1">{node.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (node.doc) handleContextMenu(e, node.doc.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-600 rounded transition-all"
        >
          <MoreVertical className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface-900 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-sm">{currentWorkspaceName}</span>
        </div>
        <div className="flex items-center gap-1">
          {onCreateFile && (
            <button
              onClick={onCreateFile}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Nuevo archivo"
            >
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onCreateFolder && (
            <button
              onClick={onCreateFolder}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Nueva carpeta"
            >
              <FolderPlus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onUploadFile && (
            <button
              onClick={onUploadFile}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Subir archivo"
            >
              <Upload className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-surface-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar archivos..."
            className="w-full pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTree.children.map(child => renderNode(child, 0))}
        {filteredTree.children.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            {searchQuery ? 'No se encontraron archivos' : 'Este espacio está vacío'}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                // TODO: Implement duplicate
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-surface-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Duplicar
            </button>
            <button
              onClick={() => {
                // TODO: Implement move
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-surface-700 transition-colors"
            >
              <FolderInput className="w-4 h-4" />
              Mover a...
            </button>
            <div className="border-t border-surface-700 my-1" />
            <button
              onClick={() => {
                if (onDeleteDoc) onDeleteDoc(contextMenu.docId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileExplorer;
