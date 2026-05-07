import { fetchZod } from '@/lib/fetch-zod';
import { snippetSchema } from '@agora/contracts';
import { z } from 'zod';
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

const SNIPPET_PAGE_SIZE = 100;
const SNIPPET_PAGE_HARD_LIMIT = 50;

const pagedSnippetSchema = z.object({
  items: z.array(snippetSchema),
  cursor: z.string().nullable().optional()
});

export const fetchSnippets = async (workspaceId: string): Promise<Snippet[]> => {
  const accumulated: Snippet[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < SNIPPET_PAGE_HARD_LIMIT; page++) {
    const params = new URLSearchParams({
      workspaceId,
      limit: String(SNIPPET_PAGE_SIZE)
    });
    if (cursor) params.set('cursor', cursor);

    const raw = await fetchZod(`/api/snippets?${params.toString()}`, z.union([z.array(snippetSchema), pagedSnippetSchema]), {
      cache: 'no-store'
    });

    if (Array.isArray(raw)) {
      return raw as Snippet[];
    }

    accumulated.push(...(raw.items as Snippet[]));
    const nextCursor = raw.cursor ?? null;
    if (!nextCursor || raw.items.length < SNIPPET_PAGE_SIZE) {
      return accumulated;
    }
    cursor = nextCursor;
  }

  return accumulated;
};

export const createSnippet = async (data: SnippetInput): Promise<Snippet | null> => {
  const res = await authFetch('/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) return null;
  return res.json();
};

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

export const deleteSnippet = async (id: string): Promise<boolean> => {
  const res = await authFetch(`/api/snippets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
};

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
  },
  {
    title: 'Ficha de lectura',
    description: 'Plantilla para tesis, conceptos y evidencias',
    markdown: '## Ficha de lectura\n- Texto / obra:\n- Autor:\n- Fecha:\n- Pregunta guia:\n\n### Tesis central\n-\n\n### Conceptos clave\n- \n\n### Evidencias / citas\n> \n\n### Objeciones o tensiones\n- \n\n### Proxima accion\n- [ ]',
    category: 'general',
    order: 40
  },
  {
    title: 'Matriz de evidencias',
    description: 'Tabla base para organizar hallazgos y fuentes',
    markdown: '## Matriz de evidencias\n| Hallazgo | Evidencia | Fuente | Uso |\n| --- | --- | --- | --- |\n|  |  |  |  |\n|  |  |  |  |',
    category: 'structure',
    order: 41
  },
  {
    title: 'Acta cooperativa',
    description: 'Acuerdos, responsables y seguimiento del equipo',
    markdown: '## Acta cooperativa\n- Fecha:\n- Participantes:\n- Objetivo comun:\n\n### Acuerdos\n- \n\n### Responsables\n| Tarea | Responsable | Fecha |\n| --- | --- | --- |\n|  |  |  |\n\n### Riesgos y apoyos\n- Riesgo:\n- Apoyo:\n\n### Seguimiento\n- [ ]',
    category: 'general',
    order: 42
  },
  {
    title: 'PROP · Modus Ponens',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'Si llueve entonces la calle se moja. Llueve. Por lo tanto, la calle se moja.',
    category: 'formalization',
    order: 60
  },
  {
    title: 'PROP · Modus Tollens',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'Si el coche avanza, entonces hay gasolina. El coche no avanza. Por lo tanto, no hay gasolina.',
    category: 'formalization',
    order: 61
  },
  {
    title: 'PROP · Silogismo Hipotético',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'Si estudio, apruebo el examen. Si apruebo el examen, obtengo el título. Si obtengo el título, consigo trabajo.',
    category: 'formalization',
    order: 62
  },
  {
    title: 'PROP · Conjunción',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'El gato es negro y el perro es grande.',
    category: 'formalization',
    order: 63
  },
  {
    title: 'PROP · Disyunción',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'O viajamos en tren o viajamos en avión.',
    category: 'formalization',
    order: 64
  },
  {
    title: 'PROP · Bicondicional',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'Un número es par si y solo si es divisible entre dos.',
    category: 'formalization',
    order: 65
  },
  {
    title: 'PROP · Cadena + MP',
    description: 'Texto base para formalización proposicional clásica',
    markdown: 'Si un animal es mamífero, entonces tiene sangre caliente. Si tiene sangre caliente, entonces puede regular su temperatura. Los perros son mamíferos. Por lo tanto, los perros pueden regular su temperatura.',
    category: 'formalization',
    order: 66
  },
  {
    title: 'FOL · Silogismo universal',
    description: 'Texto base para formalización de primer orden',
    markdown: 'Todos los filósofos buscan la verdad. Sócrates es filósofo. Por lo tanto, Sócrates busca la verdad.',
    category: 'formalization',
    order: 67
  },
  {
    title: 'SYL · Barbara clásico',
    description: 'Texto base para formalización silogística aristotélica',
    markdown: 'Todos los humanos son mortales. Sócrates es humano. Por lo tanto, Sócrates es mortal.',
    category: 'formalization',
    order: 68
  },
  {
    title: 'MOD · Necesidad + posibilidad',
    description: 'Texto base para formalización modal K',
    markdown: 'Es necesario que si llueve, la calle se moje. Posiblemente llueve.',
    category: 'formalization',
    order: 69
  },
  {
    title: 'EPI · Conocimiento + MP',
    description: 'Texto base para formalización epistémica S5',
    markdown: 'Se sabe que la tierra es redonda. Si la tierra es redonda, entonces tiene gravedad.',
    category: 'formalization',
    order: 70
  },
  {
    title: 'DEO · Obligación + permiso',
    description: 'Texto base para formalización deóntica',
    markdown: 'Es obligatorio que todos respeten las leyes. Es permitido que se proteste pacíficamente.',
    category: 'formalization',
    order: 71
  },
  {
    title: 'TMP · Siempre + eventualmente',
    description: 'Texto base para formalización temporal LTL',
    markdown: 'Siempre que llueve, eventualmente sale el sol. Actualmente llueve.',
    category: 'formalization',
    order: 72
  },
  {
    title: 'INT · Doble negación',
    description: 'Texto base para formalización intuicionista',
    markdown: 'No es cierto que no llueve. Si llueve entonces la calle se moja.',
    category: 'formalization',
    order: 73
  },
  {
    title: 'PAR · Contradicción tolerada',
    description: 'Texto base para formalización paraconsistente',
    markdown: 'El gato está vivo y el gato no está vivo. El gato está en la caja.',
    category: 'formalization',
    order: 74
  },
  {
    title: 'ARI · Divisibilidad',
    description: 'Texto base para formalización aritmética',
    markdown: 'Si un número es par, entonces es divisible entre dos. Cuatro es par. Por lo tanto, cuatro es divisible entre dos.',
    category: 'formalization',
    order: 75
  },
  {
    title: 'PRO · Inferencia probable',
    description: 'Texto base para formalización probabilística',
    markdown: 'Probablemente llueve. Si llueve, entonces posiblemente la calle se moje.',
    category: 'formalization',
    order: 76
  },
  {
    title: 'PROP · Aristóteles — Poética',
    description: 'Texto complejo para probar formalización',
    markdown: 'Puesto que realizan la representación actuando, primero sería necesariamente una parte de la tragedia la decoración del espectáculo, la melopeya y la elocución.',
    category: 'formalization',
    order: 77
  },
  {
    title: 'ST · Script base',
    description: 'Plantilla inicial para ejecutar un script ST',
    markdown: 'logic classical.propositional\n\naxiom a1 : P -> Q\naxiom a2 : P\n\nderive Q from {a1, a2}\n\ncheck valid ((P -> Q) -> (!Q -> !P))',
    category: 'st',
    order: 80
  },
  {
    title: 'ST · Assumption proof',
    description: 'Esqueleto de prueba con hipótesis y meta',
    markdown: 'assume demo : P -> Q\nshow P -> Q\nqed',
    category: 'st',
    order: 81
  },
  {
    title: 'ST · Tabla de verdad',
    description: 'Snippet para explorar una fórmula con truth table',
    markdown: 'logic classical.propositional\n\ntruth_table (P & Q)',
    category: 'st',
    order: 82
  },
  {
    title: 'ST · Derivación modal',
    description: 'Base para lógica modal K',
    markdown: 'logic modal.k\n\naxiom m1 : [] (P -> Q)\naxiom m2 : <> P\n\ncheck satisfiable ([] (P -> Q) & <> P)',
    category: 'st',
    order: 83
  },
  {
    title: 'ST · Primer orden',
    description: 'Base para cuantificadores y verificación',
    markdown: 'logic classical.first_order\n\naxiom a1 : forall x (Human(x) -> Mortal(x))\naxiom a2 : Human(socrates)\n\ncheck valid ((forall x (Human(x) -> Mortal(x)) & Human(socrates)) -> Mortal(socrates))',
    category: 'st',
    order: 84
  }
];

const buildSnippetKey = (snippet: Pick<Snippet, 'title' | 'category'> | Omit<SnippetInput, 'workspaceId'>) =>
  `${snippet.category}::${snippet.title}`.trim().toLowerCase();

// Dedupe global: si SnippetGallery monta en múltiples paneles del dashboard
// simultáneamente, cada instancia llamaba seedDefaultSnippets concurrentemente
// y la condición de carrera causaba 14×N POSTs creando duplicados (los famosos
// 7+ "LaTeX inline" que aparecían en la galería). Con esta promesa por
// workspace todos los callers comparten el mismo seeding.
const seedingPromises = new Map<string, Promise<Snippet[]>>();

export const seedDefaultSnippets = async (workspaceId: string, existingSnippets?: Snippet[]): Promise<Snippet[]> => {
  const cached = seedingPromises.get(workspaceId);
  if (cached) return cached;

  const promise = (async (): Promise<Snippet[]> => {
    const current = Array.isArray(existingSnippets)
      ? existingSnippets
      : await fetchSnippets(workspaceId);
    const existingKeys = new Set(current.map((snippet) => buildSnippetKey(snippet)));
    const missing = DEFAULT_SNIPPETS.filter((snippet) => !existingKeys.has(buildSnippetKey(snippet)));

    if (missing.length === 0) {
      return current.slice().sort((a, b) => a.order - b.order);
    }

    const created = await Promise.all(
      missing.map((snippet) => createSnippet({ ...snippet, workspaceId }))
    );

    return [...current, ...created.filter((snippet): snippet is Snippet => snippet !== null)]
      .sort((a, b) => a.order - b.order);
  })();

  seedingPromises.set(workspaceId, promise);
  // Mantener el dedupe ~30s tras completar para cubrir re-mounts cercanos del
  // mismo workspace; cualquier fetch posterior pasa fresh.
  promise.finally(() => {
    setTimeout(() => {
      if (seedingPromises.get(workspaceId) === promise) {
        seedingPromises.delete(workspaceId);
      }
    }, 30_000);
  });
  return promise;
};
