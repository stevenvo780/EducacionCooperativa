// ============================================================
// ST — Definiciones, Fuentes e Interpretaciones
// Características: define · unfold · fold · source · interpret
//                  glossary · render glossary · render analysis
// ============================================================

logic classical.propositional
set verbose = on

print "=== Definiciones formales en ST ==="

// ── 1. DEFINICIONES SIMPLES ──────────────────────────────────
// define Nombre := formula
// Alias español: definir

define Tautologia := P -> P
description "Una fórmula que es verdadera en toda interpretación"

define Contradiccion := P & !P
description "Una fórmula que es falsa en toda interpretación"

definir Contingente := P -> Q
description "Una fórmula cuya verdad depende de la interpretación"

// También acepta = en lugar de :=
define ImplicacionBase = P -> Q

// ── 2. DEFINICIONES PARAMÉTRICAS ─────────────────────────────
// define Nombre(param1, param2) := formula

define Implica(x, y) := x -> y
description "Implicación material parametrizada"

define NandDef(x, y) := !(x & y)
description "Negación conjuntiva (NAND) parametrizada"

define Equivale(x, y) := (x -> y) & (y -> x)
description "Equivalencia material parametrizada"

// ── 3. ENCADENAMIENTO DE DEFINICIONES ────────────────────────
// Las definiciones pueden referenciar otras ya declaradas
// (no se permiten ciclos directos ni indirectos)

define Base := P -> Q
define Compuesta := Base -> R

// ── 4. USAR DEFINICIONES EN VERIFICACIONES ───────────────────

check valid Tautologia
check satisfiable Contradiccion
check valid Implica(P, P)
check valid Equivale(P, P)

// Definición expandida en tabla de verdad
truth_table Implica(P, Q)

// Definición en axioma y derivación
axiom regla = Implica(P, Q)
axiom premisa = P
derive Q from {regla, premisa}

// Definición expandida en check satisfiable
define Explosion := Contradiccion -> Q
check satisfiable Explosion

// ── 5. UNFOLD — EXPANDIR DEFINICIÓN ─────────────────────────
// Muestra y verifica la fórmula expandida de la definición
// Alias español: desplegar

unfold Tautologia
unfold Implica(P, Q)
unfold Compuesta
// La build canónica actual valida `unfold` aquí de forma estable.
unfold NandDef(P, Q)

// ── 6. FOLD — CONTRAER FÓRMULA A DEFINICIÓN ─────────────────
// Busca si la fórmula coincide con alguna definición registrada
// Alias español: plegar

fold (P -> P)
fold (P -> Q)
plegar (P -> P)

// ── 7. SOURCE — FUENTES BIBLIOGRÁFICAS ───────────────────────
// Campos disponibles: author, work, year, url, section
// Sin colons entre clave y valor

source Aristoteles {
  author "Aristóteles"
  work "Organon"
  year -350
}

source Frege {
  author "Gottlob Frege"
  work "Begriffsschrift"
  year 1879
}

source Wikipedia {
  author "Wikipedia"
  work "Lógica proposicional"
  url "https://es.wikipedia.org/wiki/Lógica_proposicional"
  section "Introducción"
}

// Alias español: fuente
fuente Kant {
  author "Immanuel Kant"
  work "Crítica de la razón pura"
  year 1781
}

// ── 8. INTERPRET — TEXTO NATURAL A FÓRMULA ──────────────────
// Vincula texto natural a una fórmula lógica
// Alias español: interpretar

interpret "si llueve, la calle se moja" as P -> Q
interpret "está lloviendo" as P
interpret "la calle está mojada" as Q

// Con identificador en lugar de string
interpret Premisa1 as P -> Q

// Alias español
interpretar "todo hombre es mortal" as P -> Q

// ── 9. GLOSSARY — VER GLOSARIO ──────────────────────────────
// Muestra todas las definiciones, fuentes e interpretaciones activas
// Alias español: glosario

glossary

// ── 10. RENDER GLOSSARY — FORMATOS DE EXPORTACIÓN ───────────

render glossary as markdown
render glossary as json
render glossary as latex

// Sin "as" — por defecto markdown
render glossary

// ── 11. RENDER ANALYSIS — ANÁLISIS COMPLETO DEL SCRIPT ──────

render analysis as markdown

// ── 12. FLUJO INTEGRADO ──────────────────────────────────────

source SocraticArgument {
  author "Platón"
  work "Menón"
  year -380
}

define Mortal := P -> Q
description "Todo hombre es mortal (P = hombre, Q = mortal)"

axiom premisaMayor = Mortal
axiom premisaMenor = P
derive Q from {premisaMayor, premisaMenor}

interpret "Sócrates es hombre" as P
interpret "Por tanto Sócrates es mortal" as Q

render analysis as markdown

// ── 13. EXPORT DEFINE ────────────────────────────────────────
// Permite que otros archivos importen la definición vía import

export define ReglaBase := P -> Q
description "Regla base exportable desde este módulo"
