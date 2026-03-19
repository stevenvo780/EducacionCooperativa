// ============================================================
// ST - Meta logica y metaprogramacion
// Ejemplo ejecutable para la documentacion de EducacionCooperativa
// Autor y derechos: Steven Vallejo Ortiz
// ============================================================

logic classical.propositional
set verbose = on

print "=== Meta logica en ST ==="

theory Meta(nombre) {
  let etiqueta = nombre

  fn inspeccionar(F) {
    print etiqueta
    print typeof(F)
    print get_atoms(F)
    print is_valid(F)
    print is_satisfiable(F)
    explain F
    return F
  }

  fn clasificar(F) {
    if valid F {
      print "tautologia"
    } else if satisfiable F {
      print "contingente"
    } else {
      print "contradiccion"
    }
    return F
  }
}

let meta = Meta("MetaLogica")
meta.inspeccionar((P -> (Q -> P)))
meta.clasificar((P & !P))

theory BibliotecaMeta {
  let identidad = P -> P

  fn auditar() {
    print typeof(identidad)
    print get_atoms(identidad)
    check valid identidad
  }
}

BibliotecaMeta.auditar()

theory MetaInferencia {
  fn revisar() {
    analyze {P, P -> Q} -> Q
    analyze {P -> Q, Q} -> P
  }
}

MetaInferencia.revisar()
