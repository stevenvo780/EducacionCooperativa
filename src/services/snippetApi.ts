import { authFetch } from '@/services/apiClient';

export interface Snippet {
  id: string;
  title: string;
  description: string;
  markdown: string;
  workspaceId: string;
  category: string;
  order: number;
  ownerId?: string;
}

export type SnippetInput = Omit<Snippet, 'id' | 'ownerId'>;

/* ── Fetch all snippets for a workspace ── */
export const fetchSnippets = async (workspaceId: string): Promise<Snippet[]> => {
  const res = await authFetch(`/api/snippets?workspaceId=${encodeURIComponent(workspaceId)}`, {
    cache: 'no-store'
  });
  if (!res.ok) return [];
  return res.json();
};

/* ── Create a snippet ── */
export const createSnippet = async (data: SnippetInput): Promise<Snippet | null> => {
  const res = await authFetch('/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) return null;
  return res.json();
};

/* ── Update a snippet ── */
export const updateSnippet = async (
  id: string,
  data: Partial<Pick<Snippet, 'title' | 'description' | 'markdown' | 'category' | 'order'>>
): Promise<boolean> => {
  const res = await authFetch(`/api/snippets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.ok;
};

/* ── Delete a snippet ── */
export const deleteSnippet = async (id: string): Promise<boolean> => {
  const res = await authFetch(`/api/snippets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
};

/* ── Default snippets to seed when workspace has none ── */
export const DEFAULT_SNIPPETS: Omit<SnippetInput, 'workspaceId'>[] = [
  {
    title: 'LaTeX inline',
    description: 'Fórmula en línea con KaTeX',
    markdown: '$E = mc^2$',
    category: 'math',
    order: 0
  },
  {
    title: 'Bloque LaTeX',
    description: 'Bloque matemático multilínea',
    markdown: '$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$',
    category: 'math',
    order: 1
  },
  {
    title: 'Matriz',
    description: 'Matriz 3×3 editable',
    markdown: '$$\n\\begin{pmatrix}\na & b & c \\\\\nd & e & f \\\\\ng & h & i\n\\end{pmatrix}\n$$',
    category: 'math',
    order: 2
  },
  {
    title: 'Sumatorias',
    description: 'Sumatoria con límites',
    markdown: '$$\n\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n\n$$',
    category: 'math',
    order: 3
  },
  {
    title: 'Fracción',
    description: 'Fracción simple',
    markdown: '$$\n\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}\n$$',
    category: 'math',
    order: 4
  },
  {
    title: 'Lógica proposicional',
    description: 'Modus Ponens, implicación, conectivos',
    markdown: '$$\n\\begin{array}{l}\np \\to q \\\\\np \\\\\n\\hline\n\\therefore q\n\\end{array}\n$$',
    category: 'math',
    order: 5
  },
  {
    title: 'Sistema de ecuaciones',
    description: 'Sistema 2×2',
    markdown: '$$\n\\begin{cases}\nax + by = e \\\\\ncx + dy = f\n\\end{cases}\n$$',
    category: 'math',
    order: 6
  },
  {
    title: 'Diagrama Mermaid',
    description: 'Diagrama de flujo editable',
    markdown: '```mermaid\ngraph TD\n  A[Inicio] --> B{Decisión}\n  B -->|Sí| C[Acción A]\n  B -->|No| D[Acción B]\n  C --> E[Fin]\n  D --> E\n```',
    category: 'diagram',
    order: 10
  },
  {
    title: 'Diagrama de secuencia',
    description: 'Secuencia entre actores',
    markdown: '```mermaid\nsequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hola Bob\n  B-->>A: Hola Alice\n```',
    category: 'diagram',
    order: 11
  },
  {
    title: 'Admonición / Callout',
    description: 'Nota resaltada tipo callout',
    markdown: ':::note[Nota importante]\nEscribe aquí la observación clave.\n:::',
    category: 'structure',
    order: 20
  },
  {
    title: 'Lista de tareas',
    description: 'Checklist editable',
    markdown: '- [ ] Primer pendiente\n- [ ] Segundo pendiente\n- [ ] Tercer pendiente',
    category: 'structure',
    order: 21
  },
  {
    title: 'Tabla',
    description: 'Tabla 3 columnas',
    markdown: '| Columna 1 | Columna 2 | Columna 3 |\n| --- | --- | --- |\n| dato | dato | dato |\n| dato | dato | dato |',
    category: 'structure',
    order: 22
  },
  {
    title: 'Frontmatter',
    description: 'Metadatos YAML al inicio',
    markdown: '---\ntitle: Documento\ntags:\n  - clase\n  - apunte\n---',
    category: 'structure',
    order: 23
  },
  {
    title: 'Nota al pie',
    description: 'Referencia con nota al pie',
    markdown: 'Texto con referencia[^1]\n\n[^1]: Contenido de la nota al pie.',
    category: 'structure',
    order: 24
  },
  {
    title: 'Bloque de código',
    description: 'Bloque con sintaxis resaltada',
    markdown: '```python\ndef hello():\n    print("Hola mundo")\n\nhello()\n```',
    category: 'code',
    order: 30
  }
];

/* ── Seed default snippets for a workspace if it has none ── */
export const seedDefaultSnippets = async (workspaceId: string): Promise<Snippet[]> => {
  const promises = DEFAULT_SNIPPETS.map((s) =>
    createSnippet({ ...s, workspaceId })
  );
  const results = await Promise.all(promises);
  return results.filter((s): s is Snippet => s !== null);
};
