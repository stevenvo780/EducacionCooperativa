'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { FileText, Plus, Trash2, Search, LogOut, User, Upload, Image as ImageIcon, File as FileIcon, Users, Briefcase, ChevronDown, Check, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const createDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim() || !user) return;
    setIsCreating(true);
    try {
        const docRef = await addDoc(collection(db, 'documents'), {
            name: newDocName,
            content: '# ' + newDocName,
            type: 'text',
            ownerId: user.uid,
            workspaceId: currentWorkspace?.id === PERSONAL_WORKSPACE_ID ? null : currentWorkspace?.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setNewDocName('');
        fetchDocs(); 
        router.push(`/editor/${docRef.id}`);
    } catch (e) {
        console.error("Error creating doc", e);
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
        
        await addDoc(collection(db, 'documents'), {
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
        
        fetchDocs();
    } catch (error) {
        console.error("Upload failed", error);
        alert("Error uploading file");
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDocument = async (docItem: DocItem, e: React.MouseEvent) => {
      e.preventDefault(); 
      if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) return;
      try {
        if (docItem.type === 'file' && (docItem as any).storagePath) {
            const storageRef = ref(storage, (docItem as any).storagePath);
            await deleteObject(storageRef).catch(e => console.warn("Storage delete failed", e));
        }
        await deleteDoc(doc(db, 'documents', docItem.id));
        fetchDocs();
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <span className="bg-blue-600 text-white p-1 rounded">St</span>
                </Link>
                
                {/* Workspace Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200"
                    >
                        {currentWorkspace?.type === 'personal' ? (
                            <User className="w-4 h-4 text-slate-500" />
                        ) : (
                            <Briefcase className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="font-medium text-sm">{currentWorkspace?.name || 'Seleccionar espacio'}</span>
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

                {currentWorkspace?.type === 'shared' && (
                    <button 
                        onClick={() => setShowMembersModal(true)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition"
                    >
                        <Users className="w-3.5 h-3.5" />
                        {currentWorkspace.members.length} miembros
                    </button>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => logout()}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                    title="Cerrar Sesión"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar documentos..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    onChange={(e) => {
                        const val = e.target.value.toLowerCase();
                        if (!val) {
                            fetchDocs(); 
                            return;
                        }
                        const filtered = docs.filter(d => d.name.toLowerCase().includes(val));
                        setDocs(filtered);
                    }}
                />
            </div>

            <div className="flex w-full md:w-auto gap-3 items-center">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={handleFileUpload}
                />
                
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 font-medium text-sm"
                >
                    <Upload className="w-4 h-4" />
                    Subir
                </button>

                <form onSubmit={createDoc} className="flex gap-2">
                    <input 
                        type="text"
                        placeholder="Nuevo documento"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-48"
                    />
                    <button 
                        type="submit"
                        disabled={isCreating || !newDocName.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium text-sm disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Crear
                    </button>
                </form>
            </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docs.map((doc) => (
                <Link href={doc.type === 'file' ? doc.url || '#' : `/editor/${doc.id}`} key={doc.id} target={doc.type === 'file' ? '_blank' : undefined}>
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 transition cursor-pointer relative"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                {getIcon(doc)}
                            </div>
                            <button 
                                onClick={(e) => deleteDocument(doc, e)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <h3 className="font-medium text-slate-800 truncate mb-1">{doc.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                             <span>{(doc.updatedAt?.seconds ? new Date(doc.updatedAt.seconds * 1000).toLocaleDateString() : 'Draft')}</span>
                             {doc.type === 'file' && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{doc.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</span>}
                        </div>
                    </motion.div>
                </Link>
            ))}

            {docs.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
                    <p>No hay documentos en este espacio.</p>
                    <button onClick={() => (document.querySelector('input[type="text"]') as HTMLInputElement)?.focus()} className="text-blue-500 hover:underline mt-2 text-sm">Empieza creando uno</button>
                </div>
            )}
        </div>
      </main>

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

