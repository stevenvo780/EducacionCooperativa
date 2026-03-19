// ST — Aritmética
logic arithmetic

print "=== curso-aritmetica ==="

// === COMPROBACIONES Y PRUEBAS ===
axiom limite = 2 + 3 < 10
axiom cota = 4 * 2 >= 8
check valid 2 + 3 < 10
check valid (2 * 3) >= 6
check satisfiable 10 % 3 > 0
derive 2 + 3 < 10 from {limite}
prove 2 + 3 < 10 from {limite}

// === EXPLICACIÓN Y ESTADO ===
explain 2 + 3 * 4
explain 10 > 5

let base = 2 + 3
print base
print typeof(base)
set base = base * 2
print base

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
// analyze existe en el runtime global, pero hoy no produce inferencias
// pedagógicamente útiles para arithmetic.
render theory
