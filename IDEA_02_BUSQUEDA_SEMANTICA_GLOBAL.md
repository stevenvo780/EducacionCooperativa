# Idea 02: busqueda semantica global

## Objetivo

Crear una busqueda global que no dependa solo de coincidencia exacta por nombre o texto.

Debe encontrar por:

- concepto
- tema
- idea cercana
- autor
- obra
- relacion semantica

## Que problema resuelve

Hoy la busqueda rapida actual:

- vive en `src/components/dashboard/QuickSearchModal.tsx`
- recibe `DocItem[]`
- en `src/app/dashboard/page.tsx` filtra por `d.name.toLowerCase().includes(query)`

Eso sirve para abrir archivos por nombre.
No sirve para pensar ni para investigar.

Para humanidades eso se queda corto.

## Dependencia clave

Esta idea depende de `IDEA_01_LENGUAJE_MD_ST.md`.

Sin el motor semantico, la busqueda solo podria ser:

- full text
- por nombre
- por snippets de texto

Con el motor semantico puede ser mucho mejor.

## Integracion con el codigo actual

Puntos que hay que cambiar:

- `src/components/dashboard/QuickSearchModal.tsx`
  Hoy el modal asume que todo resultado es un `DocItem`.

- `src/app/dashboard/page.tsx`
  Hoy `quickSearchResults` solo hace filtro simple por nombre.

- `src/store/dashboardSlice.ts`
  Puede seguir guardando query e indice, pero el modelo de resultado debe crecer.

## Que hay que construir

### 1. Nuevo tipo de resultado

En vez de solo `DocItem`, hace falta un union type como:

- `document`
- `concept`
- `fragment`
- `author`
- `work`

Cada uno con su preview y accion de apertura.

### 2. Nuevo endpoint o servicio de busqueda

No deberia vivir dentro del filtro del cliente.

Hace falta algo tipo:

- `/api/search/semantic`

Con:

- query
- workspace
- filtros
- limite

### 3. Ranking

Debe mezclar:

- coincidencia literal
- coincidencia por concepto
- coincidencia por relacion
- coincidencia por fuente

## Que hay que hacer exactamente

1. Definir modelo `SearchResultItem`.
2. Separar busqueda de nombre de la busqueda semantica.
3. Crear un servicio de indexacion.
4. Crear endpoint de consulta.
5. Redisenar `QuickSearchModal` para resultados mixtos.
6. Agregar previews por tipo de resultado.

## Problemas graves

### Problema 1: intentar mantener todo en cliente

Con un workspace grande eso no escala.

Solucion:

- indice compilado
- consulta central
- resultados paginados o limitados

### Problema 2: resultados irrelevantes

Una busqueda semantica mala molesta mas que ayuda.

Solucion:

- ranking simple primero
- no intentar IA magica desde el dia uno
- usar mezcla de exacto + semantico + relaciones

### Problema 3: UI pensada solo para archivos

El modal actual esta pensado para abrir docs.

Solucion:

- separar tipo de resultado
- render por tipo
- accion por tipo

### Problema 4: ambiguedad entre conceptos y documentos

Buscar "Memoria" podria devolver:

- concepto
- nota
- PDF
- fragmento

Solucion:

- agrupar por tipo
- mostrar etiqueta visual
- permitir filtros

## Solucion tecnica recomendada

Agregar:

- `src/lib/search/types.ts`
- `src/lib/search/rank.ts`
- `src/app/api/search/semantic/route.ts`

Y luego cambiar:

- `QuickSearchModal`
- `dashboard/page.tsx`

## Tiempo realista

- V1 de backend + modelo de resultados: 4 a 6 dias
- V1 de UI: 2 a 3 dias
- Afinar ranking: 3 a 5 dias

Bloqueada hasta tener al menos una V1 del motor `.md.st`.

## Criterio de exito

La idea funciona si una persona puede escribir:

- "memoria"
- "archivo colonial"
- "Halbwachs"
- "testimonio"

y obtener:

- documentos
- conceptos
- fragmentos
- relaciones utiles

sin saber donde estaba guardado exactamente.

