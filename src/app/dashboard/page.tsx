'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import Link from 'next/link';

interface DocItem {
  id: string;
  name: string;
  updatedAt: any;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const router = useRouter();
  const [newDocName, setNewDocName] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
        fetchDocs();
    }
  }, [user, loading, router]);

  const fetchDocs = async () => {
    if (!user) return;
    const q = query(collection(db, 'documents'), where('ownerId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    const fetched: DocItem[] = [];
    querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as DocItem);
    });
    setDocs(fetched);
  };

  const createDoc = async () => {
    if (!newDocName.trim() || !user) return;
    try {
        const docRef = await addDoc(collection(db, 'documents'), {
            name: newDocName,
            content: '# ' + newDocName,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setNewDocName('');
        fetchDocs(); // refresh
        // router.push(`/editor/${docRef.id}`); // Optional: auto open
    } catch (e) {
        console.error("Error creating doc", e);
    }
  };

  const deleteDocument = async (id: string) => {
      if (!confirm('Are you sure?')) return;
      await deleteDoc(doc(db, 'documents', id));
      fetchDocs();
  };

  if (loading || !user) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Mis Documentos</h1>
        <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Nombre del documento..." 
                className="border p-2 rounded"
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
            />
            <button 
                onClick={createDoc}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
                Crear Nuevo
            </button>
        </div>
      </div>

      <div className="grid gap-4">
        {docs.length === 0 && <p className="text-gray-500">No tienes documentos.</p>}
        {docs.map(doc => (
            <div key={doc.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                <Link href={`/editor/${doc.id}`} className="font-bold text-lg text-blue-600 hover:underline">
                    {doc.name || 'Sin título'}
                </Link>
                <div className="flex items-center gap-4">
                   <span className="text-xs text-gray-500">ID: {doc.id}</span>
                   <button 
                    onClick={() => deleteDocument(doc.id)}
                    className="text-red-500 hover:text-red-700"
                   >
                    Eliminar
                   </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
