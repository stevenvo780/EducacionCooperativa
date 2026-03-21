'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  BookMarked,
  ClipboardList,
  FileCode2,
  Link2,
  Network,
  Pin,
  Quote,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import clsx from 'clsx';
import type { BoardCard } from '@/components/dashboard/types';
import type {
  SemanticConceptRecord,
  SemanticFragmentRecord,
  SemanticRelationRecord,
  SemanticWorkspaceState
} from '@/services/editorSemanticStore';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';

type SemanticTab = 'resumen' | 'conceptos' | 'evidencias' | 'fijados' | 'relaciones' | 'archivos';

const TABS: { key: SemanticTab; label: string; icon: React.ReactNode }[] = [
  { key: 'resumen', label: 'Resumen', icon: <BookMarked className="h-3.5 w-3.5" /> },
  { key: 'conceptos', label: 'Conceptos', icon: <Network className="h-3.5 w-3.5" /> },
  { key: 'evidencias', label: 'Evidencias', icon: <Quote className="h-3.5 w-3.5" /> },
  { key: 'fijados', label: 'Fijados', icon: <Pin className="h-3.5 w-3.5" /> },
  { key: 'relaciones', label: 'Relaciones', icon: <Link2 className="h-3.5 w-3.5" /> },
  { key: 'archivos', label: 'Archivos ST', icon: <FileCode2 className="h-3.5 w-3.5" /> }
];

interface SemanticBrowserProps {
  docName: string;
  state: SemanticWorkspaceState;
  linkedTasks: BoardCard[];
  onBack: () => void;
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
  return `${compact.slice(0, maxLength - 1)}…`;
};

const formatDate = (ts: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ── Metric Card ── */
function MetricCard({ label, value, hint, accent }: { label: string; value: number; hint: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={clsx('mt-2 text-3xl font-bold', accent || 'text-slate-100')}>{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</div>
    </div>
  );
}

/* ── Action Card ── */
function ActionCard({ icon, title, description, onClick, variant }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'blue' | 'emerald' | 'default';
}) {
  const colors = variant === 'blue'
    ? 'border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/5'
    : variant === 'emerald'
      ? 'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5'
      : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900';
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('rounded-xl border bg-slate-900/70 p-4 text-left transition', colors)}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span className="text-blue-300">{icon}</span>
        {title}
      </div>
      <p className="text-[11px] leading-5 text-slate-500">{description}</p>
    </button>
  );
}

/* ── Concept Detail Card ── */
function ConceptCard({ concept, relationsCount, fragments }: {
  concept: SemanticConceptRecord;
  relationsCount: number;
  fragments: SemanticFragmentRecord[];
}) {
  const [expanded, setExpanded] = useState(false);
  const relatedFragments = fragments.filter(f => f.conceptId === concept.id);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-100 truncate">{concept.title}</h4>
            {concept.definition && (
              <p className="mt-1 text-xs text-blue-300/80">Def: {concept.definition}</p>
            )}
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{compactText(concept.excerpt, 200)}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1 text-[10px] text-slate-500">
            <span>{concept.docName}</span>
            <span>{formatDate(concept.updatedAt)}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {concept.logicProfile && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
              {concept.logicProfile}
            </span>
          )}
          {concept.formula && (
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
              axiom
            </span>
          )}
          {relationsCount > 0 && (
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {relationsCount} relacion{relationsCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/50 px-4 py-3 space-y-3">
          {concept.formula && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Fórmula ST</div>
              <pre className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-cyan-300 overflow-x-auto">
                {concept.formula}
              </pre>
            </div>
          )}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Texto fuente</div>
            <p className="text-[11px] leading-5 text-slate-400">{concept.excerpt}</p>
          </div>
          {relatedFragments.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Fragmentos relacionados ({relatedFragments.length})
              </div>
              <div className="space-y-1">
                {relatedFragments.map(f => (
                  <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-slate-400">
                    {compactText(f.excerpt, 120)}
                    <span className="ml-2 text-[10px] text-slate-600">{f.docName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Fragment Card ── */
function FragmentCard({ fragment }: { fragment: SemanticFragmentRecord }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-200 leading-5 flex-1 min-w-0">{compactText(fragment.text, 300)}</p>
        <div className="shrink-0 text-[10px] text-slate-500 text-right">
          <div>{fragment.docName}</div>
          <div>{formatDate(fragment.updatedAt)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {fragment.conceptTitle && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">
            ↔ {fragment.conceptTitle}
          </span>
        )}
        {fragment.linkedDocName && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            📄 {fragment.linkedDocName}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Relation Card ── */
function RelationCard({ relation, fragment }: { relation: SemanticRelationRecord; fragment?: SemanticFragmentRecord }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
        <Link2 className="h-3.5 w-3.5 text-blue-300" />
        {relation.conceptTitle}
      </div>
      {fragment && (
        <p className="mt-2 text-[11px] leading-5 text-slate-400">
          {compactText(fragment.excerpt || fragment.text, 200)}
        </p>
      )}
      <div className="mt-2 text-[10px] text-slate-500">
        {relation.relationType} · {formatDate(relation.createdAt)}
      </div>
    </div>
  );
}

/* ── ST Files Section ── */
function STFilesPanel() {
  const allFiles = STDefinitionsRegistry.getRegisteredFiles();
  const entries = allFiles.map(fileName => ({
    fileName,
    definitions: STDefinitionsRegistry.getFileDefinitions(fileName)
  })).filter(e => e.definitions.length > 0);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCode2 className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No hay archivos ST registrados</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Genera un archivo ST desde un documento con conceptos definidos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(({ fileName, definitions }) => (
        <div key={fileName} className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">{fileName}</span>
            <span className="ml-auto text-[10px] text-slate-500">{definitions.length} definiciones</span>
          </div>
          <div className="p-3 space-y-1.5">
            {definitions.map((def, i) => (
              <div key={`${def.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                <span className={clsx(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold',
                  def.kind === 'define' ? 'bg-blue-500/15 text-blue-300' :
                    def.kind === 'interpretation' ? 'bg-amber-500/15 text-amber-300' :
                      'bg-violet-500/15 text-violet-300'
                )}>
                  {def.kind}
                </span>
                <span className="text-xs font-mono text-slate-200 truncate">{def.name}</span>
                {def.naturalName && def.naturalName !== def.name && (
                  <span className="text-[10px] text-slate-500 truncate ml-auto">{compactText(def.naturalName, 60)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-3 text-slate-600">{icon}</div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 text-[11px] text-slate-600 max-w-md mx-auto">{description}</p>
    </div>
  );
}

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/* ══════════════════════════════════════════════
   ══  SemanticBrowser — Full Tab Component  ══
   ══════════════════════════════════════════════ */

export function SemanticBrowser({
  docName,
  state,
  linkedTasks,
  onBack,
  onInsertAtlas,
  onInsertEvidenceMatrix,
  onInsertResearchBrief,
  onGenerateSTFile,
  companionSTExists
}: SemanticBrowserProps) {
  const [activeTab, setActiveTab] = useState<SemanticTab>('resumen');
  const [searchQuery, setSearchQuery] = useState('');

  const evidence = useMemo(() => state.fragments.filter(f => f.kind === 'evidence'), [state.fragments]);
  const pinned = useMemo(() => state.fragments.filter(f => f.kind === 'pinned'), [state.fragments]);

  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    state.relations.forEach(r => { counts.set(r.conceptId, (counts.get(r.conceptId) ?? 0) + 1); });
    return counts;
  }, [state.relations]);

  const linkedDocs = useMemo(() => {
    const linked = new Map<string, { name: string; fragment: string }>();
    state.fragments.forEach(item => {
      if (!item.linkedDocId || !item.linkedDocName || linked.has(item.linkedDocId)) return;
      linked.set(item.linkedDocId, { name: item.linkedDocName, fragment: item.excerpt });
    });
    return Array.from(linked.entries()).map(([id, v]) => ({ id, ...v }));
  }, [state.fragments]);

  const lowerQuery = searchQuery.toLowerCase().trim();

  const filteredConcepts = useMemo(() => {
    if (!lowerQuery) return state.concepts;
    return state.concepts.filter(c =>
      c.title.toLowerCase().includes(lowerQuery) ||
      (c.definition?.toLowerCase().includes(lowerQuery)) ||
      c.excerpt.toLowerCase().includes(lowerQuery)
    );
  }, [state.concepts, lowerQuery]);

  const filteredEvidence = useMemo(() => {
    if (!lowerQuery) return evidence;
    return evidence.filter(f => f.text.toLowerCase().includes(lowerQuery) || f.excerpt.toLowerCase().includes(lowerQuery));
  }, [evidence, lowerQuery]);

  const filteredPinned = useMemo(() => {
    if (!lowerQuery) return pinned;
    return pinned.filter(f => f.text.toLowerCase().includes(lowerQuery) || f.excerpt.toLowerCase().includes(lowerQuery));
  }, [pinned, lowerQuery]);

  const filteredRelations = useMemo(() => {
    if (!lowerQuery) return state.relations;
    return state.relations.filter(r =>
      r.conceptTitle.toLowerCase().includes(lowerQuery)
    );
  }, [state.relations, lowerQuery]);

  const tabCounts: Record<SemanticTab, number> = {
    resumen: 0,
    conceptos: state.concepts.length,
    evidencias: evidence.length,
    fijados: pinned.length,
    relaciones: state.relations.length,
    archivos: STDefinitionsRegistry.getRegisteredFiles().length
  };

  const handleTabChange = useCallback((tab: SemanticTab) => {
    setActiveTab(tab);
    setSearchQuery('');
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider shrink-0 transition"
            >
              <ChevronLeftIcon className="w-4 h-4" /> Editor
            </button>
            <div className="h-4 w-px bg-slate-700 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <BookMarked className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-200 truncate">Mesa Semántica</span>
            </div>
          </div>

          {/* Search */}
          {activeTab !== 'resumen' && (
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1.5 rounded-lg ml-4">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-500 shrink-0 ml-3">
            {docName || 'Documento'}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0.5 px-4 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
              )}
            >
              {tab.icon}
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === tab.key ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'
                )}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {activeTab === 'resumen' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Conceptos" value={state.concepts.length} hint="Ideas registradas desde selecciones" accent="text-blue-300" />
              <MetricCard label="Evidencias" value={evidence.length} hint="Fragmentos para argumentar" accent="text-amber-300" />
              <MetricCard label="Fijados" value={pinned.length} hint="Atajos de acceso rápido" accent="text-emerald-300" />
              <MetricCard label="Relaciones" value={state.relations.length} hint="Conexiones entre conceptos" accent="text-violet-300" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Tareas" value={linkedTasks.length} hint="Seguimientos operativos" />
              <MetricCard label="Docs enlazados" value={linkedDocs.length} hint="Enlaces internos creados" />
              <MetricCard label="Archivos ST" value={STDefinitionsRegistry.getRegisteredFiles().length} hint="Archivos con definiciones" />
              <MetricCard label="Definiciones" value={state.concepts.filter(c => c.definition).length} hint="Conceptos con definición formal" />
            </div>

            {/* Actions */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Materializar el trabajo</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ActionCard
                  icon={<Network className="h-4 w-4" />}
                  title="Insertar atlas"
                  description="Vista redactable con panorama, conceptos y fragmentos clave."
                  onClick={onInsertAtlas}
                  variant="blue"
                />
                <ActionCard
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Matriz de evidencias"
                  description="Tabla con evidencias y fijados lista para exportar."
                  onClick={onInsertEvidenceMatrix}
                />
                <ActionCard
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Bitácora de investigación"
                  description="Resumen de estado, tareas, docs conectados y próximos pasos."
                  onClick={onInsertResearchBrief}
                />
                {onGenerateSTFile && (
                  <ActionCard
                    icon={<FileCode2 className="h-4 w-4" />}
                    title={companionSTExists ? 'Actualizar ST' : 'Generar archivo ST'}
                    description={companionSTExists
                      ? 'Sincroniza definiciones formales con los conceptos actuales.'
                      : 'Crea un archivo .st con definiciones formales de tus conceptos.'}
                    onClick={onGenerateSTFile}
                    variant="emerald"
                  />
                )}
              </div>
            </div>

            {/* Quick preview of concepts */}
            {state.concepts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Últimos conceptos</h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange('conceptos')}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition"
                  >
                    Ver todos →
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {state.concepts.slice(0, 4).map(concept => (
                    <ConceptCard
                      key={concept.id}
                      concept={concept}
                      relationsCount={relationCounts.get(concept.id) ?? 0}
                      fragments={state.fragments}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Workflow */}
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Flujo recomendado</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {[
                  { n: '1', t: 'Selecciona un fragmento relevante' },
                  { n: '2', t: 'Guárdalo como concepto, evidencia o ficha' },
                  { n: '3', t: 'Relaciónalo con otros conceptos o documentos' },
                  { n: '4', t: 'Inserta atlas o bitácora para consolidar' }
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-2">
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-300">{step.n}</span>
                    <p className="text-[11px] leading-5 text-slate-500 pt-0.5">{step.t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conceptos' && (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredConcepts.length === 0 ? (
              <EmptyState
                icon={<Network className="h-8 w-8" />}
                title={lowerQuery ? 'Sin resultados' : 'No hay conceptos registrados'}
                description={lowerQuery
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Selecciona texto en el editor y usa "Definir concepto" para crear tu primer concepto.'}
              />
            ) : (
              filteredConcepts.map(concept => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  relationsCount={relationCounts.get(concept.id) ?? 0}
                  fragments={state.fragments}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'evidencias' && (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredEvidence.length === 0 ? (
              <EmptyState
                icon={<Quote className="h-8 w-8" />}
                title={lowerQuery ? 'Sin resultados' : 'No hay evidencias marcadas'}
                description={lowerQuery
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Selecciona texto en el editor y usa "Marcar como evidencia" para comenzar.'}
              />
            ) : (
              filteredEvidence.map(fragment => (
                <FragmentCard key={fragment.id} fragment={fragment} />
              ))
            )}
          </div>
        )}

        {activeTab === 'fijados' && (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredPinned.length === 0 ? (
              <EmptyState
                icon={<Pin className="h-8 w-8" />}
                title={lowerQuery ? 'Sin resultados' : 'No hay fragmentos fijados'}
                description={lowerQuery
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Selecciona texto en el editor y usa "Fijar fragmento" para acceso rápido.'}
              />
            ) : (
              filteredPinned.map(fragment => (
                <FragmentCard key={fragment.id} fragment={fragment} />
              ))
            )}
          </div>
        )}

        {activeTab === 'relaciones' && (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredRelations.length === 0 ? (
              <EmptyState
                icon={<Link2 className="h-8 w-8" />}
                title={lowerQuery ? 'Sin resultados' : 'No hay relaciones'}
                description={lowerQuery
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Selecciona texto y relacíonalo con un concepto existente.'}
              />
            ) : (
              filteredRelations.map(relation => (
                <RelationCard
                  key={relation.id}
                  relation={relation}
                  fragment={state.fragments.find(f => f.id === relation.fragmentId)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'archivos' && (
          <div className="max-w-4xl mx-auto">
            <STFilesPanel />
          </div>
        )}
      </div>
    </div>
  );
}
