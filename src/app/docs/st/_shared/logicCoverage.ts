export interface LogicCoverageBlock {
  title: string;
  description: string;
  items?: string[];
  code?: string;
  note?: string;
  runnable?: boolean;
}

export interface LogicCoverageEntry {
  summary: string;
  blocks: LogicCoverageBlock[];
}

export const logicCoverageBySlug: Record<string, LogicCoverageEntry> = {
  proposicional: {
    summary:
      'El perfil proposicional es el más amplio del runtime: conecta operadores clásicos y extendidos, 27 esquemas clasificados automáticamente, 25 reglas derivativas nombradas y 10 detectores de falacia realmente implementados.',
    blocks: [
      {
        title: 'Operadores y aliases soportados',
        description:
          'La sintaxis proposicional no se queda en los cinco conectivos clásicos. El parser y el runtime también aceptan operadores funcionalmente completos y sus aliases textuales o Unicode.',
        items: [
          '`!`, `&`, `|`, `->`, `<->`',
          '`^`, `xor`, `⊕` para XOR',
          '`!&`, `nand`, `↑` para NAND',
          '`!|`, `nor`, `↓` para NOR',
          '`formulaToUnicode()` y `formulaToLaTeX()` renderizan todos esos conectivos'
        ]
      },
      {
        title: 'Las 27 leyes que el clasificador reconoce hoy',
        description:
          'Estas son las fórmulas base que el runtime etiqueta por nombre cuando coinciden por unificación estructural.',
        code: `logic classical.propositional
check valid (P -> P)
check valid (P | !P)
check valid !(P & !P)
check valid (P -> (Q -> P))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P -> Q) -> (!Q -> !P))
check valid ((!P -> !Q) -> (Q -> P))
check valid (!!P -> P)
check valid (P -> !!P)
check valid (((P -> Q) -> P) -> P)
check valid (!P -> (P -> Q))
check valid (((P -> Q) & (Q -> R)) -> (P -> R))
check valid ((P | Q) -> (Q | P))
check valid ((P & Q) -> (Q & P))
check valid (!(P & Q) <-> (!P | !Q))
check valid (!(P | Q) <-> (!P & !Q))
check valid ((P & (Q | R)) <-> ((P & Q) | (P & R)))
check valid ((P | (Q & R)) <-> ((P | Q) & (P | R)))
check valid ((P -> Q) <-> (!P | Q))
check valid ((P <-> Q) <-> ((P -> Q) & (Q -> P)))
check valid ((P & (P | Q)) <-> P)
check valid ((P | (P & Q)) <-> P)
check valid ((P & P) <-> P)
check valid ((P | P) <-> P)
check valid (((P & Q) -> R) <-> (P -> (Q -> R)))
check valid ((P <-> Q) <-> (Q <-> P))
check valid (!!P <-> P)`,
        note:
          'Aquí están las 27 fórmulas realmente presentes en `formula-classifier.ts`, no una versión resumida.'
      },
      {
        title: 'Las 25 reglas de derivación activas',
        description:
          'El derivador BFS del perfil clásico nombra estas reglas cuando logra construir la meta o un paso intermedio relevante.',
        items: [
          'Modus Ponens',
          'Modus Tollens',
          'Introducción de conjunción',
          'Eliminación de conjunción',
          'Introducción de disyunción',
          'Silogismo hipotético',
          'Silogismo disyuntivo',
          'Introducción de bicondicional',
          'Eliminación de bicondicional',
          'Dilema constructivo',
          'Dilema destructivo',
          'Dilema simple',
          'Resolución',
          'Explosión',
          'Doble negación',
          'Introducción de doble negación',
          'Introducción de implicación',
          'Contraposición',
          'Absorción',
          'Exportación',
          'Importación',
          'De Morgan (AND)',
          'De Morgan (OR)',
          'Reducción al absurdo (RAA)',
          'Prueba condicional'
        ]
      },
      {
        title: 'Falacias realmente implementadas',
        description:
          'El changelog menciona once, pero el runtime activo registra diez detectores explícitos en `fallacies.ts`. La doc queda alineada con el código real.',
        items: [
          'Afirmación del consecuente',
          'Negación del antecedente',
          'Medio no distribuido',
          'Falacia de composición',
          'Posible falso dilema',
          'Petición de principio',
          'Conversión ilícita',
          'Generalización apresurada',
          'Cuaternio terminorum',
          'Falacia de división'
        ],
        code: `logic classical.propositional
analyze {P -> Q, Q} -> P
analyze {P -> Q, !P} -> !Q
analyze {P -> P} -> (P -> P)`,
        note:
          'La “falacia del consecuente” del changelog queda absorbida por la afirmación del consecuente en la implementación actual.'
      }
    ]
  },
  'primer-orden': {
    summary:
      'FOL cubre cuantificadores, dualidades, prenex, skolemización, pasos UI/EI/UG/EG, dominio e interpretación en contramodelos. La sintaxis de igualdad existe, pero su semántica todavía no está cerrada pedagógicamente en el runtime actual.',
    blocks: [
      {
        title: 'Sintaxis realmente soportada',
        description:
          'Además de cuantificadores y predicados, el parser acepta igualdad y conectivos clásicos completos.',
        items: [
          '`forall x`, `exists x`',
          'Predicados de aridad variable como `P(x)`, `R(x, y)`',
          'Conectivos `!`, `&`, `|`, `->`, `<->` dentro de fórmulas cuantificadas',
          'Sintaxis de igualdad `x = y` y render formal de `=`',
          'La igualdad se parsea y se formatea, pero hoy no tiene un tratamiento semántico fiable en `check valid`'
        ]
      },
      {
        title: 'Familias de fórmulas cubiertas',
        description:
          'Estos son los patrones que el perfil trabaja bien hoy: instanciación, generalización, dualidad cuantificacional y contramodelos de orden superior sencillo.',
        code: `logic classical.first_order
check valid ((forall x P(x)) -> P(a))
check valid (P(a) -> exists x P(x))
check valid ((forall x (P(x) -> Q(x))) -> ((forall x P(x)) -> (forall x Q(x))))
check valid ((forall x (P(x) -> Q(x))) -> ((exists x P(x)) -> (exists x Q(x))))
check equivalent !(exists x !P(x)), forall x P(x)
check equivalent !(forall x P(x)), exists x !P(x)
check satisfiable (forall x exists y R(x, y))
explain forall x exists y Relacion(x, y)
countermodel ((exists x P(x)) -> forall x P(x))
countermodel ((forall x exists y R(x, y)) -> (exists y forall x R(x, y)))`
      },
      {
        title: 'Igualdad y estado real del motor',
        description:
          'La igualdad está en el AST y en el render, pero no debe documentarse como teorema semánticamente resuelto.',
        code: `logic classical.first_order
let igualdad = (x = y)
print igualdad
explain forall x (x = x)`,
        note:
          'La documentación ahora la presenta como soporte sintáctico con semántica parcial, porque `check valid forall x (x = x)` no sale válida en el runtime actual.'
      }
    ]
  },
  'modal-k': {
    summary:
      'Modal K cubre necesidad, posibilidad, dualidad, cuadros Kripke y reconocimiento de esquemas K/T/D/4/5/B cuando la fórmula coincide o falla por propiedades del frame.',
    blocks: [
      {
        title: 'Operadores y propiedades del frame',
        description:
          'K trabaja con la relación de accesibilidad sin restricciones y usa esa falta de restricciones como contenido pedagógico explícito.',
        items: [
          '`[]` / `□` para necesidad',
          '`<>` / `◇` para posibilidad',
          'Dualidades `[]P ≡ !<>!P` y `<>P ≡ ![]!P`',
          'El sistema explica por qué no valen reflexividad, serialidad, transitividad, simetría ni euclidianidad'
        ]
      },
      {
        title: 'Axiomas y contraejemplos reales de K',
        description:
          'Esta batería deja ver lo que el sistema sí y no valida con el frame mínimo.',
        code: `logic modal.k
set verbose = on
check valid ([](P -> Q) -> ([]P -> []Q))
check valid []P -> P
check valid []P -> <>P
check valid []P -> [][]P
check valid P -> []<>P
check valid <>P -> []<>P
check equivalent []P, !<>!P
check equivalent <>P, ![]!P
countermodel ([]P -> P)
countermodel (<>P -> []<>P)`
      }
    ]
  },
  deontica: {
    summary:
      'La deóntica estándar documenta obligación, permiso y prohibición sobre KD serial, y además reconoce patrones paradójicos como Ross, Chisholm y el Buen Samaritano.',
    blocks: [
      {
        title: 'Operadores normativos y axiomas',
        description:
          'El perfil usa la sintaxis modal como notación base de O/P/F y deja visible la serialidad del frame.',
        items: [
          '`[](P)` como obligación `O(P)`',
          '`<>(P)` como permiso `P(P)`',
          '`[](!P)` como prohibición `F(P)`',
          'Axioma K: `O(P -> Q) -> (O(P) -> O(Q))`',
          'Axioma D: `O(P) -> P(P)`'
        ]
      },
      {
        title: 'Paradojas y fórmulas normativas reconocidas',
        description:
          'La cobertura nueva no es solo veredictos, sino patrones filosóficos detectables por nombre.',
        code: `logic deontic.standard
set verbose = on
check valid ([](P) -> <>(P))
check valid ([](P -> Q) -> ([](P) -> [](Q)))
check valid ([](!P) -> !<>(P))
check valid ([]P -> [](P | Q))
explain ([]P -> [](P | Q))
explain ([]P & [](P -> Q) & (!P -> []!Q) & !P)
explain (P -> []<>P)
countermodel ([](P) -> P)
countermodel (<>(P) -> P)`,
        note:
          'Ross y Chisholm son soportes reales del motor; el Buen Samaritano se reconoce por aproximación de patrón.'
      }
    ]
  },
  epistemica: {
    summary:
      'S5 cubre K/T/4/5/B, dualidades K/B, colapso de modalidades iteradas, Kripke de equivalencia y paradojas epistémicas como Moore y la omnisciencia lógica.',
    blocks: [
      {
        title: 'Cobertura axiomática y colapsos',
        description:
          'El runtime documenta el marco S5 como equivalencia y explota ese hecho para simplificar fórmulas iteradas.',
        code: `logic epistemic.s5
set verbose = on
check valid ([](P -> Q) -> ([]P -> []Q))
check valid ([]P -> P)
check valid ([]P -> []([]P))
check valid (![]P -> [](![]P))
check valid (P -> []<>P)
check equivalent []P, !<>!P
check equivalent <>P, ![]!P`
      },
      {
        title: 'Paradojas y modelos abiertos',
        description:
          'El perfil no se limita al cuadro axiomático: también ilustra fenómenos epistémicos no triviales.',
        code: `logic epistemic.s5
set verbose = on
check satisfiable (P & ![]P)
check satisfiable ([]P & ![]Q)
check satisfiable (<>P & <>!P)
explain (![]P -> [](![]P))
explain (P & ![]P)
countermodel (<>P -> P)
countermodel ([]P -> []Q)`,
        note:
          'Aquí quedan referenciados Moore, la introspección negativa y el comportamiento de modelos donde `P` es verdad sin ser sabido.'
      }
    ]
  },
  intuicionista: {
    summary:
      'IPC mantiene forcing Kripke, lectura BHK y contraste con clásica. También acepta los conectivos extendidos del parser, siempre bajo semántica intuicionista.',
    blocks: [
      {
        title: 'Conectivos y lectura constructiva',
        description:
          'La sintaxis soportada incluye los conectivos clásicos y extendidos, pero la validez se decide con forcing intuicionista.',
        items: [
          '`!`, `&`, `|`, `->`, `<->`',
          '`^`, `xor`, `⊕`',
          '`!&`, `nand`, `↑`',
          '`!|`, `nor`, `↓`',
          'La salida explica BHK, persistencia y diferencia entre no demostrable y falso'
        ]
      },
      {
        title: 'Fórmulas que distinguen IPC de CPC',
        description:
          'Este bloque referencia de forma explícita las leyes válidas y las caídas clásicas más importantes.',
        code: `logic intuitionistic.propositional
check valid (P -> P)
check valid (P -> (Q -> P))
check valid ((P -> (Q -> R)) -> ((P -> Q) -> (P -> R)))
check valid ((P -> Q) -> (!Q -> !P))
check valid ((P & !P) -> Q)
check valid (P -> !!P)
check valid !(P | Q) -> (!P & !Q)
check valid (P | !P)
check valid (!!P -> P)
check valid (((P -> Q) -> P) -> P)
check equivalent (P !& Q), !(P & Q)
check equivalent (P !| Q), !(P | Q)
countermodel (P | !P)
countermodel (!!P -> P)`,
        note:
          'Las tres últimas fórmulas muestran el límite constructivo real: LEM, DNE y Peirce no salen válidas aquí.'
      }
    ]
  },
  temporal: {
    summary:
      'LTL cubre G/F, next, until, dualidades, frame tipo S4 y seis patrones temporales nombrados por el runtime.',
    blocks: [
      {
        title: 'Operadores y aliases temporales',
        description:
          'El parser acepta las formas textuales y luego las renderiza como `G`, `F`, `X` y `U`.',
        items: [
          '`[](P)` / `G(P)` para siempre',
          '`<>(P)` / `F(P)` para eventualmente',
          '`next P` / `X(P)` para siguiente estado',
          '`P until Q` / `P U Q` para hasta que',
          'Dualidades `F(P) ≡ !G(!P)` y `G(P) ≡ !F(!P)`'
        ]
      },
      {
        title: 'Fórmulas base del perfil temporal',
        description:
          'Estas líneas cubren los axiomas y contraejemplos temporales más importantes del motor.',
        code: `logic temporal.ltl
set verbose = on
check valid ([]P -> P)
check valid ([]P -> <>P)
check valid ([]P -> []([]P))
check valid ([](P -> Q) -> ([]P -> [](Q)))
check valid ([]P -> next P)
check valid (<>P -> []P)
check equivalent <>(P), ![](!P)
check equivalent [](P), !<>(!P)
check satisfiable (next P)
check satisfiable (P until Q)
countermodel (<>P -> []P)
countermodel (next P -> P)`
      },
      {
        title: 'Los seis patrones temporales reconocidos',
        description:
          'La clasificación temporal no debe quedar implícita; aquí están las seis familias que hoy detecta `classifyTemporalPattern()`.',
        code: `logic temporal.ltl
explain [](!P)
explain <>(P)
explain [](P -> <>Q)
explain <>[](P)
explain []<>(P)
explain (!P until Q)`,
        note:
          'Eso cubre Safety, Liveness, Response, Persistence, Recurrence y Precedence.'
      }
    ]
  },
  aritmetica: {
    summary:
      'Arithmetic ya no es un extra mínimo: soporta enteros, decimales, menos unario, cinco operadores numéricos, seis comparadores textuales o Unicode, simplificación, warnings y scripting completo.',
    blocks: [
      {
        title: 'Operadores numéricos, comparadores y formato',
        description:
          'La cobertura real del perfil aritmético es más amplia de lo que mostraban los ejemplos viejos.',
        items: [
          'Literales enteros y decimales',
          'Menos unario como `-5` y `-(3 + 2)`',
          '`+`, `-`, `*`, `/`, `%`',
          '`<`, `>`, `<=`, `>=`, `≤`, `≥`',
          'Render Unicode con `×`, `÷`, `≤`, `≥` y LaTeX con `\\times`, `\\frac`, `\\leq`',
          'Warnings por división o módulo por cero literal'
        ]
      },
      {
        title: 'Cobertura operativa completa del perfil',
        description:
          'Este bloque referencia todos los operadores y varias combinaciones mixtas con lógica.',
        code: `logic arithmetic
check valid 3 < 5
check valid 5 > 3
check valid 1 <= 2
check valid 5 >= 5
check valid 3 ≤ 5
check valid 5 ≥ 3
check satisfiable 2 + 2 > 3
explain 2 + 3
explain 10 - 4
explain 3 * 5
explain 10 / 2
explain 10 % 3
explain 2 + 3 * 4
explain -(3 + 2)
let X = 2 + 3
print X
set X = 2 * 5
print X
axiom mezcla = (1 < 2) & (3 > 1)
print mezcla
countermodel 5 < 3`
      }
    ]
  },
  aristotelica: {
    summary:
      'La silogística actual expone proposiciones A/E/I/O, cuadro de oposición, distribución, inferencias inmediatas, detección de entimemas y 19 modos válidos efectivamente codificados en el perfil. La doc anterior que hablaba de 24 estaba inflando soporte.',
    blocks: [
      {
        title: 'Las 19 formas válidas realmente implementadas',
        description:
          'Esta lista sale del arreglo `VALID_SYLLOGISMS` del perfil. Queda referenciada completa, sin suponer 24 donde el motor hoy codifica 19.',
        code: `logic aristotelian.syllogistic
check valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (M(x) -> P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> !P(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (S(x) -> !M(x))) -> (forall x (S(x) -> !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (exists x (S(x) & M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> M(x))) & (exists x (S(x) & !M(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (M(x) -> P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((exists x (M(x) & P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> P(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (M(x) -> !P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((exists x (M(x) & !P(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (M(x) -> !P(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (P(x) -> M(x))) & (forall x (M(x) -> !S(x))) -> (forall x (S(x) -> !P(x))))
check valid ((exists x (P(x) & M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & P(x))))
check valid ((forall x (P(x) -> !M(x))) & (forall x (M(x) -> S(x))) -> (exists x (S(x) & !P(x))))
check valid ((forall x (P(x) -> !M(x))) & (exists x (M(x) & S(x))) -> (exists x (S(x) & !P(x))))`,
        note:
          'Eso cubre Barbara, Celarent, Darii, Ferio, Cesare, Camestres, Festino, Baroco, Darapti, Disamis, Datisi, Felapton, Bocardo, Ferison, Bramantip, Camenes, Dimaris, Fesapo y Fresison.'
      },
      {
        title: 'Cuadro de oposición, inferencias inmediatas y entimemas',
        description:
          'Además de modos completos, el perfil explica relaciones A/E/I/O y puede sugerir premisa faltante cuando recibe una sola premisa.',
        items: [
          'Relaciones contradictorias A-O y E-I',
          'Contrarias A-E y subcontrarias I-O',
          'Subalternación A-I y E-O',
          'Conversión, obversión y contraposición según el tipo A/E/I/O',
          'Detección de entimemas con sugerencia de premisa faltante'
        ],
        code: `logic aristotelian.syllogistic
axiom mayor = forall x (M(x) -> P(x))
derive forall x (S(x) -> P(x)) from {mayor}
analyze {forall x (P(x) -> M(x)), forall x (S(x) -> M(x))} -> forall x (S(x) -> P(x))
explain forall x (M(x) -> P(x))
explain exists x (S(x) & !P(x))`
      }
    ]
  },
  belnap: {
    summary:
      'Belnap cubre los cuatro valores T/F/B/N, designación T/B, retículo A4, comparación con clásica y un conjunto concreto de leyes que sobreviven o caen.',
    blocks: [
      {
        title: 'Semántica y designación reales',
        description:
          'La documentación ahora referencia explícitamente qué significa cada valor y por qué no hay explosión.',
        items: [
          '`T`: solo verdadero',
          '`F`: solo falso',
          '`B`: both, verdadero y falso a la vez',
          '`N`: none, ni verdadero ni falso',
          'Valores designados: `T` y `B`'
        ]
      },
      {
        title: 'Leyes que fallan y leyes que sobreviven',
        description:
          'El propio `explain()` del perfil enumera estas diferencias; aquí quedan documentadas y ejecutables.',
        code: `logic paraconsistent.belnap
set verbose = on
check satisfiable (P & !P)
check valid ((P & !P) -> Q)
check valid (P | !P)
check valid (P -> P)
check valid ((P & Q) -> P)
check equivalent (P -> Q), (!P | Q)
check equivalent !(P & Q), (!P | !Q)
check equivalent !(P | Q), (!P & !Q)
check equivalent !!P, P
explain (P & !P)
explain (P -> P)
countermodel (P | !P)
countermodel ((P & !P) -> Q)`,
        note:
          'Con eso se cubren explícitamente explosión, LEM, identidad, De Morgan y doble negación en Belnap.'
      }
    ]
  },
  probabilistica: {
    summary:
      'El perfil probabilístico trabaja con independencia, complemento, inclusión-exclusión, condicional material, bicondicional, K1/K2/K3, Bayes, sensibilidad y tablas con subfórmulas.',
    blocks: [
      {
        title: 'Reglas y conectivos cubiertos',
        description:
          'Aunque el foco pedagógico está en `!`, `&`, `|`, `->` y `<->`, la evaluación booleana base también entiende `nand`, `nor` y `xor`.',
        items: [
          '`P(!A) = 1 - P(A)`',
          '`P(A & B) = P(A) * P(B)` bajo independencia',
          '`P(A | B) = P(A) + P(B) - P(A & B)`',
          '`P(A -> B) = P(!A | B)`',
          '`P(A <-> B) = P(A -> B) * P(B -> A)`'
        ]
      },
      {
        title: 'Cobertura operativa del perfil probabilístico',
        description:
          'Este bloque referencia validez, satisfacibilidad, equivalencia, explicación paso a paso y tablas con subfórmulas.',
        code: `logic probabilistic.basic
set verbose = on
check valid (P | !P)
check valid (P -> P)
check valid ((P & !P) -> Q)
check valid P
check equivalent (P -> Q), (!P | Q)
check equivalent !(P & Q), (!P | !Q)
check equivalent (P <-> Q), ((P -> Q) & (Q -> P))
check satisfiable P
check satisfiable (P & Q)
check satisfiable !(P & Q)
explain !P
explain (P | Q)
explain (P & Q)
explain (P -> Q)
truth_table (P -> Q)
truth_table (P & !P)
truth_table (P | !P)
countermodel P
countermodel (P & Q)`,
        note:
          'Aquí quedan referenciadas las reglas de complemento, inclusión-exclusión, independencia, condicional material, Kolmogorov y Bayes.'
      }
    ]
  }
};
