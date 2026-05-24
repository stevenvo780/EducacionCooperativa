import type { Notebook, Cell } from '@/types/stnb';

const ST_LANG_VERSION = '4.15.0';

function makeNotebook(
  title: string,
  profile: string,
  cells: Cell[]
): Notebook {
  const now = new Date().toISOString();
  return {
    version: '1.0.0',
    kernel: 'st',
    kernelVersion: ST_LANG_VERSION,
    metadata: { title, profile, createdAt: now, updatedAt: now },
    cells
  };
}

function codeCell(id: string, source: string): Cell {
  return { id, type: 'code', source, outputs: [] };
}

function mdCell(id: string, source: string): Cell {
  return { id, type: 'markdown', source };
}

export const TEMPLATES: Array<{ label: string; description: string; create: () => Notebook }> = [
  {
    label: 'Vacío',
    description: 'Notebook sin celdas',
    create: () => makeNotebook('Sin título', 'classical', [])
  },
  {
    label: 'Intro clásica',
    description: 'Ejemplos básicos de lógica clásica',
    create: () =>
      makeNotebook('Introducción — lógica clásica', 'classical', [
        mdCell('m1', '# Lógica clásica\n\nEn el perfil **classical** puedes declarar proposiciones y mostrar teoremas.'),
        codeCell('c1', 'show: ⊤.'),
        mdCell('m2', '## Contradicción\n\nVerifiquemos que `⊥` no es demostrable.'),
        codeCell('c2', 'show: ⊥.')
      ])
  },
  {
    label: 'Tutorial modal',
    description: 'Lógica modal K básica',
    create: () =>
      makeNotebook('Tutorial — lógica modal K', 'modal-k', [
        mdCell('m1', '# Lógica Modal K\n\nEl perfil `modal-k` añade los operadores **□** (necesario) y **◇** (posible).'),
        codeCell('c1', 'show: □⊤.'),
        mdCell('m2', '## Axioma K\n\nVerifica el esquema K: $□(p→q) → (□p → □q)$'),
        codeCell('c2', 'show: □(⊤→⊤)→(□⊤→□⊤).')
      ])
  }
];
