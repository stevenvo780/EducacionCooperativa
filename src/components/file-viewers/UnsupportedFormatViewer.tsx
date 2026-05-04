'use client';

import React from 'react';
import { BookX, FileQuestion, FileWarning } from 'lucide-react';
import FileViewerShell from '@/components/file-viewers/FileViewerShell';
import { ViewerUnsupported } from '@/components/file-viewers/ViewerStates';

interface UnsupportedFormatViewerProps {
  docName: string;
  fileUrl: string | null;
  reason: 'kindle' | 'djvu' | 'mscz' | 'generic';
  onClose?: () => void;
}

const PRESETS = {
  kindle: {
    icon: BookX,
    title: 'Formato Kindle no previsualizable',
    description: 'Los archivos .mobi/.azw/.azw3 usan un formato propietario sin soporte abierto en navegador. Convierte a EPUB con Calibre o descarga para leerlo en Kindle/Calibre.'
  },
  djvu: {
    icon: FileWarning,
    title: 'DjVu no previsualizable en navegador',
    description: 'El formato DjVu requiere conversión server-side a PDF. Descárgalo y conviértelo (ej: ddjvu) o ábrelo con un visor DjVu local.'
  },
  mscz: {
    icon: FileWarning,
    title: 'Formato MuseScore propietario',
    description: 'Los .mscz contienen un formato interno de MuseScore. Exporta como .musicxml o .mxl desde MuseScore para visualizar la partitura aquí.'
  },
  generic: {
    icon: FileQuestion,
    title: 'Formato no soportado',
    description: 'No hay un visualizador disponible para este formato en este momento. Puedes descargarlo o abrirlo en una app externa.'
  }
} as const;

export default function UnsupportedFormatViewer({ docName, fileUrl, reason, onClose }: UnsupportedFormatViewerProps) {
  const preset = PRESETS[reason];
  return (
    <FileViewerShell docName={docName} fileUrl={fileUrl} onClose={onClose}>
      <ViewerUnsupported
        icon={preset.icon}
        title={preset.title}
        description={preset.description}
        fileUrl={fileUrl}
      />
    </FileViewerShell>
  );
}
