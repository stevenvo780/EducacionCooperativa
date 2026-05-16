import { describe, it, expect } from 'vitest';
import {
  lintAcademic,
  detectFallacies,
  detectCircularReasoning,
  detectVacuousClaims,
  detectHedging,
  detectContradictions
} from '@/lib/academic-linter';

describe('academic-linter — hedging', () => {
  it('marca un párrafo con >30% de oraciones con lenguaje atenuador', () => {
    const text =
      'Quizás los datos sugieren una correlación. Tal vez la causa sea otra. Es posible que existan errores de medición. Los resultados son robustos.';
    const diags = detectHedging(text, 'es', 0.3);
    expect(diags.length).toBe(1);
    expect(diags[0]?.category).toBe('hedging');
    expect(diags[0]?.severity).toBe('info');
    expect(diags[0]?.message).toMatch(/hedging/i);
  });

  it('no marca un párrafo con hedging por debajo del umbral', () => {
    const text =
      'Los datos muestran una correlación. La causa es la temperatura. Las mediciones son precisas. Quizás haya factores secundarios.';
    const diags = detectHedging(text, 'es', 0.3);
    expect(diags).toEqual([]);
  });

  it('respeta umbrales personalizados', () => {
    const text =
      'Quizás los datos sugieren X. Tal vez sea Y. Posiblemente sea Z. Es evidente. Los datos son sólidos.';
    const lenient = detectHedging(text, 'es', 0.7);
    const strict = detectHedging(text, 'es', 0.3);
    expect(lenient.length).toBe(0);
    expect(strict.length).toBe(1);
  });
});

describe('academic-linter — circular reasoning', () => {
  it('detecta un ciclo A → B → A', () => {
    const diags = detectCircularReasoning([
      { id: 'A', cites: ['B'] },
      { id: 'B', cites: ['A'] }
    ]);
    expect(diags.length).toBe(2);
    expect(diags.every(d => d.category === 'circular')).toBe(true);
    const ids = diags.map(d => d.message);
    expect(ids.some(m => m.includes('A'))).toBe(true);
    expect(ids.some(m => m.includes('B'))).toBe(true);
  });

  it('detecta un ciclo más largo A → B → C → A', () => {
    const diags = detectCircularReasoning([
      { id: 'A', cites: ['B'] },
      { id: 'B', cites: ['C'] },
      { id: 'C', cites: ['A'] }
    ]);
    expect(diags.length).toBe(3);
  });

  it('no marca grafo acíclico', () => {
    const diags = detectCircularReasoning([
      { id: 'A', cites: ['B', 'C'] },
      { id: 'B', cites: ['C'] },
      { id: 'C', cites: [] }
    ]);
    expect(diags).toEqual([]);
  });

  it('maneja graceful citas vacías o undefined', () => {
    expect(detectCircularReasoning(undefined)).toEqual([]);
    expect(detectCircularReasoning([])).toEqual([]);
  });
});

describe('academic-linter — vacuous claims', () => {
  it('marca "es bien sabido que P." sin cita', () => {
    const diags = detectVacuousClaims('Es bien sabido que la entropía siempre crece.', 'es');
    expect(diags.length).toBe(1);
    expect(diags[0]?.category).toBe('vacuous');
  });

  it('no marca cuando hay cita en el mismo párrafo', () => {
    const diags = detectVacuousClaims(
      'Es bien sabido que la entropía siempre crece (Clausius, 1865).',
      'es'
    );
    expect(diags).toEqual([]);
  });

  it('marca "se ha demostrado que..." sin cita', () => {
    const diags = detectVacuousClaims(
      'Se ha demostrado que el modelo converge en condiciones generales.',
      'es'
    );
    expect(diags.length).toBe(1);
  });
});

describe('academic-linter — contradicción literal', () => {
  it('detecta "llueve" y "no llueve" en el mismo texto', () => {
    const text = 'Llueve. El experimento es estable. No llueve.';
    const diags = detectContradictions(text, 'es');
    expect(diags.length).toBe(1);
    expect(diags[0]?.category).toBe('contradiction');
    expect(diags[0]?.severity).toBe('error');
  });

  it('detecta "X es cierto" y "no es cierto que X"', () => {
    const text = 'La hipótesis es cierta. No es cierto que la hipótesis es cierta.';
    const diags = detectContradictions(text, 'es');
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });

  it('no marca oraciones diferentes sin contradicción real', () => {
    const text = 'Llueve hoy. El cielo está nublado. La temperatura baja.';
    const diags = detectContradictions(text, 'es');
    expect(diags).toEqual([]);
  });
});

describe('academic-linter — fallacies', () => {
  it('detecta afirmación del consecuente en español', () => {
    const text =
      'Si llueve entonces la calle se moja. La calle se moja. Por lo tanto llueve.';
    const diags = detectFallacies(text, 'es');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags.some(d => d.category === 'fallacy')).toBe(true);
  });

  it('detecta ad hominem', () => {
    const text = 'El autor es un ignorante y por eso su tesis falla.';
    const diags = detectFallacies(text, 'es');
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });
});

describe('academic-linter — texto limpio', () => {
  it('un texto académico bien escrito devuelve 0 diagnostics', () => {
    const text =
      'El experimento descrito por Smith (2020) muestra una correlación significativa entre la variable X y la variable Y. Replicamos el procedimiento con n=240 sujetos y obtuvimos un coeficiente de Pearson r=0.42 (p<0.01). La interpretación se alinea con el modelo propuesto por López (2019).';
    const diags = lintAcademic(text, { language: 'es' });
    expect(diags).toEqual([]);
  });
});

describe('academic-linter — lintAcademic agrega y ordena', () => {
  it('combina diagnósticos de todas las reglas y ordena por offset', () => {
    const text = [
      'Es bien sabido que la entropía siempre crece.',
      '',
      'Quizás esto sea cierto. Tal vez no. Posiblemente sea irrelevante. Es posible verificarlo.',
      '',
      'Llueve.',
      '',
      'No llueve.'
    ].join('\n');

    const diags = lintAcademic(text, {
      language: 'es',
      hedgingThreshold: 0.3,
      citations: [
        { id: 'X', cites: ['Y'] },
        { id: 'Y', cites: ['X'] }
      ]
    });

    expect(diags.length).toBeGreaterThan(0);
    const categories = new Set(diags.map(d => d.category));
    expect(categories.has('vacuous')).toBe(true);
    expect(categories.has('hedging')).toBe(true);
    expect(categories.has('contradiction')).toBe(true);
    expect(categories.has('circular')).toBe(true);

    for (let i = 1; i < diags.length; i++) {
      const prev = diags[i - 1];
      const curr = diags[i];
      if (!prev || !curr) continue;
      expect(prev.from).toBeLessThanOrEqual(curr.from);
    }
  });
});
