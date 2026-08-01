---
name: cptp-scoring
description: >
  Referencia COMPLETA y ABSOLUTA del sistema de puntuacion CPTP (Club Paraguayo de Tiro - Long Range).
  Usala SIEMPRE que trabajes con el proyecto cptp-scoring. Cubre arquitectura, reglas de negocio,
  scoring, modalidades, sorteo, sincronizacion, RBAC, impresion, PWA y mas.
---

# CPTP Scoring System — Referencia Maestra para IA

## Ruta del proyecto
`G:\.22 LR\cptp-scoring`

## Stack Tecnologico
| Componente | Version | Proposito |
|---|---|---|
| Astro | ^7.1.1 | SSG + shell SPA |
| TypeScript | ^7.0.2 | Tipado estatico |
| Dexie.js | ^4.4.4 | IndexedDB (offline-first, 4 tablas, 8 migraciones) |
| @supabase/supabase-js | ^2.110.7 | PostgreSQL cloud + Auth + RBAC |
| Tailwind CSS | ^4.3.3 | CSS utility |
| DaisyUI | ^5.6.18 | Componentes UI |
| html2canvas | ^1.4.1 | Captura DOM a canvas |
| workbox-window | ^7.4.1 | Service Worker |
| Node | >=22.12.0 | Motor |

---

## REGLA OBLIGATORIA: Documentacion + Commit + Push
Cada vez que modifiques codigo (feature, bugfix, refactor, schema, dependencias, comportamiento),
DEBES seguir este ciclo COMPLETO sin saltarte ningun paso:

### Paso 1: Codigo
- Hacer el cambio necesario

### Paso 2: Build
```bash
cd "G:\.22 LR\cptp-scoring"
npm run build
```

### Paso 3: Documentacion
Actualizar **TODOS** los archivos que apliquen:

| Archivo | Cuando actualizar |
|---|---|
| **`.agents/skills/cptp-scoring/SKILL.md`** | **SIEMPRE** — esta skill debe reflejar el estado actual del proyecto |
| `docs/ARCHITECTURE.md` | Modulos nuevos, flujo de datos nuevo, patrones arquitectonicos |
| `docs/TECHNICAL.md` | Comportamiento de modulos, reglas de scoring, schema DB, deps, build |
| `docs/MASTER-REFERENCE.md` | Reglas de negocio, modalidades nuevas, features significativas |

### Paso 4: Commit y Push (OBLIGATORIO)
```bash
cd "G:\.22 LR\cptp-scoring"
git add <archivos modificados>
git commit -m "tipo(scope): descripcion"
git push
```

Sin excepcion. No dejar cambios sin commitear ni pushear.

---

## Flujo de Trabajo Obligatorio

```
cd "G:\.22 LR\cptp-scoring"
npm run build                    # build + inject-sw-cache.js automatico
git add <archivos>
git commit -m "tipo(scope): desc"
git push
```

**Service Worker:** El SW cachea todos los assets. inject-sw-cache.js cambia la version de cache en cada build. El usuario debe hacer Ctrl+Shift+R tras deploy para forzar actualizacion del SW.

---

## Arquitectura de Modulos

```
src/
├── pages/index.astro              # Unica pagina (SPA)
├── layouts/BaseLayout.astro       # PWA meta, navbar, offline indicator
├── styles/global.css              # ~832 lineas de diseno tactico CPTP
└── lib/
    ├── app.ts                     # Entry point: router + auth + sync timers + MutationObserver
    ├── router.ts                  # Hash routing (#/event/123, #/series/456)
    ├── db.ts                      # Dexie schema (8 versiones de migracion)
    ├── types.ts                   # Interfaces TS: Shot, Participant, Series, ShootingEvent, etc.
    ├── supabase.ts                # Cliente Supabase
    ├── authManager.ts             # RBAC: admin/staff/spectator + updateUIRoles()
    ├── sync.ts                    # Push/Pull cloud + UUIDs deterministas
    ├── scoring.ts                 # Motor .22 LR (10 tiros, 67 max)
    ├── scoringCentralFire.ts      # Motor CF .308/.223 (12 tiros, bonus, 96 max)
    ├── modalityConfig.ts          # Config central por modalidad
    ├── championship.ts            # Campeonato General Anual (Base Firme + Total Actual)
    ├── eventsManager.ts           # CRUD eventos + filtros + paginacion
    ├── heatsManager.ts            # Barrel de re-export (compatibilidad)
    ├── heatsRules.ts              # Reglas Dominguez + rifle compartido
    ├── heatsReorder.ts            # Modal reorden manual + reset sorteo
    ├── masterCompetitors.ts       # Padron Maestro CRUD + migracion + dedup
    ├── tiebreaker.ts              # Desempates manuales
    ├── backup.ts                  # Export/Import JSON
    ├── print.ts                   # Barrel de re-export (compatibilidad)
    ├── printModal.ts              # Modal iframe para impresion
    ├── printScoreSheet.ts         # Planillas .22 LR A4 landscape (2 series)
    ├── printRankingCard.ts        # Tarjeta de posiciones A4 vertical
    ├── printCF.ts                 # Planillas CF A4 (1 serie, columna bonus)
    ├── printChampionship.ts       # Impresion + CSV del campeonato
    ├── eventsManager.ts           # Funciones CRUD eventos
    ├── analyticsManager.ts        # Extraccion de stats sociales y competitivos
    ├── authManager.ts             # Auth con Supabase + Roles (Admin/User)
    ├── sync.ts                    # Logica de subida/bajada Supabase <-> Dexie
    ├── excel.ts                   # Export CSV con BOM UTF-8
    ├── seeder.ts                  # Datos de prueba / simulacion
    ├── modals.ts                  # esc(), showToast, showConfirm, showPrompt
    ├── views/
        ├── DashboardView.ts
        ├── AnalyticsView.ts       # UI de gráficos (Chart.js)
        ├── NewEventView.ts
        ├── LoginView.ts
        ├── ChampionshipView.ts
        ├── event/
        │   ├── EventDetailView.ts       # Orquestador (~500 lineas)
        │   ├── EventRosterView.ts       # Tab Tiradores
        │   ├── EventSeriesView.ts       # Tab Series
        │   └── EventStandingsView.ts    # Tab Posiciones
        └── scoring/
            └── SeriesScoringView.ts

---

## Estética y UI/UX (Módulo de Analíticas)

El módulo de Analíticas (`AnalyticsView.ts`) NO DEBE usar fondos blancos genéricos ni tipografía "Inter" corporativa. Su estándar estético es **"Inteligencia Táctica (INTEL)"**:
- **Fondo General**: `Slate 950` (`#020617`).
- **Tarjetas/Contenedores**: `Slate 900` (`#0f172a`) con bordes en `Slate 800` (`#1e293b`).
- **Tipografía**: `Orbitron` para los títulos principales (estilo militar/visor) y `Rajdhani` para los textos y labels de Chart.js.
- **Gráficos (Chart.js)**: Utilizan grid de **1 sola columna (1fr)** para maximizar la legibilidad de los nombres largos, y colores tácticos de la bandera paraguaya (Azul `#0038a8`, Rojo `#d52b1e`) combinados con neones tácticos (Esmeralda, Ámbar).
```

---

## Modalidades de Disparo

| Propiedad | .22 LR | .308 | .223 |
|---|---|---|---|
| shotsPerSeries | 10 | 12 | 12 |
| seriesPerEvent | 2 | 1 | 1 |
| spotsPerHeat | 4 | 1 | 1 |
| maxHeats | 8 | 50 | 50 |
| hasBonus | false | true | true |
| maxSeriesScore | 67 | 96 | 96 |
| useFamilyRules | true | false | false |
| useSharedRifle | true | false | false |

---

## Sistema de Puntuacion (Reglas de Negocio)

### La Mecanica de Arrastre (Drag Mechanic)

El valor de cada disparo NO se elige libremente. Depende del **numero de disparo** en que se acierta el blanco. Si fallas un blanco, el siguiente se atrasa y su valor maximo baja.

**Tablas de puntuacion .22 LR:**
```typescript
'15"': [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]   // shotNumber - 1 = indice
'10"': [20, 18, 16, 14, 12, 10, 8, 6, 4]  // shotNumber - 2 = indice
'5"':  [30, 26, 23, 20, 16, 13, 11, 7]    // shotNumber - 3 = indice
```

**Ejemplo perfecto (67 pts):** D1=15"(10) + D2=10"(20) + D3=5"(30) + D4-10(7x1=7)

**Ejemplo con fallo (59 pts):** D1=X(0) + D2=15"(9) + D3=10"(18) + D4=5"(26) + D5-10(6x1=6)

**Tablas Fuego Central:**
```typescript
grande:  [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
mediano: [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4]
pequeno: [42, 38, 34, 30, 26, 22, 18, 14, 11, 7]
```

**Bonus CF:** Si el primer disparo impacta zona bonus del Grande, los adicionales valen x2 (2 pts en vez de 1). Max: 96 pts (con bonus) / 87 pts (sin bonus).

**Notacion oficial:** O = acierto, X = fallo

---

## Modelo de Datos (IndexedDB)

### events (ShootingEvent)
```typescript
id?: number; name: string; date: string; location?: string;
modality?: '.22 LR' | '.308' | '.223';
championshipDate?: string; createdAt: number;
isPilot?: boolean; is_deleted?: boolean;
// Indices: ++id, date, modality, createdAt
```

### participants (Participant)
```typescript
id?: number; eventId: number; name: string;
competitorNumber: number; sector?: 'A' | 'B';
spot?: 1|2|3|4; tanda?: number;           // Serie 1
tandaS2?: number; spotS2?: 1|2|3|4;       // Serie 2
category?: string; tieRank?: number;
status?: 'active'|'dq'|'dns';
paymentStatus?: 'paid'|'pending'|'exempt';
presentForRaffle?: boolean;
sharedRifleId?: string; is_deleted?: boolean;
// Indices: ++id, eventId, competitorNumber, status, paymentStatus
```

### series (Series)
```typescript
id?: number; eventId: number; participantId: number;
seriesNumber: number; shots: Shot[];
totalScore: number; bonusActive?: boolean;
createdAt: number; is_deleted?: boolean;
// Indices: ++id, eventId, participantId, seriesNumber
```

### masterCompetitors (Padron Maestro)
```typescript
id?: number; name: string; category?: string;
phone?: string; championshipTieRank?: number;
createdAt: number; is_deleted?: boolean;
// Indices: ++id, name, championshipTieRank, createdAt
```

### Shot (embebido en Series)
```typescript
shotNumber: number;  // 1-10 (.22 LR) o 1-12 (CF)
targetType: '15"' | '10"' | '5"' | 'grande' | 'mediano' | 'pequeno' | 'additional';
hit: boolean;  // true = O, false = X
value: number;
```

### Migraciones (v2 → v8)
| Version | Cambio |
|---|---|
| v2 | Schema base: events + series |
| v3 | Reset shots/totalScore en series existentes |
| v4 | Tabla participants, migra datos legacy single-shooter |
| v5 | masterCompetitors + status/payment en participants |
| v6 | Elimina UNIQUE de masterCompetitors.name |
| v7 | championshipTieRank en masterCompetitors |
| v8 | Indice modality en events + migracion a .22 LR |

---

## UUIDs Deterministas (Sync)

Para mapear IDs numericos de Dexie a UUIDs de Postgres sin tabla de traduccion:
```
00000000-0000-4000-{namespace:0000}-{id:000000000000}
Namespaces: 0=events, 1=participants, 2=series, 3=masterCompetitors
```

Push: upsert a Supabase. Pull: upsert a Dexie (NO borra datos locales).

Auto-pull para spectators cada 30s si hay conexion.

---

## Sorteo de Tandas (Heats)

### Reglas de la Familia Dominguez
1. Angel Dominguez y Facundo Dominguez NUNCA en la misma tanda
2. Facundo debe tirar SIEMPRE en tanda ANTERIOR (menor numero) que Angel
3. Solo aplican tandas 2, 3, 4 para ellos
4. Si coinciden, se reasigna automaticamente

### Rifle Compartido
Tiradores con el mismo sharedRifleId (Rifle A, B, C, D, E) no pueden estar en la misma tanda.

### Limites
- Maximo **4 tiradores por tanda** (.22 LR), hasta **8 tandas**
- **1 tirador por tanda** (CF), hasta **50 turnos**

### Modal de Reorden Manual
- .22 LR: grid de tandas/mesas con selects + flechas arriba/abajo
- CF: lista secuencial plana con flechas arriba/abajo

---

## Campeonato General Anual

1. Filtra eventos del año y modalidad (excluye isPilot)
2. Agrupa por nombre normalizado (sin acentos, minusculas)
3. Por tirador y evento: suma totalScore de sus series
4. dq = 0 (muestra DQ), dns = 0 (muestra "-")
5. Ordena puntajes de mayor a menor
6. **Base Firme** (verde) = Top 2 | **Total Actual** (azul) = Top 3
7. **En Riesgo** (amarillo) = 3er puntaje si hay 4+ eventos
8. **Descarte** (tachado) = puntajes > Top 3

**Ordenamiento:** Total Actual → Base Firme → championshipTieRank manual → alfabetico

---

## Autenticacion y Roles (RBAC)

| Rol | Acceso | Color badge | CSS class |
|---|---|---|---|
| admin | Control total: crear/eliminar eventos, padron, todo | Rojo #b7201c | .admin-only |
| staff | Puntuacion en vivo, inscripciones, sorteo, subida nube | Azul #0056b3 | .staff-only |
| spectator | Solo lectura. Auto-pull cada 30s | — | oculto por defecto |

MutationObserver en #app-root re-aplica updateUIRoles() cuando cambia el DOM.

**IMPORTANTE:** updateUIRoles() DEBE llamarse tras CADA render de vista.

---

## PWA y Offline

- Service Worker: Cache-first para assets estaticos
- Cache versionada post-build por inject-sw-cache.js
- Manifest: display standalone, orientation portrait
- Offline indicator parpadeante en navbar
- Toda la logica de negocio funciona
1. IMPRESION: printScoreSheet.ts y printCF.ts son COMPLETAMENTE separados
   - Ambos requieren usar medidas relativas en `@media print` y tienen configurado `margin-top: 18mm` en `@page` para dejar espacio y perforar las hojas.
   - printScoreSheet.ts -> SOLO .22 LR -> dos columnas. DEBE usar `width: 100%; height: auto; align-items: flex-start;` en el contenedor flex, NUNCA dimensiones fijas en mm porque rompe el salto de página en Chrome. NUNCA dejes etiquetas `</div>` extra.
   - printCF.ts -> SOLO .308/.223 -> una columna, layout ancho completo. Tambien DEBE llevar `align-items: flex-start;` para evitar el estiramiento vertical.
   - NUNCA mezclar CSS ni logica entre los dos archivos
- Todas las planillas se renderizan en iframe dentro de modal
- printChampionship.ts para el campeonato general

---

## Paleta de Colores

| Token | Color | Uso |
|---|---|---|
| Rojo CPTP | #e31c25 / #b7201c | Primary, errores |
| Azul Paraguay | #0056b3 | Secondary |
| Texto oscuro | #0f172a (Slate 900) | Texto principal |
| Texto medio | #475569 (Slate 600) | Texto secundario |
| Borde | #e2e8f0 (Slate 200) | Bordes |
| Fondo pagina | #f1f5f9 (Slate 100) | Background |
| Success | #22c55e | Aciertos (O) |
| Warning | #eab308 | En riesgo |

### Clases CSS globales
`.card-tactical` `.btn-primary-custom` `.btn-ghost-custom` `.btn-danger-custom`
`.field-input` `.staff-only` `.admin-only` `.empty-state`

### Tipografia
- **Orbitron** (900, 700): Titulos tacticos, badges
- **Rajdhani** (400-700): Texto general, navbar
- **JetBrains Mono** (400, 700): Puntajes, datos numericos

---

## Seguridad (Auditada)

### RLS Policies en Supabase (Ya implementadas)
Las Row Level Security policies estan configuradas y funcionando:

| Tabla | Lectura | Escritura |
|---|---|---|
| `events` | Publica (SELECT) | Solo admin (ALL) |
| `series` | Publica (SELECT) | Staff y admin (ALL) |
| `participants` | Publica (SELECT) | Staff y admin (ALL) |
| `master_competitors` | Publica (SELECT) | Solo admin (ALL) |
| `user_roles` | Solo propio `auth.uid()` | — |

### Buenas practicas ya implementadas
- **XSS prevenido**: `esc()` sanitiza `& < > " '` y se usa en TODO `innerHTML`
- **Sin hardcoded secrets**: Supabase keys via `import.meta.env.PUBLIC_*`, `.env` en `.gitignore`
- **Sin eval ni code injection**: No hay `eval`, `new Function`, `setTimeout` con strings
- **Sin command injection**: No se ejecutan comandos shell desde el frontend

### Pendiente opcional
- `console.error()` en produccion: los errores van a la consola del navegador. Si se quiere ocultar, agregar un wrapper que solo loguee en modo desarrollo.

---

## Reglas Criticas — NO Romper

1. **IMPRESION:** `print.ts` y `printCF.ts` son COMPLETAMENTE separados. NUNCA mezclar CSS ni logica.

2. **Boton Reordenar S2 NUNCA en CF:**
   `style="display:${!isCF && maxSeriesPerEvent > 1 ? 'inline-block' : 'none'}"`

3. **Service Worker:** Ctrl+Shift+R necesario tras deploy para ver cambios.

4. **Soft delete:** SIEMPRE filtrar `.filter((item: any) => !item.is_deleted)`

5. **addMasterCompetitor** DEBE estar importado en EventDetailView.ts.

6. **updateUIRoles()** DEBE llamarse tras cada render de vista para aplicar permisos.

7. **Deteccion de modalidad siempre explicita:**
   ```typescript
   let modality: Modality = event.modality || '.22 LR';
   if (!event.modality && event.name) {
     if (event.name.includes('.308')) modality = '.308';
     else if (event.name.includes('.223')) modality = '.223';
   }
   const isCF = modality === '.308' || modality === '.223';
   ```

8. **CICLO COMPLETO OBLIGATORIO:** Por cada cambio de codigo: (1) codigo → (2) `npm run build` → (3) actualizar esta skill + docs/ → (4) `git add`, `git commit`, `git push`. Sin excepcion.

9. **NO MONOLITOS — partir en archivos chicos:** Si un archivo supera las ~400 lineas, partirlo en modulos mas pequeños por responsabilidad. No importa si es vanilla TS sin framework, siempre se pueden crear archivos separados. Ejemplos:
   - `EventDetailView.ts` (~1527 lineas) deberia ser varios archivos (uno por tab)
   - Cualquier vista o modulo nuevo que empiece a crecer, partirlo antes de que duela
   - Preferir 5 archivos de 100 lineas a 1 archivo de 500 lineas

---

## Deteccion de Modalidad - Patron Correcto

```typescript
import { getModalityConfig } from './modalityConfig';

// Importacion: EventSeriesView.ts, eventsManager.ts, SeriesScoringView.ts, tiebreaker.ts
// Reglas: Seeder, Dominguez, 67 max (.22 LR), 96 max (CF)

---

## Feature Backlog (Aprobado para el Futuro)

**1. Rendimiento por Rifle Compartido (Analytics)**
- **Concepto**: Muchos tiradores usan rifles prestados (`sharedRifleId` como 'Rifle A', 'Rifle B').
- **Objetivo**: Crear un gráfico en `AnalyticsView.ts` que agrupe y promedie los puntajes (`totalScore`) basándose en el rifle utilizado.
- **Valor**: Permitirá a la comisión directiva del CPTP identificar estadísticamente si un rifle está rindiendo por debajo de la media (posible cañón desgastado, mira descalibrada, problema de munición).
- **Implementación futura**: Añadir `getRiflePerformanceData()` en `analyticsManager.ts`.

// En EventDetailView / SeriesScoringView:
const modality: Modality = event?.modality || '.22 LR';
const isCF = modality === '.308' || modality === '.223';
const mConfig = getModalityConfig(modality);
```

Usar `modalityConfig.ts` como fuente unica de verdad para:
- `mConfig.shotsPerSeries` (10 o 12)
- `mConfig.seriesPerEvent` (2 o 1)
- `mConfig.spotsPerHeat` (4 o 1)
- `mConfig.maxHeats` (8 o 50)
- `mConfig.hasBonus` (false o true)
- `mConfig.maxSeriesScore` (67 o 96)
- `mConfig.useFamilyRules` / `mConfig.useSharedRifle`

---

## Comandos Utiles

```bash
npm run build                          # Compila + inyecta SW cache
npm run dev                            # Dev server
npm run preview                        # Preview build produccion
git log --oneline -5                   # Ultimos commits
```

---

## Diseño Visual y Patrones de UI

### Metadatos de Eventos (Bandera de Paraguay)
En `DashboardView.ts` y `EventDetailView.ts`, los metadatos del evento forman la bandera de Paraguay alineando los siguientes badges en orden:
1. **Fecha**: Fondo rojo (`#d52b1e`), texto blanco (`#ffffff`).
2. **Ubicación**: Fondo blanco (`#ffffff`), borde sutil (`1px solid #cbd5e1`), texto oscuro (`#0f172a`).
3. **Fecha del Campeonato**: Fondo azul (`#0038a8`), texto blanco (`#ffffff`).

### Formatos de Fechas (Estándar Paraguayo)
Toda fecha mostrada en la UI (listados, gráficos, selectores) debe usar el formato latino/paraguayo **`DD-MM-YYYY`** o su versión corta **`DD-MM`**. Está estrictamente prohibido usar el formato norteamericano `MM-DD-YYYY` o mostrar ISO crudo `YYYY-MM-DD` en la interfaz visual de usuario (solo usar ISO para base de datos).

---

## Errores Comunes y Soluciones

| Error | Causa | Solucion |
|---|---|---|
| Boton no aparece para admin | updateUIRoles() no llamado | Llamar despues de cada render |
| Cambios no visibles en cliente | SW cacheado | Ctrl+Shift+R |
| Impresion estirada a 2 hojas | `</div>` extra rompe flexbox o `width/height` en `mm` excede pagina | Revisar pares de `</div>` y usar `width:100%; height:auto` en `@media print` |
| Bordes estirados (print) | Contenedor flex con `align-items: stretch` | Usar `align-items: flex-start` en `@media print` para LR y CF |
| addMasterCompetitor undefined | Falta import en EventDetailView | Agregar import |
| Fecha Campeonato no visible en UI | No se renderiza en header de EventDetailView | Agregar el badge interpolado en el HTML del `section-title` |
| Datos sin sincronizar | is_deleted no filtrado | Usar .filter(!item.is_deleted) |
| Reordenar S2 aparece en CF | isCF no aplicado | Usar !isCF en display |
| Boton "Nuevo Evento" oculto | No es admin | Solo admin puede crear eventos |
| Pull sobrescribe datos locales | Sync antiguo con clear() | Verificar sync.ts use put() no clear() |
| Paginacion no avanza | Condicion al reves (`>=` en vez de `<`) | Verificar `dash-next-page` use `dashPage < totalPages` |
