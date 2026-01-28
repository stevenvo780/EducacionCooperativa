'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { FileText, Plus, Trash2, Search, LogOut, User, Upload, Image as ImageIcon, File as FileIcon, Users, Briefcase, ChevronDown, Check, X, Shield, Folder, MoreVertical, FileCode, Settings, HelpCircle, ArrowLeft } from 'lucide-react';
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
  updatedAt: any;
  ownerId: string;
  workspaceId?: string;
}

const PERSONAL_WORKSPACE_ID = 'personal';

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
  const [sidebarWidth, setSidebarWidth] = useState(260);

  // Actions State
  const [newDocName, setNewDocName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
        initializeDashboard();
    }
  }, [user, loading, router]);

  useEffect(() => {
      if (currentWorkspace && user) {
          fetchDocs();
      }
  }, [currentWorkspace]);

  const initializeDashboard = async () => {
    if (!user) return;
    // 1. Fetch Workspaces
    await fetchWorkspaces();
  };

  const fetchWorkspaces = async () => {
    if (!user) return;
    try {
        const qMembers = query(collection(db, 'workspaces'), where('members', 'array-contains', user.uid));
        
        const snapshot = await getDocs(qMembers);
        const fetched: Workspace[] = [];
        snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as Workspace));
        
        // Fetch Invites
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
        
        if (!currentWorkspace) {
            setCurrentWorkspace(personalSpace);
        }
    } catch (e) {
        console.error("Error fetching workspaces", e);
    }
  };

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

  const fetchDocs = async () => {
    if (!user || !currentWorkspace) return;
    try {
        let q;
        if (currentWorkspace.id === PERSONAL_WORKSPACE_ID) {
            // Fetch personal docs (no workspaceId or null)
            // Note: Compound queries with '==' null are tricky in simple mode, 
            // so we might need to filter client side if we don't have a reliable index.
            // For now, let's query by ownerId and filter.
            // A better V2 approach: add 'workspaceId: "personal"' to all new personal docs.
            q = query(collection(db, 'documents'), where('ownerId', '==', user.uid));
        } else {
            q = query(collection(db, 'documents'), where('workspaceId', '==', currentWorkspace.id));
        }

        const querySnapshot = await getDocs(q);
        const fetched: DocItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as any;
            // Client-side filtering for Personal Workspace legacy docs
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
  };

  const createWorkspace = async () => {
      if (!newWorkspaceName.trim() || !user) return;
      try {
          const wsRef = await addDoc(collection(db, 'workspaces'), {
              name: newWorkspaceName,
              ownerId: user.uid,
              members: [user.uid], // Owner is a member
              createdAt: serverTimestamp(),
              type: 'shared'
          });
          setNewWorkspaceName('');
          setShowNewWorkspaceModal(false);
          await fetchWorkspaces();
          // Switch to new workspace
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
    setIsCreating(true);
    try {
        const docRef = await addDoc(collection(db, 'documents'), {
            name: name,
            content: '# ' + name,
            type: 'text',
            ownerId: user.uid,
            workspaceId: currentWorkspace?.id === PERSONAL_WORKSPACE_ID ? null : currentWorkspace?.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setNewDocName('');
        await fetchDocs(); 
        setSelectedDocId(docRef.id);
    } catch (e) {
        console.error("Error creating doc", e);
    } finally {
        setIsCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    try {
        // Path adjusted: workspaces/{wsId}/{file} or users/{uid}/{file}
        const basePath = currentWorkspace?.id === PERSONAL_WORKSPACE_ID 
            ? `users/${user.uid}` 
            : `workspaces/${currentWorkspace?.id}`;
            
        const storageRef = ref(storage, `${basePath}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        const docRef = await addDoc(collection(db, 'documents'), {
            name: file.name,
            type: 'file',
            url: url,
            mimeType: file.type,
            storagePath: storageRef.fullPath,
            ownerId: user.uid,
            workspaceId: currentWorkspace?.id === PERSONAL_WORKSPACE_ID ? null : currentWorkspace?.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        await fetchDocs();
        setSelectedDocId(docRef.id);
    } catch (error) {
        console.error("Upload failed", error);
        alert("Error uploading file");
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
         // Find user by email (Need a cloud function or specialized query usually, 
         // but for now we'll just add to a 'pendingInvites' array and assume they accept later, 
         // OR if we want to be insecure/fast, we query users collection if readable).
         
         // V1 Simplified: Just add to pendingInvites
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
    <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col text-slate-900 overflow-hidden">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20">
            <div className="flex items-center gap-4">
                <Link href="/" className="font-bold flex items-center gap-2 text-slate-800">
                    <span className="bg-blue-600 text-white p-1 rounded-md text-xs">St</span>
                    <span className="hidden sm:inline">Studio</span>
                </Link>
                
                {/* Workspace Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200"
                    >
                        {currentWorkspace?.type === 'personal' ? (
                            <User className="w-4 h-4 text-slate-500" />
                        ) : (
                            <Briefcase className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="font-medium text-sm max-w-[120px] truncate">{currentWorkspace?.name || 'Seleccionar'}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    
                    {showWorkspaceMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden">
                                {invites.length > 0 && (
                                    <>
                                        <div className="p-2 border-b border-slate-100 bg-amber-50">
                                            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider px-2">Invitaciones</span>
                                        </div>
                                        {invites.map(ws => (
                                            <div key={ws.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 border-b border-slate-100">
                                                <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{ws.name}</span>
                                                <button 
                                                    onClick={() => acceptInvite(ws)}
                                                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                                >
                                                    Unirse
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                                <div className="p-2 border-b border-slate-100">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Mis Espacios</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {workspaces.map(ws => (
                                        <button
                                            key={ws.id}
                                            onClick={() => {
                                                setCurrentWorkspace(ws);
                                                setShowWorkspaceMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-slate-50 transition ${currentWorkspace?.id === ws.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                        >
                                            {ws.type === 'personal' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                                            {ws.name}
                                            {currentWorkspace?.id === ws.id && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-slate-100 bg-slate-50">
                                    <button 
                                        onClick={() => {
                                            setShowNewWorkspaceModal(true);
                                            setShowWorkspaceMenu(false);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-600 transition"
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
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition hidden sm:flex"
                    >
                        <Users className="w-3.5 h-3.5" />
                        {currentWorkspace.members.length}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                    <User className="w-4 h-4" />
                    <span className="truncate max-w-[150px] hidden md:inline">{user.email}</span>
                </div>
                <button 
                    onClick={() => logout()}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                    title="Cerrar Sesión"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div style={{ width: sidebarWidth }} className="bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 transition-all hidden md:flex">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-100/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explorador</span>
                <div className="flex gap-1">
                    <button onClick={() => createDoc()} className="p-1 hover:bg-white rounded text-slate-500 hover:text-blue-600 transition" title="Nuevo Archivo"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-white rounded text-slate-500 hover:text-blue-600 transition" title="Subir Archivo"><Upload className="w-4 h-4" /></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {/* Simulated Folder Structure - Root */}
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-slate-400 uppercase mt-2">
                    <ChevronDown className="w-3 h-3" />
                    {currentWorkspace?.name}
                </div>
                
                {docs.length === 0 && (
                     <div className="px-4 py-8 text-center text-xs text-slate-400">
                        Vacío
                     </div>
                )}

                {docs.map(doc => (
                    <div 
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer select-none transition ${selectedDocId === doc.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-200/50'}`}
                    >
                        <div className={`${selectedDocId === doc.id ? 'text-blue-600' : 'text-slate-400'}`}>
                            {getIcon(doc)}
                        </div>
                        <span className="truncate flex-1">{doc.name}</span>
                        <button 
                            onClick={(e) => deleteDocument(doc, e)}
                            className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white text-xs text-slate-400 flex justify-between items-center">
                <span>{docs.length} items</span>
                <div className="flex gap-2">
                   <Settings className="w-4 h-4 hover:text-slate-600 cursor-pointer" />
                   <HelpCircle className="w-4 h-4 hover:text-slate-600 cursor-pointer" />
                </div>
            </div>
        </div>

        {/* Central Pane */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            {selectedDocId ? (
                // Editor View
                 <Editor 
                    roomId={selectedDocId} 
                    onClose={() => setSelectedDocId(null)} 
                 />
            ) : (
                // Grid View (Empty State / Home)
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                     <div className="max-w-5xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                            {currentWorkspace?.type === 'personal' ? <User className="w-8 h-8 text-blue-500" /> : <Briefcase className="w-8 h-8 text-orange-500" />}
                            {currentWorkspace?.name}
                        </h2>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {docs.map(doc => (
                                <motion.div 
                                    key={doc.id}
                                    layoutId={doc.id}
                                    onClick={() => setSelectedDocId(doc.id)}
                                    className="bg-white group p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition cursor-pointer flex flex-col items-center text-center gap-3 aspect-square justify-center relative"
                                >
                                     <div className={`p-4 rounded-full ${doc.type === 'file' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                                         {doc.type === 'file' ? <FileIcon className="w-8 h-8" /> : <FileCode className="w-8 h-8" />}
                                     </div>
                                     <span className="font-medium text-slate-700 text-sm line-clamp-2 w-full break-words">
                                         {doc.name}
                                     </span>
                                </motion.div>
                            ))}

                            {/* Add Button Card */}
                            <button 
                                onClick={() => createDoc()}
                                className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition aspect-square"
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            >
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                    <h2 className="text-lg font-bold mb-4">Nuevo Espacio de Trabajo</h2>
                    <input 
                        type="text" 
                        placeholder="Nombre, ej: Grupo Física" 
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-4 text-sm"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowNewWorkspaceModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button onClick={createWorkspace} disabled={!newWorkspaceName.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Crear</button>
                    </div>
                </div>
            </motion.div>
        )}

        {showMembersModal && currentWorkspace && (
             <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            >
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            Miembros de {currentWorkspace.name}
                        </h2>
                        <button onClick={() => setShowMembersModal(false)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Invitar por Email</label>
                        <div className="flex gap-2">
                             <input 
                                type="email" 
                                placeholder="usuario@ejemplo.com" 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <button onClick={inviteMember} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Enviar</button>
                        </div>
                    </div>

                    <div className="space-y-3">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Miembros ({currentWorkspace.members.length})</label>
                         <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
                            {currentWorkspace.members.map((uid) => (
                                <div key={uid} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                            U
                                        </div>
                                        <span className="text-slate-600 font-mono text-xs">{uid.substring(0, 8)}...</span>
                                        {uid === currentWorkspace.ownerId && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                    </div>
                                    <Shield className={`w-3 h-3 ${uid === currentWorkspace.ownerId ? 'text-amber-500' : 'text-slate-300'}`} />
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

