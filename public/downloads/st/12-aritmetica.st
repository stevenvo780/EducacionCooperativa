// ST — Aritmética
// Script canónico exhaustivo del perfil arithmetic
logic arithmetic

set verbose = off

print "=== curso-aritmetica ==="

// === LITERALES, WARNINGS Y AXIOMAS ===
axiom Entero = 42
axiom Expresion = 2 + 3 * 4
axiom DivisionPeligrosa = 10 / 0
axiom limite = 2 + 3 < 10
axiom mezcla = (1 < 2) & (3 > 1)

// === TODAS LAS FAMILIAS DE OPERADORES ===
check valid 3 < 5
check valid 5 > 3
check valid 1 <= 2
check valid 5 >= 5
check valid 3 ≤ 5
check valid 5 ≥ 3
check valid (2 + 3) >= 5
check valid (10 - 3) >= 7
check valid (4 * 3) >= 12
check valid (10 / 2) >= 5
check valid (10 % 3) >= 1
check valid ((2 + 3) * 2) >= 10
check valid (3 - 5) < 0
check satisfiable 2 + 2 > 3
check satisfiable 10 % 3 > 0

// === DERIVACIÓN Y PRUEBA ===
derive 2 + 3 < 10 from {limite}
prove 2 + 3 < 10 from {limite}

// === EXPLAIN: CÁLCULO, COMPARACIÓN Y MENOS UNARIO ===
set verbose = on
explain 2 + 3
explain 10 - 4
explain 3 * 5
explain 10 / 2
explain 10 % 3
explain 2 + 3 * 4
explain -(3 + 2)
explain 10 > 5

// === ESTADO, TIPOS Y MUTACIÓN ===
let base = 2 + 3
print base
print typeof(base)
set base = base * 2
print base
print mezcla

if valid base >= 10 {
  print "base grande"
} else {
  print "base pequena"
}

for Caso in { 1, 2, 3 } {
  explain Caso + base
}

set LOOP = 1
while satisfiable LOOP {
  print "loop arithmetic"
  set LOOP = 0
}

fn calcular(A, B) {
  print A
  print B
  explain A + B
  return A + B
}

print calcular(4, 5)

theory Calculadora {
  let referencia = 7 + 1

  fn revisar(X) {
    explain X
    return X
  }
}

Calculadora.revisar(3 * 3)
countermodel 5 < 3
render theory
