# Idea 05: favoritos o fijados arriba del sidebar

## Objetivo

Agregar una zona de acceso rapido arriba del sidebar para documentos importantes.

Esto no necesita teorizarse demasiado.
Es una mejora pequena, clara y de alto valor diario.

## Que problema resuelve

Hoy la app obliga a navegar repetidamente por:

- carpetas
- busquedas
- tabs

Para usuarios no tecnicos, eso desgasta.

Un area de favoritos reduce mucha friccion.

## Integracion con el codigo actual

Puntos utiles:

- `src/components/dashboard/Sidebar.tsx`
  Es el lugar natural donde debe aparecer.

- `src/components/FileExplorer.tsx`
  Ya tiene acciones de doc y podria disparar "fijar" desde su menu contextual.

- `src/services/dashboardPersistence.ts`
  Puede servir para persistencia local por workspace si se quiere una primera version rapida.

## Que hay que hacer exactamente

1. Definir si favoritos son:
   - locales por usuario
   - persistidos en Firestore
   - o ambos

2. Mostrar bloque de favoritos arriba del sidebar.
3. Agregar accion "Fijar/Quitar de favoritos".
4. Permitir abrir rapido desde ahi.

## Problemas graves

### Problema 1: persistencia mal pensada

Si queda solo local, el usuario puede sentir que se pierde entre dispositivos.

Solucion:

- V1 local por velocidad
- V2 persistida por usuario/workspace

### Problema 2: demasiados favoritos

Si todo puede fijarse sin limite, deja de servir.

Solucion:

- top visible corto
- opcion de ordenar
- maximo recomendado para la zona superior

### Problema 3: mezcla rara con tabs

Favoritos no deben competir con tabs abiertos.

Solucion:

- tabs = trabajo actual
- favoritos = acceso rapido estable

## Solucion tecnica recomendada

V1 barata:

- persistencia local por workspace y usuario
- UI simple arriba del sidebar
- accion contextual en explorador

V2:

- campo persistido en backend o documento auxiliar

## Tiempo realista

- V1 completa: 1 a 2 dias
- V2 persistida: 2 a 3 dias extra

## Criterio de exito

La idea funciona si el usuario entra y puede abrir en un clic sus 3 a 8 materiales de trabajo real sin navegar.

