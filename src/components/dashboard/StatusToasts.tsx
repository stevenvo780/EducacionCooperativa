'use client';

import { Check, FileText, Loader2, Upload } from 'lucide-react';
import { DeletePhase, UploadPhase, type DeleteStatus, type UploadStatus } from '@/components/dashboard/types';

interface StatusToastsProps {
  uploadStatus: UploadStatus | null;
  deleteStatus: DeleteStatus | null;
}

const StatusToasts = ({ uploadStatus, deleteStatus }: StatusToastsProps) => {
  if (!uploadStatus && !deleteStatus) return null;

  return (
    <div className="absolute right-4 top-16 z-50 w-72 flex flex-col gap-2">
      {uploadStatus && (
        <div className="bg-surface-800 border border-surface-600/50 rounded-xl p-3 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between text-xs font-semibold text-surface-200">
            <span>
              {uploadStatus.phase === UploadPhase.Done
                ? 'Subida completa'
                : uploadStatus.phase === UploadPhase.Error
                  ? 'Error de carga'
                  : uploadStatus.phase === UploadPhase.Converting
                    ? `Convirtiendo a Markdown...`
                    : `Subiendo ${uploadStatus.currentIndex}/${uploadStatus.total}`}
            </span>
            {uploadStatus.phase === UploadPhase.Done && <Check className="w-3 h-3 text-emerald-400" />}
            {uploadStatus.phase === UploadPhase.Uploading && <Upload className="w-3 h-3 text-mandy-400" />}
            {uploadStatus.phase === UploadPhase.Converting && <FileText className="w-3 h-3 text-blue-400 animate-pulse" />}
          </div>
          {uploadStatus.currentName && (
            <div className="mt-1 text-[11px] text-surface-400 truncate">{uploadStatus.currentName}</div>
          )}
          <div className="mt-2 h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`${uploadStatus.phase === UploadPhase.Error ? 'bg-red-500' : 'bg-mandy-500'} h-full transition-[width] duration-200`}
              style={{ width: `${uploadStatus.progress}%` }}
            />
          </div>
          {uploadStatus.phase === UploadPhase.Error && uploadStatus.error && (
            <div className="mt-1 text-[11px] text-red-400">{uploadStatus.error}</div>
          )}
        </div>
      )}
      {deleteStatus && (
        <div className="bg-surface-800 border border-surface-600/50 rounded-xl p-3 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between text-xs font-semibold text-surface-200">
            <span>
              {deleteStatus.phase === DeletePhase.Done
                ? 'Eliminado'
                : deleteStatus.phase === DeletePhase.Error
                  ? 'Error al eliminar'
                  : 'Eliminando...'}
            </span>
            {deleteStatus.phase === DeletePhase.Done && <Check className="w-3 h-3 text-emerald-400" />}
            {deleteStatus.phase === DeletePhase.Deleting && <Loader2 className="w-3 h-3 text-mandy-400 animate-spin" />}
          </div>
          {deleteStatus.name && (
            <div className="mt-1 text-[11px] text-surface-400 truncate">{deleteStatus.name}</div>
          )}
          <div className="mt-2 h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`${deleteStatus.phase === DeletePhase.Error ? 'bg-red-500' : 'bg-amber-500'} h-full transition-[width] duration-200 ${deleteStatus.phase === DeletePhase.Deleting ? 'animate-pulse' : ''}`}
              style={{ width: deleteStatus.phase === DeletePhase.Deleting ? '60%' : '100%' }}
            />
          </div>
          {deleteStatus.phase === DeletePhase.Error && deleteStatus.error && (
            <div className="mt-1 text-[11px] text-red-400">{deleteStatus.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusToasts;
