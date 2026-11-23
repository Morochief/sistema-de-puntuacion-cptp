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

## Ciclo 5: nueva impresión y Top 6 premiados (pedido del cliente)

- **Pedido:** sacar la leyenda "Planilla oficial del campeonato - Sujeta a fiscalización del Club CPTP". Imprimir con el mismo formato que se ve en el módulo, indicando el calibre y con los logos. Poder exportar las 6 primeras posiciones, que son las que reciben premio.
- **Cambio:**
  - `printChampionshipPreview` se reescribió con los mismos colores y etiquetas que la tabla del módulo (Base Firme, En Riesgo, Top 3, Descarte, DQ/DNS, medallas 1-2-3 y Top 6 resaltado). El encabezado lleva los logos CPTP y Long Range, la modalidad (por ejemplo ".22 LR — Long Range") y el año. Ya no tiene pie ni la leyenda de fiscalización.
  - Botones nuevos en el módulo: **🏆 Top 6 Premiados** (vista de impresión con las 6 primeras posiciones y botón **Descargar imagen** en PNG) y **Exportar Top 6** (CSV).
  - `printModal.ts` agrega un botón opcional "Descargar imagen". Usa html2canvas con `foreignObjectRendering`, porque el render normal desplazaba el texto, y antes rasteriza los logos SVG, porque si no salían en blanco.
- **Ciclos de verificación en el navegador (Chrome headless, 8 tiradores y 4 fechas):**
  1. Primera versión: la vista de impresión se veía bien, pero en el PNG faltaban los logos y el texto salía corrido. Corregí los logos rasterizándolos.
  2. El texto seguía corrido. Cambié a `foreignObjectRendering` y el PNG quedó bien.
  3. Con fuentes web (Rajdhani) el PNG cortaba los textos porque no incluye las fuentes. Volví a las fuentes del sistema y agregué `nowrap`. Resultado correcto.
  4. Final: la vista Top 6 muestra 6 filas y no tiene la leyenda de fiscalización. Los dos logos cargan, el PNG `Campeonato_22LR_2026_Top6.png` se descarga bien y el CSV `Campeonato_22LR_2026_Top6.csv` trae el título con el calibre más 6 filas. La impresión completa tampoco tiene la leyenda. El PDF generado conserva los colores. No hubo errores en la consola.
- **Build y tests:** `npm run build` OK, `npm test` 12/12.

## Ciclo 6: ordenar a mano los empates (pedido de Kevin: en .308 el que iba primero quedó segundo)

- **Diagnóstico:** el desempate manual existía en el código (`championshipTieRank` en el Padrón Maestro, usado como 3er criterio de orden), pero **no había ninguna pantalla para cargarlo**. Ni el Padrón ni el módulo permitían editarlo, así que todos quedaban en 999 y los empates exactos se resolvían por orden alfabético. No era algo propio de .308: pasaba en todas las modalidades.
- **Cambio:**
  - `championshipCore.ts`: `detectChampionshipTies()` y `isChampionshipTie()` detectan los grupos empatados en todos los totales (con el criterio elegido, el otro total y Top 2 cuando se ordena por Top Gun) y con puntaje mayor a 0.
  - Nuevo `championshipTieBreaker.ts`: modal **Resolver Empates** con ▲ ▼, igual al de los eventos. Al guardar asigna 1, 2, 3… a cada tirador del grupo en **todos** sus registros del Padrón con ese nombre (si no tiene registro, lo crea). El orden se sube a la nube con el sync normal (columna `championship_tie_rank` existente, sin cambios en la base).
  - `ChampionshipView.ts`: botón **⚖️ Resolver Empates (n)** (solo staff/admin, oculto con el simulador abierto) y etiqueta **EMPATE** en las filas empatadas. Como el orden se aplica en `sortChampionshipRanking`, también se respeta en la impresión, el Top 6, la imagen y el Excel.
- **Verificación:**
  - Tests nuevos 13 y 14: detectar empates, que el orden manual decida y que se lea del Padrón. Resultado: `npm test` 14/14.
  - Navegador, con un empate en .308 (Abel y Zoe con 170 en todos los totales): antes Abel salía 2° por orden alfabético. Después de Resolver Empates, Zoe queda 2° y Abel 3°. El orden se guarda en el Padrón (Zoe 1, Abel 2), se mantiene al recargar y se respeta en el Top 6 impreso y en el Excel. El botón queda oculto para espectadores y no hubo errores en la consola.
  - `npm run build` OK.
- **Límite conocido:** el número de desempate se guarda por tirador, no por año ni modalidad. Solo se usa cuando dos tiradores empatan en **todos** los totales, así que un conflicto entre modalidades exige que la misma pareja empate exacto en las dos (muy raro). Si pasa, alcanza con volver a usar Resolver Empates.

## Ciclo 7: regla del descarte y reordenar cualquier empate de Top 3

- **Pedido de Kevin:** a igual Top 3 queda arriba el que tiene **mayor puntaje de descarte**, no el de mejor Top 2. Caso real en .223: Francisco "Pancho" Cardozo tenía que quedar 3° y Sebastián Ayala 4°. Además, tiene que poder reordenar a mano a cualquiera que tenga el mismo Top 3, aunque el Top 2 sea distinto.
- **Cambio en el orden oficial (Top 3):** Top 3 → orden manual de "Resolver Empates" (si hay uno cargado para ese Top 3) → **mayor descarte** (se compara el mejor descarte, después el siguiente, y quien no tiene descarte va abajo) → alfabético. El Top 2 ya no desempata. En las vistas Top 2 y Top Gun se mantiene el orden automático por totales.
- **Resolver Empates:** ahora agrupa a todos los que tienen el mismo Top 3. Muestra el descarte de cada uno y el orden sugerido es el de la regla.
- **Orden manual por empate:** se guarda en el Padrón como `Top3 × 100 + posición` (por ejemplo 25601). Así solo vale para ese empate: si el Top 3 del tirador cambia en otra fecha, otro año u otra modalidad, el orden manual deja de aplicarse solo y vuelve a regir el descarte. Los valores cargados con el formato anterior (1, 2…) se ignoran y hay que volver a cargarlos. No hace falta tocar la base de datos.
- **Verificación:**
  - Tests nuevos: regla del descarte con el caso Cardozo/Ayala (y con nombres invertidos, para que no dependa del alfabeto), comparación de varios descartes, agrupación por Top 3, que el orden manual mande, que un orden viejo se ignore y que se lea del Padrón. `npm test` 26/26. Al quitar la regla a propósito, fallan los tests 13 y 14.
  - Navegador, con el caso .223 (Ayala 96/90/70/60 y Cardozo 90/86/80/75, ambos con 256): queda Cardozo 3° y Ayala 4° por descarte (75 contra 60). El modal muestra "Descarte: 75 / 60" y, si se cambia el orden a mano, Ayala pasa a 3° y se guarda en el Padrón (25601/25602). En la vista Top 2 no aparece el botón. La impresión Top 6 respeta el orden y lleva la leyenda "Empate en Top 3: queda arriba el mayor descarte". No hubo errores en la consola.
  - `npm run build` OK.

## Estructura final

- `championship.ts`: solo lee Dexie y llama al core. Agrega `getChampionshipYears()`.
- `championshipCore.ts` (nuevo): lógica pura, sin base de datos ni DOM, testeable.
- `championshipSimulator.ts`: simulación sobre copias + máximos por modalidad.
- `tests/championship.test.mjs` + script `npm test`.

## Pendiente / no incluido

- Empates exactos: siguen recibiendo posiciones distintas (desempate alfabético). Habría que definir si deben compartir posición.
- `EventStandingsView` (posiciones de cada evento) también suma todas las series sin filtrar duplicados. No se tocó porque está fuera del módulo.
