import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Folder, Users, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-bold text-blue-600">Griego2</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded hover:bg-gray-100">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              isActive('/') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Folder size={20} />
            {isSidebarOpen && <span>Archivos</span>}
          </Link>

          <Link
            to="/invitations"
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              isActive('/invitations') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={20} />
            {isSidebarOpen && <span>Invitaciones</span>}
          </Link>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
             {isSidebarOpen && (
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
                 <p className="text-xs text-gray-500 truncate">{user?.email}</p>
               </div>
             )}
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};