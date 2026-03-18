import type { QuickInsert, ToolbarGroupKey, ToolbarVisibility } from './types';

export const TOOLBAR_VISIBILITY_STORAGE_KEY = 'agora.editor.toolbar.visibility.v2';

export const DEFAULT_TOOLBAR_VISIBILITY: ToolbarVisibility = {
  history: true,
  inline: true,
  structure: true,
  lists: true,
  media: true,
  insert: true,
  snippets: true,
  advanced: true
};

export const TOOLBAR_GROUP_LABELS: Record<ToolbarGroupKey, string> = {
  history: 'Historial',
  inline: 'Formato',
  structure: 'Bloques',
  lists: 'Listas',
  media: 'Links y media',
  insert: 'Inserciones',
  snippets: 'Snippets',
  advanced: 'Avanzadas'
};

export const QUICK_INSERTS: QuickInsert[] = [
  {
    id: 'latex-inline',
    title: 'LaTeX en línea',
    description: 'Inserta una fórmula en línea con KaTeX.',
    markdown: '$E = mc^2$'
  },
  {
    id: 'latex-block',
    title: 'Bloque LaTeX',
    description: 'Inserta un bloque matemático multilínea.',
    markdown: '$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n'
  },
  {
    id: 'mermaid',
    title: 'Diagrama Mermaid',
    description: 'Inserta una plantilla de diagrama/flujo.',
    markdown: '```mermaid\ngraph TD\n  Inicio[Inicio] --> Idea[Idea]\n  Idea --> Revision[Revisión]\n  Revision --> Publicacion[Publicación]\n```\n'
  },
  {
    id: 'admonition',
    title: 'Admonición',
    description: 'Añade una nota resaltada tipo callout.',
    markdown: ':::note[Nota importante]\nEscribe aquí la observación clave.\n:::\n'
  },
  {
    id: 'frontmatter',
    title: 'Frontmatter',
    description: 'Inserta metadatos YAML al inicio del documento.',
    markdown: '---\ntitle: Documento\ntags:\n  - clase\n  - apunte\n---\n\n'
  },
  {
    id: 'checklist',
    title: 'Lista de tareas',
    description: 'Crea una lista de tareas lista para editar.',
    markdown: '- [ ] Primer pendiente\n- [ ] Segundo pendiente\n- [ ] Tercer pendiente\n'
  },
  {
    id: 'reading-card',
    title: 'Ficha de lectura',
    description: 'Estructura una lectura con tesis, conceptos y evidencias.',
    markdown: '## Ficha de lectura\n- Texto / obra:\n- Autor:\n- Fecha:\n- Pregunta guia:\n\n### Tesis central\n-\n\n### Conceptos clave\n- \n\n### Evidencias / citas\n> \n\n### Objeciones o tensiones\n- \n\n### Proxima accion\n- [ ]\n'
  },
  {
    id: 'evidence-matrix',
    title: 'Matriz de evidencias',
    description: 'Organiza hallazgos, fuentes y usos en una sola tabla.',
    markdown: '## Matriz de evidencias\n| Hallazgo | Evidencia | Fuente | Uso |\n| --- | --- | --- | --- |\n|  |  |  |  |\n|  |  |  |  |\n'
  },
  {
    id: 'cooperative-minutes',
    title: 'Acta cooperativa',
    description: 'Documenta acuerdos, responsables y seguimiento del equipo.',
    markdown: '## Acta cooperativa\n- Fecha:\n- Participantes:\n- Objetivo comun:\n\n### Acuerdos\n- \n\n### Responsables\n| Tarea | Responsable | Fecha |\n| --- | --- | --- |\n|  |  |  |\n\n### Riesgos y apoyos\n- Riesgo:\n- Apoyo:\n\n### Seguimiento\n- [ ]\n'
  }
];

export const TABLE_MAX_ROWS = 8;
export const TABLE_MAX_COLS = 8;
