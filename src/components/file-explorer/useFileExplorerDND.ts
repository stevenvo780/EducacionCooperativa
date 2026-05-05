import { useCallback } from 'react';
import type { DocItem, FolderItem } from '../FileExplorer';

export const DOC_REORDER_TYPE = 'application/x-doc-reorder';
export const FOLDER_REORDER_TYPE = 'application/x-folder-reorder';

export const arrayMove = <T,>(items: T[], from: number, to: number) => {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
};

export const resolveReorderIndex = (fromIndex: number, targetIndex: number, placeAfter: boolean) => {
  let toIndex = placeAfter ? targetIndex + 1 : targetIndex;
  if (fromIndex < toIndex) toIndex -= 1;
  return toIndex;
};

interface UseFileExplorerDNDProps {
  canReorderDocs: boolean;
  canReorderFolders: boolean;
  docIndexMap: Map<string, number>;
  folderIndexMap: Map<string, number>;
  filteredFolderDocs: DocItem[];
  filteredChildFolders: FolderItem[];
  activeFolder: string;
  onReorderDocs?: (payload: { folderPath: string; orderedIds: string[] }) => void;
  onReorderFolders?: (payload: { parentPath: string; orderedPaths: string[] }) => void;
}

export function useFileExplorerDND({
  canReorderDocs,
  canReorderFolders,
  docIndexMap,
  folderIndexMap,
  filteredFolderDocs,
  filteredChildFolders,
  activeFolder,
  onReorderDocs,
  onReorderFolders
}: UseFileExplorerDNDProps) {

  const reorderDocs = useCallback((dragId: string, targetId: string, placeAfter: boolean) => {
    if (!canReorderDocs) return;
    const fromIndex = docIndexMap.get(dragId);
    const toIndex = docIndexMap.get(targetId);
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(filteredFolderDocs, fromIndex, resolvedIndex);
    onReorderDocs?.({ folderPath: activeFolder, orderedIds: reordered.map(doc => doc.id) });
  }, [canReorderDocs, docIndexMap, filteredFolderDocs, activeFolder, onReorderDocs]);

  const reorderFolders = useCallback((dragPath: string, targetPath: string, placeAfter: boolean) => {
    if (!canReorderFolders) return;
    const fromIndex = folderIndexMap.get(dragPath);
    const toIndex = folderIndexMap.get(targetPath);
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(filteredChildFolders, fromIndex, resolvedIndex);
    onReorderFolders?.({ parentPath: activeFolder, orderedPaths: reordered.map(folder => folder.path) });
  }, [canReorderFolders, folderIndexMap, filteredChildFolders, activeFolder, onReorderFolders]);

  const getDropPosition = useCallback((e: React.DragEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    return e.clientY > midpoint ? 'after' : 'before';
  }, []);

  return {
    reorderDocs,
    reorderFolders,
    getDropPosition
  };
}
