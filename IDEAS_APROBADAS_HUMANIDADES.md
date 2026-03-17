# Ideas aprobadas y refinadas

Documento base con las ideas que si quedaron vivas despues de filtrar lo que ya existe y revisar el codigo actual.

## Lo que ya existe y no conviene repetir

Estas ideas no se vuelven a proponer como eje central porque ya estan resueltas o bastante cubiertas:

- Enlaces y redirecciones internas en Markdown.
- Wiki links y apertura de documentos relacionados.
- Menu contextual basico en explorador de archivos.
- Modos de visualizacion del editor.
- Copias de documentos.
- Plantillas y combinaciones de acciones.
- Kanban base ya funcional.

## Lo que si falta de verdad

### 1. Busqueda semantica global

Una barra global que busque en todo el workspace por:

- tema
- idea
- autor
- obra
- concepto
- fragmento parecido

No solo por coincidencia exacta.

Por que si falta:

- hoy la app ya navega bien documentos y links, pero sigue faltando una forma potente de encontrar conocimiento por sentido y no por texto literal
- para humanidades esto vale mucho mas que agregar mas botones

Que deberia cubrir:

- notas `.md`
- documentos convertidos
- OCR
- transcripciones
- citas o fragmentos guardados
- contenido relacionado aunque no use la misma palabra exacta

### 2. Sistema contextual unificado de click derecho y long press

No como detalle visual aislado, sino como sistema de interaccion transversal.

Debe funcionar en:

- sidebar
- tabs
- resultados de busqueda
- tablero
- relaciones entre documentos
- editor

Objetivo:

- menos botones fijos
- menos pasos
- mas acciones donde realmente esta el usuario

Esto no es solo "poner menu contextual".
Es convertir la app en una interfaz mas madura y natural.

### 3. Menu contextual del editor, pero no para repetir Markdown

Aqui hay que refinar la idea.

No tiene sentido que el menu contextual del editor repita simplemente:

- negrilla
- italica
- encabezados
- links

porque eso ya pertenece a la logica normal de Markdown y del editor actual.

Lo que si deberia hacer ese menu contextual es abrir acciones de trabajo intelectual sobre el texto seleccionado:

- definir concepto
- mandar a sistema semantico
- relacionar con otro concepto
- marcar como evidencia
- mandar a tarea
- mandar al tablero
- fijar como fragmento importante
- abrir acciones avanzadas

O sea:

- menos "formato"
- mas "operacion academica"

### 4. Capa semantica nueva tipo `.md.st`

Esta es la idea mas original de todas.

La propuesta no es meter mas logica suelta por toda la app, sino crear una capa interpretable para texto semantico.

Idea base:

- un archivo o bloque tipo `.md.st`
- ahi se pueden declarar conceptos, definiciones, relaciones, conjuntos, objetos, jerarquias y referencias

Ejemplos de lo que podria modelar:

- una palabra tiene definicion
- un concepto contiene otros
- un autor pertenece a una corriente
- una obra refiere otra
- un concepto se conecta con archivos o notas

Luego, desde esa capa, la app puede hacer cosas realmente escalables:

- hover con definicion
- vista de relaciones
- fragmentos relacionados
- busqueda por conceptos
- glosarios vivos
- mapas de ideas

Lo importante:

- en vez de agregar mil reglas dispersas
- se agrega un interprete nuevo
- y luego muchas funciones salen de ahi

### 5. Favoritos o fijados arriba del sidebar

Esto si es simple y util.

No como sistema enorme, sino como acceso rapido visible arriba del sidebar.

Sirve para:

- notas de trabajo frecuente
- lecturas actuales
- documentos base de una clase
- archivos importantes de un proyecto

Por que vale la pena:

- reduce mucha navegacion repetida
- para usuarios no tecnicos da sensacion de orden y control
- es barato comparado con otras ideas

### 6. Integracion fuerte entre Markdown y tablero

Esta es la otra idea claramente util.

No se trata solo de "hay tablero" y "hay markdown".
Se trata de conectar de verdad ambos mundos.

Lo que si falta:

- crear tarea desde un `.md`
- enlazar una card a un documento concreto
- ver desde una nota en que card o columna esta asociada
- enviar fragmentos o pendientes al tablero
- abrir desde el tablero la nota fuente

Esto vuelve el tablero academico y no solo administrativo.

## Como se entiende esto junto

La direccion buena no es meter mas features sueltas.

La direccion buena es:

1. Encontrar mejor lo que ya existe.
2. Actuar desde donde el usuario ya esta trabajando.
3. Crear una capa semantica escalable.
4. Unir lectura, escritura y organizacion.

## Prioridad realista

Si hubiera que ordenar por valor y viabilidad:

1. Favoritos arriba del sidebar.
2. Sistema contextual unificado de click derecho y long press.
3. Integracion fuerte Markdown <-> tablero.
4. Busqueda semantica global.
5. Capa `.md.st`.

## Nota tecnica corta

Lo que inspira esta priorizacion al mirar el codigo actual:

- el editor ya resuelve links internos y wiki links
- el explorador ya tiene menu contextual basico
- el tablero actual aun no modela relaciones ricas con documentos
- todavia no existe una capa semantica propiamente dicha

