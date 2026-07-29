# CPTP Scoring — Referencia Maestra

**Versión:** 0.0.1
**Última actualización:** 2026-07-28
**Documentos relacionados:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECHNICAL.md](./TECHNICAL.md)
**Proyecto:** [cptp-scoring](../) · [ECC (`G:\.22 LR\ECC`)](../../ECC/)

---

## 1. ¿Qué es CPTP Scoring?

CPTP Scoring es una **aplicación web progresiva (PWA) offline-first** para gestionar y puntuar competencias de tiro de precisión del **Club Paraguayo de Tiro de Precisión (CPTP)**. Corre completamente en el navegador, se instala como una app nativa en el celular o tablet, y funciona **sin internet** porque los polígonos de tiro no tienen conectividad confiable.

Tres modalidades:

| Modalidad | Calibre | Disparos por serie | Series por evento | Máximo por serie |
|---|---|---|---|---|
| Long Range | .22 LR | 10 | 2 | 67 pts |
| Fuego Central | .308 | 12 | 1 | 96 pts (con bonus) |
| Fuego Central | .223 | 12 | 1 | 96 pts (con bonus) |

---

## 2. El Club Paraguayo de Tiro de Precisión

CPTP es un club de tiro deportivo en Paraguay que organiza competencias regulares de precisión a larga distancia. La modalidad principal es **.22 LR Long Range**, donde los tiradores disparan a blancos progresivos de 15, 10 y 5 pulgadas desde distancias que pueden superar los 200 metros.

La identidad visual de la app refleja al club:
- **Rojo #e31c25 / #b7201c** y **azul #0056b3** — los colores de la bandera paraguaya
- Logos del CPTP y Long Range como watermarks al 4% de opacidad en las planillas
- Tipografía Orbitron (títulos tácticos), Rajdhani (texto general), JetBrains Mono (números)

Dos familias de tiradores reales tienen reglas codificadas en el sistema de sorteo:
- **Ángel Domínguez** y **Facundo Domínguez**: nunca en la misma tanda, Facundo siempre antes
- Varios tiradores comparten **rifles** (Rifle A, B, C, D, E) y no pueden estar en tandas simultáneas

---

## 3. Cómo se Puntúa — Las Reglas de Negocio

### 3.1. La mecánica de arrastre (drag mechanic)

El sistema de puntuación no es suma libre. Cada blanco tiene una **escalera de valores que decrece con cada disparo**. Si fallás un blanco, no perdés puntos directamente, pero el siguiente blanco se atrasa un disparo y su valor máximo posible se reduce.

**Ejemplo — serie perfecta (67 pts):**

| Disparo | Blanco | Impacto | Puntos |
|---|---|---|---|
| 1 | 15" | O | 10 |
| 2 | 10" | O | 20 |
| 3 | 5" | O | 30 |
| 4–10 | Adicionales | O | 7 × 1 = 7 |
| **Total** | | | **67** |

**Ejemplo — fallo en el primer disparo (59 pts):**

| Disparo | Blanco | Impacto | Puntos |
|---|---|---|---|
| 1 | 15" | X | 0 |
| 2 | 15" | O | 9 |
| 3 | 10" | O | 18 |
| 4 | 5" | O | 26 |
| 5–10 | Adicionales | O | 6 × 1 = 6 |
| **Total** | | | **59** |

El segundo disparo acertó 15", pero como es el segundo intento, la tabla ya bajó de 10 a 9. Eso arrastró todo: el 10" empezó desde el disparo 3 (máx 18 en vez de 20), el 5" desde el disparo 4 (máx 26 en vez de 30), y solo quedaron 6 adicionales en vez de 7.

### 3.2. Tablas de puntuación (.22 LR)

```typescript
'15"': [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]   // shotNumber - 1 = índice
'10"': [20, 18, 16, 14, 12, 10, 8, 6, 4]  // shotNumber - 2 = índice
'5"':  [30, 26, 23, 20, 16, 13, 11, 7]    // shotNumber - 3 = índice
```

### 3.3. Bonus de Fuego Central (.308 / .223)

Si el primer disparo impacta en la **zona bonus** del blanco Grande, todos los adicionales (disparos 4–12) valen **2 pts en vez de 1**.

Máximos:
- **Con bonus: 96 pts** (12 + 24 + 42 + 9 × 2)
- **Sin bonus: 87 pts** (12 + 24 + 42 + 9 × 1)

### 3.4. Notación oficial

| Símbolo | Significado |
|---|---|
| **O** | Tiro correcto (acierto) |
| **X** | Tiro errado (fallo) |

> "EN LA LINEA DE TIRO ES OBLIGATORIO EL USO DE LENTES Y TAPA OIDO. LA SEGURIDAD ES UN HABITO, PRACTIQUELA !" — reglamento oficial del CPTP

---

## 4. Arquitectura del Sistema

### 4.1. Stack completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Astro 7 SSG Shell                           │
│   src/pages/index.astro  +  src/layouts/BaseLayout.astro            │
│   (single HTML document; all view containers pre-rendered/hidden)   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ hydrates client-side JS
┌───────────────────────────────▼───────────────────────────────────────┐
│                    Router & Entry Point (app.ts)                     │
│   hash routing · auth bootstrap · auto-sync timers · MutationObserver│
└───────────────────────────────┬───────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                  Views (vanilla DOM, src/lib/views/)                  │
│  DashboardView · NewEventView · LoginView · ChampionshipView          │
│  EventDetailView · SeriesScoringView                                  │
└───────┬───────────────┬───────────────┬───────────────┬──────────────┘
        │               │               │               │
┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐ ┌───────▼───────────┐
│ Business      │ │ Ops modules  │ │ Print /     │ │ Auth & RBAC        │
│ Logic:        │ │ eventsManager│ │ Export:      │ │ authManager.ts     │
│ scoring.ts    │ │ heatsRules  │ │ print.ts    │ │ (Supabase Auth)    │
│ scoringCF.ts  │ │ heatsReorder│ │ printModal  │ │                    │
│ modalityConf. │ │ tiebreaker   │ │ excel.ts    │ │                    │
│               │ │ masterComp.  │ │             │ │                    │
└───────┬───────┘ └──────┬───────┘ └─────┬──────┘ └───────┬────────────┘
        │                │                │                 │
┌───────▼────────────────▼────────────────▼─────────────────▼──────────┐
│                         Data Layer                                    │
│  ┌────────────────────────┐        ┌────────────────────────────────┐ │
│  │   Dexie (IndexedDB)     │◄──────►│         Supabase                │ │
│  │   db.ts — local, always│  sync  │   (PostgreSQL + Auth)            │ │
│  │   available offline    │  .ts   │   cloud source of truth          │ │
│  └────────────────────────┘        └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2. Dependencias actuales (`package.json`)

| Paquete | Versión | Rol |
|---|---|---|
| `astro` | ^7.1.1 | SSG + shell de página única |
| `typescript` | ^7.0.2 | Tipado estático |
| `dexie` | ^4.4.4 | IndexedDB (BD local, offline-first) |
| `@supabase/supabase-js` | ^2.110.7 | Nube (PostgreSQL + Auth + RBAC) |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.3 | CSS utility |
| `daisyui` | ^5.6.18 | Componentes UI |
| `html2canvas` | ^1.4.1 | Captura DOM → canvas |
| `workbox-window` | ^7.4.1 | Service Worker |

Node >=22.12.0 requerido.

### 4.3. Rutas (hash-based SPA)

| Vista | Hash | Contenedor |
|---|---|---|
| Dashboard | `#/` | `#view-dashboard` |
| Nuevo Evento | `#/new` | `#view-new-event` |
| Login | `#/login` | `#view-login` |
| Detalle de Evento | `#/event/{id}` | `#view-event` |
| Scoring (Serie) | `#/series/{id}` | `#view-series` |

### 4.4. Principios de diseño

**Offline-first:** IndexedDB es la fuente de verdad primaria. Todo el CRUD funciona sin conexión. La nube es un espejo eventualmente consistente.

**Sin framework UI:** No hay React, Vue ni Svelte. El DOM se manipula con `innerHTML`, `document.createElement`, y templates inline. Bundle mínimo, sin runtime pesado, arranque instantáneo en tablets Android viejas.

**UUIDs deterministas:** Los IDs autoincrementales de Dexie se mapean a UUIDs reversibles para Supabase sin tabla de traducción:
```
00000000-0000-4000-{namespace}-{id padded to 12}
namespaces: 0=events, 1=participants, 2=series, 3=masterCompetitors
```

**Soft delete (`is_deleted`):** No hay borrados físicos. El flag `is_deleted` se sincera como cualquier otro campo, eliminando condiciones de carrera en sync bidireccional offline/online.

---

## 5. Modelo de Datos

### 5.1. Tablas IndexedDB (4 tablas, 8 migraciones)

#### `events` (ShootingEvent)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number?` | PK auto-increment |
| `name` | `string` | Nombre del evento |
| `date` | `string` | ISO "YYYY-MM-DD" |
| `location` | `string?` | Ubicación |
| `modality` | `'.22 LR' \| '.308' \| '.223'?` | Por defecto .22 LR |
| `championshipDate` | `string?` | "1ª Fecha", "Final", etc. |
| `createdAt` | `number` | Timestamp UNIX |
| `isPilot` | `boolean?` | Si es true, no cuenta para campeonato |
| `is_deleted` | `boolean?` | Soft delete |
| *Índices* | | `++id, date, modality, createdAt` |

#### `participants` (Participant)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number?` | PK auto-increment |
| `eventId` | `number` | FK → events.id |
| `name` | `string` | Nombre del tirador |
| `competitorNumber` | `number` | 1–32, correlativo |
| `sector` | `'A' \| 'B'?` | Sector para sorteo |
| `spot` | `1\|2\|3\|4?` | Mesa para Serie 1 |
| `tanda` | `number?` | Tanda para Serie 1 |
| `tandaS2` | `number?` | Tanda para Serie 2 |
| `spotS2` | `1\|2\|3\|4?` | Mesa para Serie 2 |
| `category` | `string?` | Senior, Damas, Junior, Promocional, General |
| `tieRank` | `number?` | Posición manual para desempate |
| `status` | `'active'\|'dq'\|'dns'?` | Estado del competidor |
| `paymentStatus` | `'paid'\|'pending'\|'exempt'?` | Estado de pago |
| `presentForRaffle` | `boolean?` | Presente para sorteo de rifle |
| `sharedRifleId` | `string?` | 'Rifle A', 'Rifle B', etc. |
| `is_deleted` | `boolean?` | Soft delete |
| *Índices* | | `++id, eventId, competitorNumber, status, paymentStatus` |

#### `series` (Series)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number?` | PK auto-increment |
| `eventId` | `number` | FK → events.id |
| `participantId` | `number` | FK → participants.id |
| `seriesNumber` | `number` | 1 o 2 (.22 LR), 1 (CF) |
| `shots` | `Shot[]` | Array embebido |
| `totalScore` | `number` | Suma calculada |
| `bonusActive` | `boolean?` | Solo CF: bonus activo |
| `createdAt` | `number` | Timestamp |
| `is_deleted` | `boolean?` | Soft delete |
| *Índices* | | `++id, eventId, participantId, seriesNumber` |

#### `masterCompetitors` (Padrón Maestro)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number?` | PK auto-increment |
| `name` | `string` | Nombre normalizado |
| `category` | `string?` | Categoría del tirador |
| `phone` | `string?` | Teléfono |
| `championshipTieRank` | `number?` | Posición táctica para desempate anual |
| `createdAt` | `number` | Timestamp |
| `is_deleted` | `boolean?` | Soft delete |
| *Índices* | | `++id, name, championshipTieRank, createdAt` |

#### `Shot` (embebido en Series)

```typescript
interface Shot {
  shotNumber: number;   // 1-10 (.22 LR) o 1-12 (.308/.223)
  targetType: AnyTargetType;  // '15"' | '10"' | '5"' | 'grande' | 'mediano' | 'pequeño' | 'additional'
  hit: boolean;         // true = O, false = X
  value: number;        // Puntos obtenidos (calculado automáticamente)
}
```

### 5.2. Migraciones (v2 → v8)

| Versión | Cambio |
|---|---|
| **v2** | Schema base: events + series |
| **v3** | Upgrade hook: resetea shots/totalScore en series existentes |
| **v4** | Multi-participante: tabla `participants`, migra datos legacy de un solo tirador |
| **v5** | `masterCompetitors` + status/payment en participants |
| **v6** | Elimina UNIQUE de `masterCompetitors.name` (dedup vía app) |
| **v7** | `championshipTieRank` en masterCompetitors |
| **v8** | Modalidad + índice `modality` en events, migra existentes a `.22 LR` |

### 5.3. Esquema Supabase (PostgreSQL)

La migración SQL para multi-modalidad agrega:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS modality text DEFAULT '.22 LR';
ALTER TABLE series ADD COLUMN IF NOT EXISTS bonus_active boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pilot boolean DEFAULT false;
UPDATE events SET modality = '.22 LR' WHERE modality IS NULL;
```

---

## 6. Módulo por Módulo — Qué hace cada archivo

### 6.1. Núcleo (`src/lib/`)

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `types.ts` | 67 | Interfaces de todo el sistema |
| `db.ts` | 94 | Schema Dexie, 8 versiones de migración |
| `supabase.ts` | — | Cliente Supabase desde env vars |
| `router.ts` | — | Hash router: `navigate()`, `getRoute()`, `showView()` |
| `app.ts` | 119 | Entry point, routing, auth, auto-sync, MutationObserver |
| `modals.ts` | — | `esc()`, `showToast()`, `showConfirm()`, `showPrompt()`, edit participant |
| `authManager.ts` | 90 | Auth Supabase + RBAC: admin/staff/spectator |

### 6.2. Motores de puntuación

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `scoring.ts` | 172 | Motor .22 LR: 10 disparos, 3 blancos, arrastre, máximo 67 pts |
| `scoringCentralFire.ts` | 175 | Motor .308/.223: 12 disparos, bonus, máximo 96/87 pts |
| `modalityConfig.ts` | 151 | Config central: blancos, puntajes, reglas por modalidad |

Tres funciones clave en cada motor:
1. **`calculateShotValue()`** — calcula el valor de un disparo según número y fase
2. **`deriveCurrentPhase()`** — determina qué blanco se está intentando según el historial
3. **`getMaxPossibleRemaining()` / `getCostOfMiss()`** — feedback en vivo de cuánto se pierde al fallar

### 6.3. Gestión de operaciones

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `eventsManager.ts` | 166 | CRUD eventos, filtros, ordenamiento, paginación, edición |
| `heatsManager.ts` | — | Barrel (re-export) |
| `heatsRules.ts` | 400 | Reglas Domínguez (S1+S2) + rifle compartido |
| `heatsReorder.ts` | 350 | Modal reorden manual + reset sorteo |
| `championship.ts` | 175 | Campeonato General Anual: Base Firme (Top 2) + Total Actual (Top 3) |
| `masterCompetitors.ts` | — | CRUD Padrón Maestro, migración automática, dedup |
| `tiebreaker.ts` | — | Desempates manuales |
| `backup.ts` | — | Export/Import JSON de eventos completos |
| `seeder.ts` | — | Población masiva de datos de prueba + simulación de puntuaciones |

### 6.4. Sincronización

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `sync.ts` | 272 | Push (local → nube) y Pull (nube → local) con UUIDs deterministas |

Push: lee todos los registros no-eliminados de Dexie, los mapea a UUIDs, hace `upsert` en Supabase.

Pull: descarga todo de Supabase, convierte UUIDs a IDs numéricos, hace `put()` (upsert) en Dexie. **No borra datos locales.**

Auto-pull para espectadores cada 30 segundos.

### 6.5. Impresión y exportación

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `print.ts` | — | Barrel (re-export). Ver módulos abajo |
| `printModal.ts` | 112 | Modal iframe para impresión (compartido LR + CF) |
| `printScoreSheet.ts` | 558 | Planillas .22 LR A4 landscape (2 series lado a lado) |
| `printRankingCard.ts` | 300 | Tarjeta de posiciones A4 vertical |
| `printCF.ts` | 421 | Planillas Fuego Central (1 serie, columna bonus) |
| `printChampionship.ts` | — | Impresión + CSV del Campeonato General |
| `excel.ts` | — | Export CSV con BOM UTF-8 |

Todas las planillas se renderizan en un **iframe dentro de un modal** para mantener estilos aislados.

### 6.6. Vistas (`src/lib/views/`)

| Archivo | Responsabilidad |
|---|---|
| `DashboardView.ts` | Lista de eventos con filtros (año, modalidad, búsqueda), paginación, botonera |
| `NewEventView.ts` | Formulario de creación de evento |
| `LoginView.ts` | Formulario de login Supabase |
| `ChampionshipView.ts` | Tabla del Campeonato General con selector año/modalidad |
| `event/EventDetailView.ts` | Orquestador: carga datos, renderiza shell con 3 tabs |
| `event/EventRosterView.ts` | Tab Tiradores: inscripción, sorteo, cuadro de tandas |
| `event/EventSeriesView.ts` | Tab Series: lista de series por tirador |
| `event/EventStandingsView.ts` | Tab Posiciones: ranking, premios |
| `scoring/SeriesScoringView.ts` | Puntuación disparo por disparo con feedback visual |

---

## 7. El Sistema de Sorteo (Heats)

### 7.1. Reglas de la Familia Domínguez

Codificadas en `heatsRules.ts` + `heatsReorder.ts`:

1. **Ángel Domínguez** y **Facundo Domínguez** NUNCA en la misma tanda
2. **Facundo** debe tirar SIEMPRE en tanda ANTERIOR (menor número) que **Ángel**
3. Solo aplican tandas 2, 3, 4 para ellos
4. Si coinciden, se reasigna automáticamente intercambiando con otro competidor

### 7.2. Rifle Compartido

Tiradores con el mismo `sharedRifleId` (Rifle A, B, C, D, E) no pueden estar en la misma tanda. Si un sorteo los coloca juntos, `applySharedRifleRules()` los reubica automáticamente.

### 7.3. Límites

- Máximo **4 tiradores por tanda** (.22 LR)
- Máximo **8 tandas** por evento
- Para Fuego Central: 1 tirador por tanda, hasta 50 turnos

---

## 8. Campeonato General Anual

### 8.1. Algoritmo (`championship.ts`)

1. Filtra eventos del año y modalidad seleccionados (excluye `isPilot`)
2. Agrupa participantes por **nombre normalizado** (sin acentos, minúsculas) a través de todos los eventos
3. Por cada tirador y cada evento:
   - Si no está inscrito: 0 pts, status `dns`
   - Si está `dq`: 0 pts, status `dq`
   - Si está `active`: suma del `totalScore` de todas sus series en ese evento
4. Ordena los puntajes de mayor a menor
5. Calcula marcadores:
   - **Base Firme** (verde) = suma del Top 2
   - **Total Actual** (azul) = suma del Top 3
   - **En Riesgo** (amarillo) = el 3er puntaje si hay 4+ eventos
   - **Descarte** (tachado) = puntajes más allá del Top 3

### 8.2. Ordenamiento del ranking

1. Por el criterio seleccionado (Total Actual o Base Firme)
2. Por el otro criterio
3. Por `championshipTieRank` manual (del Padrón Maestro)
4. Alfabético por nombre

---

## 9. Autenticación y Roles (RBAC)

Implementado en `authManager.ts` con Supabase Auth + tabla `user_roles` en Postgres.

| Rol | Acceso | Color badge | CSS class |
|---|---|---|---|
| **admin** | Control total: crear/eliminar eventos, padrón, todo | Rojo #b7201c | `.admin-only` |
| **staff** | Puntuación en vivo, inscripciones, sorteo, subida a nube | Azul #0056b3 | `.staff-only` |
| **spectator** | Solo lectura. Auto-pull desde la nube cada 30s | — | oculto por defecto |

Un `MutationObserver` en `#app-root` re-aplica las reglas de visibilidad cada vez que el DOM cambia dinámicamente (tras renderizar un modal, por ejemplo). Esto no es seguridad a nivel servidor — es una capa de UI. La seguridad real está en las políticas RLS de Supabase.

---

## 10. PWA y Funcionamiento Offline

### 10.1. Service Worker

`public/sw.js` — registrado desde `BaseLayout.astro` con `navigator.serviceWorker.register('/sw.js')`.

Estrategia de caché: **Cache-first** para assets estáticos. El nombre de caché (`cptp-scoring-cache-v<timestamp>`) se reescribe en cada build por `scripts/inject-sw-cache.js`, forzando la actualización de la PWA instalada.

### 10.2. Manifest (`public/manifest.json`)

- `display: standalone` — se ve como app nativa
- `orientation: portrait`
- Iconos 192×192, 512×512, maskable-512×512, SVG
- Meta tags iOS (`apple-mobile-web-app-capable`, etc.)

### 10.3. Indicador offline

Un `#offline-indicator` en la navbar parpadea cuando `navigator.onLine === false`. Se oculta automáticamente al recuperar conexión.

---

## 11. Flujo Completo de la App

```
USUARIO ABRE LA APP
  │
  ├── app.ts: checkAuth() → determina rol (admin/staff/spectator)
  │   └── silent pull desde Supabase si events local está vacío
  │
  ├── DASHBOARD (#/)
  │   ├── Pestaña "Mis Eventos"
  │   │   ├── Lista con filtros (año, modalidad, búsqueda, orden)
  │   │   ├── Botón "Nuevo Evento" (solo admin)
  │   │   ├── Botón "Padrón Maestro" (solo admin)
  │   │   ├── Botones Exportar/Importar backup JSON
  │   │   ├── Botón "Sincronizar con Nube"
  │   │   └── Paginación (6 eventos por página)
  │   │
  │   └── Pestaña "Campeonato General"
  │       ├── Selector de año y modalidad
  │       ├── Tabla: Tirador | E1 | E2 | E3 | E4 | Base Firme | Total Actual
  │       ├── Exportar CSV
  │       └── Imprimir planilla
  │
  ├── NUEVO EVENTO (#/new)
  │   ├── Nombre, fecha, ubicación
  │   ├── Modalidad (.22 LR / .308 / .223)
  │   └── Fecha de campeonato (ej: "1ª Fecha")
  │
  ├── DETALLE DE EVENTO (#/event/{id})
  │   ├── Pestaña "Tiradores"
  │   │   ├── Agregar competidores (desde Padrón Maestro o nuevo)
  │   │   ├── Asignar categoría, pago, estado
  │   │   ├── Sortear tandas (automático con reglas Domínguez + rifle)
  │   │   ├── Reordenar manualmente tandas/mesas
  │   │   ├── Cargar participantes desde backup JSON
  │   │   └── Simular datos de prueba (seeder)
  │   │
  │   ├── Pestaña "Series"
  │   │   └── Botones por competidor para acceder al scoring
  │   │
  │   └── Pestaña "Posiciones"
  │       ├── Ranking del evento con puntajes totales
  │       ├── Desempates manuales
  │       ├── Imprimir planillas (individual, todas, ranking, blank)
  │       └── Exportar CSV
  │
  └── SCORING (#/series/{id})
      ├── Barra de progreso (10 pips .22 LR / 12 pips CF)
      ├── Indicador de fase actual (15"→10"→5"→adicional)
      ├── Botonera HIT (verde) / MISS (rojo)
      ├── Valor del próximo disparo si acierta
      ├── "Costo de fallar" y "Máximo posible restante"
      ├── Historial de disparos
      ├── Total en vivo
      └── Botón imprimir planilla individual
```

---

## 12. Historias de Desarrollo

### 12.1. Refactorización del monolito

La app comenzó como un solo `app.ts`. Se extrajeron módulos en etapas, documentadas por los scripts Python en la raíz:

| Script | Acción |
|---|---|
| `refactor.py` | Extrajo `modals.ts` (toast, confirm, prompt) |
| `refactor2.py` | Extrajo `router.ts` (navegación hash) |
| `refactor_all.py` | Extrajo `excel.ts` + `seeder.ts` simultáneamente |
| `refactor_brace.py` | Usó parser de llaves (brace counting) en vez de regex para manejar funciones anidadas |
| `refactor_final.py` | Extrajo handlers de seed/población de `EventDetailView.ts` a `seeder.ts` |
| `refactor_seeder.py` | Refinó la extracción de seed handlers |
| `refactor_seeder2.py` | Ajustes finales de seed |
| `fix.py` | Cambió texto de botón "Sorteo (X/32)" → "Sorteo y Puestos (X/32)" |

### 12.2. Implementación de Fuego Central (.308 / .223)

La característica de multi-modalidad se implementó mediante parches secuenciales:

| Parche | Archivo | Cambio |
|---|---|---|
| `patch.js` (226 líneas) | `print.ts` | Agregó soporte CF a planillas imprimibles: tablas condicionales, totales dinámicos (/67 vs /96) |
| `patch2.cjs` (50 líneas) | `print.ts` | Columna vacía para CF en lugar de duplicar la primera |
| `patch5.cjs` (43 líneas) | `print.ts` | Div dummy para mantener layout |
| `patch_print.py` (256 líneas) | `print.ts` | Versión Python completa del parche CF |
| `fix_heats.cjs` (236 líneas) | `heatsReorder.ts` | Modal de reorden para CF: lista secuencial plana con flechas |
| `patch_active_tab.py` (43 líneas) | `EventDetailView.ts` | Sistema de tabs activos |
| `patch_event_buttons.py` (30 líneas) | `EventDetailView.ts` | Clase staff-only a botones de acción |
| `patch_series_buttons.py` (12 líneas) | `SeriesScoringView.ts` | staff-only a botones de nueva/serie |

### 12.3. Datos reales

El archivo `cptp_backup_3ra__fecha_long_range__2_20260725.json` contiene un evento real:
- **Evento:** "3ra Fecha Long Range .22 LR" — 25 de julio de 2026
- **Ubicación:** Polígono Long Range — CPTP
- **~32 competidores** con tandas, mesas, estados, pagos
- **Versión corregida** (`_fixed.json`): eliminó a Wilmar Cabral (dns), renumeró consecutivamente

---

## 13. Diseño UI/UX

### 13.1. Paleta de colores (tema "cptp-dark")

| Token | Color | Uso |
|---|---|---|
| Primary | `#e31c25` | Rojo CPTP |
| Secondary | `#0056b3` | Azul Paraguay |
| Base-100 | `#f8fafc` | Fondo claro |
| Base-300 | `#ffffff` | Tarjetas |
| Success | `#22c55e` | Verde aciertos (O) |
| Error | `#e31c25` | Rojo fallos (X) |
| Warning | `#eab308` | Amarillo en riesgo |

### 13.2. Tipografía

| Fuente | Peso | Uso |
|---|---|---|
| **Orbitron** | 900, 700 | Títulos tácticos, badges |
| **Rajdhani** | 400–700 | Texto general, navbar |
| **JetBrains Mono** | 400, 700 | Puntajes, datos numéricos |

### 13.3. Modo oscuro

Diseñado para uso en exteriores con sol. La UI completa tiene variante oscura.

### 13.4. Watermarks

Logos CPTP (izquierda) y Long Range (derecha) con 4% de opacidad en planillas — no interfieren con la escritura a mano.

---

## 14. Cómo se Construye y Despliega

```bash
# Desarrollo
npm run dev           # astro dev

# Build producción
npm run build         # astro build && node scripts/inject-sw-cache.js

# Preview del build
npm run preview       # astro preview
```

Variables de entorno requeridas (`.env`):
```
PUBLIC_SUPABASE_URL=https://lfhxwamctujvgszmdjap.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

Si faltan, la app funciona en modo offline-only sin errores — `supabase.ts` usa valores dummy y loguea un warning.

---

## 15. Infraestructura Cloud

**Supabase** alojado en `lfhxwamctujvgszmdjap.supabase.co`.

Tablas en Postgres:
- `events` — UUID PK (determinista), snake_case
- `participants` — UUID PK
- `series` — UUID PK
- `master_competitors` — UUID PK
- `user_roles` — user_id → role (admin/staff)

Todas las tablas llevan `is_deleted boolean` para soft-delete sincronizado.

---

## 16. El Taller: ECC (Everything Claude Code)

ECC en `G:\.22 LR\ECC` versión **2.0.0** — el sistema de herramientas que usaste para construir CPTP Scoring.

### 16.1. Qué es ECC

Es un **plugin de Claude Code** que proporciona 67 agentes especializados, 278 skills, 94 comandos y hooks automatizados. Creado por [Affaan Mustafa](https://x.com/affaan). 211.9K+ estrellas en GitHub, 230+ contribuyentes, compatible con Claude Code, Cursor, Codex, OpenCode, Gemini, Zed, GitHub Copilot.

### 16.2. Agentes que usaste en CPTP

| Agente | Para qué te sirvió en este proyecto |
|---|---|
| **planner** | Planificar la implementación del Campeonato General |
| **code-reviewer** | Revisar calidad de cada módulo nuevo |
| **build-error-resolver** | Arreglar errores de TypeScript al refactorizar |
| **tdd-guide** | Guiar el desarrollo con tests primero |
| **database-reviewer** | Diseñar el schema Dexie y las migraciones |
| **typescript-reviewer** | Revisar el código TypeScript de los módulos |
| **python-reviewer** | Revisar los scripts de refactorización en Python |
| **refactor-cleaner** | Extraer módulos del monolito app.ts de forma segura |
| **security-reviewer** | Validar auth, sanitización de inputs, sync seguro |
| **architect** | Decisiones de arquitectura offline-first |

### 16.3. Skills que aplicaste

Skills (workflows reutilizables) que usaste directa o indirectamente:

- `backend-patterns` — patrones de API, DB, caching
- `api-design` — diseño de la interfaz de datos
- `database-migrations` — las 8 migraciones de Dexie
- `verification-loop` — build, test, lint, typecheck
- `error-handling` — manejo de errores en toda la app
- `search-first` — investigación antes de codificar
- `coding-standards` — estándares de código consistentes
- `git-workflow` — commits y PRs estructurados
- `security-review` — checklist de seguridad pre-commit

---

## Apéndice A: Árbol de archivos completo

```
cptp-scoring/
├── docs/
│   ├── ARCHITECTURE.md          ← 309 líneas — Arquitectura y diseño
│   ├── TECHNICAL.md             ← 230 líneas — Referencia técnica
│   └── MASTER-REFERENCE.md      ← Este documento
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── favicon.svg / favicon.ico
│   ├── logo-cptp.svg
│   ├── logo-long-range.svg
│   ├── flag-paraguay.svg
│   ├── 22lr.svg / modalidad.svg
│   └── pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png
├── scripts/
│   ├── inject-sw-cache.js
│   ├── generate-icons.mjs
│   └── migration_multimodality.sql
├── scratch/
│   ├── patch.js (226)
│   ├── patch2.cjs (50)
│   ├── patch5.cjs (43)
│   ├── fix_heats.cjs (236)
│   ├── patch_active_tab.py (43)
│   ├── patch_event_buttons.py (30)
│   ├── patch_series_buttons.py (12)
│   └── patch_print.py (256)
├── src/
│   ├── layouts/BaseLayout.astro
│   ├── pages/index.astro
│   ├── styles/global.css (832)
│   └── lib/
│       ├── app.ts (119)
│       ├── router.ts
│       ├── db.ts (94)
│       ├── types.ts (67)
│       ├── supabase.ts
│       ├── authManager.ts (90)
│       ├── sync.ts (272)
│       ├── scoring.ts (172)
│       ├── scoringCentralFire.ts (175)
│       ├── modalityConfig.ts (151)
│       ├── championship.ts (175)
│       ├── eventsManager.ts (166)
│       ├── heatsManager.ts (barrel)
│       ├── heatsRules.ts
│       ├── heatsReorder.ts
│       ├── masterCompetitors.ts
│       ├── tiebreaker.ts
│       ├── backup.ts
│       ├── print.ts
│       ├── printModal.ts
│       ├── printScoreSheet.ts
│       ├── printRankingCard.ts
│       ├── printCF.ts
│       ├── printChampionship.ts
│       ├── excel.ts
│       ├── seeder.ts
│       ├── modals.ts
│       └── views/
│           ├── DashboardView.ts
│           ├── NewEventView.ts
│           ├── LoginView.ts
│           ├── ChampionshipView.ts
│           ├── event/
│           │   ├── EventDetailView.ts
│           │   ├── EventRosterView.ts
│           │   ├── EventSeriesView.ts
│           │   └── EventStandingsView.ts
│           └── scoring/SeriesScoringView.ts
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── .env
├── AGENTS.md
├── CLAUDE.md
├── *.py  (scripts de refactorización)
├── cptp_backup_*.json  (backups)
└── dist/  (build output)
```
