import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Mis Archivos</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">Aquí se mostrarán tus archivos y carpetas.</p>
        {/* TODO: Implementar explorador de archivos con API */}
      </div>
    </div>
  );
};