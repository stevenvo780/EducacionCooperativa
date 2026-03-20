'use client';

import type { ReactNode } from 'react';
import {
  BookMarked,
  Briefcase,
  ClipboardList,
  FileCode2,
  Link2,
  Network,
  Pin,
  Quote,
  Sparkles,
  X
} from 'lucide-react';
import type { BoardCard } from '@/components/dashboard/types';
import type {
  SemanticWorkspaceState
} from '@/services/editorSemanticStore';

interface SemanticWorkbenchProps {
  docName: string;
  state: SemanticWorkspaceState;
  linkedTasks: BoardCard[];
  onClose: () => void;
  onInsertAtlas: () => void;
  onInsertEvidenceMatrix: () => void;
  onInsertResearchBrief: () => void;
  onGenerateSTFile?: () => void;
  companionSTExists?: boolean;
}

const compactText = (value: string, maxLength = 140) => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Sin contenido';
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}...`;
};

const toTableCell = (value: string) => compactText(value, 90).replace(/\|/g, '\\|');

const getPinnedFragments = (state: SemanticWorkspaceState) => (
  state.fragments.filter((item) => item.kind === 'pinned')
);

const getEvidenceFragments = (state: SemanticWorkspaceState) => (
  state.fragments.filter((item) => item.kind === 'evidence')
);

const getLinkedDocuments = (state: SemanticWorkspaceState) => {
  const linked = new Map<string, { name: string; fragment: string }>();

  state.fragments.forEach((item) => {
    if (!item.linkedDocId || !item.linkedDocName) return;
    if (linked.has(item.linkedDocId)) return;
    linked.set(item.linkedDocId, {
      name: item.linkedDocName,
      fragment: item.excerpt
    });
  });

  return Array.from(linked.entries()).map(([id, value]) => ({
    id,
    name: value.name,
    fragment: value.fragment
  }));
};

const getRelationCounts = (state: SemanticWorkspaceState) => {
  const counts = new Map<string, number>();
  state.relations.forEach((relation) => {
    counts.set(relation.conceptId, (counts.get(relation.conceptId) ?? 0) + 1);
  });
  return counts;
};

export const buildSemanticAtlasMarkdown = ({
  state,
  docName
}: {
  state: SemanticWorkspaceState;
  docName: string;
}) => {
  const pinned = getPinnedFragments(state);
  const evidence = getEvidenceFragments(state);
  const relationCounts = getRelationCounts(state);

  return [
    '## Atlas semantico',
    `> Generado desde **${docName || 'Documento actual'}**.`,
    '',
    '### Panorama',
    `- Conceptos registrados: **${state.concepts.length}**`,
    `- Evidencias marcadas: **${evidence.length}**`,
    `- Fragmentos fijados: **${pinned.length}**`,
    `- Relaciones activas: **${state.relations.length}**`,
    '',
    '### Conceptos activos',
    ...(state.concepts.length > 0
      ? state.concepts.slice(0, 10).map((concept, index) => {
          const base = `${index + 1}. **${concept.title}** — ${compactText(concept.excerpt, 120)} _(fuente: ${concept.docName}; relaciones: ${relationCounts.get(concept.id) ?? 0})_`;
          return concept.definition ? `${base}\n   > Definición: ${compactText(concept.definition, 200)}` : base;
        })
      : ['- Aun no hay conceptos registrados desde el editor.']),
    '',
    '### Fragmentos fijados',
    ...(pinned.length > 0
      ? pinned.slice(0, 8).map((item) => `- ${compactText(item.text, 160)} _(documento: ${item.docName})_`)
      : ['- Aun no hay fragmentos fijados.']),
    '',
    '### Evidencias disponibles',
    ...(evidence.length > 0
      ? evidence.slice(0, 8).map((item) => `- ${compactText(item.text, 160)} _(documento: ${item.docName})_`)
      : ['- Aun no hay evidencias marcadas.']),
    ''
  ].join('\n');
};

export const buildEvidenceMatrixMarkdown = ({ state }: { state: SemanticWorkspaceState }) => {
  const rows = [
    ...getEvidenceFragments(state).map((item) => ({
      type: 'Evidencia',
      fragment: item,
      relation: item.conceptTitle || item.linkedDocName || 'Sin vinculo'
    })),
    ...getPinnedFragments(state)
      .filter((item) => item.kind === 'pinned')
      .map((item) => ({
        type: 'Fijado',
        fragment: item,
        relation: item.conceptTitle || item.linkedDocName || 'Acceso rapido'
      }))
  ];

  return [
    '## Matriz de evidencias',
    '',
    '| Tipo | Fragmento | Documento | Relacion |',
    '| --- | --- | --- | --- |',
    ...(rows.length > 0
      ? rows.slice(0, 16).map((row) => (
          `| ${row.type} | ${toTableCell(row.fragment.text)} | ${toTableCell(row.fragment.docName)} | ${toTableCell(row.relation)} |`
        ))
      : ['| Sin datos | Todavia no hay fragmentos marcados desde el menu semantico. | - | - |']),
    ''
  ].join('\n');
};

export const buildResearchBriefMarkdown = ({
  state,
  docName,
  linkedTasks
}: {
  state: SemanticWorkspaceState;
  docName: string;
  linkedTasks: BoardCard[];
}) => {
  const evidence = getEvidenceFragments(state);
  const pinned = getPinnedFragments(state);
  const linkedDocs = getLinkedDocuments(state);
  const nextSteps: string[] = [];

  if (state.concepts.length === 0) {
    nextSteps.push('Definir al menos un concepto desde una seleccion relevante.');
  }
  if (evidence.length === 0) {
    nextSteps.push('Marcar evidencias antes de redactar conclusiones.');
  }
  if (state.relations.length === 0 && state.concepts.length > 0) {
    nextSteps.push('Relacionar conceptos con fragmentos para evitar conceptos huerfanos.');
  }
  if (linkedTasks.length === 0) {
    nextSteps.push('Convertir un fragmento critico en tarea para dar seguimiento operativo.');
  }
  if (nextSteps.length === 0) {
    nextSteps.push('Consolidar los hallazgos en una conclusion o memo de equipo.');
  }

  return [
    '## Bitacora de investigacion',
    `> Corte rapido del documento **${docName || 'Documento actual'}**.`,
    '',
    '### Resumen operativo',
    `- Conceptos activos: **${state.concepts.length}**`,
    `- Evidencias listas para redactar: **${evidence.length}**`,
    `- Fragmentos fijados para consulta: **${pinned.length}**`,
    `- Enlaces internos creados: **${linkedDocs.length}**`,
    `- Tareas vinculadas: **${linkedTasks.length}**`,
    '',
    '### Conceptos prioritarios',
    ...(state.concepts.length > 0
      ? state.concepts.slice(0, 5).map((concept) => {
          const base = `- **${concept.title}** — ${compactText(concept.excerpt, 120)}`;
          return concept.definition ? `${base}\n  > ${compactText(concept.definition, 200)}` : base;
        })
      : ['- Todavia no hay conceptos priorizados.']),
    '',
    '### Evidencias clave',
    ...(evidence.length > 0
      ? evidence.slice(0, 5).map((item) => `- ${compactText(item.text, 160)} _(fuente: ${item.docName})_`)
      : ['- Todavia no hay evidencias clave registradas.']),
    '',
    '### Documentos conectados',
    ...(linkedDocs.length > 0
      ? linkedDocs.slice(0, 6).map((item) => `- **${item.name}** — ${compactText(item.fragment, 110)}`)
      : ['- Todavia no hay enlaces internos asociados a fragmentos.']),
    '',
    '### Tareas relacionadas',
    ...(linkedTasks.length > 0
      ? linkedTasks.slice(0, 6).map((task) => `- **${task.title}**${task.description ? ` — ${compactText(task.description, 110)}` : ''}`)
      : ['- Todavia no hay tareas vinculadas a este documento.']),
    '',
    '### Proximos pasos sugeridos',
    ...nextSteps.map((step) => `- [ ] ${step}`),
    ''
  ].join('\n');
};

function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</div>
    </div>
  );
}

function WorkbenchAction({
  icon,
  title,
  description,
  onClick
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-blue-500/40 hover:bg-slate-900"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span className="text-blue-300">{icon}</span>
        {title}
      </div>
      <p className="text-[11px] leading-5 text-slate-500">{description}</p>
    </button>
  );
}

function WorkbenchList({
  title,
  icon,
  items,
  emptyLabel
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ title: string; subtitle: string; meta: string }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] leading-5 text-slate-500">{emptyLabel}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
              <div className="text-xs font-medium text-slate-200">{item.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-400">{item.subtitle}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.meta}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function SemanticWorkbench({
  docName,
  state,
  linkedTasks,
  onClose,
  onInsertAtlas,
  onInsertEvidenceMatrix,
  onInsertResearchBrief,
  onGenerateSTFile,
  companionSTExists
}: SemanticWorkbenchProps) {
  const pinned = getPinnedFragments(state);
  const evidence = getEvidenceFragments(state);
  const linkedDocs = getLinkedDocuments(state);

  return (
    <aside className="w-[23rem] shrink-0 border-l border-slate-800 bg-slate-950/95">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <BookMarked className="h-3.5 w-3.5" />
              Mesa semantica
            </div>
            <p className="mt-2 text-sm text-slate-200">{docName || 'Documento actual'}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Convierte conceptos, evidencias y relaciones en artefactos utiles dentro del documento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            title="Cerrar mesa semantica"
            aria-label="Cerrar mesa semantica"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Conceptos" value={state.concepts.length} hint="Ideas registradas desde selecciones" />
          <MetricCard label="Evidencias" value={evidence.length} hint="Fragmentos marcados para argumentar" />
          <MetricCard label="Fijados" value={pinned.length} hint="Atajos para reusar fragmentos clave" />
          <MetricCard label="Tareas" value={linkedTasks.length} hint="Seguimientos operativos vinculados" />
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Materializar el trabajo</div>
          <div className="grid gap-2">
            <WorkbenchAction
              icon={<Network className="h-4 w-4" />}
              title="Insertar atlas de conceptos"
              description="Crea una vista redactable con panorama, conceptos activos y fragmentos clave."
              onClick={onInsertAtlas}
            />
            <WorkbenchAction
              icon={<ClipboardList className="h-4 w-4" />}
              title="Insertar matriz de evidencias"
              description="Genera una tabla con evidencias y fijados lista para completar o exportar."
              onClick={onInsertEvidenceMatrix}
            />
            <WorkbenchAction
              icon={<Sparkles className="h-4 w-4" />}
              title="Insertar bitacora de investigacion"
              description="Resume estado, tareas, documentos conectados y proximos pasos sugeridos."
              onClick={onInsertResearchBrief}
            />
            {onGenerateSTFile && (
              <WorkbenchAction
                icon={<FileCode2 className="h-4 w-4" />}
                title={companionSTExists ? 'Actualizar archivo ST' : 'Generar archivo ST'}
                description={companionSTExists
                  ? 'Sincroniza las definiciones formales con los conceptos actuales.'
                  : 'Crea un archivo .st con definiciones formales de tus conceptos y evidencias.'}
                onClick={onGenerateSTFile}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Flujo recomendado</div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            1. Selecciona un fragmento. 2. Guardalo como concepto, evidencia o ficha analitica. 3. Relacionalo o conviertelo en tarea. 4. Inserta un atlas o una bitacora para consolidar el trabajo.
          </p>
        </section>

        <WorkbenchList
          title="Conceptos activos"
          icon={<Network className="h-4 w-4" />}
          items={state.concepts.slice(0, 6).map((concept) => ({
            title: concept.title,
            subtitle: concept.definition || concept.excerpt,
            meta: concept.definition ? `${concept.docName} · con definición` : concept.docName
          }))}
          emptyLabel="Todavia no hay conceptos registrados."
        />

        <WorkbenchList
          title="Evidencias"
          icon={<Quote className="h-4 w-4" />}
          items={evidence.slice(0, 6).map((item) => ({
            title: compactText(item.excerpt, 70),
            subtitle: item.docName,
            meta: 'Evidencia'
          }))}
          emptyLabel="Todavia no hay evidencias marcadas."
        />

        <WorkbenchList
          title="Fragmentos fijados"
          icon={<Pin className="h-4 w-4" />}
          items={pinned.slice(0, 6).map((item) => ({
            title: compactText(item.excerpt, 70),
            subtitle: item.docName,
            meta: 'Acceso rapido'
          }))}
          emptyLabel="Todavia no hay fragmentos fijados."
        />

        <WorkbenchList
          title="Documentos conectados"
          icon={<Link2 className="h-4 w-4" />}
          items={linkedDocs.slice(0, 6).map((item) => ({
            title: item.name,
            subtitle: compactText(item.fragment, 90),
            meta: 'Enlace interno'
          }))}
          emptyLabel="Todavia no hay enlaces internos creados desde selecciones."
        />

        <WorkbenchList
          title="Tareas vinculadas"
          icon={<Briefcase className="h-4 w-4" />}
          items={linkedTasks.slice(0, 6).map((task) => ({
            title: task.title,
            subtitle: compactText(task.description || task.sourceFragment || 'Sin descripcion', 90),
            meta: task.sourceDocName || 'Tablero'
          }))}
          emptyLabel="Todavia no hay tareas vinculadas a este documento."
        />
      </div>
    </aside>
  );
}
