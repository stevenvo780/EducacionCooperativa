'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import { FileText, Plus, Trash2, Search, LogOut, User, Upload, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file';
  url?: string;
  mimeType?: string;
  updatedAt: any;
  ownerId: string;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const router = useRouter();
  const [newDocName, setNewDocName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
        fetchDocs();
    }
  }, [user, loading, router]);

  const fetchDocs = async () => {
    if (!user) return;
    try {
        const q = query(
            collection(db, 'documents'), 
            where('ownerId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetched: DocItem[] = [];
        querySnapshot.forEach((doc) => {
            fetched.push({ id: doc.id, ...doc.data() } as DocItem);
        });
        // Client side sort since index might be missing
        fetched.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setDocs(fetched);
    } catch (error) {
        console.error("Error fetching docs", error);
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
        const storageRef = ref(storage, `users/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        await addDoc(collection(db, 'documents'), {
            name: file.name,
            type: 'file',
            url: url,
            mimeType: file.type,
            storagePath: storageRef.fullPath,
            ownerId: user.uid,
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
            <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="bg-blue-600 text-white p-1 rounded">Gr</span> Dashboard
            </h1>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                    <User className="w-4 h-4" />
                    <span className="truncate max-w-[150px]">{user.email}</span>
                </div>
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
                        // Basic client search
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
                    {isUploading ? 'Subiendo...' : 'Subir'}
                </button>

                <form onSubmit={createDoc} className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nuevo documento..." 
                        className="w-40 xl:w-64 border border-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newDocName}
                        onChange={e => setNewDocName(e.target.value)}
                        required={!newDocName} /* Only required if submitting form */
                    />
                    <button 
                        type="submit"
                        disabled={isCreating}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium text-sm shadow-sm hover:shadow active:scale-95 transform"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Crear</span>
                    </button>
                </form>
            </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <div className="mx-auto bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500">No tienes documentos aún.</p>
                    <p className="text-sm text-slate-400">¡Crea uno nuevo arriba!</p>
                </div>
            )}
            
            {docs.map((doc, i) => (
                <motion.div 
                    key={doc.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                >
                    <Link href={`/editor/${doc.id}`} className="group block h-full">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition h-full flex flex-col justify-between">
                            <div className="flex items-start justify-between mb-4">
                                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                                    {getIcon(doc)}
                                </div>
                                <button 
                                    onClick={(e) => deleteDocument(doc, e)}
                                    className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition truncate mb-1">
                                    {doc.name || 'Sin título'}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {doc.type === 'file' ? 'Archivo' : 'Documento'} • ID: {doc.id.substring(0, 8)}
                                </p>
                            </div>
                        </div>
                    </Link>
                </motion.div>
            ))}
        </div>
      </main>
    </div>
  );
}
