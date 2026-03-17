# Idea 01: lenguaje `.md.st`

## Objetivo

Crear un lenguaje nuevo orientado a gente de letras para modelar:

- conceptos
- definiciones
- relaciones
- jerarquias
- conjuntos
- referencias a documentos
- referencias a fragmentos

La idea no es reemplazar Markdown.

La idea es agregar una capa semantica formal que viva junto a Markdown y que luego alimente:

- hover semantico
- explorador de conceptos
- busqueda por concepto
- agrupacion de resultados
- fragmentos relacionados

## Que problema resuelve

Hoy la app ya tiene:

- Markdown util
- links internos
- wiki links
- apertura de documentos
- conversion de varios formatos a Markdown

Pero no tiene una estructura formal para decir:

- que es un concepto
- que contiene otro concepto
- que obra depende de que autor
- que nota pertenece a que conjunto teorico

Si intentamos agregar esas cosas solo con UI, menus y reglas sueltas, el sistema se vuelve fragil.

Por eso vale la pena bajar de nivel y crear un interprete.

## Como deberia verse el lenguaje

Tiene que ser:

- legible por humanos
- mas cercano a un cuaderno teorico que a JSON
- formal lo suficiente para ser parseado

Ejemplo inicial:

```st
concepto Memoria {
  define: """
  La memoria colectiva articula experiencia, archivo y reconstruccion social.
  """

  contiene: [Recuerdo, Archivo, Testimonio]
  relacionado: [Violencia, HistoriaOral]
  ver: [[autores/halbwachs.md]], [[seminario/memoria-politica.md]]
}

autor Halbwachs {
  define: "Socio logo clave para memoria colectiva."
  obra: [MemoriaColectiva]
}

obra MemoriaColectiva {
  autor: Halbwachs
  ano: 1950
  conceptos: [Memoria, Sociedad]
}

conjunto SeminarioMemoria = [Memoria, Archivo, Testimonio]
```

## Integracion con el codigo actual

Puntos del codigo donde esto se integraria de verdad:

- `src/services/dashboardDocUtils.ts`
  Ahi hoy se reconoce Markdown por extension. Hay que aceptar `.md.st` como documento de texto semantico.

- `src/components/MosaicEditor.tsx`
  Hoy el editor esta construido alrededor de MDXEditor y preview Markdown. `.md.st` no debe entrar como si fuera Markdown enriquecido normal.

- `src/components/Editor.tsx`
  Puede seguir reutilizandose, pero deberia detectar si el documento es `.md.st` y cargar un modo/editor distinto.

- `src/app/api/documents/[id]/stream/route.ts`
  El stream actual de documentos sirve para sincronizar contenido. Eso es reutilizable para el lenguaje nuevo.

- `src/app/api/documents/convert/route.ts`
  No debe convertir `.md.st`. Este lenguaje se crea y edita como fuente propia.

## Propuesta de arquitectura

### Fase 1: parser y AST

Construir:

- lexer
- parser
- AST
- errores de sintaxis claros

Salida esperada:

- `SemanticDocument`
- `SemanticNode`
- `SemanticRelation`
- `SemanticReference`

### Fase 2: resolvedor de referencias

Tomar los nodos del AST y resolver:

- referencias a otros conceptos
- referencias a documentos
- referencias a fragmentos

Esto debe apoyarse en la logica de apertura interna que hoy ya existe en `MosaicEditor.tsx`.

### Fase 3: indice semantico

Guardar una forma compilada del `.md.st` para consultas rapidas:

- mapa de simbolos
- grafo de relaciones
- referencias documento -> concepto
- concepto -> documento

### Fase 4: vista semantica

Primero no intentaria hacer un editor WYSIWYG semantico.

Primero haria:

- editor textual
- panel de errores
- preview semantico
- inspector del concepto seleccionado

## Que hay que hacer exactamente

1. Definir sintaxis estable minima.
2. Crear parser puro en TypeScript.
3. Definir AST versionado.
4. Crear resolvedor de nombres.
5. Definir formato de errores entendible.
6. Integrar deteccion de `.md.st` en docs.
7. Crear modo visual propio para estos archivos.
8. Crear una representacion compilada para busqueda y hover.

## Problemas graves

### Problema 1: meter `.md.st` dentro de MDXEditor

Eso seria un error.

Por que:

- MDXEditor esta pensado para Markdown/MDX
- el lenguaje nuevo tendra semantica propia
- tratar de doblar el editor actual para esto va a generar bugs raros

Solucion:

- usar un editor textual dedicado para `.md.st`
- mantener el preview semantico en un panel aparte

### Problema 2: sintaxis demasiado tecnica

Si parece un lenguaje de programacion clasico, la gente de letras no lo va a querer usar.

Solucion:

- palabras clave legibles
- bloques claros
- ejemplos academicos
- errores con lenguaje humano

### Problema 3: referencias rotas

Si el lenguaje permite referir archivos y conceptos y luego esos nombres cambian, se rompe todo.

Solucion:

- separar nombre visible de identificador interno
- compilar con tabla de simbolos
- ofrecer rename seguro despues

### Problema 4: crecer sin modelo comun

Si cada funcion nueva reinterpreta el lenguaje a su manera, el sistema se desordena.

Solucion:

- parser unico
- AST unico
- resolvedor unico
- motor semantico comun

## Solucion tecnica recomendada

Crear un modulo nuevo, por ejemplo:

- `src/lib/semantic/lexer.ts`
- `src/lib/semantic/parser.ts`
- `src/lib/semantic/ast.ts`
- `src/lib/semantic/resolver.ts`
- `src/lib/semantic/types.ts`

No mezclar esta logica dentro de `MosaicEditor.tsx`.

## Tiempo realista

- V1 parser + AST + errores: 1 a 2 semanas
- V1 editor + preview semantico: 1 semana
- V1 referencias a documentos: 3 a 5 dias

Para una version realmente util:

- 3 a 4 semanas de trabajo serio

## Criterio de exito

La idea funciona si una persona puede:

1. crear un `.md.st`
2. definir conceptos y relaciones
3. ver errores claros
4. navegar desde esos conceptos a documentos reales
5. reutilizar esa informacion en hover, busqueda y exploracion

