import React from 'react';

export const Invitations: React.FC = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Invitaciones</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Nueva Invitación
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 text-center text-gray-500">
          No tienes invitaciones pendientes.
        </div>
        {/* TODO: Lista de invitaciones desde API */}
      </div>
    </div>
  );
};