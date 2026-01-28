'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { FileText, Plus, Trash2, Search, LogOut, User, Upload, Image as ImageIcon, File as FileIcon, Users, Briefcase, ChevronDown, Check, X, Shield, Folder, MoreVertical, FileCode, Settings, HelpCircle, ArrowLeft, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@/components/Editor';

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
  type?: 'text' | 'file';
  url?: string;
  mimeType?: string;
  folder?: string;
  updatedAt: any;
  ownerId: string;
  workspaceId?: string;
}

const PERSONAL_WORKSPACE_ID = 'personal';
const DEFAULT_FOLDER_NAME = 'No estructurado';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
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
  const [openTabs, setOpenTabs] = useState<DocItem[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Actions State
  const [newDocName, setNewDocName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
        const qMembers = query(collection(db, 'workspaces'), where('members', 'array-contains', user.uid));

        const snapshot = await getDocs(qMembers);
        const fetched: Workspace[] = [];
        snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as Workspace));

        if (user.email) {
            const qInvites = query(collection(db, 'workspaces'), where('pendingInvites', 'array-contains', user.email));
            const snapInvites = await getDocs(qInvites);
            const fetchedInvites: Workspace[] = [];
            snapInvites.forEach(doc => fetchedInvites.push({ id: doc.id, ...doc.data() } as Workspace));
            setInvites(fetchedInvites);
        }

        const personalSpace: Workspace = {
            id: PERSONAL_WORKSPACE_ID,
            name: 'Espacio Personal',
            ownerId: user.uid,
            members: [user.uid],
            type: 'personal'
        };

        const allWorkspaces = [personalSpace, ...fetched];
        setWorkspaces(allWorkspaces);
        setCurrentWorkspace(prev => prev ?? personalSpace);
    } catch (e) {
        console.error("Error fetching workspaces", e);
    }
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
        let q;
        if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
            q = query(collection(db, 'documents'), where('ownerId', '==', user.uid));
        } else {
            q = query(collection(db, 'documents'), where('workspaceId', '==', currentWorkspace.id));
        }

        const querySnapshot = await getDocs(q);
        const fetched: DocItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as any;
            if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
                if (!data.workspaceId || data.workspaceId === PERSONAL_WORKSPACE_ID) {
                    fetched.push({ id: doc.id, ...data } as DocItem);
                }
            } else {
                fetched.push({ id: doc.id, ...data } as DocItem);
            }
        });

        fetched.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setDocs(fetched);
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

  const openDocument = (doc: DocItem) => {
      if (!openTabs.find(t => t.id === doc.id)) {
          setOpenTabs([...openTabs, doc]);
      }
      setSelectedDocId(doc.id);
      setShowMobileSidebar(false);
  };

  const closeTab = (docId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newTabs = openTabs.filter(t => t.id !== docId);
      setOpenTabs(newTabs);
      if (selectedDocId === docId) {
          setSelectedDocId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
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

  const createDoc = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    const name = newDocName.trim() || 'Sin título';
    if (!user) return;
    const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
    const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? null : workspaceId;
    setIsCreating(true);
    try {
        const docRef = await addDoc(collection(db, 'documents'), {
            name: name,
            content: '# ' + name,
            type: 'text',
            ownerId: user.uid,
            workspaceId: docWorkspaceId,
            folder: DEFAULT_FOLDER_NAME,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setNewDocName('');
        await fetchDocs();
        openDocument({ id: docRef.id, name: name, type: 'text', ownerId: user.uid, updatedAt: { seconds: Date.now() / 1000 } });
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

  const buildStorageFileName = (fileName: string) => {
    const safeName = fileName.replace(/[\\/]/g, '_');
    const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return `${uniqueId}_${safeName}`;
  };

  const uploadFiles = async (files: File[]) => {
    if (!user || files.length === 0) return;
    const context = getUploadContext();
    if (!context) return;

    setIsUploading(true);
    try {
        const createdDocs: DocItem[] = [];
        for (const file of files) {
            const storageRef = ref(storage, `${context.storageFolder}/${buildStorageFileName(file.name)}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const docRef = await addDoc(collection(db, 'documents'), {
                name: file.name,
                type: 'file',
                url: url,
                mimeType: file.type,
                storagePath: storageRef.fullPath,
                ownerId: user.uid,
                workspaceId: context.workspaceId,
                folder: DEFAULT_FOLDER_NAME,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            createdDocs.push({
                id: docRef.id,
                name: file.name,
                type: 'file',
                url: url,
                mimeType: file.type,
                ownerId: user.uid,
                updatedAt: { seconds: Date.now()/1000 }
            });
        }

        await fetchDocs();
        if (createdDocs.length === 1) {
            openDocument(createdDocs[0]);
        }
    } catch (error) {
        console.error("Upload failed", error);
        alert("Error uploading file");
    } finally {
        setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    await uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer?.types?.includes('Files');

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
    await uploadFiles(files);
  };

  const deleteDocument = async (docItem: DocItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) return;
      try {
        if (docItem.type === 'file' && (docItem as any).storagePath) {
            const storageRef = ref(storage, (docItem as any).storagePath);
            await deleteObject(storageRef).catch(e => console.warn("Storage delete failed", e));
        }
        await deleteDoc(doc(db, 'documents', docItem.id));
        fetchDocs();
        if (selectedDocId === docItem.id) setSelectedDocId(null);
      } catch (e) {
        console.error("Error deleting", e);
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
      {/* Top Header */}
      <header className="h-14 bg-surface-800 border-b border-surface-600/50 flex items-center justify-between px-4 shrink-0 z-50 relative">
            <div className="flex items-center gap-4">
                <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="md:hidden p-1.5 text-surface-400 hover:bg-surface-700 rounded">
                    <Menu className="w-5 h-5" />
                </button>
                <div onClick={() => setSelectedDocId(null)} className="font-bold flex items-center gap-2 text-white cursor-pointer">
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
                    onClick={() => setSelectedDocId(null)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-surface-700 px-2 py-1 rounded transition flex-1"
                    title="Volver a Vista Cuadrícula"
                >
                    <Folder className="w-4 h-4 text-surface-500" />
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Archivos</span>
                </div>
                <div className="flex gap-0.5">
                    <button onClick={() => createDoc()} className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Nuevo Archivo"><Plus className="w-4 h-4" /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Subir Archivo"><Upload className="w-4 h-4" /></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-surface-500 uppercase mt-2">
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
                        <button
                            onClick={(e) => deleteDocument(doc, e)}
                            className="text-surface-500 opacity-0 group-hover:opacity-100 hover:text-mandy-500 p-0.5"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
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
            {openTabs.length > 0 && (
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

            {selectedDocId ? (
                 <Editor
                    key={selectedDocId}
                    roomId={selectedDocId}
                    onClose={() => closeTab(selectedDocId, { stopPropagation: () => {} } as React.MouseEvent)}
                 />
            ) : (
                // Grid View (Empty State / Home)
                <div className="flex-1 overflow-y-auto p-8 bg-surface-900">
                     <div className="max-w-5xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            {currentWorkspace?.type === 'personal' ? <User className="w-8 h-8 text-surface-400" /> : <Briefcase className="w-8 h-8 text-mandy-400" />}
                            {currentWorkspace?.name}
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {docs.map(doc => (
                                <motion.div
                                    key={doc.id}
                                    layoutId={doc.id}
                                    onClick={() => openDocument(doc)}
                                    className="bg-surface-800 group p-4 rounded-xl border border-surface-600/50 hover:border-mandy-500/30 hover:shadow-lg hover:shadow-mandy-500/5 transition cursor-pointer flex flex-col items-center text-center gap-3 aspect-square justify-center relative"
                                >
                                     <div className={`p-4 rounded-full ${doc.type === 'file' ? 'bg-accent-purple/20 text-accent-purple-light' : 'bg-mandy-500/10 text-mandy-400'}`}>
                                         {doc.type === 'file' ? <FileIcon className="w-8 h-8" /> : <FileCode className="w-8 h-8" />}
                                     </div>
                                     <span className="font-medium text-surface-200 text-sm line-clamp-2 w-full break-words">
                                         {doc.name}
                                     </span>
                                </motion.div>
                            ))}

                            {/* Add Button Card */}
                            <button
                                onClick={() => createDoc()}
                                className="border-2 border-dashed border-surface-600 rounded-xl flex flex-col items-center justify-center gap-2 text-surface-500 hover:border-mandy-500/50 hover:text-mandy-400 hover:bg-mandy-500/5 transition aspect-square"
                            >
                                <Plus className="w-8 h-8" />
                                <span className="text-sm font-medium">Nuevo Doc</span>
                            </button>
                        </div>
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
