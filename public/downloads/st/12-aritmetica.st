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

// === RECURSIÓN PROFUNDA — TCO ===
// ST aplica optimización de recursión de cola (TCO): no hay límite rígido de pila
fn countdown(N) {
  if valid N <= 0 {
    return 0
  }
  let prev = N - 1
  return countdown(prev)
}
let r1000 = countdown(1000)
print r1000

fn factorial(N) {
  if valid N <= 1 {
    return 1
  }
  let prev = N - 1
  let res = factorial(prev)
  return N * res
}
print factorial(10)

// === LOOPS LARGOS ===
// Bucles de cientos de iteraciones sin límite rígido
let acc = 0
for i in {1,2,3,4,5,6,7,8,9,10} {
  for j in {1,2,3,4,5,6,7,8,9,10} {
    set acc = acc + 1
  }
}
print acc

// === DEFINICIONES ARITMÉTICAS ===
// define funciona también con expresiones aritméticas
define SumaBase := 2 + 3
description "Suma de demostración"

define Mayor(x, y) := x > y
description "x es mayor que y"

check valid SumaBase >= 5
check valid Mayor(10, 3)
glossary

// === CAPTURA DE RESULTADOS ARITMÉTICOS ===
let verif = check valid 3 < 5
print verif.status  // "valid"

let sat = check satisfiable 10 % 3 > 0
print sat.status  // "satisfiable"
