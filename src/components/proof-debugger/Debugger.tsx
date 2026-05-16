'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { DebugExample, DebugSnapshot } from './types';
import { PROOF_EXAMPLES } from './examples';

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  exampleId: string;
  snapshots: DebugSnapshot[];
  cursor: number;
  playing: boolean;
}

type Action =
  | { type: 'SELECT_EXAMPLE'; id: string; snapshots: DebugSnapshot[] }
  | { type: 'GO_TO'; cursor: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TICK' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_EXAMPLE':
      return { ...state, exampleId: action.id, snapshots: action.snapshots, cursor: 0, playing: false };
    case 'GO_TO':
      return { ...state, cursor: Math.max(0, Math.min(action.cursor, state.snapshots.length - 1)), playing: false };
    case 'PLAY':
      return state.cursor >= state.snapshots.length - 1
        ? { ...state, cursor: 0, playing: true }
        : { ...state, playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'TICK': {
      const next = state.cursor + 1;
      if (next >= state.snapshots.length) return { ...state, playing: false };
      return { ...state, cursor: next };
    }
  }
}

const initialExample = PROOF_EXAMPLES[0] ?? {
  id: '',
  name: '',
  description: '',
  profile: '',
  snapshots: []
};

const initialState: State = {
  exampleId: initialExample.id,
  snapshots: initialExample.snapshots,
  cursor: 0,
  playing: false
};

// ─── Source badge ──────────────────────────────────────────────────────────────

function sourceBadge(source?: string): { label: string; color: string } {
  switch (source) {
    case 'premise': return { label: 'Premisa', color: '#3b82f6' };
    case 'assumption': return { label: 'Asunción', color: '#f59e0b' };
    case 'rule': return { label: 'Regla', color: '#22c55e' };
    case 'semantic': return { label: 'Semántico', color: '#a855f7' };
    case 'goal': return { label: 'Objetivo', color: '#ef4444' };
    case 'subproof': return { label: 'Subprueba', color: '#06b6d4' };
    default: return { label: source ?? '—', color: '#6b7280' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Debugger() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { snapshots, cursor, playing, exampleId } = state;
  const current = snapshots[cursor];
  const total = snapshots.length;
  const isFirst = cursor === 0;
  const isLast = cursor === total - 1;

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [playing]);

  const selectExample = useCallback((ex: DebugExample) => {
    dispatch({ type: 'SELECT_EXAMPLE', id: ex.id, snapshots: ex.snapshots });
  }, []);

  const goTo = useCallback((n: number) => dispatch({ type: 'GO_TO', cursor: n }), []);

  const currentExample = PROOF_EXAMPLES.find(e => e.id === exampleId);

  if (!current) return <div style={S.empty}>Sin pasos para mostrar.</div>;

  const badge = sourceBadge(current.source);

  return (
    <div style={S.root}>
      {/* ── Toolbar ── */}
      <div style={S.toolbar}>
        <span style={S.toolbarTitle}>
          <ClockIcon />
          Proof Debugger
        </span>

        <div style={S.examplePicker}>
          {PROOF_EXAMPLES.map(ex => (
            <button
              key={ex.id}
              onClick={() => selectExample(ex)}
              style={ex.id === exampleId ? { ...S.exBtn, ...S.exBtnActive } : S.exBtn}
              title={ex.description}
            >
              {ex.name}
            </button>
          ))}
        </div>

        {currentExample && (
          <span style={S.profileBadge}>{currentExample.profile}</span>
        )}
      </div>

      {/* ── 3-column layout ── */}
      <div style={S.columns}>

        {/* LEFT — step list */}
        <aside style={S.left}>
          <div style={S.panelHeader}>Pasos ({total})</div>
          <ol style={S.stepList}>
            {snapshots.map((snap, i) => {
              const b = sourceBadge(snap.source);
              const active = i === cursor;
              return (
                <li
                  key={snap.step}
                  onClick={() => goTo(i)}
                  style={active ? { ...S.stepItem, ...S.stepItemActive } : S.stepItem}
                  aria-current={active ? 'step' : undefined}
                >
                  <span style={{ ...S.stepDot, background: b.color }} />
                  <span style={S.stepNum}>{snap.step}</span>
                  <span style={S.stepFormula} title={snap.formula}>{snap.formula}</span>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* CENTER — formula focus */}
        <main style={S.center}>
          <div style={S.panelHeader}>
            Paso {current.step} / {total}
            <span style={{ ...S.sourceBadge, background: badge.color }}>
              {badge.label}
            </span>
          </div>

          <div style={S.formulaBox}>
            <span style={S.formulaText}>{current.formula}</span>
          </div>

          <div style={S.infoRow}>
            <span style={S.label}>Justificación:</span>
            <span style={S.monoBlue}>{current.justification}</span>
          </div>

          {current.premises.length > 0 && (
            <div style={S.infoRow}>
              <span style={S.label}>Premisas:</span>
              <div style={S.chipRow}>
                {current.premises.map(p => (
                  <button
                    key={p}
                    onClick={() => goTo(p - 1)}
                    style={S.chip}
                    title={`Ir al paso ${p}`}
                  >
                    #{p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {current.result && (
            <div style={S.infoRow}>
              <span style={S.label}>Resultado:</span>
              <span style={S.monoGreen}>{current.result}</span>
            </div>
          )}

          {/* Controls */}
          <div style={S.controls}>
            <button
              onClick={() => goTo(0)}
              disabled={isFirst}
              style={isFirst ? { ...S.ctrlBtn, ...S.ctrlDisabled } : S.ctrlBtn}
              title="Primer paso"
              aria-label="Primer paso"
            >
              <SkipBackIcon />
            </button>
            <button
              onClick={() => goTo(cursor - 1)}
              disabled={isFirst}
              style={isFirst ? { ...S.ctrlBtn, ...S.ctrlDisabled } : S.ctrlBtn}
              title="Paso anterior"
              aria-label="Paso anterior"
            >
              <StepBackIcon />
            </button>
            <button
              onClick={() => playing ? dispatch({ type: 'PAUSE' }) : dispatch({ type: 'PLAY' })}
              style={{ ...S.ctrlBtn, ...S.ctrlPlay }}
              title={playing ? 'Pausar' : 'Reproducir'}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              onClick={() => goTo(cursor + 1)}
              disabled={isLast}
              style={isLast ? { ...S.ctrlBtn, ...S.ctrlDisabled } : S.ctrlBtn}
              title="Siguiente paso"
              aria-label="Siguiente paso"
            >
              <StepFwdIcon />
            </button>
            <button
              onClick={() => goTo(total - 1)}
              disabled={isLast}
              style={isLast ? { ...S.ctrlBtn, ...S.ctrlDisabled } : S.ctrlBtn}
              title="Último paso"
              aria-label="Último paso"
            >
              <SkipFwdIcon />
            </button>
          </div>

          {/* Slider */}
          <div style={S.sliderWrap}>
            <input
              type="range"
              min={0}
              max={total - 1}
              value={cursor}
              onChange={e => goTo(Number(e.target.value))}
              style={S.slider}
              aria-label="Paso actual"
            />
            <span style={S.sliderLabel}>{cursor + 1} / {total}</span>
          </div>
        </main>

        {/* RIGHT — assignments */}
        <aside style={S.right}>
          <div style={S.panelHeader}>Asignaciones</div>
          {current.assignments && Object.keys(current.assignments).length > 0 ? (
            <table style={S.assignTable}>
              <thead>
                <tr>
                  <th style={S.th}>Var</th>
                  <th style={S.th}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(current.assignments).map(([k, v]) => (
                  <tr key={k}>
                    <td style={S.td}><code style={S.code}>{k}</code></td>
                    <td style={S.td}>
                      <span style={{ ...S.boolBadge, background: v ? '#22c55e' : '#ef4444' }}>
                        {v ? 'true' : 'false'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={S.emptyPanel}>Sin asignaciones en este paso.</p>
          )}

          {currentExample && (
            <div style={S.descBox}>
              <div style={S.descTitle}>Descripción</div>
              <p style={S.descText}>{currentExample.description}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
    </svg>
  );
}

function StepBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

function StepFwdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>
    </svg>
  );
}

function SkipFwdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px'
  },
  empty: {
    padding: '2rem',
    color: '#64748b'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    background: '#111827',
    borderBottom: '1px solid #1e293b',
    flexWrap: 'wrap'
  },
  toolbarTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
    color: '#a78bfa',
    fontSize: '15px'
  },
  examplePicker: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  exBtn: {
    padding: '4px 10px',
    border: '1px solid #334155',
    borderRadius: '6px',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px'
  },
  exBtnActive: {
    background: '#4f46e5',
    color: '#fff',
    borderColor: '#4f46e5'
  },
  profileBadge: {
    marginLeft: 'auto',
    padding: '2px 8px',
    borderRadius: '4px',
    background: '#1e293b',
    color: '#64748b',
    fontSize: '11px',
    fontFamily: 'monospace'
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 200px',
    flex: 1,
    overflow: 'hidden'
  },
  left: {
    borderRight: '1px solid #1e293b',
    overflow: 'auto',
    background: '#0d1117'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#111827',
    borderBottom: '1px solid #1e293b',
    fontWeight: 600,
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    position: 'sticky',
    top: 0,
    zIndex: 1
  },
  stepList: {
    listStyle: 'none',
    margin: 0,
    padding: 0
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #0f172a',
    overflow: 'hidden'
  },
  stepItemActive: {
    background: '#1e1b4b',
    borderLeft: '3px solid #4f46e5'
  },
  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0
  },
  stepNum: {
    color: '#475569',
    fontFamily: 'monospace',
    fontSize: '11px',
    minWidth: '18px'
  },
  stepFormula: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#cbd5e1',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto'
  },
  sourceBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#fff',
    fontWeight: 600
  },
  formulaBox: {
    margin: '24px 24px 0',
    padding: '24px',
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    textAlign: 'center'
  },
  formulaText: {
    fontSize: '28px',
    fontFamily: 'Georgia, serif',
    color: '#f1f5f9',
    letterSpacing: '0.02em'
  },
  infoRow: {
    display: 'flex',
    gap: '8px',
    padding: '10px 24px 0',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  label: {
    color: '#64748b',
    fontSize: '12px',
    flexShrink: 0
  },
  monoBlue: {
    fontFamily: 'monospace',
    color: '#a5b4fc',
    fontSize: '13px'
  },
  monoGreen: {
    fontFamily: 'monospace',
    color: '#4ade80',
    fontSize: '13px'
  },
  chipRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  chip: {
    padding: '2px 10px',
    borderRadius: '20px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '24px 24px 8px'
  },
  ctrlBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    cursor: 'pointer'
  },
  ctrlPlay: {
    width: '44px',
    height: '44px',
    background: '#4f46e5',
    border: 'none',
    borderRadius: '50%',
    color: '#fff'
  },
  ctrlDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed'
  },
  sliderWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 24px 24px'
  },
  slider: {
    flex: 1,
    accentColor: '#4f46e5',
    cursor: 'pointer'
  },
  sliderLabel: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#64748b',
    minWidth: '40px',
    textAlign: 'right'
  },
  right: {
    borderLeft: '1px solid #1e293b',
    background: '#0d1117',
    overflow: 'auto'
  },
  assignTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    padding: '6px 12px',
    textAlign: 'left',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #1e293b',
    background: '#0d1117'
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #0f172a'
  },
  code: {
    fontFamily: 'monospace',
    color: '#a5b4fc'
  },
  boolBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'monospace'
  },
  emptyPanel: {
    padding: '16px 12px',
    color: '#475569',
    fontSize: '12px',
    margin: 0
  },
  descBox: {
    margin: '12px',
    padding: '10px',
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '8px'
  },
  descTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '4px'
  },
  descText: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.5
  }
};
