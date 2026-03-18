export interface LogicOperator {
  symbol: string;
  name: string;
  meaning: string;
  stExample: string;
}

export interface LogicBlock {
  title: string;
  body: string;
}

export interface LogicCommandExample {
  title: string;
  description: string;
  code: string;
}

export interface LogicCoursePageData {
  slug: string;
  navLabel: string;
  title: string;
  subtitle: string;
  profile: string;
  badge: string;
  level: string;
  intro: string;
  whyItMatters: string;
  learningGoals: string[];
  concepts: LogicBlock[];
  operators: LogicOperator[];
  commands: LogicCommandExample[];
  workedExamples: LogicCommandExample[];
  mistakes: string[];
  limits: string[];
  bridges: string[];
  downloads: {
    basic: string;
    complete: string;
  };
}

export const logicCourses: LogicCoursePageData[] = [
  {
    slug: 'proposicional',
    navLabel: 'Proposicional',
    title: 'Curso completo de Lógica Proposicional',
    subtitle: 'La base de toda la academia ST: fórmulas, tablas de verdad, inferencia y lectura formal del razonamiento.',
    profile: 'classical.propositional',
    badge: 'CPC',
    level: 'Fundacional',
    intro: 'La lógica proposicional clásica es el punto de partida para comprender todo ST. Aquí aprendemos a tratar enunciados completos como unidades de verdad, a combinarlos con conectivos y a verificar si un razonamiento es válido, satisfacible o equivalente.',
    whyItMatters: 'Sin dominar la proposicional, el resto de lógicas se vuelve opaco. La modal reutiliza la implicación y la negación. La deóntica y la epistémica heredan la lectura estructural de las fórmulas. La intuicionista discute precisamente qué partes de la clásica se mantienen y cuáles no.',
    learningGoals: [
      'Reconocer qué es y qué no es una proposición dentro de ST.',
      'Dominar el significado exacto de !, &, |, -> y <->.',
      'Distinguir entre validez, satisfacibilidad, contradicción y contingencia.',
      'Usar derive, truth_table, check valid, check satisfiable, check equivalent y countermodel con soltura.',
      'Introducir aliases con let para volver más legible una teoría ejecutable.',
      'Usar analyze y explain para convertir ejercicios lógicos en clases paso a paso.',
      'Leer y construir demostraciones basadas en Modus Ponens, Modus Tollens y reglas estructurales.',
      'Entender las equivalencias fundamentales que permiten reescribir fórmulas sin cambiar su valor lógico.'
    ],
    concepts: [
      {
        title: '1. Proposición, átomo y fórmula',
        body: 'Una proposición es un enunciado declarativo que puede ser verdadero o falso. En ST esto se representa con átomos como P, Q, R o nombres más expresivos como Humo, Fuego o Aprueba. Una fórmula es cualquier expresión construida a partir de esos átomos usando conectivos. Ejemplos: P, !P, P & Q, (P -> Q) & P.'
      },
      {
        title: '2. Bivalencia clásica',
        body: 'El perfil classical.propositional solo admite dos valores: verdadero y falso. No hay un tercer estado. El motor explora todas las valuaciones posibles de los átomos para decidir si una fórmula siempre vale, a veces vale o nunca vale. Por eso las tablas de verdad son la semántica central de este curso.'
      },
      {
        title: '3. Validez, satisfacibilidad y contingencia',
        body: 'Una fórmula es válida si es verdadera en toda valuación. Es satisfacible si existe al menos una valuación donde sale verdadera. Es contradictoria si no hay ninguna valuación que la haga verdadera. Es contingente si es satisfacible pero no válida. Esta distinción es clave porque muchos estudiantes confunden “posible” con “siempre verdadero”.'
      },
      {
        title: '4. Forma lógica frente a contenido',
        body: 'En ST no importa si P significa “llueve” o “2+2=4”; importa cómo se relaciona con otras fórmulas. La lógica proposicional abstrae el contenido material y se concentra en la arquitectura del razonamiento: si P y P -> Q, entonces Q. Esa estructura permanece sin importar el tema.'
      },
      {
        title: '5. Semántica del motor de ST',
        body: 'El motor proposicional de ST combina una tabla de verdad exhaustiva con un derivador BFS. Primero puede intentar probar metas mediante reglas sintácticas; si no logra cerrar la derivación, puede comprobar semánticamente si toda valuación que satisface las premisas también satisface la meta. Así se enseña a la vez prueba e interpretación.'
      },
      {
        title: '6. Reescritura lógica',
        body: 'Dos fórmulas pueden verse distintas y significar exactamente lo mismo. Por ejemplo, P -> Q equivale a !P | Q. Esta idea permite normalizar expresiones, encontrar versiones más intuitivas y detectar si dos razonamientos son realmente el mismo bajo otra forma.'
      }
    ],
    operators: [
      {
        symbol: '!P',
        name: 'Negación',
        meaning: 'Invierte el valor de verdad. Si P es verdadera, !P es falsa; si P es falsa, !P es verdadera.',
        stExample: 'check valid !(P & !P)\ncheck equivalent !!P, P\ntruth_table !P'
      },
      {
        symbol: 'P & Q',
        name: 'Conjunción',
        meaning: 'Es verdadera solo cuando ambas partes son verdaderas. Modela el “y” inclusivo.',
        stExample: 'check satisfiable P & Q\ncheck satisfiable P & !P\ntruth_table P & Q'
      },
      {
        symbol: 'P | Q',
        name: 'Disyunción',
        meaning: 'Es verdadera cuando al menos una parte es verdadera. Solo falla si ambas son falsas.',
        stExample: 'check valid P | !P\nderive P | Q from {base}\ntruth_table P | Q'
      },
      {
        symbol: 'P -> Q',
        name: 'Implicación material',
        meaning: 'Solo es falsa cuando P es verdadera y Q es falsa. En todos los demás casos es verdadera.',
        stExample: 'check equivalent P -> Q, !P | Q\ncheck valid P -> Q\ncountermodel P -> Q'
      },
      {
        symbol: 'P <-> Q',
        name: 'Bicondicional',
        meaning: 'Es verdadera cuando ambos lados tienen el mismo valor de verdad. Equivale a (P -> Q) & (Q -> P).',
        stExample: 'check equivalent P <-> Q, (P -> Q) & (Q -> P)\ncheck valid P <-> P\ntruth_table P <-> Q'
      }
    ],
    commands: [
      {
        title: 'Validez',
        description: 'Usa check valid para preguntar si una fórmula es tautológica.',
        code: 'logic classical.propositional\ncheck valid P | !P\ncheck valid (P & (P -> Q)) -> Q'
      },
      {
        title: 'Satisfacibilidad',
        description: 'Usa check satisfiable para saber si existe al menos una valuación donde la fórmula sale verdadera.',
        code: 'logic classical.propositional\ncheck satisfiable P & Q\ncheck satisfiable P & !P'
      },
      {
        title: 'Equivalencia',
        description: 'Usa check equivalent para confirmar que dos formas distintas expresan la misma condición lógica.',
        code: 'logic classical.propositional\ncheck equivalent P -> Q, !P | Q\ncheck equivalent !(P & Q), !P | !Q'
      },
      {
        title: 'Derivación',
        description: 'Usa derive para obtener una conclusión a partir de premisas registradas como axiomas.',
        code: 'logic classical.propositional\naxiom regla : P -> Q\naxiom base = P\nderive Q from {regla, base}'
      },
      {
        title: 'Tabla de verdad',
        description: 'Usa truth_table para ver el comportamiento exacto de una fórmula en todas las valuaciones.',
        code: 'logic classical.propositional\ntruth_table P -> Q\ntruth_table (P & (P -> Q)) -> Q'
      },
      {
        title: 'Contramodelo',
        description: 'Usa countermodel cuando una fórmula no es válida y quieres ver por qué falla.',
        code: 'logic classical.propositional\ncountermodel P -> Q\ncountermodel P <-> Q'
      },
      {
        title: 'Variables lógicas con let',
        description: 'Usa let para nombrar reglas, hechos y descripciones, y luego reutilizarlos en derivaciones y verificaciones.',
        code: 'logic classical.propositional\nlet regla = "Si estudio, apruebo" : (E -> A)\nlet hecho = "Estudio hoy" : E\nderive A from {regla, hecho}\nprint regla'
      },
      {
        title: 'Analizar y explicar inferencias',
        description: 'Usa analyze para evaluar una inferencia completa y explain para desplegar lectura pedagógica de una fórmula.',
        code: 'logic classical.propositional\nanalyze {E, E -> A} -> A\nexplain (E -> A)'
      }
    ],
    workedExamples: [
      {
        title: 'Ejemplo 1 · Razonamiento encadenado',
        description: 'Encadena dos implicaciones con un hecho inicial. Es la mejor puerta de entrada para entender Modus Ponens aplicado varias veces.',
        code: 'logic classical.propositional\naxiom r1 : Estudia -> Aprueba\naxiom r2 : Aprueba -> Celebra\naxiom hecho = Estudia\nderive Aprueba from {r1, hecho}\nderive Celebra from {r1, r2, hecho}'
      },
      {
        title: 'Ejemplo 2 · Tautología y contingencia',
        description: 'Contrasta una verdad lógica universal con una fórmula que solo vale a veces.',
        code: 'logic classical.propositional\ncheck valid P | !P\ncheck valid P -> Q\ncheck satisfiable P -> Q\ncountermodel P -> Q'
      },
      {
        title: 'Ejemplo 3 · Equivalencias fundamentales',
        description: 'Practica tres equivalencias que aparecen una y otra vez en lógica, programación y especificación.',
        code: 'logic classical.propositional\ncheck equivalent P -> Q, !P | Q\ncheck equivalent !(P & Q), !P | !Q\ncheck equivalent P <-> Q, (P -> Q) & (Q -> P)'
      },
      {
        title: 'Ejemplo 4 · Reglas que implementa el motor',
        description: 'Este bloque toca varias reglas del derivador de ST: introducción y eliminación de conjunción, doble negación y bicondicional.',
        code: 'logic classical.propositional\naxiom both : P & Q\nderive P from {both}\nderive Q from {both}\n\naxiom dbl : !!R\nderive R from {dbl}\n\naxiom iff : P <-> Q\naxiom have = P\nderive Q from {iff, have}'
      },
      {
        title: 'Ejemplo 5 · Mini teoría completa',
        description: 'Un guion más largo que combina teoría, validez, equivalencia, tabla de verdad y contramodelo en un mismo flujo.',
        code: 'logic classical.propositional\naxiom regla1 : Humo -> Fuego\naxiom regla2 : Fuego -> Evacuar\naxiom hecho = Humo\n\nderive Fuego from {regla1, hecho}\nderive Evacuar from {regla1, regla2, hecho}\n\ncheck valid (Humo & (Humo -> Fuego) & (Fuego -> Evacuar)) -> Evacuar\ncheck equivalent Humo -> Fuego, !Humo | Fuego\ntruth_table (Humo & (Humo -> Fuego)) -> Fuego\ncountermodel Humo -> Evacuar'
      },
      {
        title: 'Ejemplo 6 · Clase guiada con ST moderno',
        description: 'Combina aliases, análisis, explicación y control condicional ligero para convertir una inferencia en material pedagógico ejecutable.',
        code: 'logic classical.propositional\n\nlet regla = "Si estudio, apruebo" : (E -> A)\nlet hecho = "Estudio hoy" : E\n\nderive A from {regla, hecho}\nanalyze {E, E -> A} -> A\nexplain (E -> A)\n\nif valid (P | !P) {\n  print "tautología detectada"\n} else {\n  print "esto no debería ocurrir"\n}'
      }
    ],
    mistakes: [
      'Creer que P -> Q significa relación causal fuerte. En clásica es un conectivo veritativo, no una teoría de causa.',
      'Confundir “satisfacible” con “válida”. Una contingencia puede ser satisfacible y sin embargo fallar en muchas valuaciones.',
      'Olvidar que la única fila falsa de P -> Q es P=V y Q=F.',
      'Pensar que countermodel muestra un error del motor, cuando en realidad muestra exactamente por qué la fórmula no es tautológica.',
      'No distinguir entre tener una equivalencia semántica y tener una derivación explícita en una teoría dada.',
      'Suponer que una contradicción nunca puede aparecer en premisas; en clásica puede aparecer, pero trivializa si se combina con principios fuertes como explosión.'
    ],
    limits: [
      'truth_table admite hasta 20 variables proposicionales.',
      'El derivador BFS usa un límite de 200 iteraciones.',
      'La semántica es completamente clásica: no hay tercer valor, ni inconsistencia tolerada, ni persistencia intuicionista.',
      'Si quieres cuantificadores, necesitas pasar a classical.first_order.'
    ],
    bridges: [
      'Desde aquí pasas a Primer Orden para introducir individuos y cuantificadores.',
      'También pasas a Modal K para conservar conectivos clásicos y sumar mundos posibles.',
      'La Intuicionista te enseña qué principios clásicos dejan de estar disponibles.',
      'Belnap muestra qué pasa cuando abandonas la bivalencia.',
      'La Probabilística reusa la clásica dentro de mundos, pero mide grados de probabilidad.'
    ],
    downloads: {
      basic: '/downloads/st/01-clasica-proposicional.st',
      complete: '/downloads/st/12-clasica-completa.st'
    }
  },
  {
    slug: 'primer-orden',
    navLabel: 'Primer Orden',
    title: 'Curso completo de Lógica de Primer Orden',
    subtitle: 'Individuos, predicados, cuantificadores y razonamiento estructurado sobre dominios.',
    profile: 'classical.first_order',
    badge: 'FOL',
    level: 'Intermedio',
    intro: 'La lógica de primer orden extiende la proposicional para hablar de objetos, propiedades y relaciones. Aquí ya no dices solo P o Q, sino Humano(socrates), Ama(ana, musica) o forall x (Humano(x) -> Mortal(x)).',
    whyItMatters: 'Con FOL puedes formalizar conocimiento real: bases de datos, ontologías, reglas generales y excepciones parciales. Es la lógica natural para pasar de “algo ocurre” a “todos los individuos de cierto tipo cumplen cierta propiedad”.',
    learningGoals: ['Leer correctamente forall y exists.', 'Distinguir predicados, constantes y variables.', 'Practicar derivaciones por instanciación de universales.', 'Evitar confundir existencia con universalidad.', 'Comprender el límite semidecidible del motor.'],
    concepts: [
      { title: '1. Dominio e individuos', body: 'Toda fórmula FOL se interpreta sobre un dominio de objetos. Los nombres como ana, socrates o c son constantes; las letras x, y, z suelen ser variables.' },
      { title: '2. Predicados y relaciones', body: 'P(x) expresa una propiedad de x; R(x,y) expresa una relación entre x e y. Esta diferencia es esencial para modelar conocimiento no reducible a una sola variable.' },
      { title: '3. Cuantificadores', body: 'forall x φ dice que φ vale para todo objeto. exists x φ dice que φ vale para al menos uno. Ambos cambian profundamente el alcance de la fórmula y exigen mucha atención a los paréntesis.' },
      { title: '4. Tableau FOL', body: 'El motor usa un tableau analítico con instanciaciones y constantes de Skolem. Eso le da potencia, pero también explica por qué algunas búsquedas pueden cerrarse con unknown si el espacio crece.' }
    ],
    operators: [
      { symbol: 'forall x φ', name: 'Universal', meaning: 'Afirma que φ se cumple para todo individuo del dominio.', stExample: 'check valid forall x (P(x) -> P(x))' },
      { symbol: 'exists x φ', name: 'Existencial', meaning: 'Afirma que al menos un individuo cumple φ.', stExample: 'check satisfiable exists x (P(x) & Q(x))' },
      { symbol: 'P(x)', name: 'Predicado', meaning: 'Describe una propiedad o condición del individuo x.', stExample: 'axiom caso = Estudiante(ana)' },
      { symbol: 'R(x,y)', name: 'Relación', meaning: 'Describe una relación entre dos individuos.', stExample: 'check satisfiable Ama(ana, musica)' }
    ],
    commands: [
      { title: 'Universal a caso concreto', description: 'Registra una regla universal y un hecho para derivar una consecuencia individual.', code: 'logic classical.first_order\naxiom regla : forall x (Estudiante(x) -> Lee(x))\naxiom caso = Estudiante(ana)\nderive Lee(ana) from {regla, caso}' },
      { title: 'Validez elemental', description: 'Comprueba principios básicos del cuantificador universal.', code: 'logic classical.first_order\ncheck valid forall x (P(x) -> P(x))\ncheck valid (forall x P(x)) -> P(a)' },
      { title: 'Existencia', description: 'Explora el paso entre casos particulares y existencia.', code: 'logic classical.first_order\ncheck valid P(a) -> exists x P(x)\ncountermodel exists x P(x) -> forall x P(x)' }
    ],
    workedExamples: [
      { title: 'Todos los humanos son mortales', description: 'La derivación canónica de la tradición lógica.', code: 'logic classical.first_order\naxiom regla : forall x (Humano(x) -> Mortal(x))\naxiom caso = Humano(socrates)\nderive Mortal(socrates) from {regla, caso}' },
      { title: 'Propiedad universal no invertible', description: 'Muestra que de “existe alguien con P” no se sigue “todos tienen P”.', code: 'logic classical.first_order\ncountermodel exists x P(x) -> forall x P(x)' },
      { title: 'Compatibilidad con conjunciones', description: 'Combina cuantificación y conectivos clásicos.', code: 'logic classical.first_order\ncheck satisfiable exists x (Estudiante(x) & Lee(x))\ncheck valid forall x ((P(x) -> Q(x)) -> (P(x) -> Q(x)))' }
    ],
    mistakes: ['Olvidar el alcance del cuantificador.', 'Leer exists x P(x) como si hablara de un individuo específico ya nombrado.', 'Usar derive con fórmulas no registradas en axioms o theorems.', 'Suponer que todo problema FOL tendrá decisión rápida.'],
    limits: ['El tableau FOL del motor usa profundidad máxima 50.', 'Puede devolver unknown en fórmulas complejas.', 'No es un sistema completo para toda la práctica matemática avanzada; está orientado a docencia y experimentación guiada.'],
    bridges: ['Viene después de proposicional.', 'Prepara muy bien el paso a silogística aristotélica y a modelados normativos con entidades.', 'También ayuda a leer mejor fórmulas de Text Layer cuando formalizas documentos.'],
    downloads: {
      basic: '/downloads/st/02-primer-orden.st',
      complete: '/downloads/st/13-fol-completa.st'
    }
  },
  {
    slug: 'modal-k',
    navLabel: 'Modal K',
    title: 'Curso completo de Lógica Modal K',
    subtitle: 'Necesidad, posibilidad y mundos accesibles en el sistema modal mínimo.',
    profile: 'modal.k',
    badge: 'K',
    level: 'Intermedio',
    intro: 'Modal K es la entrada al razonamiento sobre necesidad y posibilidad. Conserva los conectivos clásicos, pero añade una capa semántica nueva: los mundos posibles y la relación de accesibilidad entre ellos.',
    whyItMatters: 'Muchísimas lógicas especializadas —deóntica, epistémica, temporal— nacen de ideas modales. Si entiendes bien K, entiendes el lenguaje estructural del resto de familias.',
    learningGoals: ['Entender □ y ◇.', 'Distinguir verdad actual de verdad necesaria.', 'Comprender por qué K no fuerza reflexividad.', 'Leer contramodelos en términos de mundos.'],
    concepts: [
      { title: '1. Mundo actual y mundos posibles', body: 'Una fórmula modal no depende solo del estado actual; depende de qué mundos están accesibles desde él.' },
      { title: '2. Necesidad y posibilidad', body: '[]P significa que P vale en todos los mundos accesibles. <>P significa que P vale en al menos uno.' },
      { title: '3. K como sistema mínimo', body: 'K valida la distribución de la necesidad sobre la implicación, pero no asume que todo mundo se accede a sí mismo.' },
      { title: '4. Tableaux etiquetados', body: 'ST usa labeled tableau: razona sobre fórmulas y sobre el mundo donde deben cumplirse.' }
    ],
    operators: [
      { symbol: '[]P', name: 'Necesidad', meaning: 'P vale en todos los mundos accesibles.', stExample: 'check valid [](P -> Q) -> ([]P -> []Q)' },
      { symbol: '<>P', name: 'Posibilidad', meaning: 'P vale en al menos un mundo accesible.', stExample: 'check equivalent <>(P), ![](!P)' }
    ],
    commands: [
      { title: 'Axioma K', description: 'Practica la ley central del sistema.', code: 'logic modal.k\ncheck valid [](P -> Q) -> ([]P -> []Q)' },
      { title: 'Dualidad modal', description: 'Comprueba la equivalencia entre posibilidad y negación de necesidad.', code: 'logic modal.k\ncheck equivalent <>(P), ![](!P)' },
      { title: 'Contramodelos modales', description: 'Ve por qué una fórmula falla en un frame no reflexivo.', code: 'logic modal.k\ncheck valid []P -> P\ncountermodel <>P -> []P' }
    ],
    workedExamples: [
      { title: 'Distribución necesaria', description: 'La ley característica de K.', code: 'logic modal.k\ncheck valid [](P -> Q) -> ([]P -> []Q)' },
      { title: 'Reflexividad ausente', description: 'Muestra por qué []P -> P no es teorema de K.', code: 'logic modal.k\ncheck valid []P -> P\ncountermodel []P -> P' },
      { title: 'Posibilidad compatible múltiple', description: 'Dos posibilidades distintas pueden coexistir.', code: 'logic modal.k\ncheck satisfiable <>(P) & <>(Q)' }
    ],
    mistakes: ['Creer que necesario significa verdadero aquí mismo.', 'Confundir K con T o S5.', 'Olvidar que la relación de accesibilidad puede no ser reflexiva.'],
    limits: ['Tableau modal limitado a 200 nodos.', 'No hay garantías de reflexividad, simetría ni transitividad.'],
    bridges: ['La deóntica y la epistémica reinterpretan [] y <>.', 'Temporal LTL conserva intuiciones modales pero con lectura temporal.'],
    downloads: {
      basic: '/downloads/st/03-modal-k.st',
      complete: '/downloads/st/14-modal-completa.st'
    }
  },
  {
    slug: 'deontica',
    navLabel: 'Deóntica',
    title: 'Curso completo de Lógica Deóntica',
    subtitle: 'Obligación, permiso y prohibición sobre la base modal KD.',
    profile: 'deontic.standard',
    badge: 'KD',
    level: 'Intermedio',
    intro: 'La lógica deóntica traduce normas: lo que debe ocurrir, lo que está permitido y lo que está prohibido.',
    whyItMatters: 'Es muy útil para políticas, compliance, derecho, reglas institucionales y análisis de conflicto normativo.',
    learningGoals: ['Leer O, P y F como operadores normativos.', 'Entender por qué lo obligatorio no implica que ya ocurra.', 'Explorar serialidad y axioma D.', 'Practicar derivaciones normativas sencillas.'],
    concepts: [
      { title: '1. Obligación', body: 'O(P) expresa que P debe ocurrir. En ST se representa sobre [] en el perfil deóntico.' },
      { title: '2. Permisión', body: 'P(P) en la salida del motor expresa que P está permitido y suele modelarse con <>.' },
      { title: '3. Prohibición', body: 'F(P) se interpreta como obligación de no P, es decir, [](!P).' },
      { title: '4. Serialidad', body: 'La serialidad garantiza que desde cualquier mundo hay al menos un mundo normativamente accesible. De ahí sale el axioma D.' }
    ],
    operators: [
      { symbol: '[](P)', name: 'Obligación', meaning: 'P es obligatorio.', stExample: 'check valid [](P) -> <>(P)' },
      { symbol: '<>(P)', name: 'Permisión', meaning: 'P está permitido.', stExample: 'check satisfiable <>(P) & <>(Q)' },
      { symbol: '[](!P)', name: 'Prohibición', meaning: 'P está prohibido.', stExample: 'check valid [](!P) -> !<>(P)' }
    ],
    commands: [
      { title: 'Obligación implica permiso', description: 'Ejercicio básico del sistema KD.', code: 'logic deontic.standard\ncheck valid [](P) -> <>(P)' },
      { title: 'No confundir deber con hecho', description: 'Mira por qué O(P) no implica P actual.', code: 'logic deontic.standard\ncheck valid [](P) -> P\ncountermodel [](P) -> P' },
      { title: 'Derivación normativa', description: 'Propaga un deber a otra consecuencia permitida.', code: 'logic deontic.standard\naxiom norma : [](P -> Q)\naxiom permiso = <>(P)\nderive <>(Q) from {norma, permiso}' }
    ],
    workedExamples: [
      { title: 'Deber institucional', description: 'Ejemplo simple con entrega y aprobación.', code: 'logic deontic.standard\naxiom norma : [](Entrega -> Registro)\naxiom permiso = <>(Entrega)\nderive <>(Registro) from {norma, permiso}' },
      { title: 'Obligación incumplida', description: 'Una obligación puede coexistir con su incumplimiento factual.', code: 'logic deontic.standard\ncheck satisfiable [](Entrega) & !Entrega' }
    ],
    mistakes: ['Confundir norma con hecho.', 'Pensar que prohibido significa simplemente falso.', 'No distinguir el plano del deber del plano descriptivo.'],
    limits: ['Máximo 200 nodos en el tableau.', 'No modela todavía conflictos normativos profundos o lógica deóntica dyádica.'],
    bridges: ['Comparte estructura con la lógica modal.', 'Sirve como antesala para discusiones éticas, regulatorias y de agentes.'],
    downloads: {
      basic: '/downloads/st/04-deontica.st',
      complete: '/downloads/st/15-deontica-completa.st'
    }
  },
  {
    slug: 'epistemica',
    navLabel: 'Epistémica',
    title: 'Curso completo de Lógica Epistémica S5',
    subtitle: 'Conocimiento idealizado, accesibilidad universal e introspección.',
    profile: 'epistemic.s5',
    badge: 'S5',
    level: 'Intermedio',
    intro: 'La lógica epistémica permite formalizar qué sabe un agente y qué considera posible. En S5, el conocimiento es idealizado: verdadero, introspectivo y estructuralmente estable.',
    whyItMatters: 'Es clave para razonar sobre información, observación, agentes, juegos epistémicos y estados de conocimiento compartido.',
    learningGoals: ['Distinguir verdad, conocimiento y creencia/posibilidad epistémica.', 'Comprender T, 4 y B.', 'Leer S5 como marco idealizado.', 'Practicar derivaciones sobre conocimiento cerrado.'],
    concepts: [
      { title: '1. Veridicidad', body: 'Si un agente sabe P, entonces P es verdadera. Esto es el axioma T.' },
      { title: '2. Introspección positiva', body: 'Si el agente sabe P, sabe que sabe P. Ese es el axioma 4.' },
      { title: '3. Introspección negativa', body: 'Si no sabe P, sabe que no sabe P. ST la refleja con la forma B implementada.' },
      { title: '4. Universalidad S5', body: 'Todos los mundos son epistémicamente accesibles entre sí dentro del marco idealizado del sistema.' }
    ],
    operators: [
      { symbol: '[](P)', name: 'Conocimiento', meaning: 'P es conocido por el agente.', stExample: 'check valid [](P) -> P' },
      { symbol: '<>(P)', name: 'Posibilidad epistémica', meaning: 'P es compatible con lo que el agente considera posible.', stExample: 'check satisfiable <>(P) & ![](P)' }
    ],
    commands: [
      { title: 'Conocimiento verdadero', description: 'Comprueba el axioma T.', code: 'logic epistemic.s5\ncheck valid [](P) -> P' },
      { title: 'Introspección positiva', description: 'El agente sabe que sabe.', code: 'logic epistemic.s5\ncheck valid [](P) -> []([](P))' },
      { title: 'Cierre epistémico', description: 'Si sabe una implicación y sabe el antecedente, sabe el consecuente.', code: 'logic epistemic.s5\naxiom r1 : [](P -> Q)\naxiom r2 = [](P)\nderive [](Q) from {r1, r2}' }
    ],
    workedExamples: [
      { title: 'Teoremas básicos de S5', description: 'Tríada mínima para empezar.', code: 'logic epistemic.s5\ncheck valid [](P) -> P\ncheck valid [](P) -> []([](P))\ncheck valid !([](P)) -> [](!([](P)))' },
      { title: 'Compatibilidad con ignorancia', description: 'Es posible que algo sea compatible sin estar sabido.', code: 'logic epistemic.s5\ncheck satisfiable <>(P) & ![](P)' }
    ],
    mistakes: ['Leer S5 como psicología humana real.', 'Confundir posibilidad epistémica con posibilidad física.', 'Pensar que ignorar P equivale a conocer !P.'],
    limits: ['Frame universal puede crecer rápido.', 'Modelo idealizado: no representa límites cognitivos ni errores humanos finos.'],
    bridges: ['Nace de la modal.', 'Se conecta con agentes, coordinación y teoría de juegos.'],
    downloads: {
      basic: '/downloads/st/05-epistemica-s5.st',
      complete: '/downloads/st/16-epistemica-completa.st'
    }
  },
  {
    slug: 'intuicionista',
    navLabel: 'Intuicionista',
    title: 'Curso completo de Lógica Intuicionista',
    subtitle: 'Verdad como demostrabilidad constructiva y ruptura con varias leyes clásicas.',
    profile: 'intuitionistic.propositional',
    badge: 'IPC',
    level: 'Intermedio–Avanzado',
    intro: 'La lógica intuicionista conserva parte importante del razonamiento clásico, pero rechaza la idea de que toda fórmula deba ser verdadera o falsa sin una construcción efectiva.',
    whyItMatters: 'Es esencial para teoría de la demostración, fundamentos constructivos, programación funcional y semánticas de tipos.',
    learningGoals: ['Entender por qué falla P | !P.', 'Comprender la no validez de !!P -> P.', 'Leer contramodelos intuicionistas.', 'Distinguir no demostrable de falso.'],
    concepts: [
      { title: '1. Verdad constructiva', body: 'Afirmar P no es solo asignarle V; es disponer de una construcción o prueba de P.' },
      { title: '2. Persistencia de Kripke', body: 'Si algo es verdadero en un mundo intuicionista, sigue siéndolo en mundos futuros accesibles.' },
      { title: '3. Tercero excluido', body: 'P | !P no es una ley general en IPC. Puede haber mundos donde aún no tengamos ni P ni una refutación de P.' },
      { title: '4. Doble negación', body: 'Que sea imposible refutar P no basta para afirmar constructivamente P. Por eso !!P -> P falla.' }
    ],
    operators: [
      { symbol: '!P', name: 'Negación intuicionista', meaning: 'No hay forma de obtener P en ningún mundo accesible.', stExample: 'check valid P -> !!P' },
      { symbol: 'P -> Q', name: 'Implicación constructiva', meaning: 'Una transformación efectiva de pruebas de P en pruebas de Q.', stExample: 'check valid (P -> Q) -> (P -> Q)' }
    ],
    commands: [
      { title: 'Validez constructiva', description: 'Compara principios aceptados y rechazados.', code: 'logic intuitionistic.propositional\ncheck valid P -> !!P\ncheck valid P | !P\ncheck valid !!P -> P' },
      { title: 'Contramodelos', description: 'Observa por qué fallan ciertas leyes clásicas.', code: 'logic intuitionistic.propositional\ncountermodel P | !P\ncountermodel !!P -> P' },
      { title: 'Satisfacibilidad', description: 'Que una ley no sea válida no significa que nunca pueda cumplirse.', code: 'logic intuitionistic.propositional\ncheck satisfiable P | !P' }
    ],
    workedExamples: [
      { title: 'Lo que sí se conserva', description: 'Ejemplos de fórmulas válidas intuicionistamente.', code: 'logic intuitionistic.propositional\ncheck valid P -> !!P\ncheck valid ((P -> Q) -> (!Q -> !P))\ncheck valid (P & Q) -> P' },
      { title: 'Lo que no se conserva', description: 'Ejemplos clásicos que fallan en IPC.', code: 'logic intuitionistic.propositional\ncheck valid P | !P\ncheck valid !!P -> P\ncheck valid ((!P -> !Q) -> (Q -> P))' }
    ],
    mistakes: ['Pensar que una fórmula no válida queda refutada.', 'Aplicar leyes clásicas sin mirar el perfil activo.', 'Olvidar que la semántica usa mundos persistentes.'],
    limits: ['Máximo 4 mundos Kripke.', 'Con más átomos el motor reduce mundos para mantener tractabilidad.'],
    bridges: ['Se entiende mucho mejor después de la proposicional clásica.', 'Conecta con teoría de tipos, lambda cálculo y semántica de programación.'],
    downloads: {
      basic: '/downloads/st/06-intuicionista.st',
      complete: '/downloads/st/17-intuicionista-completa.st'
    }
  },
  {
    slug: 'temporal',
    navLabel: 'Temporal',
    title: 'Curso completo de Lógica Temporal LTL',
    subtitle: 'Razonamiento sobre presente, futuro, persistencia y evolución de estados.',
    profile: 'temporal.ltl',
    badge: 'LTL',
    level: 'Avanzado',
    intro: 'La lógica temporal lineal describe lo que vale ahora, siempre, eventualmente o en el siguiente instante. Es una herramienta muy natural para sistemas reactivos, protocolos y procesos en evolución.',
    whyItMatters: 'Permite expresar especificaciones como “algo nunca debe pasar”, “algo terminará pasando” o “si ocurre un evento, luego vendrá otro”.',
    learningGoals: ['Dominar G, F y X.', 'Distinguir propiedades de seguridad y de vivacidad.', 'Leer ejemplos de persistencia temporal.', 'Entender el alcance actual del operador U en el motor.'],
    concepts: [
      { title: '1. Siempre', body: 'G(P) o [](P) indica que P vale en todos los estados futuros relevantes.' },
      { title: '2. Eventualmente', body: 'F(P) o <>(P) indica que P ocurre en algún estado futuro.' },
      { title: '3. Siguiente', body: 'X(P) afirma que P vale en el próximo paso.' },
      { title: '4. Frames temporales', body: 'ST usa un frame reflexivo-transitivo para G y F, con expansión específica para X.' }
    ],
    operators: [
      { symbol: '[](P)', name: 'Siempre / G', meaning: 'P vale globalmente.', stExample: 'check valid [](P) -> P' },
      { symbol: '<>(P)', name: 'Eventualmente / F', meaning: 'P ocurre alguna vez.', stExample: 'check valid [](P) -> <>(P)' },
      { symbol: 'X(P)', name: 'Siguiente', meaning: 'P vale en el siguiente instante.', stExample: 'check satisfiable X(P)' }
    ],
    commands: [
      { title: 'Ley básica de G', description: 'Si algo siempre vale, entonces vale ahora.', code: 'logic temporal.ltl\ncheck valid [](P) -> P' },
      { title: 'G implica F', description: 'Lo que siempre vale también ocurre eventualmente.', code: 'logic temporal.ltl\ncheck valid [](P) -> <>(P)' },
      { title: 'F no implica G', description: 'Lo eventual no basta para garantizar permanencia.', code: 'logic temporal.ltl\ncheck valid <>(P) -> [](P)\ncountermodel <>(P) -> [](P)' }
    ],
    workedExamples: [
      { title: 'Dualidades temporales', description: 'Reescrituras fundamentales entre siempre y eventualmente.', code: 'logic temporal.ltl\ncheck equivalent <>(P), ![](!P)\ncheck equivalent [](P), !<>(!P)' },
      { title: 'Propagación temporal', description: 'Cierre de una regla siempre válida sobre un hecho siempre válido.', code: 'logic temporal.ltl\naxiom regla : []((P -> Q))\naxiom hecho = [](P)\nderive [](Q) from {regla, hecho}' }
    ],
    mistakes: ['Confundir eventualmente con ahora.', 'Leer X(P) como repetición de P presente.', 'Confiar demasiado en until sin revisar la limitación actual del motor.'],
    limits: ['El tableau temporal comparte límite de 200 nodos.', 'El operador U tiene soporte parcial en el motor actual.'],
    bridges: ['Conecta con verificación de software y protocolos.', 'Se apoya en intuiciones modales pero con lectura temporal específica.'],
    downloads: {
      basic: '/downloads/st/07-temporal-ltl.st',
      complete: '/downloads/st/18-temporal-completa.st'
    }
  },
  {
    slug: 'aritmetica',
    navLabel: 'Aritmética',
    title: 'Curso completo de Lógica Aritmética Ejecutable',
    subtitle: 'Cálculo, comparación y scripting explicativo con el perfil arithmetic de ST.',
    profile: 'arithmetic',
    badge: 'ARITH',
    level: 'Aplicado',
    intro: 'El perfil arithmetic convierte ST en un pequeño laboratorio ejecutable para expresiones numéricas, comparaciones, control de flujo y ejemplos pedagógicos paso a paso. Es una puerta excelente para enseñar que ST ya no solo verifica fórmulas: también puede guionar procesos lógicos y computacionales simples.',
    whyItMatters: 'Aritmética es el perfil más claro para mostrar que ST creció hacia un lenguaje explicativo completo. Aquí puedes usar números, operadores aritméticos, comparaciones, let, set, if, for, while, funciones y explain con resultados concretos. Es ideal para talleres, onboarding y cursos introductorios donde conviene mezclar lógica con ejecución visible.',
    learningGoals: [
      'Leer expresiones numéricas con la precedencia correcta.',
      'Distinguir entre resultado numérico y comparación booleana.',
      'Usar check valid y check satisfiable sobre desigualdades y expresiones aritméticas.',
      'Usar let, set, if, for y while para construir pequeños scripts ejecutables.',
      'Escribir funciones con fn y return para encapsular pasos repetibles.',
      'Aprovechar explain para convertir cálculos en ejemplos pedagógicos claros.'
    ],
    concepts: [
      {
        title: '1. Aritmética como perfil ejecutable',
        body: 'En arithmetic, ST interpreta expresiones como 2 + 3, 8 / 2 o 10 % 3 y comparaciones como 5 > 2 o 4 <= 4. Ya no estás trabajando solo con tablas de verdad clásicas, sino con evaluación numérica y condiciones verdaderas o falsas a partir de operaciones aritméticas.'
      },
      {
        title: '2. Comparaciones como fórmulas verificables',
        body: 'Expresiones como 2 + 3 < 10 o 8 / 2 >= 4 producen fórmulas que el motor puede tratar como válidas o satisfacibles dentro del perfil arithmetic. Esto permite reutilizar comandos como check valid, countermodel o explain sobre expresiones numéricas.'
      },
      {
        title: '3. ST como lenguaje guiado',
        body: 'Arithmetic es también el mejor lugar para enseñar let, set, print, if, for, while y fn porque los resultados son inmediatos y concretos. El estudiante ve cómo cambia el estado y cómo una condición deja de cumplirse al reasignar una variable.'
      },
      {
        title: '4. Explain con resultados concretos',
        body: 'Mientras otros perfiles explican estructura lógica, arithmetic además devuelve el resultado evaluado. Así puedes mostrar no solo la forma de una expresión, sino también el valor que produce y el porqué de una comparación verdadera o falsa.'
      }
    ],
    operators: [
      { symbol: 'A + B', name: 'Suma', meaning: 'Agrega dos expresiones numéricas y devuelve un nuevo valor.', stExample: 'logic arithmetic\nexplain 2 + 3\ncheck valid 2 + 3 < 10' },
      { symbol: 'A - B', name: 'Resta', meaning: 'Resta una cantidad a otra. También soporta menos unario mediante reescritura interna.', stExample: 'logic arithmetic\nexplain 10 - 4\nexplain -(3 + 2)' },
      { symbol: 'A * B', name: 'Multiplicación', meaning: 'Multiplica dos expresiones; tiene mayor precedencia que + y -.', stExample: 'logic arithmetic\nexplain 2 + 3 * 4\nexplain (2 + 3) * 4' },
      { symbol: 'A / B', name: 'División', meaning: 'Divide una expresión por otra; sirve para construir comparaciones evaluables.', stExample: 'logic arithmetic\ncheck valid 8 / 2 >= 4\nexplain 10 / 2' },
      { symbol: 'A % B', name: 'Módulo', meaning: 'Devuelve el residuo de una división entera.', stExample: 'logic arithmetic\nexplain 10 % 3\ncheck valid 10 % 3 > 0' },
      { symbol: 'A < B, A > B, A <= B, A >= B', name: 'Comparaciones', meaning: 'Producen fórmulas verdaderas o falsas que pueden usarse en check, if o while.', stExample: 'logic arithmetic\ncheck valid 2 + 3 < 10\ncheck satisfiable 5 > 3' }
    ],
    commands: [
      { title: 'Validez aritmética', description: 'Comprueba que una desigualdad o comparación sale verdadera en el cálculo planteado.', code: 'logic arithmetic\ncheck valid 2 + 3 < 10\ncheck valid (2 * 3) >= 6' },
      { title: 'Explicación numérica', description: 'Usa explain para obtener lectura y resultado de una expresión.', code: 'logic arithmetic\nexplain 2 + 3 * 4\nexplain 10 > 5' },
      { title: 'Variables y reasignación', description: 'Usa let y set para construir pequeños scripts con estado legible.', code: 'logic arithmetic\nlet X = 2 + 3\nprint X\nset X = 2 * 5\nprint X' },
      { title: 'Condicionales y loops', description: 'Combina arithmetic con if, for y while para mostrar procesos paso a paso.', code: 'logic arithmetic\nif valid 8 / 2 >= 4 {\n  print "division ok"\n}\n\nfor N in { 1, 2, 3 } {\n  print N\n}\n\nset LOOP = 1\nwhile satisfiable LOOP {\n  print "loop arithmetic"\n  set LOOP = 0\n}' },
      { title: 'Funciones', description: 'Encapsula secuencias reutilizables con fn y return.', code: 'logic arithmetic\nfn calcular(A, B) {\n  print A\n  print B\n  explain A + B\n  return A + B\n}\n\ncalcular(4, 5)' }
    ],
    workedExamples: [
      { title: 'Ejemplo 1 · Cálculo y comparación', description: 'Empieza por expresiones cortas y comparaciones directas.', code: 'logic arithmetic\ncheck valid 2 + 3 < 10\ncheck valid (2 * 3) >= 6\ncheck satisfiable 10 % 3 > 0\nexplain 2 + 3 * 4\nexplain 10 > 5' },
      { title: 'Ejemplo 2 · Variables y mutación', description: 'Muestra cómo el estado puede cambiar de manera controlada.', code: 'logic arithmetic\nlet X = 2 + 3\nprint X\nset X = 2 * 5\nprint X' },
      { title: 'Ejemplo 3 · Flujo de control', description: 'Convierte una verificación en un flujo legible para una clase o demo.', code: 'logic arithmetic\nif valid 8 / 2 >= 4 {\n  print "division ok"\n} else {\n  print "division fail"\n}\n\nfor N in { 1, 2, 3 } {\n  print N\n}\n\nset LOOP = 1\nwhile satisfiable LOOP {\n  print "loop arithmetic"\n  set LOOP = 0\n}' },
      { title: 'Ejemplo 4 · Función reutilizable', description: 'Agrupa pasos repetibles y explica resultados en un solo bloque.', code: 'logic arithmetic\nfn calcular(A, B) {\n  print A\n  print B\n  explain A + B\n  return A + B\n}\n\ncalcular(4, 5)' },
      { title: 'Ejemplo 5 · Script completo de aula', description: 'Una mini lección ejecutable que mezcla cálculo, control de flujo y explicación.', code: 'logic arithmetic\nprint "=== arithmetic-course ==="\nlet base = 2 + 3\nprint base\n\nif valid base < 10 {\n  print "base pequeña"\n}\n\nfor Caso in { 1, 2, 3 } {\n  print Caso\n}\n\nfn revisar(X) {\n  explain X\n  check satisfiable X > 0\n}\n\nrevisar(4 + 5)\ncountermodel 5 < 3' }
    ],
    mistakes: [
      'Confundir explain con check valid: uno explica y evalúa; el otro verifica un estatus lógico.',
      'Olvidar que la precedencia hace que 2 + 3 * 4 no sea lo mismo que (2 + 3) * 4.',
      'Usar while sin cambiar el estado con set y provocar iteraciones innecesarias.',
      'Esperar que una función devuelta por return pueda incrustarse ya como expresión dentro de otra fórmula.',
      'Tratar una comparación como si fuera un número cuando ya produce un resultado booleano del perfil.'
    ],
    limits: [
      'La división por cero puede producir resultados no útiles para docencia rigurosa; conviene evitarla en materiales introductorios.',
      'while tiene un límite de seguridad de 1000 iteraciones.',
      'Las funciones hoy son statements reutilizables; no son expresiones anidadas del lenguaje.',
      'Arithmetic está orientado a ejemplos pedagógicos y scripting ligero, no a álgebra simbólica avanzada.'
    ],
    bridges: [
      'Es el mejor perfil para enseñar el nuevo ST como lenguaje ejecutable, no solo lógico.',
      'Sirve como puente entre estudiantes que vienen de programación y estudiantes que vienen de lógica formal.',
      'Prepara muy bien la entrada a ejemplos con Text Layer, analyze y explain dentro de materiales educativos.',
      'Ayuda a prototipar mini simulaciones y laboratorios visibles antes de pasar a perfiles más abstractos.'
    ],
    downloads: {
      basic: '/downloads/st/23-aritmetica.st',
      complete: '/downloads/st/24-aritmetica-completa.st'
    }
  },
  {
    slug: 'aristotelica',
    navLabel: 'Aristotélica',
    title: 'Curso completo de Silogística Aristotélica',
    subtitle: 'Modos categóricos, figuras y análisis formal de silogismos clásicos.',
    profile: 'aristotelian.syllogistic',
    badge: 'SYL',
    level: 'Histórica–Formal',
    intro: 'La silogística aristotélica estudia razonamientos entre clases o términos: todos, ningún, algún. ST la implementa con una lectura moderna sobre fórmulas categóricas.',
    whyItMatters: 'Es una gran puerta pedagógica para entender estructura inferencial, distribución de términos y la historia de la lógica antes de Frege.',
    learningGoals: ['Reconocer A, E, I y O.', 'Entender la figura silogística.', 'Practicar modos válidos como Barbara y Celarent.', 'Detectar falacias por mala distribución del término medio.'],
    concepts: [
      { title: '1. Proposiciones A/E/I/O', body: 'A: Todo S es P. E: Ningún S es P. I: Algún S es P. O: Algún S no es P.' },
      { title: '2. Términos mayor, menor y medio', body: 'El término medio conecta premisas pero no aparece en la conclusión.' },
      { title: '3. Figuras', body: 'La posición del término medio define la figura del silogismo.' },
      { title: '4. Modos válidos', body: 'ST reconoce 19 modos válidos codificados directamente en el motor.' }
    ],
    operators: [
      { symbol: 'forall x (S(x) -> P(x))', name: 'A universal afirmativa', meaning: 'Todo S es P.', stExample: 'axiom mayor : forall x (M(x) -> P(x))' },
      { symbol: 'forall x (S(x) -> !P(x))', name: 'E universal negativa', meaning: 'Ningún S es P.', stExample: 'axiom premisa : forall x (M(x) -> !P(x))' },
      { symbol: 'exists x (S(x) & P(x))', name: 'I particular afirmativa', meaning: 'Algún S es P.', stExample: 'check satisfiable exists x (S(x) & P(x))' },
      { symbol: 'exists x (S(x) & !P(x))', name: 'O particular negativa', meaning: 'Algún S no es P.', stExample: 'check satisfiable exists x (S(x) & !P(x))' }
    ],
    commands: [
      { title: 'Barbara', description: 'El silogismo clásico por excelencia.', code: 'logic aristotelian.syllogistic\naxiom mayor : forall x (M(x) -> P(x))\naxiom menor : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {mayor, menor}' },
      { title: 'Celarent', description: 'Una forma negativa válida.', code: 'logic aristotelian.syllogistic\ncheck valid (forall x (M(x) -> !P(x)) & forall x (S(x) -> M(x))) -> forall x (S(x) -> !P(x))' },
      { title: 'Falacia', description: 'Observa un caso de término medio mal distribuido.', code: 'logic aristotelian.syllogistic\naxiom p1 : forall x (P(x) -> M(x))\naxiom p2 : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {p1, p2}' }
    ],
    workedExamples: [
      { title: 'Barbara y Celarent', description: 'Dos formas canónicas para memorizar la estructura inferencial.', code: 'logic aristotelian.syllogistic\naxiom mayor : forall x (M(x) -> P(x))\naxiom menor : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {mayor, menor}\n\ncheck satisfiable forall x (S(x) -> P(x))' },
      { title: 'Darii y Ferio', description: 'Introduce existencia particular en la conclusión.', code: 'logic aristotelian.syllogistic\ncheck satisfiable exists x (S(x) & P(x))\ncheck satisfiable exists x (S(x) & !P(x))' }
    ],
    mistakes: ['Perder de vista el término medio.', 'Creer que toda frase con “todos” ya forma un silogismo válido.', 'Olvidar que derive exige exactamente dos premisas categóricas.'],
    limits: ['ST codifica 19 modos, no las 24 formas históricas completas.', 'No toda falacia verbal queda explicada automáticamente si la forma cae cerca de un patrón válido.'],
    bridges: ['Conecta históricamente con FOL.', 'Ayuda a enseñar estructura inferencial sin cargar demasiada sintaxis moderna al inicio.'],
    downloads: {
      basic: '/downloads/st/08-aristotelica.st',
      complete: '/downloads/st/19-aristotelica-completa.st'
    }
  },
  {
    slug: 'belnap',
    navLabel: 'Belnap',
    title: 'Curso completo de Lógica Paraconsistente Belnap',
    subtitle: 'Cuatro valores, inconsistencia tolerada y caída de varias leyes clásicas.',
    profile: 'paraconsistent.belnap',
    badge: 'B4',
    level: 'Avanzado',
    intro: 'Belnap-Dunn amplía la semántica clásica con cuatro valores: verdadero, falso, ambos y ninguno. Esto permite trabajar con información inconsistente o incompleta sin hacer explotar el sistema.',
    whyItMatters: 'Es especialmente útil para modelar bases de conocimiento ruidosas, fuentes conflictivas o sistemas donde no quieres que una contradicción vuelva trivial toda la teoría.',
    learningGoals: ['Entender T, F, B y N.', 'Comprender por qué ex falso falla.', 'Ver por qué P -> P puede dejar de ser válida.', 'Aprender a leer contramodelos de 4 valores.'],
    concepts: [
      { title: '1. Cuatro valores', body: 'T verdadero, F falso, B ambos, N ninguno. Los valores designados son T y B.' },
      { title: '2. Paraconsistencia', body: 'Una contradicción no obliga a que cualquier fórmula sea válida.' },
      { title: '3. Fallo del tercero excluido', body: 'Si P vale N, entonces P | !P también puede valer N y no quedar designada.' },
      { title: '4. Implicación material no clásica', body: 'Como la implicación se define desde !P | Q, hereda fenómenos no clásicos cuando interviene N.' }
    ],
    operators: [
      { symbol: 'P & !P', name: 'Contradicción tolerada', meaning: 'Puede ser satisfacible cuando P toma valor B.', stExample: 'check satisfiable P & !P' },
      { symbol: 'P | !P', name: 'Tercero excluido fallido', meaning: 'Ya no siempre resulta designado.', stExample: 'check valid P | !P' },
      { symbol: 'P -> P', name: 'Reflexividad material fallida', meaning: 'Puede fallar si P toma N.', stExample: 'check valid P -> P' }
    ],
    commands: [
      { title: 'Contradicción satisfacible', description: 'Experimenta con P y no-P simultáneamente.', code: 'logic paraconsistent.belnap\ncheck satisfiable P & !P' },
      { title: 'Ex falso quodlibet', description: 'Observa cómo deja de ser una ley válida.', code: 'logic paraconsistent.belnap\ncheck valid (P & !P) -> Q\ncountermodel (P & !P) -> Q' },
      { title: 'Equivalencias que sí se conservan', description: 'Algunas leyes de reescritura siguen funcionando.', code: 'logic paraconsistent.belnap\ncheck equivalent P -> Q, !P | Q\ncheck equivalent !(P & Q), !P | !Q' }
    ],
    workedExamples: [
      { title: 'Tres sorpresas de Belnap', description: 'Lo que más desconcierta a quien viene de la clásica.', code: 'logic paraconsistent.belnap\ncheck valid P -> P\ncheck valid P | !P\ncheck valid (P & !P) -> Q' },
      { title: 'Lo que sí se puede hacer', description: 'Equivalencias y satisfacibilidad útiles.', code: 'logic paraconsistent.belnap\ncheck satisfiable P & !P\ncheck equivalent P -> Q, !P | Q\ncheck equivalent !(P | Q), !P & !Q' }
    ],
    mistakes: ['Esperar automáticamente todas las leyes clásicas.', 'Confundir valor designado con valor estrictamente verdadero.', 'Pensar que una contradicción destruye todo el sistema.'],
    limits: ['El espacio crece como 4^n.', 'Hay fórmulas clásicamente obvias que dejan de ser válidas.'],
    bridges: ['Excelente contraste con la clásica.', 'Prepara discusión sobre inconsistencia controlada y razonamiento robusto.'],
    downloads: {
      basic: '/downloads/st/09-paraconsistente-belnap.st',
      complete: '/downloads/st/20-belnap-completa.st'
    }
  },
  {
    slug: 'probabilistica',
    navLabel: 'Probabilística',
    title: 'Curso completo de Lógica Probabilística',
    subtitle: 'Semántica clásica por mundos, pero evaluada por asignaciones de probabilidad.',
    profile: 'probabilistic.basic',
    badge: 'PROB',
    level: 'Avanzado',
    intro: 'La lógica probabilística de ST toma fórmulas clásicas y les asigna una probabilidad global a partir de mundos posibles y probabilidades discretas sobre los átomos.',
    whyItMatters: 'Sirve para explorar incertidumbre sin abandonar la estructura lógica de base. Es una buena transición entre lógica formal y modelos probabilísticos simples.',
    learningGoals: ['Entender qué significa probabilidad de una fórmula.', 'Distinguir probabilidad positiva de validez.', 'Ver el papel de la independencia entre átomos.', 'Leer las salidas de truth_table y countermodel en este perfil.'],
    concepts: [
      { title: '1. Mundo booleano subyacente', body: 'Cada mundo sigue siendo clásico: una fórmula o vale o no vale en ese mundo.' },
      { title: '2. Agregación probabilística', body: 'La probabilidad de una fórmula se obtiene sumando probabilidades de mundos donde la fórmula es verdadera.' },
      { title: '3. Validez probabilística', body: 'Una fórmula es válida si tiene probabilidad 1 en todo el muestreo considerado.' },
      { title: '4. Muestreo discreto', body: 'El motor no integra sobre continuo; usa puntos discretos como 0, 0.25, 0.5, 0.75 y 1.' }
    ],
    operators: [
      { symbol: 'P -> Q', name: 'Implicación clásica por mundo', meaning: 'Se evalúa clásicamente dentro de cada mundo antes de agregarse probabilísticamente.', stExample: 'truth_table P -> Q' },
      { symbol: 'P | !P', name: 'Tautología probabilística', meaning: 'Conserva probabilidad 1 en todo muestreo.', stExample: 'check valid P | !P' }
    ],
    commands: [
      { title: 'Validez probabilística', description: 'Comprueba fórmulas que siempre alcanzan probabilidad 1.', code: 'logic probabilistic.basic\ncheck valid P | !P\ncheck valid P -> P' },
      { title: 'No toda fórmula alcanza 1', description: 'Muestra que una contingencia no es válida en este sentido fuerte.', code: 'logic probabilistic.basic\ncheck valid P -> Q\ncountermodel P -> Q' },
      { title: 'Probabilidad positiva', description: 'Satisfacibilidad se interpreta como existencia de asignaciones con probabilidad positiva.', code: 'logic probabilistic.basic\ncheck satisfiable P & Q' }
    ],
    workedExamples: [
      { title: 'Validez vs posibilidad', description: 'Contrasta una tautología con una simple contingencia.', code: 'logic probabilistic.basic\ncheck valid P | !P\ncheck valid P\ncheck satisfiable P' },
      { title: 'Equivalencia estructural', description: 'Incluso aquí la implicación material mantiene su equivalencia clásica.', code: 'logic probabilistic.basic\ncheck equivalent (P -> Q) <-> (!P | Q), P | !P' }
    ],
    mistakes: ['Confundir probabilidad alta con validez.', 'Olvidar que el motor asume independencia entre átomos.', 'Leer el muestreo discreto como si fuera un cálculo continuo exacto.'],
    limits: ['El muestreo se reduce cuando 5^n supera 10000.', 'truth_table puede mezclar lectura clásica y probabilística en la salida.'],
    bridges: ['Conecta lógica formal con incertidumbre cuantitativa.', 'Se entiende mejor después de dominar proposicional clásica.'],
    downloads: {
      basic: '/downloads/st/10-probabilistica.st',
      complete: '/downloads/st/21-probabilistica-completa.st'
    }
  }
];

export const logicCourseBySlug = Object.fromEntries(logicCourses.map(course => [course.slug, course])) as Record<string, LogicCoursePageData>;
