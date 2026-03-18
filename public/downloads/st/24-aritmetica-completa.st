logic arithmetic

print "=== curso-aritmetica-completa ==="

check valid 2 + 3 < 10
check valid (2 * 3) >= 6
check satisfiable 10 % 3 > 0

explain 2 + 3 * 4
explain 10 > 5

let base = 2 + 3
print base
set base = 2 * 5
print base

if valid 8 / 2 >= 4 {
  print "division ok"
} else {
  print "division fail"
}

for Caso in { 1, 2, 3 } {
  print Caso
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

calcular(4, 5)
countermodel 5 < 3
