'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase'; // Direct access to get token if needed

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async (path: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else {
        console.error("Failed to fetch files");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles(currentPath);
    }
  }, [user, currentPath]);

  const handleNavigate = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const handleGoBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  if (!user) return <div className="p-8">Please log in.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard de Archivos</h1>
      
      <div className="flex items-center gap-2 mb-4 bg-gray-100 p-2 rounded">
        <button 
            onClick={() => setCurrentPath('')}
            className="text-blue-600 hover:underline"
        >
            Inicio
        </button>
        {currentPath && (
            <>
                <span>/</span>
                <span className="font-mono text-sm">{currentPath}</span>
                <button 
                    onClick={handleGoBack}
                    className="ml-auto px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                >
                    Atrás
                </button>
            </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow min-h-[400px]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Carpeta vacía</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <li 
                key={idx} 
                className="p-4 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                onClick={() => item.type === 'folder' ? handleNavigate(item.name) : null}
              >
                <span className="text-xl">
                  {item.type === 'folder' ? '📁' : '📄'}
                </span>
                <span className="flex-1 font-medium text-gray-700">
                  {item.name}
                </span>
                {item.type === 'file' && (
                  <span className="text-xs text-gray-400">
                    {(item.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
