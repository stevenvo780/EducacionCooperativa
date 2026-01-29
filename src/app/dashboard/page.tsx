'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FileText, Plus, Trash2, LogOut, User, Upload, Image as ImageIcon, File as FileIcon, Users, Briefcase, ChevronDown, Check, X, Shield, Folder, Settings, HelpCircle, Menu, Loader2, Columns, Eye, Pencil, Terminal as TerminalIcon, FolderPlus, Copy, FolderInput } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@/components/Editor';
import Terminal from '@/components/Terminal';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  pendingInvites?: string[];
  type: 'personal' | 'shared';
}

interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder';
  content?: string;
  url?: string;
  storagePath?: string;
  mimeType?: string;
  folder?: string;
  updatedAt: any;
  ownerId: string;
  workspaceId?: string;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'system' | 'record' | 'virtual';
}

type ViewMode = 'edit' | 'split' | 'preview';

interface UploadStatus {
  total: number;
  currentIndex: number;
  currentName: string;
  progress: number;
  phase: 'uploading' | 'done' | 'error';
  error?: string;
}

interface DeleteStatus {
  phase: 'deleting' | 'done' | 'error';
  name?: string;
  error?: string;
}

const PERSONAL_WORKSPACE_ID = 'personal';
const DEFAULT_FOLDER_NAME = 'No estructurado';

const normalizePath = (value?: string) => {
    if (!value) return '';
    return value
        .split('/')
        .map(part => part.trim())
        .filter(Boolean)
        .join('/');
};

const normalizeFolderPath = (value?: string) => {
    const normalized = normalizePath(value);
    return normalized || DEFAULT_FOLDER_NAME;
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const router = useRouter();

  // Workspace State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [invites, setInvites] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // UI State
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [openTabs, setOpenTabs] = useState<DocItem[]>([]);
  const [docModes, setDocModes] = useState<Record<string, ViewMode>>({});
  const [activeFolder, setActiveFolder] = useState<string>(DEFAULT_FOLDER_NAME);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string | null>(null);

  // Actions State
  const [newDocName, setNewDocName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const uploadStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    
    const personalSpace: Workspace = {
        id: PERSONAL_WORKSPACE_ID,
        name: 'Espacio Personal',
        ownerId: user.uid,
        members: [user.uid],
        type: 'personal'
    };

    let fetched: Workspace[] = [];
    try {
        console.log("Skipped Firestore Client Calls");
    } catch (e) {
        console.error("Error fetching workspaces", e);
    }

    const allWorkspaces = [personalSpace, ...fetched];
    setWorkspaces(allWorkspaces);
    setCurrentWorkspace(prev => prev ?? personalSpace);
  }, [user]);

  const acceptInvite = async (ws: Workspace) => {
      if(!user?.email) return;
      try {
          const wsRef = doc(db, 'workspaces', ws.id);
          await updateDoc(wsRef, {
              members: arrayUnion(user.uid),
              pendingInvites: arrayRemove(user.email)
          });
          await fetchWorkspaces();
          alert('¡Te has unido al espacio!');
      } catch (e) {
          console.error("Error accepting", e);
      }
  };

  const fetchDocs = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    try {
        let url = '/api/documents?';
        if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
            url += `ownerId=${user.uid}`;
        } else {
            url += `workspaceId=${currentWorkspace.id}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch docs via API');
        const fetched: DocItem[] = await res.json();

        const filtered = fetched.filter(d => {
             if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
                 return !d.workspaceId || d.workspaceId === PERSONAL_WORKSPACE_ID;
             }
             return true;
        });

        const folderDocs = filtered.filter(item => item.type === 'folder');
        const fileDocs = filtered.filter(item => item.type !== 'folder');

        const normalizedFileDocs = fileDocs.map(docItem => {
            const folderPath = normalizeFolderPath(docItem.folder);
            return { ...docItem, folder: folderPath };
        });

        const folderMap = new Map<string, FolderItem>();
        const ensureNode = (path: string, kind: FolderItem['kind']) => {
            const normalized = normalizePath(path);
            if (!normalized) return;
            const existing = folderMap.get(normalized);
            const name = normalized.split('/').slice(-1)[0] || normalized;
            const parentPath = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';

            if (!existing) {
                folderMap.set(normalized, {
                    id: `path:${normalized}`,
                    name,
                    path: normalized,
                    parentPath,
                    kind
                });
                return;
            }

            const priority: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
            if (priority[kind] < priority[existing.kind]) {
                folderMap.set(normalized, { ...existing, kind });
            }
        };

        const ensureAncestors = (path: string) => {
            const normalized = normalizePath(path);
            if (!normalized) return;
            const parts = normalized.split('/');
            let current = '';
            parts.forEach(part => {
                current = current ? `${current}/${part}` : part;
                ensureNode(current, current === DEFAULT_FOLDER_NAME ? 'system' : 'virtual');
            });
        };

        ensureNode(DEFAULT_FOLDER_NAME, 'system');

        folderDocs.forEach(folderDoc => {
            const parentPath = normalizePath(folderDoc.folder);
            const name = (folderDoc.name || 'Carpeta').trim() || 'Carpeta';
            const fullPath = parentPath ? `${parentPath}/${name}` : name;
            ensureAncestors(parentPath);
            ensureNode(fullPath, fullPath === DEFAULT_FOLDER_NAME ? 'system' : 'record');
        });

        normalizedFileDocs.forEach(docItem => {
            const folderPath = normalizeFolderPath(docItem.folder);
            ensureAncestors(folderPath);
            ensureNode(folderPath, folderPath === DEFAULT_FOLDER_NAME ? 'system' : 'virtual');
        });

        const folderList = Array.from(folderMap.values());

        normalizedFileDocs.sort((a, b) => {
            const dateA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt).getTime();
            const dateB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt).getTime();
            return (dateB || 0) - (dateA || 0);
        });

        setDocs(normalizedFileDocs);
        setFolders(folderList);
    } catch (error) {
        console.error("Error fetching docs", error);
    }
  }, [user, currentWorkspace]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
        fetchWorkspaces();
    }
  }, [user, loading, router, fetchWorkspaces]);

  useEffect(() => {
      if (currentWorkspace && user) {
          fetchDocs();
      }
  }, [currentWorkspace, user, fetchDocs]);

  useEffect(() => {
      return () => {
          if (uploadStatusTimer.current) {
              clearTimeout(uploadStatusTimer.current);
          }
          if (deleteStatusTimer.current) {
              clearTimeout(deleteStatusTimer.current);
          }
      };
  }, []);

  const closeTabById = useCallback((docId: string) => {
      setOpenTabs(prev => {
          const next = prev.filter(t => t.id !== docId);
          setSelectedDocId(prevSelected => {
              if (prevSelected !== docId) return prevSelected;
              return next.length > 0 ? next[next.length - 1].id : null;
          });
          return next;
      });
  }, []);

  const openDocument = (doc: DocItem) => {
      setShowTerminal(false);
      if (doc.type === 'folder') return;
      if (doc.folder) {
          setActiveFolder(doc.folder);
      }
      setOpenTabs(prev => {
          if (prev.find(t => t.id === doc.id)) {
              return prev;
          }
          return [...prev, doc];
      });
      setSelectedDocId(doc.id);
      setShowMobileSidebar(false);
  };

  const closeTab = (docId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeTabById(docId);
  };

  useEffect(() => {
      setDocModes(prev => {
          const next: Record<string, ViewMode> = {};
          openTabs.forEach(tab => {
              next[tab.id] = prev[tab.id] ?? 'preview';
          });
          return next;
      });
  }, [openTabs]);

  const setDocMode = useCallback((docId: string, mode: ViewMode) => {
      setDocModes(prev => {
          if (prev[docId] === mode) return prev;
          return { ...prev, [docId]: mode };
      });
  }, []);

  const gridDocs = useMemo(() => {
      if (openTabs.length <= 4) return openTabs;
      const selected = selectedDocId ? openTabs.find(tab => tab.id === selectedDocId) : null;
      if (!selected) return openTabs.slice(-4);
      const others = openTabs.filter(tab => tab.id !== selected.id);
      return [selected, ...others].slice(0, 4);
  }, [openTabs, selectedDocId]);

  const gridColsClass = gridDocs.length <= 1 ? 'grid-cols-1' : 'grid-cols-2';
  const gridRowsClass = gridDocs.length <= 2 ? 'grid-rows-1' : 'grid-rows-2';

  const createFolderRecord = async (folderName: string) => {
      if (!user) return false;
      const trimmed = folderName.trim();
      if (!trimmed) return false;
      const parentPath = normalizePath(activeFolder);
      const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
      const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
      if (exists) return false;

      const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
      const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? null : workspaceId;
      const response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              name: trimmed,
              type: 'folder',
              ownerId: user.uid,
              workspaceId: docWorkspaceId,
              folder: parentPath
          })
      });
      if (!response.ok) {
          console.error('Failed to create folder');
          return false;
      }
      await fetchDocs();
      return true;
  };

  const createFolder = async () => {
      const name = prompt('Nombre de carpeta');
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const parentPath = normalizePath(activeFolder);
      const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
      const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
      if (exists) {
          alert('La carpeta ya existe');
          return;
      }
      const created = await createFolderRecord(trimmed);
      if (!created) {
          alert('No se pudo crear la carpeta');
      }
  };

  const moveDocumentToFolder = async (docId: string, folderPath: string) => {
      const targetPath = normalizeFolderPath(folderPath);

      if (targetPath !== DEFAULT_FOLDER_NAME) {
          const segments = targetPath.split('/');
          const leafName = segments[segments.length - 1];
          const parentPath = segments.slice(0, -1).join('/');
          const exists = folders.some(folder => folder.path.toLowerCase() === targetPath.toLowerCase());
          if (!exists) {
              const savedActive = activeFolder;
              setActiveFolder(parentPath || DEFAULT_FOLDER_NAME);
              await createFolderRecord(leafName);
              setActiveFolder(savedActive);
          }
      }

      setDocs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));
      setOpenTabs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));

      try {
          const res = await fetch(`/api/documents/${docId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder: targetPath })
          });
          if (!res.ok) {
              throw new Error('Failed to move document');
          }
          await fetchDocs();
      } catch (error) {
          console.error('Error moving document', error);
          await fetchDocs();
      }
  };

  const copyDocument = async (docItem: DocItem) => {
      if (!user) return;
      if (docItem.type === 'folder') return;
      const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
      const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? null : workspaceId;
      const newName = `${docItem.name} (copia)`;
      const payload: Record<string, unknown> = {
          name: newName,
          type: docItem.type || 'text',
          ownerId: user.uid,
          workspaceId: docWorkspaceId,
          folder: docItem.folder || DEFAULT_FOLDER_NAME,
          mimeType: docItem.mimeType || null
      };

      if (docItem.type === 'file') {
          payload.url = docItem.url || null;
          payload.storagePath = docItem.storagePath || null;
      } else {
          payload.content = docItem.content ?? '';
      }

      try {
          const res = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Failed to copy document');
          const data = await res.json();
          await fetchDocs();
          openDocument({
              id: data.id,
              name: newName,
              type: docItem.type || 'text',
              ownerId: user.uid,
              updatedAt: { seconds: Date.now() / 1000 },
              folder: docItem.folder || DEFAULT_FOLDER_NAME,
              mimeType: docItem.mimeType,
              url: docItem.url,
              storagePath: docItem.storagePath,
              content: docItem.content
          });
      } catch (error) {
          console.error('Error copying document', error);
          alert('Error al copiar');
      }
  };

  const promptMoveDocument = async (docItem: DocItem) => {
      const current = docItem.folder || DEFAULT_FOLDER_NAME;
      const target = prompt('Mover a carpeta', current);
      if (!target) return;
      await moveDocumentToFolder(docItem.id, target);
  };

  const createWorkspace = async () => {
      if (!newWorkspaceName.trim() || !user) return;
      try {
          const wsRef = await addDoc(collection(db, 'workspaces'), {
              name: newWorkspaceName,
              ownerId: user.uid,
              members: [user.uid],
              createdAt: serverTimestamp(),
              type: 'shared'
          });
          setNewWorkspaceName('');
          setShowNewWorkspaceModal(false);
          await fetchWorkspaces();
          setCurrentWorkspace({
              id: wsRef.id,
              name: newWorkspaceName,
              ownerId: user.uid,
              members: [user.uid],
              type: 'shared'
          });
      } catch (e) {
          console.error("Error creating workspace", e);
      }
  };

  const createDoc = async (e?: React.FormEvent, folderName?: string) => {
    if(e) e.preventDefault();
    const name = newDocName.trim() || 'Sin título';
    if (!user) return;
    const targetFolder = (folderName ?? activeFolder ?? DEFAULT_FOLDER_NAME).trim() || DEFAULT_FOLDER_NAME;
    const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
    const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? null : workspaceId;
    setIsCreating(true);
    try {
        const response = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                content: '# ' + name,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder,
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create document via API');
        }

        const data = await response.json();
        const docRef = { id: data.id };

        setNewDocName('');
        await fetchDocs();
        openDocument({
            id: docRef.id,
            name: name,
            type: 'text',
            ownerId: user.uid,
            updatedAt: { seconds: Date.now() / 1000 },
            folder: targetFolder
        });
    } catch (e) {
        console.error("Error creating doc", e);
    } finally {
        setIsCreating(false);
    }
  };

  const getUploadContext = () => {
    if (!user) return null;
    const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
    const isPersonal = workspaceId === PERSONAL_WORKSPACE_ID;
    const basePath = isPersonal ? `users/${user.uid}` : `workspaces/${workspaceId}`;

    return {
        workspaceId: isPersonal ? null : workspaceId,
        storageFolder: `${basePath}/${DEFAULT_FOLDER_NAME}`
    };
  };

  const isMarkdownName = (name?: string) => {
    const lower = (name ?? '').toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown') || lower.endsWith('.mkd');
  };

  const isMarkdownFile = (file: File) => {
    if (file.type && file.type.toLowerCase().includes('markdown')) return true;
    return isMarkdownName(file.name);
  };

  const isMarkdownDocItem = (doc: DocItem) => {
    if (doc.mimeType && doc.mimeType.toLowerCase().includes('markdown')) return true;
    return isMarkdownName(doc.name);
  };

  const getFileExtension = (name: string) => {
    const parts = name.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toUpperCase();
  };

  const getDocBadge = (doc: DocItem) => {
    if (doc.type === 'file') {
        if (isMarkdownDocItem(doc)) return 'MD';
        const ext = getFileExtension(doc.name);
        return ext ? (ext.length > 4 ? ext.slice(0, 4) : ext) : 'FILE';
    }
    return isMarkdownName(doc.name) ? 'MD' : 'DOC';
  };

  const docsByFolder = useMemo(() => {
      const grouped: Record<string, DocItem[]> = {};
      docs.forEach(docItem => {
          const folderName = docItem.folder || DEFAULT_FOLDER_NAME;
          if (!grouped[folderName]) grouped[folderName] = [];
          grouped[folderName].push(docItem);
      });
      return grouped;
  }, [docs]);

  const activeFolderDocs = useMemo(() => {
      return docsByFolder[activeFolder] ?? [];
  }, [docsByFolder, activeFolder]);

  const folderChildrenMap = useMemo(() => {
      const map: Record<string, FolderItem[]> = {};
      folders.forEach(folder => {
          const parent = folder.parentPath || '';
          if (!map[parent]) map[parent] = [];
          map[parent].push(folder);
      });
      Object.values(map).forEach(list => {
          list.sort((a, b) => {
              const kindWeight: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
              const weightDiff = kindWeight[a.kind] - kindWeight[b.kind];
              if (weightDiff !== 0) return weightDiff;
              return a.name.localeCompare(b.name);
          });
      });
      return map;
  }, [folders]);

  const activeChildFolders = useMemo(() => {
      return folderChildrenMap[activeFolder] ?? [];
  }, [folderChildrenMap, activeFolder]);

  const renderFolderTree = (parentPath: string, depth = 0): React.ReactNode[] => {
      const children = folderChildrenMap[parentPath] ?? [];
      return children.map(folder => {
          const count = docsByFolder[folder.path]?.length ?? 0;
          const isActive = activeFolder === folder.path;
          const isDropActive = folderDragOver === folder.path;
          const paddingLeft = 12 + depth * 12;

          return (
              <div key={folder.path}>
                  <button
                      onClick={() => setActiveFolder(folder.path)}
                      onDragOver={(e) => handleFolderDragOver(e, folder.path)}
                      onDrop={(e) => handleFolderDrop(e, folder.path)}
                      onDragLeave={() => handleFolderDragLeave(folder.path)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition border ${isDropActive ? 'border-mandy-500/70 bg-mandy-500/10 text-mandy-300' : isActive ? 'border-mandy-500/40 bg-mandy-500/10 text-mandy-300' : 'border-transparent text-surface-300 hover:bg-surface-700/40'}`}
                      style={{ paddingLeft }}
                  >
                      <Folder className={`w-4 h-4 ${isActive ? 'text-mandy-400' : 'text-surface-500'}`} />
                      <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
                      <span className="text-[10px] text-surface-500">{count}</span>
                  </button>
                  {renderFolderTree(folder.path, depth + 1)}
              </div>
          );
      });
  };

  useEffect(() => {
      if (folders.length === 0) {
          if (activeFolder !== DEFAULT_FOLDER_NAME) {
              setActiveFolder(DEFAULT_FOLDER_NAME);
          }
          return;
      }
      const exists = folders.some(folder => folder.path === activeFolder);
      if (!exists) {
          const rootFolders = folderChildrenMap[''] ?? [];
          const fallback = rootFolders[0]?.path || DEFAULT_FOLDER_NAME;
          setActiveFolder(fallback);
      }
  }, [folders, activeFolder, folderChildrenMap]);

  const scheduleUploadStatusClear = () => {
    if (uploadStatusTimer.current) {
        clearTimeout(uploadStatusTimer.current);
    }
    uploadStatusTimer.current = setTimeout(() => setUploadStatus(null), 2000);
  };

  const scheduleDeleteStatusClear = () => {
    if (deleteStatusTimer.current) {
        clearTimeout(deleteStatusTimer.current);
    }
    deleteStatusTimer.current = setTimeout(() => setDeleteStatus(null), 2000);
  };

  const uploadFiles = async (files: File[], targetFolder?: string) => {
    if (!user || files.length === 0) return;
    const folderName = (targetFolder ?? DEFAULT_FOLDER_NAME).trim() || DEFAULT_FOLDER_NAME;
    const context = getUploadContext();
    if (!context) return;

    if (uploadStatusTimer.current) {
        clearTimeout(uploadStatusTimer.current);
    }
    setUploadStatus({
        total: files.length,
        currentIndex: 0,
        currentName: '',
        progress: 0,
        phase: 'uploading'
    });
    setIsUploading(true);
    try {
        const createdDocs: DocItem[] = [];
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            setUploadStatus(prev => prev ? {
                ...prev,
                currentIndex: i + 1,
                currentName: file.name,
                progress: 0,
                phase: 'uploading',
                error: undefined
            } : prev);

            if (isMarkdownFile(file)) {
                const content = await file.text();
                
                const res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: file.name,
                        content: content,
                        type: 'text',
                        mimeType: file.type || 'text/markdown',
                        ownerId: user.uid,
                        workspaceId: context.workspaceId,
                        folder: folderName
                    })
                });
                
                if (!res.ok) throw new Error("Markdown upload failed");
                const data = await res.json();

                setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
                createdDocs.push({
                    id: data.id,
                    name: file.name,
                    type: 'text',
                    mimeType: file.type || 'text/markdown',
                    ownerId: user.uid,
                    updatedAt: { seconds: Date.now()/1000 }
                });
                continue;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('ownerId', user.uid);
            formData.append('workspaceId', context.workspaceId || 'personal');
            formData.append('folder', folderName);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if(!res.ok) throw new Error("API Upload failed");
            
            const newDoc = await res.json();
            createdDocs.push(newDoc);
            
            setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
        }

        await fetchDocs();
        if (createdDocs.length === 1) {
            openDocument(createdDocs[0]);
        }
        setUploadStatus(prev => prev ? { ...prev, progress: 100, phase: 'done' } : prev);
        scheduleUploadStatusClear();
    } catch (error) {
        console.error("Upload failed", error);
        setUploadStatus(prev => prev ? {
            ...prev,
            phase: 'error',
            error: 'Error al subir'
        } : prev);
        scheduleUploadStatusClear();
        alert("Error al subir archivo");
    } finally {
        setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const targetFolder = uploadTargetFolder ?? DEFAULT_FOLDER_NAME;
    setUploadTargetFolder(null);
    await uploadFiles(files, targetFolder);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isFileDrag = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (types.includes('Files')) return true;
    return Array.from(e.dataTransfer?.items ?? []).some(item => item.kind === 'file');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDragActive) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    await uploadFiles(files, DEFAULT_FOLDER_NAME);
  };

  const handleDocDragStart = (e: React.DragEvent, docItem: DocItem) => {
      e.dataTransfer.setData('application/x-doc-id', docItem.id);
      e.dataTransfer.setData('text/plain', docItem.id);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDocDragEnd = () => {
      setFolderDragOver(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
      const types = Array.from(e.dataTransfer.types ?? []);
      const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
      if (!hasDocId || types.includes('Files')) return;
      e.preventDefault();
      setFolderDragOver(folderName);
  };

  const handleFolderDragLeave = (folderName: string) => {
      if (folderDragOver === folderName) {
          setFolderDragOver(null);
      }
  };

  const handleFolderDrop = async (e: React.DragEvent, folderName: string) => {
      const types = Array.from(e.dataTransfer.types ?? []);
      const hasDocId = types.includes('application/x-doc-id') || types.includes('text/plain');
      if (!hasDocId || types.includes('Files')) return;
      const docId = e.dataTransfer.getData('application/x-doc-id') || e.dataTransfer.getData('text/plain');
      if (!docId) return;
      e.preventDefault();
      setFolderDragOver(null);
      await moveDocumentToFolder(docId, folderName);
  };

  const deleteDocument = async (docItem: DocItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (deletingIds[docItem.id]) return;
      if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) return;
      try {
        setDeletingIds(prev => ({ ...prev, [docItem.id]: true }));
        if (deleteStatusTimer.current) {
            clearTimeout(deleteStatusTimer.current);
        }
        setDeleteStatus({ phase: 'deleting', name: docItem.name });
        const res = await fetch(`/api/documents/${docItem.id}`, { method: 'DELETE' });
        if (!res.ok) {
            throw new Error('API delete failed');
        }
        setDocs(prev => prev.filter(item => item.id !== docItem.id));
        closeTabById(docItem.id);
        await fetchDocs();
        setDeleteStatus({ phase: 'done', name: docItem.name });
        scheduleDeleteStatusClear();
      } catch (e) {
        console.error("Error deleting", e);
        setDeleteStatus({ phase: 'error', name: docItem.name, error: 'Error al eliminar' });
        scheduleDeleteStatusClear();
        alert("Error al eliminar");
      } finally {
        setDeletingIds(prev => {
            const next = { ...prev };
            delete next[docItem.id];
            return next;
        });
      }
  };

  const inviteMember = async () => {
     if (!inviteEmail || !currentWorkspace || currentWorkspace.type === 'personal') return;
     try {
         const wsRef = doc(db, 'workspaces', currentWorkspace.id);
         await updateDoc(wsRef, {
             pendingInvites: arrayUnion(inviteEmail)
         });

         alert(`Invitación enviada a ${inviteEmail}`);
         setInviteEmail('');
     } catch(e) {
         console.error("Error inviting", e);
         alert("Error al invitar");
     }
  };

  const getIcon = (doc: DocItem) => {
      if (doc.type === 'file') {
          if (doc.mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
          if (isMarkdownDocItem(doc)) return <FileText className="w-5 h-5" />;
          return <FileIcon className="w-5 h-5" />;
      }
      return <FileText className="w-5 h-5" />;
  };

  if (loading || !user) return (
    <div className="flex h-screen items-center justify-center bg-surface-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mandy-500"></div>
    </div>
  );

  return (
    <div
      className="h-screen bg-surface-900 flex flex-col text-white overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="absolute inset-0 z-50 pointer-events-none">
            <div className="absolute inset-0 bg-surface-900/70 border-2 border-dashed border-mandy-500/70"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-surface-800/80 border border-mandy-500/40 rounded-xl px-6 py-4 text-center shadow-2xl shadow-black/50">
                    <div className="text-sm font-semibold text-white">Suelta para subir</div>
                    <div className="text-xs text-surface-300">
                        Destino: {currentWorkspace?.name || 'Espacio Personal'} / {DEFAULT_FOLDER_NAME}
                    </div>
                </div>
            </div>
        </div>
      )}
      {(uploadStatus || deleteStatus) && (
        <div className="absolute right-4 top-16 z-50 w-72 flex flex-col gap-2">
            {uploadStatus && (
                <div className="bg-surface-800 border border-surface-600/50 rounded-xl p-3 shadow-2xl shadow-black/40">
                    <div className="flex items-center justify-between text-xs font-semibold text-surface-200">
                        <span>
                            {uploadStatus.phase === 'done'
                                ? 'Subida completa'
                                : uploadStatus.phase === 'error'
                                    ? 'Error de carga'
                                    : `Subiendo ${uploadStatus.currentIndex}/${uploadStatus.total}`}
                        </span>
                        {uploadStatus.phase === 'done' && <Check className="w-3 h-3 text-emerald-400" />}
                        {uploadStatus.phase === 'uploading' && <Upload className="w-3 h-3 text-mandy-400" />}
                    </div>
                    {uploadStatus.currentName && (
                        <div className="mt-1 text-[11px] text-surface-400 truncate">{uploadStatus.currentName}</div>
                    )}
                    <div className="mt-2 h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
                        <div
                            className={`${uploadStatus.phase === 'error' ? 'bg-red-500' : 'bg-mandy-500'} h-full transition-all`}
                            style={{ width: `${uploadStatus.progress}%` }}
                        />
                    </div>
                    {uploadStatus.phase === 'error' && uploadStatus.error && (
                        <div className="mt-1 text-[11px] text-red-400">{uploadStatus.error}</div>
                    )}
                </div>
            )}
            {deleteStatus && (
                <div className="bg-surface-800 border border-surface-600/50 rounded-xl p-3 shadow-2xl shadow-black/40">
                    <div className="flex items-center justify-between text-xs font-semibold text-surface-200">
                        <span>
                            {deleteStatus.phase === 'done'
                                ? 'Eliminado'
                                : deleteStatus.phase === 'error'
                                    ? 'Error al eliminar'
                                    : 'Eliminando...'}
                        </span>
                        {deleteStatus.phase === 'done' && <Check className="w-3 h-3 text-emerald-400" />}
                        {deleteStatus.phase === 'deleting' && <Loader2 className="w-3 h-3 text-mandy-400 animate-spin" />}
                    </div>
                    {deleteStatus.name && (
                        <div className="mt-1 text-[11px] text-surface-400 truncate">{deleteStatus.name}</div>
                    )}
                    <div className="mt-2 h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
                        <div
                            className={`${deleteStatus.phase === 'error' ? 'bg-red-500' : 'bg-amber-500'} h-full transition-all ${deleteStatus.phase === 'deleting' ? 'animate-pulse' : ''}`}
                            style={{ width: deleteStatus.phase === 'deleting' ? '60%' : '100%' }}
                        />
                    </div>
                    {deleteStatus.phase === 'error' && deleteStatus.error && (
                        <div className="mt-1 text-[11px] text-red-400">{deleteStatus.error}</div>
                    )}
                </div>
            )}
        </div>
      )}
      {/* Top Header */}
      <header className="h-14 bg-surface-800 border-b border-surface-600/50 flex items-center justify-between px-4 shrink-0 z-50 relative">
            <div className="flex items-center gap-4">
                <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="md:hidden p-1.5 text-surface-400 hover:bg-surface-700 rounded">
                    <Menu className="w-5 h-5" />
                </button>
                <div onClick={() => { setSelectedDocId(null); setShowTerminal(false); }} className="font-bold flex items-center gap-2 text-white cursor-pointer">
                    <span className="bg-gradient-mandy text-white p-1 rounded-md text-xs">St</span>
                    <span className="hidden sm:inline">Studio</span>
                </div>

                {/* Workspace Selector */}
                <div className="relative">
                    <button
                        onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-700 rounded-lg transition border border-transparent hover:border-surface-600"
                    >
                        {currentWorkspace?.type === 'personal' ? (
                            <User className="w-4 h-4 text-surface-400" />
                        ) : (
                            <Briefcase className="w-4 h-4 text-mandy-400" />
                        )}
                        <span className="font-medium text-sm max-w-[120px] truncate text-surface-200">{currentWorkspace?.name || 'Seleccionar'}</span>
                        <ChevronDown className="w-3 h-3 text-surface-500" />
                        {invites.length > 0 && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mandy-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mandy-500"></span></span>}
                    </button>

                    {showWorkspaceMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-surface-800 border border-surface-600/50 shadow-2xl shadow-black/50 rounded-xl z-20 overflow-hidden">
                                {invites.length > 0 && (
                                    <>
                                        <div className="p-2 border-b border-surface-600/50 bg-mandy-500/10">
                                            <span className="text-xs font-semibold text-mandy-400 uppercase tracking-wider px-2">Invitaciones</span>
                                        </div>
                                        {invites.map(ws => (
                                            <div key={ws.id} className="px-4 py-3 flex items-center justify-between hover:bg-surface-700 border-b border-surface-600/30">
                                                <span className="text-sm font-medium text-surface-200 truncate max-w-[120px]">{ws.name}</span>
                                                <button
                                                    onClick={() => acceptInvite(ws)}
                                                    className="text-xs bg-mandy-500 text-white px-2 py-1 rounded hover:bg-mandy-600"
                                                >
                                                    Unirse
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                                <div className="p-2 border-b border-surface-600/50">
                                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-2">Mis Espacios</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {workspaces.map(ws => (
                                        <button
                                            key={ws.id}
                                            onClick={() => {
                                                setCurrentWorkspace(ws);
                                                setShowWorkspaceMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-surface-700 transition ${currentWorkspace?.id === ws.id ? 'bg-mandy-500/10 text-mandy-400' : 'text-surface-300'}`}
                                        >
                                            {ws.type === 'personal' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                                            {ws.name}
                                            {currentWorkspace?.id === ws.id && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-surface-600/50 bg-surface-700/50">
                                    <button
                                        onClick={() => {
                                            setShowNewWorkspaceModal(true);
                                            setShowWorkspaceMenu(false);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs font-medium hover:border-mandy-500/50 hover:text-mandy-400 transition"
                                    >
                                        <Plus className="w-3 h-3" /> Nuevo Espacio
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {currentWorkspace?.members && (
                    <button
                        onClick={() => setShowMembersModal(true)}
                        className="items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-200 px-2 py-1 rounded hover:bg-surface-700 transition hidden sm:flex"
                    >
                        <Users className="w-3.5 h-3.5" />
                        {currentWorkspace.members.length}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-sm text-surface-400 bg-surface-700 px-3 py-1.5 rounded-full">
                    <User className="w-4 h-4" />
                    <span className="truncate max-w-[150px] hidden md:inline">{user.email}</span>
                </div>
                <button
                    onClick={() => logout()}
                    className="p-2 text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 rounded-full transition"
                    title="Cerrar Sesión"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
             <div className="absolute inset-0 z-30 bg-black/40 md:hidden" onClick={() => setShowMobileSidebar(false)} />
        )}

        {/* Sidebar */}
        <div
            style={{ width: sidebarWidth }}
            className={`
                bg-surface-800 border-r border-surface-600/50 flex flex-col shrink-0 transition-transform duration-300 absolute md:relative z-40 h-full
                ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
        >
            <div className="p-3 border-b border-surface-600/50 flex justify-between items-center bg-surface-700/30 gap-2">
                <div
                    onClick={() => { setSelectedDocId(null); setShowTerminal(false); }}
                    className="flex items-center gap-2 cursor-pointer hover:bg-surface-700 px-2 py-1 rounded transition flex-1"
                    title="Volver a Vista Cuadrícula"
                >
                    <Folder className="w-4 h-4 text-surface-500" />
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Archivos</span>
                </div>
                <div className="flex gap-0.5">
                    <button
                        onClick={() => createDoc(undefined, activeFolder)}
                        className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition"
                        title="Nuevo Archivo"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => createFolder()}
                        className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition"
                        title="Nueva Carpeta"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            setUploadTargetFolder(DEFAULT_FOLDER_NAME);
                            fileInputRef.current?.click();
                        }}
                        className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition"
                        title="Subir Archivo"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {/* Mi Asistente (Terminal) Button */}
                <div 
                    onClick={() => {
                        setShowTerminal(true);
                        setSelectedDocId(null);
                        setShowMobileSidebar(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 mb-2 text-sm rounded-md cursor-pointer transition ${showTerminal ? 'bg-mandy-500 text-white shadow-lg shadow-mandy-500/20' : 'text-surface-300 hover:bg-surface-700/50'}`}
                >
                    <TerminalIcon className={`w-5 h-5 ${showTerminal ? 'text-white' : 'text-mandy-400'}`} />
                    <span className="font-bold flex-1">Mi Asistente</span>
                    {showTerminal && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                </div>

                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-surface-500 uppercase mt-4">
                    <ChevronDown className="w-3 h-3" />
                    {currentWorkspace?.name}
                </div>

                {docs.length === 0 && (
                     <div className="px-4 py-8 text-center text-xs text-surface-500">
                        Vacío
                     </div>
                )}

                {docs.map(doc => (
                    <div
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer select-none transition ${selectedDocId === doc.id ? 'bg-mandy-500/15 text-mandy-400 font-medium' : 'text-surface-300 hover:bg-surface-700/50'}`}
                    >
                        <div className={`${selectedDocId === doc.id ? 'text-mandy-500' : 'text-surface-500'}`}>
                            {getIcon(doc)}
                        </div>
                        <span className="truncate flex-1">{doc.name}</span>
                                        <div className="ml-auto flex items-center gap-1.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
                                                {getDocBadge(doc)}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyDocument(doc);
                                                }}
                                                className="text-surface-500 hover:text-surface-200 p-0.5 transition-opacity opacity-0 group-hover:opacity-100"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    promptMoveDocument(doc);
                                                }}
                                                className="text-surface-500 hover:text-surface-200 p-0.5 transition-opacity opacity-0 group-hover:opacity-100"
                                                title="Mover"
                                            >
                                                <FolderInput className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => deleteDocument(doc, e)}
                                                className={`text-surface-500 hover:text-mandy-500 p-0.5 transition-opacity ${deletingIds[doc.id] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                disabled={!!deletingIds[doc.id]}
                                                title="Eliminar"
                                            >
                                {deletingIds[doc.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-surface-600/50 bg-surface-800 text-xs text-surface-500 flex justify-between items-center">
                <span>{docs.length} items</span>
                <div className="flex gap-2">
                   <Settings className="w-4 h-4 hover:text-surface-300 cursor-pointer" />
                   <HelpCircle className="w-4 h-4 hover:text-surface-300 cursor-pointer" />
                </div>
            </div>
        </div>

        {/* Central Pane */}
        <div className="flex-1 flex flex-col bg-surface-900 overflow-hidden relative">

            {/* Tabs Bar */}
            {selectedDocId && openTabs.length > 0 && (
                <div className="flex items-center border-b border-surface-600/50 bg-surface-800 overflow-x-auto scrollbar-hide">
                    {openTabs.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => setSelectedDocId(tab.id)}
                            className={`
                                group flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer min-w-[120px] max-w-[200px] border-r border-surface-600/30 select-none
                                ${selectedDocId === tab.id ? 'bg-surface-900 text-mandy-400 border-t-2 border-t-mandy-500' : 'text-surface-500 hover:bg-surface-700/50'}
                            `}
                        >
                            {getIcon(tab)}
                            <span className="truncate flex-1">{tab.name}</span>
                            <button
                                onClick={(e) => closeTab(tab.id, e)}
                                className={`p-0.5 rounded-full hover:bg-surface-700 ${selectedDocId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Content Area */}
            {showTerminal ? (
                <div className="flex-1 min-h-0 bg-black overflow-hidden flex flex-col">
                    <div className="flex-1">
                        <Terminal nexusUrl={process.env.NEXT_PUBLIC_NEXUS_URL || "http://localhost:3002"} />
                    </div>
                </div>
            ) : selectedDocId && openTabs.length > 0 ? (
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className={`grid ${gridColsClass} ${gridRowsClass} gap-3 p-3 flex-1 min-h-0`}>
                        {gridDocs.map(doc => {
                            const currentMode = docModes[doc.id] ?? 'split';
                            const isActive = doc.id === selectedDocId;
                            const modeButtonBase = 'p-1 rounded-md border border-transparent transition';
                            const modeActive = 'bg-mandy-500/20 text-mandy-300 border-mandy-500/40';
                            const modeIdle = 'text-surface-400 hover:text-surface-100 hover:bg-surface-700/60';

                            return (
                                <div
                                    key={doc.id}
                                    className={`flex flex-col min-h-0 rounded-lg border ${isActive ? 'border-mandy-500/60 shadow-lg shadow-mandy-500/10' : 'border-surface-700/60'} bg-surface-900 overflow-hidden`}
                                >
                                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/70 border-b border-surface-700/60">
                                        <button onClick={() => setSelectedDocId(doc.id)} className="flex items-center gap-2 min-w-0 text-left">
                                            <span className="text-surface-400">{getIcon(doc)}</span>
                                            <span className="text-xs font-semibold text-surface-200 truncate">{doc.name}</span>
                                        </button>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
                                            {getDocBadge(doc)}
                                        </span>
                                        <div className="ml-auto flex items-center gap-1">
                                            <button
                                                onClick={() => setDocMode(doc.id, 'edit')}
                                                className={`${modeButtonBase} ${currentMode === 'edit' ? modeActive : modeIdle}`}
                                                title="Solo edicion"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDocMode(doc.id, 'split')}
                                                className={`${modeButtonBase} ${currentMode === 'split' ? modeActive : modeIdle}`}
                                                title="Edicion y vista"
                                            >
                                                <Columns className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDocMode(doc.id, 'preview')}
                                                className={`${modeButtonBase} ${currentMode === 'preview' ? modeActive : modeIdle}`}
                                                title="Solo vista"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => closeTabById(doc.id)}
                                                className="p-1 rounded-md text-surface-400 hover:text-mandy-300 hover:bg-surface-700/60 transition"
                                                title="Cerrar"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <Editor roomId={doc.id} embedded viewMode={currentMode} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                // Archivos Explorer
                <div className="flex-1 min-h-0 flex flex-col bg-surface-900">
                    <div className="px-6 py-4 border-b border-surface-700/60 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {currentWorkspace?.type === 'personal' ? <User className="w-6 h-6 text-surface-400" /> : <Briefcase className="w-6 h-6 text-mandy-400" />}
                            <div className="flex flex-col">
                                <span className="text-lg font-bold text-white">{currentWorkspace?.name}</span>
                                <span className="text-xs text-surface-400">Carpeta: {activeFolder}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => createDoc(undefined, activeFolder)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nuevo Doc
                            </button>
                            <button
                                onClick={() => createFolder()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
                            >
                                <FolderPlus className="w-3.5 h-3.5" /> Nueva Carpeta
                            </button>
                            <button
                                onClick={() => {
                                    setUploadTargetFolder(activeFolder);
                                    fileInputRef.current?.click();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
                            >
                                <Upload className="w-3.5 h-3.5" /> Subir
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 flex">
                        <aside className="w-64 border-r border-surface-700/60 bg-surface-800/40 flex flex-col">
                            <div className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                Carpetas
                            </div>
                            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                                {renderFolderTree('')}
                            </div>
                        </aside>
                        <section className="flex-1 min-h-0 overflow-y-auto">
                            <div className="px-6 py-4 text-xs text-surface-400 uppercase tracking-wider">
                                Documentos
                            </div>
                            <div className="px-4 pb-6 space-y-1">
                                {activeChildFolders.map(folder => {
                                    const count = docsByFolder[folder.path]?.length ?? 0;
                                    const isDropActive = folderDragOver === folder.path;
                                    return (
                                        <div
                                            key={folder.path}
                                            onClick={() => setActiveFolder(folder.path)}
                                            onDragOver={(e) => handleFolderDragOver(e, folder.path)}
                                            onDrop={(e) => handleFolderDrop(e, folder.path)}
                                            onDragLeave={() => handleFolderDragLeave(folder.path)}
                                            className={`group flex items-center gap-3 px-4 py-3 rounded-lg border transition cursor-pointer ${isDropActive ? 'border-mandy-500/70 bg-mandy-500/10' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'}`}
                                        >
                                            <Folder className="w-4 h-4 text-surface-500" />
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-surface-200 truncate">{folder.name}</span>
                                                <span className="text-[11px] text-surface-500 truncate">{folder.path}</span>
                                            </div>
                                            <span className="text-[10px] text-surface-500">{count}</span>
                                        </div>
                                    );
                                })}
                                {activeChildFolders.length === 0 && activeFolderDocs.length === 0 ? (
                                    <div className="px-4 py-6 text-sm text-surface-500">Esta carpeta está vacía.</div>
                                ) : activeFolderDocs.map(doc => (
                                    <div
                                        key={doc.id}
                                        onClick={() => openDocument(doc)}
                                        draggable
                                        onDragStart={(e) => handleDocDragStart(e, doc)}
                                        onDragEnd={handleDocDragEnd}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-surface-800/80 bg-surface-800/40 hover:bg-surface-800/70 hover:border-surface-600/80 transition cursor-pointer"
                                    >
                                        <div className="text-surface-500">{getIcon(doc)}</div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-surface-200 truncate">{doc.name}</span>
                                            <span className="text-[11px] text-surface-500 truncate">{doc.folder || DEFAULT_FOLDER_NAME}</span>
                                        </div>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
                                            {getDocBadge(doc)}
                                        </span>
                                        <div className="ml-auto flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyDocument(doc);
                                                }}
                                                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    promptMoveDocument(doc);
                                                }}
                                                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                                                title="Mover"
                                            >
                                                <FolderInput className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => deleteDocument(doc, e)}
                                                className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition opacity-0 group-hover:opacity-100"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewWorkspaceModal && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <div className="bg-surface-800 rounded-2xl shadow-2xl shadow-black/50 p-6 w-full max-w-sm border border-surface-600/50">
                    <h2 className="text-lg font-bold mb-4 text-white">Nuevo Espacio de Trabajo</h2>
                    <input
                        type="text"
                        placeholder="Nombre, ej: Grupo Física"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        className="w-full px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg mb-4 text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowNewWorkspaceModal(false)} className="px-4 py-2 text-sm text-surface-400 hover:bg-surface-700 rounded-lg">Cancelar</button>
                        <button onClick={createWorkspace} disabled={!newWorkspaceName.trim()} className="px-4 py-2 text-sm bg-gradient-mandy text-white rounded-lg hover:opacity-90 disabled:opacity-50">Crear</button>
                    </div>
                </div>
            </motion.div>
        )}

        {showMembersModal && currentWorkspace && (
             <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <div className="bg-surface-800 rounded-2xl shadow-2xl shadow-black/50 p-6 w-full max-w-md border border-surface-600/50">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                            <Users className="w-5 h-5 text-mandy-400" />
                            Miembros de {currentWorkspace.name}
                        </h2>
                        <button onClick={() => setShowMembersModal(false)} className="p-1 hover:bg-surface-700 rounded-full text-surface-400"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Invitar por Email</label>
                        <div className="flex gap-2">
                             <input
                                type="email"
                                placeholder="usuario@ejemplo.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="flex-1 px-4 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-white placeholder:text-surface-500 focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none"
                            />
                            <button onClick={inviteMember} className="bg-gradient-mandy text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">Enviar</button>
                        </div>
                    </div>

                    <div className="space-y-3">
                         <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Miembros ({currentWorkspace.members.length})</label>
                         <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
                            {currentWorkspace.members.map((uid) => (
                                <div key={uid} className="flex items-center justify-between p-2 bg-surface-700 rounded-lg text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-mandy-500/15 text-mandy-400 rounded-full flex items-center justify-center text-xs font-bold">
                                            U
                                        </div>
                                        <span className="text-surface-300 font-mono text-xs">{uid.substring(0, 8)}...</span>
                                        {uid === currentWorkspace.ownerId && <span className="bg-accent-purple/20 text-accent-purple-light text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                    </div>
                                    <Shield className={`w-3 h-3 ${uid === currentWorkspace.ownerId ? 'text-mandy-400' : 'text-surface-600'}`} />
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
             </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
