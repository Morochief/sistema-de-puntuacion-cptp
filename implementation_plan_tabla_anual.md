# Plan de Implementación: Tabla de Campeonato General Anual

Este plan detalla el diseño y la estrategia técnica para implementar el módulo de **Campeonato General Anual** en la aplicación CPTP Scoring. Este módulo consolida las puntuaciones de los tiradores a lo largo de los eventos del año y calcula el puntaje final del campeonato tomando únicamente los mejores 3 puntajes de cada tirador.

---

## User Review Required

> [!IMPORTANT]
> **Estructura de Agrupamiento por Año y Eventos**: 
> Se propone detectar automáticamente los eventos del año en curso usando el campo `date` (ej. "2026-XX-XX"). Si hay más de 4 eventos en el año, tomaremos los 4 más recientes o los primeros 4 cronológicamente del año para la tabla de columnas. Se recomienda ordenar los 4 eventos cronológicamente (E1, E2, E3, E4) de izquierda a derecha.
> 
> **Identificación de Tiradores (Padrón Maestro)**:
> Para consolidar las puntuaciones entre diferentes eventos, cruzaremos los nombres exactos de los tiradores. Es fundamental que los nombres en el padrón maestro coincidan con los ingresados en los eventos individuales (gracias a la migración automática y autocompletado esto ya está garantizado).

---

## Propuestas de Cambios

### 1. Ubicación en la Interfaz (Dashboard Principal)

Para evitar saturar el módulo de un evento individual, propondremos agregar el **Campeonato General** en la pantalla de inicio (Dashboard), agregando un sistema de pestañas similar al del detalle del evento:
- **Pestaña 1: Mis Eventos** (Listado actual de eventos, creación, importación y exportación de base de datos).
- **Pestaña 2: Campeonato General** (Tabla acumulada anual, selección de año, visualización de los 4 eventos y exportación a Excel / Impresión).

---

### 2. Algoritmo de Puntuación del Campeonato

Por cada tirador en el Padrón Maestro:
1. Buscar sus registros de participación en los eventos del año seleccionado.
2. Si participó, su puntuación para ese evento es la suma de los puntajes de sus series registradas en dicho evento.
3. Si el competidor fue marcado como `dq` (Descalificado) en el evento, su puntuación para el cálculo de ese evento es `0` y se mostrará como `DQ` en la casilla.
4. Si fue marcado como `dns` (No se presentó) o no estuvo inscrito en el evento, se mostrará como `-` o `DNS` y se computará como `0`.
5. Se analizan los puntajes de los 4 eventos:
   - Se ordenan de mayor a menor.
   - Se seleccionan los **3 puntajes más altos** (los mejores 3).
   - Estos 3 eventos seleccionados se marcan visualmente con un fondo destacado (verde suave o azul claro).
   - El peor puntaje (o el evento no participado sobrante) se marca atenuado (gris).
   - Se calcula el **Total Acumulado** sumando los 3 puntajes seleccionados.
6. El ranking general se ordena de mayor a menor según el Total Acumulado. En caso de empate en el total acumulado, se mostrarán empatados o se podrá ordenar alfabéticamente por nombre.

---

### 3. Modificaciones en Archivos

#### [NEW] [championship.ts](file:///g:/.22%20LR/cptp-scoring/src/lib/championship.ts)
Crear un nuevo módulo que implemente la lógica de negocio y el renderizado del Campeonato General:
- `getChampionshipData(year: number)`: Obtiene los eventos del año, calcula los totales acumulados por tirador aplicando la regla de descarte del peor puntaje, y retorna los tiradores ordenados con la indicación de qué celdas de eventos fueron seleccionadas.
- `renderChampionshipPanel(container: HTMLElement)`: Dibuja la tabla general, el selector de año y los botones de acción.
- `exportChampionshipToExcel()`: Exporta la tabla general del campeonato a formato Excel (.xlsx).
- `printChampionshipCard()`: Abre la vista previa en formato de planilla de impresión para el campeonato general.

#### [MODIFY] [app.ts](file:///g:/.22%20LR/cptp-scoring/src/lib/app.ts)
- Modificar `renderDashboard()` para introducir las pestañas en el Dashboard principal.
- Integrar la llamada a `renderChampionshipPanel` al cambiar a la pestaña de "Campeonato General".

#### [MODIFY] [global.css](file:///g:/.22%20LR/cptp-scoring/src/styles/global.css)
- Agregar reglas CSS para las celdas tomadas y descartadas en la tabla del campeonato general (ej. `.cell-taken` con fondo verde claro/azul suave, `.cell-discarded` atenuado).

---

## Plan de Verificación

### Pruebas Manuales
- **Inscripción y Simulación**: Crear 4 eventos en el mismo año, inscribir a los mismos tiradores usando el Padrón Maestro y simularles puntajes altos y bajos.
- **Verificación de Descarte**: Comprobar que en la fila de un tirador con 4 eventos participados, la celda con el puntaje más bajo quede en gris, y que la suma del total sea exactamente la suma de las otras 3 celdas de color.
- **Exportación e Impresión**: Probar la exportación a Excel y abrir la vista previa de impresión del Campeonato General en el visor responsivo.
