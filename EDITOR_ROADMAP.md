# 🛠️ Roadmap de Mejoras — Editor ST

> Estado actual: editor custom basado en `<textarea>` + `<pre>` overlay con syntax highlighting,
> autocomplete dinámico, LinterOverlay con diagnósticos, y OutputViewer con 3 modos de vista.
>
> Este documento propone mejoras organizadas por **impacto × esfuerzo**, con notas de arquitectura
> para cada una.

---

## Tabla de contenidos

1. [Fase 1 — Infraestructura de editor](#fase-1--infraestructura-de-editor)
2. [Fase 2 — Inteligencia de código](#fase-2--inteligencia-de-código)
3. [Fase 3 — Experiencia visual](#fase-3--experiencia-visual)
4. [Fase 4 — Herramientas de prueba y depuración](#fase-4--herramientas-de-prueba-y-depuración)
5. [Fase 5 — Exportación y colaboración](#fase-5--exportación-y-colaboración)
6. [Fase 6 — Extensiones del lenguaje en el editor](#fase-6--extensiones-del-lenguaje-en-el-editor)
7. [Apéndice — Decisión CodeMirror vs textarea](#apéndice--decisión-codemirror-vs-textarea)

---

## Fase 1 — Infraestructura de editor

### 1.1 Migrar a CodeMirror 6 ⭐⭐⭐
**Esfuerzo**: Alto (2-3 semanas)  
**Impacto**: Desbloquea prácticamente todas las demás mejoras.

El editor actual es un `<textarea>` invisible sobre un `<pre>` que renderiza HTML con clases CSS.
Esto funciona para highlighting básico, pero tiene límites duros:

| Capacidad | textarea+pre | CodeMirror 6 |
|-----------|:---:|:---:|
| Syntax highlighting | ✓ (regex) | ✓ (Lezer grammar) |
| Code folding | ✗ | ✓ |
| Bracket matching | ✗ | ✓ |
| Multiple cursors | ✗ | ✓ |
| Hover info (tooltip en símbolo) | Muy difícil | ✓ (hoverTooltip) |
| Go-to-definition | ✗ | ✓ (con extension) |
| Minimap | ✗ | ✓ (plugin) |
| Accessible (ARIA) | Parcial | ✓ |
| Undo/redo granular | Nativo textarea | ✓ (transacciones) |
| Rendimiento +10k líneas | Lento (re-render completo) | ✓ (viewport virtual) |
| Temas | Clases CSS manuales | ✓ (theme system) |
| Extensiones de terceros | ✗ | ✓ (ecosystem) |

**Plan de migración**:

```
1. Crear grammar Lezer para ST (.grammar)
   - Operadores: ->, <->, ~, &, |, forall, exists, next, until
   - Bloques: proof ... qed, /* ... */, [[ ... ]]
   - Keywords, builtins, profiles
   
2. Crear tema oscuro (replicar colores actuales)
   - Keyword: text-violet-400
   - Builtin: text-cyan-400
   - String: text-amber-300
   - Comment: text-slate-500
   - Operator: text-rose-400
   
3. Portar autocomplete a CompletionSource
   - Reusar lógica actual: st-lang/api + regex extraction
   - Añadir snippets con placeholders
   
4. Portar linter a Diagnostic[]
   - Mapear STDiagnostic → CM Diagnostic
   
5. Añadir extensiones: bracketMatching, foldGutter, closeBrackets
6. Reemplazar STCodeEditor.tsx (652 → ~250 líneas)
```

**Alternativa ligera**: si CodeMirror es demasiado, se puede quedar con textarea pero añadir
bracket matching y code folding manualmente (esfuerzo similar por menos resultado).

---

### 1.2 Keybindings configurables
**Esfuerzo**: Bajo  
**Impacto**: Medio

Actualmente solo hay `Ctrl+S` (save), `Ctrl+Enter` (run), y Tab/Enter/Escape para autocomplete.

Propuesta:
| Atajo | Acción |
|-------|--------|
| `Ctrl+D` | Duplicar línea |
| `Ctrl+/` | Comentar/descomentar (`//`) |
| `Ctrl+Shift+/` | Comentar bloque (`/* */`) |
| `Ctrl+Space` | Forzar autocomplete |
| `Ctrl+G` | Ir a línea |
| `Alt+↑/↓` | Mover línea arriba/abajo |
| `Ctrl+Shift+K` | Eliminar línea |
| `Ctrl+[` / `Ctrl+]` | Indentar / desindentar |
| `F2` | Renombrar símbolo (axiom/theorem/let) |

Con textarea se pueden implementar ~60% interceptando `onKeyDown`. Con CodeMirror, todos son
triviales via `keymap`.

---

### 1.3 Buscar y reemplazar (`Ctrl+F` / `Ctrl+H`)
**Esfuerzo**: Medio (con textarea) / Bajo (con CM)  
**Impacto**: Alto para archivos grandes

Panel flotante tipo VS Code:
- Búsqueda por texto y regex
- Resaltado de coincidencias en el overlay
- Reemplazo individual y masivo
- `Ctrl+Shift+F` para buscar en todos los archivos ST abiertos (futuro)

---

## Fase 2 — Inteligencia de código

### 2.1 Hover info (tooltip en símbolo)
**Esfuerzo**: Medio  
**Impacto**: Alto — mejora muchísimo la experiencia de aprendizaje

Al pasar el cursor sobre un símbolo, mostrar tooltip con:

| Sobre... | Tooltip muestra |
|----------|-----------------|
| Keyword (`forall`, `exists`) | Descripción + ejemplo: `∀x.P(x) — Para todo x, P(x)` |
| Perfil (`#profile propositional`) | Operadores disponibles, sistema axiomático |
| Axioma/Teorema definido | La fórmula completa con rendering Unicode |
| Builtin (`valid`, `satisfiable`) | Qué evalúa y valor de retorno |
| Operador (`->`, `<->`) | Nombre formal, tabla de verdad mini |
| Variable `let` | La fórmula asignada |
| Alias español (`entonces`) | Equivalente formal (`->`) |

**Implementación sin CodeMirror**: calcular posición del carácter bajo el cursor via
`document.caretRangeFromPoint()`, extraer token del tokenizer, buscar info en un
`Map<string, HoverInfo>` estático + dinámico (axiomas del código).

**Con CodeMirror**: usar `hoverTooltip()` extension — mucho más limpio.

---

### 2.2 Go-to-definition / Peek definition
**Esfuerzo**: Medio  
**Impacto**: Alto para archivos con muchos axiomas/teoremas

`Ctrl+Click` o `F12` sobre un nombre de axioma/teorema/let → salta a la línea donde se definió.

Con `import "file.st"`, podría incluso saltar a otro archivo (requiere resolver el import
contra el filesystem virtual o IndexedDB).

---

### 2.3 Snippets con placeholders
**Esfuerzo**: Bajo  
**Impacto**: Medio

Expandir el autocomplete actual para incluir snippets multi-línea:

```
proof → 
  proof {
    assume |cursor|
    // ...
    show |goal|
  } qed

forall →
  forall |x| . (|body|)

import →
  import "|file.st|"

check →
  check valid |formula| under |profile|
```

Con textarea: insertar texto + posicionar cursor. Con CM: `snippet()` nativo.

---

### 2.4 Signature help (parámetros de comandos)
**Esfuerzo**: Medio  
**Impacto**: Medio

Al escribir `check `, mostrar panel inline:

```
check <valid|satisfiable|equivalent> <formula> [under <profile>]
      ^^^^^^^^^^^^^^^^^^^^^^^^^
```

Esto requiere un parser parcial del "contexto de escritura" — ya hay lógica similar en
el autocomplete.

---

### 2.5 Diagnóstico en tiempo real mejorado
**Esfuerzo**: Bajo (incremental)  
**Impacto**: Alto

El LinterOverlay ya funciona. Mejoras:

1. **Quick-fix actions**: al hacer click en un error, ofrecer correcciones automáticas:
   - `Did you mean 'forall'?` → reemplazar
   - `Missing profile` → insertar `#profile propositional`
   - `Unknown atom 'p'` después de FOL → sugerir `axiom p_def : p`
   
2. **Warning para axiomas no usados**: si un `axiom` se define pero nunca se referencia
   en `check`/`prove`/`refute`, marcar con severity `hint`.

3. **Info de complejidad**: si una fórmula tiene >15 operadores, mostrar `info`:
   "Fórmula compleja — la evaluación puede ser lenta".

---

## Fase 3 — Experiencia visual

### 3.1 Minimap
**Esfuerzo**: Alto (con textarea) / Bajo (con CM)  
**Impacto**: Medio

Barra lateral derecha con vista miniatura del código. Útil para archivos >100 líneas.
Requiere renderizado canvas o SVG. CodeMirror tiene plugins para esto.

---

### 3.2 Code folding (plegado)
**Esfuerzo**: Alto (con textarea) / Bajo (con CM)  
**Impacto**: Alto para archivos complejos

Zonas plegables:
- `proof { ... } qed`
- `/* ... */` (comentarios bloque)
- Grupos consecutivos de `axiom` (heurística: 3+ axiomas seguidos = grupo)
- `[[ ... ]]` (bloques de texto natural)

Indicador en el gutter (▶ / ▼) para cada zona plegable.

---

### 3.3 Bracket matching y auto-close
**Esfuerzo**: Bajo-Medio  
**Impacto**: Alto

| Evento | Acción |
|--------|--------|
| Cursor en `(` | Resaltar `(` y su `)` correspondiente |
| Escribir `(` | Insertar `)` automáticamente |
| Escribir `"` | Insertar `"` automáticamente |
| Escribir `/*` | Insertar ` */` |
| Escribir `proof {` | Insertar `} qed` en línea siguiente |
| Selección + `(` | Envolver selección en `( ... )` |

---

### 3.4 Indentación inteligente
**Esfuerzo**: Bajo  
**Impacto**: Medio

Al presionar Enter después de:
- `proof {` → indentar +2
- `assume ...` → mantener indentación
- `} qed` → des-indentar

Reglas simples basadas en el token anterior.

---

### 3.5 Rainbow parentheses
**Esfuerzo**: Bajo  
**Impacto**: Bajo-Medio (pero muy visual para lógica)

En lógica formal los paréntesis son ubicuos. Colorear cada nivel con un color diferente:

```
((p -> (q & r)) <-> (s | t))
^              ^    ^      ^
violeta        cyan  amber  violeta
```

---

### 3.6 Tema claro / selección de temas
**Esfuerzo**: Bajo  
**Impacto**: Medio

El editor actual es solo oscuro. Añadir:
- Tema claro (para proyectores/impresión)
- 2-3 temas oscuros alternativos
- Opcionalmente: selector de tema en el toolbar del editor

---

### 3.7 Numeración de línea mejorada + breakpoints visuales
**Esfuerzo**: Bajo  
**Impacto**: Medio

El gutter actual muestra números con línea activa. Mejoras:
- Click en el gutter → toggle breakpoint (visual: punto rojo)
- Los breakpoints se usan en el stepper de Fase 4
- Indicador de cambios no guardados (barra amarilla en gutter)
- Indicador de errores en gutter (icono ✗ en la línea con error)

---

## Fase 4 — Herramientas de prueba y depuración

### 4.1 Stepper / depurador de tableaux ⭐⭐
**Esfuerzo**: Alto  
**Impacto**: Muy alto — killer feature para educación

Panel lateral o inferior que muestra la ejecución paso a paso de un tableau:

```
┌─ Paso 1: Asumir ¬(p → q)          [Premisa]
├─ Paso 2: p                         [α-descomposición de ¬→]
├─ Paso 3: ¬q                        [α-descomposición de ¬→]
├─ Paso 4: Rama cerrada (p, ¬p)      [Contradicción ✗]
└─ Resultado: Válido ✓
```

**Controles**:
- ▶ Ejecutar completo
- ⏭ Paso siguiente
- ⏮ Paso anterior
- ⏹ Reiniciar
- Velocidad de animación (slider)

**Visualización**:
- Resaltar en el código la línea/fórmula actualmente evaluándose
- En el OutputViewer (modo gráfico), expandir nodo a nodo el árbol
- Animación suave entre pasos (framer-motion ya está disponible)

**Requiere del backend (st-lang)**:
- Modificar `tableau-engine.ts` para emitir eventos paso a paso
- Nuevo modo `evaluate({ stepByStep: true })` que devuelve `StepEvent[]`
- Cada evento: `{ step, formula, rule, branch, status }`

---

### 4.2 Visualización de árbol de tableau (gráfico)
**Esfuerzo**: Alto  
**Impacto**: Muy alto para educación

Renderizar el tableau como un árbol visual (no solo texto):

```
         ¬(p → q)
            │
         ┌──┴──┐
         p    ¬q
         │
      ┌──┴──┐
      q    ¬q
      │     ✗
      ✗
```

Opciones de rendering:
- **SVG** con `d3-hierarchy` o `elkjs` para layout automático
- **Canvas** para rendimiento con árboles grandes
- **React Flow** para interactividad (zoom, pan, click en nodos)

Cada nodo muestra:
- La fórmula (Unicode)
- La regla aplicada
- Estado (abierto ○ / cerrado ✗ / activo ●)

---

### 4.3 Tabla de verdad interactiva
**Esfuerzo**: Medio  
**Impacto**: Alto

La TruthTableView actual es estática. Mejoras:
- **Celdas clickeables**: fijar una variable y ver cómo cambia el resultado
- **Resaltado de filas**: marcar satisfacientes / falsificantes
- **Filtro**: "Mostrar solo filas donde resultado = V"
- **Exportar**: copiar como Markdown / LaTeX / CSV

---

### 4.4 Playground de fórmulas (REPL inline)
**Esfuerzo**: Medio  
**Impacto**: Alto

Panel en la parte inferior del editor donde se pueden escribir expresiones sueltas
y ver el resultado inmediatamente (como un REPL):

```
> valid p -> p
✓ Válido (tautología)

> satisfiable p & ~p
✗ Insatisfacible (contradicción)

> render forall x . (P(x) -> Q(x))
∀x.(P(x) → Q(x))
```

No requiere archivo — evaluación instantánea. Útil para experimentar sin ensuciar el código.

---

## Fase 5 — Exportación y colaboración

### 5.1 Exportar a LaTeX
**Esfuerzo**: Medio  
**Impacto**: Alto para academia

Generar documento LaTeX completo a partir de un archivo `.st`:

```latex
\documentclass{article}
\usepackage{amsmath, amssymb, bussproofs}
\begin{document}

\section*{Axiomas}
\begin{enumerate}
  \item $p \to (q \to p)$ \hfill (ax1)
  \item $\forall x.\, P(x) \to Q(x)$ \hfill (universal\_impl)
\end{enumerate}

\section*{Verificaciones}
\begin{itemize}
  \item $p \to p$ es \textbf{válida} (tautología).
\end{itemize}

\end{document}
```

`st-lang` ya tiene `formulaToLaTeX()` — solo falta el wrapper del documento.

---

### 5.2 Exportar a PDF
**Esfuerzo**: Medio (vía LaTeX o vía html2canvas)  
**Impacto**: Alto

Dos estrategias:
1. **Vía LaTeX**: generar .tex → compilar con API de Overleaf o servidor LaTeX
2. **Vía HTML**: capturar el OutputViewer (modo gráfico) con `html2canvas` o `@react-pdf/renderer`

La segunda es más simple y funciona client-side.

---

### 5.3 Compartir como link (permalink)
**Esfuerzo**: Medio  
**Impacto**: Muy alto para educación

Codificar el contenido del editor en un URL comprimido (como el TypeScript Playground):

```
https://app.example.com/st#code=eNpVkM...
```

Usa `lz-string` para comprimir → base64 → URL fragment.

**Alternativa server-side**: guardar en Firebase con ID corto → `app/st/abc123`.

---

### 5.4 Modo presentación
**Esfuerzo**: Medio  
**Impacto**: Medio-Alto para docentes

Pantalla completa con:
- Fuente grande (configurable)
- Solo código + resultado (sin chrome del dashboard)
- Navegación por "slides" (cada `// ---` separa una slide)
- Animación de ejecución paso a paso
- Puntero láser virtual

Ideal para clase en proyector.

---

### 5.5 Colaboración en tiempo real
**Esfuerzo**: Muy alto  
**Impacto**: Alto

Integración con **Yjs** o **Liveblocks** para edición colaborativa:
- Cursores de otros usuarios visibles
- Sincronización de cambios en tiempo real
- Comentarios inline en el código

> ⚠️ Solo viable después de migrar a CodeMirror (tiene binding nativo con Yjs via `y-codemirror.next`).

---

## Fase 6 — Extensiones del lenguaje en el editor

### 6.1 Vista de modelos Kripke interactiva
**Esfuerzo**: Alto  
**Impacto**: Alto para lógica modal/epistémica

Renderizar los modelos Kripke como grafos interactivos:
- Nodos = mundos
- Aristas = relaciones de accesibilidad
- Click en un mundo → ver su valuación
- Drag para reorganizar
- Zoom y pan

Usar **React Flow** o **vis-network**.

La ModelView actual muestra mundos en lista — esto la convierte en un grafo navegable.

---

### 6.2 Countermodel explorer
**Esfuerzo**: Medio  
**Impacto**: Alto

Cuando un `check valid` da `invalid`, el motor ya devuelve un contramodelo.
Mejora: panel interactivo donde el estudiante puede:
- Ver el contramodelo gráficamente
- Modificar valuaciones manualmente
- Ver en tiempo real cómo cambia la evaluación
- "¿Por qué esta fórmula es inválida?" → explicación paso a paso

---

### 6.3 Fallacy highlighter en el código
**Esfuerzo**: Bajo  
**Impacto**: Medio

El comando `detect_fallacy` ya existe. Integrarlo visualmente:
- Si se detecta una falacia, subrayar la línea en naranja
- Tooltip: nombre de la falacia + explicación
- Quick-fix: "¿Quisiste decir...?" con la forma correcta

---

### 6.4 Ejercicios guiados (modo tutorial)
**Esfuerzo**: Alto  
**Impacto**: Muy alto para educación

Framework para definir ejercicios:

```st
// @exercise "Demuestra que p → p es una tautología"
// @hint "Usa check valid"
// @solution check valid p -> p under propositional

// Escribe tu solución aquí:

```

El editor:
- Muestra el enunciado en un banner superior
- Ofrece hints progresivos
- Valida la respuesta automáticamente
- Tracking de progreso

---

### 6.5 Diff viewer para refactoring
**Esfuerzo**: Medio  
**Impacto**: Bajo-Medio

Al hacer un rename (`F2`) o al aplicar un quick-fix, mostrar un diff antes/después
para que el usuario confirme el cambio.

---

## Apéndice — Decisión CodeMirror vs textarea

### Mantener textarea si:
- El editor siempre será <500 líneas
- No se necesitan hover/goto/folding
- El equipo no tiene experiencia con CM6
- Se priorizan otras features (exportación, colaboración)

### Migrar a CodeMirror si:
- Se quiere hover info, go-to-def, folding, minimap
- Se planea colaboración (Yjs binding)
- Se quiere rendimiento con archivos grandes
- Se quiere reducir código custom (652 → ~250 líneas)

### Alternativa intermedia:
- Mantener textarea para v1
- Usar CodeMirror solo para el "editor avanzado" (toggle en settings)
- Migrar gradualmente

---

## Priorización sugerida

| # | Mejora | Impacto | Esfuerzo | Prioridad |
|---|--------|---------|----------|-----------|
| 1 | Stepper/depurador de tableaux (4.1) | ⭐⭐⭐ | Alto | P0 — killer feature |
| 2 | Hover info (2.1) | ⭐⭐⭐ | Medio | P0 — usabilidad |
| 3 | Quick-fix en diagnósticos (2.5) | ⭐⭐ | Bajo | P1 — bajo costo, alto valor |
| 4 | Snippets (2.3) | ⭐⭐ | Bajo | P1 — bajo costo |
| 5 | Bracket matching (3.3) | ⭐⭐ | Bajo | P1 — esperado en cualquier editor |
| 6 | Exportar LaTeX (5.1) | ⭐⭐ | Medio | P1 — valor académico |
| 7 | Keybindings (1.2) | ⭐⭐ | Bajo | P1 |
| 8 | Permalink / compartir (5.3) | ⭐⭐⭐ | Medio | P1 — viral para educación |
| 9 | REPL inline (4.4) | ⭐⭐ | Medio | P2 |
| 10 | Árbol de tableau visual (4.2) | ⭐⭐⭐ | Alto | P2 — después del stepper |
| 11 | Code folding (3.2) | ⭐⭐ | Medio | P2 |
| 12 | Buscar/reemplazar (1.3) | ⭐⭐ | Medio | P2 |
| 13 | Tabla verdad interactiva (4.3) | ⭐⭐ | Medio | P2 |
| 14 | Kripke visual (6.1) | ⭐⭐ | Alto | P2 |
| 15 | Migración CodeMirror (1.1) | ⭐⭐⭐ | Alto | P2 — habilita P3 |
| 16 | Modo presentación (5.4) | ⭐⭐ | Medio | P3 |
| 17 | Ejercicios guiados (6.4) | ⭐⭐⭐ | Alto | P3 — requiere diseño pedagógico |
| 18 | Exportar PDF (5.2) | ⭐ | Medio | P3 |
| 19 | Tema claro (3.6) | ⭐ | Bajo | P3 |
| 20 | Colaboración real-time (5.5) | ⭐⭐ | Muy alto | P4 — requiere CM + Yjs |
| 21 | Countermodel explorer (6.2) | ⭐⭐ | Medio | P3 |
| 22 | Rainbow parentheses (3.5) | ⭐ | Bajo | P4 — cosmético |

---

*Última actualización: Junio 2025*  
*Contexto: ST v1.1 · 214 tests · EducacionCooperativa (Next.js)*
