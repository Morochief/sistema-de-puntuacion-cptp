# Revisión y arreglos del Campeonato General (noviembre 2026)

Registro de los ciclos de trabajo (arreglar → verificar → repetir) sobre el módulo
Campeonato General. Rama: `fix/campeonato-general`.

## Cómo se verifica

| Verificación | Comando / método | Resultado final |
|---|---|---|
| Tests de lógica | `npm test` (12 tests en `tests/championship.test.mjs`) | 12/12 OK |
| Tests que detectan el bug | Se reintrodujo cada bug a propósito y se confirmó que su test falla | OK (tests 3, 11 y 12 fallan con el bug) |
| Tipos | `tsc` sobre `src/` | 0 errores en los archivos del campeonato (antes: 4 errores TS2367 en `isCFModality` / `getMaxEventScore`). Quedan 25 errores previos en otros módulos, sin relación |
| Build | `npm run build` | OK |
| Prueba en navegador | Chrome headless + `astro dev`, datos de prueba cargados en IndexedDB | OK (detalle abajo) |

## Ciclo 1: imprimir y exportar mostraban datos simulados

- **Problema:** con el simulador abierto, Imprimir y Exportar recibían las filas simuladas: la "planilla oficial" salía con totales y posiciones que incluían el puntaje ficticio, sin la columna E+.
- **Cambio:** `ChampionshipView.ts` pasa siempre `sortChampionshipRanking(rankings, ...)` (datos reales) a impresión y CSV.
- **Verificación:** en el navegador, con el simulador activo (Ana +134), la vista previa de impresión muestra a Beto 1° con 295 y a Ana 2° con 205, que son los valores reales.

## Ciclo 2: simulador en .308, .223 y 21 Blackjack

- **Problema:** `isCFModality` comparaba con 'Gran Calibre', una modalidad que ya no existe, así que nunca daba verdadero. Los botones 87/96 no aparecían y el botón decía "134 pts" en todas las modalidades.
- **Cambio:** `isCentralFireModality()` (.308 / .223). `getMaxEventScore()` lee los máximos de `modalityConfig` (.22 LR 134, .308/.223 96 o 87 sin bonus, Blackjack 147). El botón muestra el máximo real.
- **Verificación:** test 11. En el navegador, en .308 aparecen "Max 87" y "Max 96", el slider llega hasta 96 y "Max 87" deja 87 pts.

## Ciclo 3: etiquetas de DQ/DNS, simulador y "En Riesgo"

- **Problema A:** un 0 por DQ o DNS entraba en el ranking de mejores puntajes y podía quedar marcado como "Base Firme" o "Top 3".
- **Problema B:** el simulador solo recalculaba las celdas activas, así que las DQ/DNS conservaban etiquetas viejas (podía haber 3 "Base Firme"). Además modificaba los objetos originales, porque la copia era superficial.
- **Problema C:** la regla de "En Riesgo" había cambiado dos veces y el código decía lo contrario que el comentario. **Kevin decidió: "mientras falten fechas".**
- **Cambio:** una sola función `applyPlacements()` en `championshipCore.ts`, que usan tanto el cálculo como el simulador. Solo los puntajes activos reciben etiquetas, el simulador trabaja sobre copias, y el 3er puntaje queda "En Riesgo" mientras la temporada siga abierta (año seleccionado >= año actual). Las celdas DQ/DNS se muestran en rojo como "DQ"/"DNS 0 pts", también en la impresión y el CSV.
- **Verificación:** tests 3, 4 y 12. En el navegador: Ana tiene DQ en E2 y la celda dice "DQ 0 PTS" sin etiqueta. Al simularla, su 95 pasa a "En Riesgo" y quedan solo 2 "Base Firme".

## Ciclo 4: inconsistencias

| Tema | Antes | Ahora | Test |
|---|---|---|---|
| Modalidad del evento | El campeonato usaba `modality \|\| '.22 LR'`; Analytics deducía .308/.223 del nombre | Una sola regla, `resolveEventModality()`, compartida con Analytics | 7 |
| Series duplicadas por sincronización | Se sumaban dos veces | Se cuenta una por `seriesNumber` (gana la más reciente) | 5 |
| Nombres con espacios dobles | Quedaban como dos tiradores distintos | Se unifican | 6 |
| Categoría | Primer registro encontrado, en orden arbitrario | Inscripción más reciente distinta de "General", y si no hay, la del Padrón | 9 |
| Selector de año | Solo los últimos 3 años | El año actual más todos los años con eventos | navegador |
| IDs del DOM con el nombre | Fallaban con `&` o comillas (el slider no actualizaba el texto) | Se ubican con `data-sim-card` | navegador |
| CSV | Un nombre que empieza con `=` podía ejecutarse como fórmula en Excel | Se le antepone `'` | — |
| Código muerto | `calculatePodiumRequirements` se calculaba y no se mostraba | Eliminado | — |
| Docs | No mencionaban Top Gun y describían la regla vieja de En Riesgo | Actualizados TECHNICAL, MASTER-REFERENCE, ARCHITECTURE y SKILL | — |

## Bug extra encontrado al probar (fuera del módulo)

- `masterCompetitors.ts`: `migrateParticipantsToPadron()` usaba la variable inexistente `nameTrimmed`. Después del primer tirador agregado tiraba `ReferenceError` y la migración al Padrón se cortaba (agregaba uno por cada arranque de la app). Se cambió por `normalized`. En el navegador ya no aparece el error.

## Estructura final

- `championship.ts`: solo lee Dexie y llama al core. Agrega `getChampionshipYears()`.
- `championshipCore.ts` (nuevo): lógica pura, sin base de datos ni DOM, testeable.
- `championshipSimulator.ts`: simulación sobre copias + máximos por modalidad.
- `tests/championship.test.mjs` + script `npm test`.

## Pendiente / no incluido

- Empates exactos: siguen recibiendo posiciones distintas (desempate alfabético). Habría que definir si deben compartir posición.
- `EventStandingsView` (posiciones de cada evento) también suma todas las series sin filtrar duplicados. No se tocó porque está fuera del módulo.
