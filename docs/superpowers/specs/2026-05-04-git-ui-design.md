# UI git workbench v2 — gitgraph + diff + acciones (sub-proyecto C)

Fecha: 2026-05-04
Rama: `feature/git-ui-tools`

## Contexto

`GitWorkbench.tsx` muestra hoy 3 tabs (`changes`, `history`, `access`) y
en `history` solo lista commits. Sin diff, sin grafo, sin botones de
revert/checkout. Esta iteración convierte la pestaña `history` en una
vista compuesta con tres sub-vistas y agrega una pestaña `compare`.

## Layout nuevo

```
┌─────────────────────────────────────────────────────────────┐
│ Git · workspace-name                  [.gitignore] [↻] [↗]  │
├─────────────────────────────────────────────────────────────┤
│ [Cambios] [Historial] [Comparar] [Acceso]                   │
├──────────────┬──────────────────────────────────────────────┤
│ Graph (SVG)  │  Detalle del commit seleccionado             │
│              │  ─────────────────────────────               │
│ ●─┐ feat... │  sha    abcdef1234567890                     │
│ │ │         │  autor  Steven <s@e.com>                     │
│ ● │         │  fecha  2026-05-04 12:34                     │
│ │ │         │  refs   main, v1.2                           │
│ ●─┘ merge... │                                              │
│ │           │  Mensaje:                                    │
│ ● fix bug   │  feat: agrega gitgraph + diff viewer        │
│              │                                              │
│              │  [Diff vs HEAD]  [Revertir]  [Rama nueva]   │
│              │  ───────────────────────────────             │
│              │  Files cambiados (3):                        │
│              │  + src/components/git/Graph.tsx (+120)       │
│              │  M src/lib/forgejo-history.ts (+8 -2)        │
│              │  - src/old-thing.ts (-15)                    │
│              │                                              │
│              │  [Patch unificado, scroll vertical]          │
└──────────────┴──────────────────────────────────────────────┘
```

## Sub-componentes

```
src/components/dashboard/GitWorkbench.tsx     (orquestador)
src/components/dashboard/git/
  GitGraphPanel.tsx        SVG con commits + lanes
  GitCommitDetail.tsx      Header del commit seleccionado + acciones
  GitDiffPanel.tsx         Lista de archivos + patch unificado
  GitComparePanel.tsx      Selector base/head + reutiliza GitDiffPanel
  GitRevertConfirmModal.tsx Modal de confirmación
  GitNewBranchModal.tsx    Modal para crear rama
  diff-utils.ts            Parser de patch unificado a hunks
```

## Decisión de libs

### Diff viewer
**No se agrega dep.** Se renderea con `<pre>` + clases tailwind
`text-emerald-700 bg-emerald-50` (línea `+`), `text-rose-700 bg-rose-50`
(línea `-`), neutro para contexto. Parser propio en `diff-utils.ts`
(~30 líneas: lee headers `@@ ... @@` y clasifica cada línea por su
primer carácter).

Razón: `react-diff-viewer-continued` añade ~100KB y peer deps en React 16.
La UI de Agora es minimalista; un viewer custom evade eso y queda bajo
control.

### Gitgraph
**No se agrega dep.** Se renderea con SVG inline.

Razón: `@gitgraph/react` arrastra `@gitgraph/core`, depende de bindings
React 16/17 y su layout es opinionado (no tailwindable directo). La
historia típica de un workspace educativo es lineal con pocas merges,
no necesitamos el motor completo.

Algoritmo (en `GitGraphPanel.tsx`, ~80 líneas):
1. Recibe `commits` ya con `parents` desde el backend, ordenados HEAD→...
2. Asigna lanes: greedy. Para cada commit toma el lane mínimo libre.
   Cuando un commit cierra un parent (parent ya pintado), libera el lane
   del parent. Resultado: mapa `sha → laneIndex`.
3. Renderiza:
   - `<circle cx={lane * 20 + 12} cy={row * 28 + 14} r="5" />` por commit.
   - `<path d="M..."/>` por cada arista commit→parent (curva Bezier corta
     si cambia de lane, línea recta si no).
   - Click en círculo emite `onSelectCommit(sha)`.
4. Colores por hash (8 colores rotando, hash determinístico): da
   diferenciación visual entre branches sin estado.

## Endpoints consumidos (todos nuevos en backend)

- `GET /api/workspaces/[id]/git/graph?limit=50` — al cargar la tab Historial.
- `GET /api/workspaces/[id]/git/diff?base=<sha>&head=<sha>` — al
  seleccionar un commit (compara contra `commit.parents[0]` por defecto).
- `POST /api/workspaces/[id]/git/revert` `{sha}` — al confirmar revertir.
- `POST /api/workspaces/[id]/git/checkout` `{sha, mode, branchName?}` —
  al crear rama nueva. `detached` no se usa por ahora (la lectura ya la
  hace `git/diff` mostrando estado).

## Schemas en `@agora/contracts`

Se agregan en `packages/agora-contracts/src/api-responses.ts`:

```ts
export const gitGraphCommitSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  parents: z.array(z.string()),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  date: z.string(),
  htmlUrl: z.string(),
  refs: z.array(z.string()).default([])
});
export const gitGraphResponseSchema = z.object({
  repoFullName: z.string(),
  defaultBranch: z.string(),
  commits: z.array(gitGraphCommitSchema)
});

export const gitDiffFileSchema = z.object({
  path: z.string(),
  oldPath: z.string().optional(),
  status: z.union([z.literal('added'), z.literal('removed'), z.literal('modified'), z.literal('renamed')]),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string()
});
export const gitDiffResponseSchema = z.object({
  base: z.string(),
  head: z.string(),
  files: z.array(gitDiffFileSchema),
  stats: z.object({ totalAdditions: z.number(), totalDeletions: z.number(), totalFiles: z.number() }),
  truncated: z.boolean().default(false)
});

export const gitRevertResponseSchema = z.object({
  ok: z.boolean(),
  newSha: z.string().optional(),
  message: z.string().optional(),
  filesChanged: z.number().optional(),
  error: z.string().optional()
});

export const gitCheckoutResponseSchema = z.object({
  ok: z.boolean(),
  branch: z.string().optional(),
  sha: z.string().optional(),
  htmlUrl: z.string().optional(),
  treeSize: z.number().optional(),
  files: z.array(z.string()).optional(),
  error: z.string().optional()
});
```

## Flujo revert (UI)

1. User clickea "Revertir" en un commit.
2. Modal pide confirmación, mostrando preview: "Esto creará un commit
   nuevo que deshace los cambios de `<sha>`. ¿Continuar?".
3. POST a `/git/revert`. Bloquea la UI con spinner.
4. Si `ok=true`: refrescar grafo, toast "Revert creado: `<newSha>`".
5. Si `ok=false`: mostrar error y conflictos si los hay.
6. **Importante**: tras un revert exitoso el campo `git.committedHash` de
   los docs Firestore queda obsoleto hasta que el daemon resyncronice
   (≤5s). El componente fuerza un `refreshAll()` al cabo de 6s para que
   el status muestre los archivos en `clean` correctamente. Si el user
   ve `modified` antes de eso, puede clickear "Recargar" manualmente.

## Tests

Vitest unit tests en `tests/unit/`:
- `git-diff-utils.test.ts` — parser de patch a hunks: cubre archivo nuevo,
  borrado, renombrado, hunks múltiples.
- `git-graph-lanes.test.ts` — algoritmo de lanes: lineal, merge, fork,
  varias ramas paralelas.

Sin E2E. Validamos con `npm run typecheck` y `npm run build`.

## Riesgos

1. **Performance del grafo con 100+ commits**: SVG nativo es liviano,
   pero scrolling con 1000 nodos puede lagear. Default `limit=50`. Se
   puede paginar después.
2. **Revert UX engañoso**: el toast dice "OK" antes que Firestore se
   actualice. Mitigado con refresh diferido (6s) + nota en tooltip.
3. **Diff de archivos binarios**: Forgejo retorna `Binary files differ`
   sin patch. Se muestra como bloque informativo, no error.
4. **Mobile layout**: el split horizontal no funciona en pantalla
   estrecha. Fallback: tabs internas (graph | detail) en `<md`.
