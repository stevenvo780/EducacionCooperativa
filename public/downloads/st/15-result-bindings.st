// ============================================================
// ST — Captura de resultados y funciones de lista
// Características: let = acción · .status · .formula ·
//                  atoms_of · len · at · formula_eq ·
//                  typeof · is_valid · is_satisfiable
// ============================================================

logic classical.propositional
set verbose = on

print "=== Captura de resultados en variables ==="

// ── 1. let var = derive ──────────────────────────────────────
// La derivación se guarda como valor con campos accesibles

axiom a1 = P -> Q
axiom a2 = P

let derivacion = derive Q from {a1, a2}

print derivacion          // fórmula resultado: Q
print derivacion.status   // "provable"
print derivacion.command  // "derive"

// ── 2. let var = check valid ─────────────────────────────────

let esValida = check valid (P -> P)
print esValida.status  // "valid"

let noValida = check valid (P -> Q)
print noValida.status  // "invalid"

// ── 3. let var = check satisfiable ───────────────────────────

let esSat = check satisfiable (P & Q)
print esSat.status  // "satisfiable"

let noSat = check satisfiable (P & !P)
print noSat.status  // "unsatisfiable"

// ── 4. let var = truth_table ─────────────────────────────────

let tabla = truth_table (P & Q)

print tabla.status      // "satisfiable"
print tabla.rows_count  // 4
print tabla.variables   // [P, Q]

// ── 5. atoms_of(f) — lista de átomos ─────────────────────────
// Devuelve todos los átomos proposicionales de una fórmula

let f = (P & Q) -> R
let atomos = atoms_of(f)

print atomos        // [P, Q, R]
print len(atomos)   // 3
print at(atomos, 0) // P
print at(atomos, 1) // Q
print at(atomos, 2) // R

// ── 6. get_atoms(f) — alias de atoms_of ─────────────────────

let atomos2 = get_atoms((P -> Q) & R)
print len(atomos2)  // 3

// ── 7. len(list) y at(list, i) ───────────────────────────────

let lista = atoms_of(P & Q & R & S)
print len(lista)   // 4

for i in {0, 1, 2, 3} {
  print at(lista, i)
}

// ── 8. formula_eq(f1, f2) — igualdad estructural ────────────
// Devuelve 1 (igual) o 0 (distinto)

let igual    = formula_eq(P -> Q, P -> Q)
let distinto = formula_eq(P -> Q, Q -> P)

print igual     // 1
print distinto  // 0

// Usando el resultado de una derivación para comparar
let meta = Q
let igualDerivado = formula_eq(derivacion, meta)
print igualDerivado  // 1 (derivacion resultó en Q)

// ── 9. typeof(arg) ───────────────────────────────────────────

print typeof(42)       // number
print typeof(P -> Q)   // formula
print typeof(atomos)   // list
print typeof("texto")  // string

// ── 10. is_valid / is_satisfiable ────────────────────────────
// Devuelven "True" o "False" como string

print is_valid(P -> P)        // True
print is_valid(P -> Q)        // False
print is_satisfiable(P & Q)   // True
print is_satisfiable(P & !P)  // False

// ── 11. Uso condicional sobre resultados capturados ──────────

let resultado = check valid (P | !P)

if valid resultado {
  print "la fórmula es válida"
} else {
  print "la fórmula no es válida"
}

// ── 12. Combinación: iterar sobre átomos de una fórmula ─────

let formula = (P -> Q) & (Q -> R) & (R -> P)
let listaAtoms = atoms_of(formula)

print "Átomos de la transitividad:"
for idx in {0, 1, 2} {
  print at(listaAtoms, idx)
}

// ── 13. Captura en context de theory ─────────────────────────

theory Verificador {
  fn comprobar(F) {
    let r = check valid F
    print r.status
    return r
  }
}

Verificador.comprobar(P -> P)
Verificador.comprobar(P -> Q)
