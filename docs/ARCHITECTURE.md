# CPTP Scoring — Architecture Documentation

**Last Updated:** 2026-07-28
**Related:** [TECHNICAL.md](./TECHNICAL.md) · [MASTER-REFERENCE.md](./MASTER-REFERENCE.md)

## System Architecture

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
│   silent padron migration · spectator auto-pull (30s interval)      │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                  Views (vanilla DOM, src/lib/views/)                  │
│  DashboardView · NewEventView · LoginView · ChampionshipView          │
│  EventDetailView · EventRosterView                                  │
│  EventSeriesView · EventStandingsView                                │
└───────┬───────────────┬───────────────┬───────────────┬──────────────┘
        │               │               │               │
┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐ ┌───────▼───────────┐
│ Business      │ │ Ops modules  │ │ Print /     │ │ Auth & RBAC        │
│ Logic:        │ │ eventsManager│ │ Export:     │ │ authManager.ts     │
│ scoring.ts    │ │ heatsManager │ │ print.ts    │ │ (Supabase Auth)    │
│ scoringCF.ts  │ │ championship │ │ printCF.ts  │ │ 3 roles:           │
│ modalityConf. │ │ tiebreaker   │ │ printChamp. │ │ admin/staff/       │
│               │ │ masterComp.  │ │ excel.ts    │ │ spectator          │
│               │ │ backup.ts    │ │             │ │                    │
│               │ │ seeder.ts    │ │             │ │                    │
└───────┬───────┘ └──────┬───────┘ └─────┬──────┘ └───────┬────────────┘
        │                │                │                 │
┌───────▼────────────────▼────────────────▼─────────────────▼──────────┐
│                         Data Layer                                    │
│  ┌────────────────────────┐        ┌────────────────────────────────┐ │
│  │   Dexie (IndexedDB)     │◄──────►│         Supabase                │ │
│  │   db.ts — local, always│  sync  │   (PostgreSQL + Auth)            │ │
│  │   available offline    │  .ts   │   cloud mirror (eventually      │ │
│  │   4 tables, 8 versions │        │   consistent via upsert)        │ │
│  └────────────────────────┘        └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Event Creation Flow
```
User (admin) → NewEventView.renderNewEvent()
             → form submit → db.events.add({ name, date, location, modality, createdAt })
             → navigate('/event/' + newId)
             → EventDetailView.renderEvent(id) loads the empty roster
             → (optional) seeder.ts / bulk import to populate participants
             → heatsManager applies seeding rules (family rules, shared rifle) on draw
```

### 2. Scoring Flow (shot by shot)
```
User (staff/admin) → SeriesScoringView.renderSeries(seriesId)
                    → loads Series.shots[] from Dexie
                    → detects modality (isCentralFire() → .22 LR or .308/.223)
                    → deriveCurrentPhase() / deriveCurrentPhaseCF()
                        determines active target (15"/10"/5"/additional
                        or grande/mediano/pequeño/additional)
                    → user taps HIT/MISS
                    → calculateShotValue() / calculateShotValueCF()
                        computes point value from shot number + phase
                        (+bonusActive for CF)
                    → shots.push({shotNumber, targetType, hit, value})
                    → calculateSeriesTotal() → db.series.put(...)
                    → UI re-renders: running total, progress bar pips,
                      "cost of miss" preview via getMaxPossibleRemaining()
```

### 3. Heat Seeding Flow
```
User (staff/admin) clicks "Sortear" or "Reordenar"

automaticDrawHeats():
  → participants sorted by sector
  → for each 4-person group, assign to tandas 1-8, spots 1-4
  → applySpecialFamilySeedingRules():
      1. Facundo Domínguez and Ángel Domínguez never in same tanda
      2. Facundo always in earlier tanda (lower number) than Ángel
      3. Both restricted to tandas 2, 3, 4
      4. If in same tanda → auto-swap with another competitor
  → applySharedRifleRules():
      groups with same sharedRifleId (e.g. "Rifle A") relocated
      → if 2+ members land in same tanda, one swaps with different-rifle competitor
  → repack: enforce max 4 per tanda, reassign spots 1-4
  → persist to Dexie

showManualHeatsReorderModal():
  → .22 LR: tanda/mesa grid with selects + up/down arrows
  → CF: flat sequential list with up/down arrows (individual turns)
  → re-apply family + rifle rules on save
  → copy tanda→tandaS2 and spot→spotS2 for Series 2
```

### 4. Cloud Sync Flow

**Push (local → cloud)**
```
pushLocalDatabaseToCloud()
  → read non-deleted rows: db.events / db.participants / db.series / db.masterCompetitors
  → map each numeric id → deterministic UUID (00000000-0000-4000-{ns}-{id padded to 12})
  → supabase.from(table).upsert(rows, { onConflict: 'id' })
  → returns SyncResult { success, eventsSynced, participantsSynced, seriesSynced, error? }
  → no destructive deletes are synced (is_deleted propagated instead)
```

**Pull (cloud → local)**
```
pullCloudDatabaseToLocal()
  → supabase.from(table).select('*')  for events/participants/series/masterCompetitors
  → fromDeterministicUuid(uuid) → numeric id (parses trailing UUID segment)
  → db.<table>.put(convertedRow)  for every cloud row (upsert — does NOT clear local data)
  → triggered: (a) silently ~1.2s after app load if events table is empty and online
               (b) every 30s for role === 'spectator' (auto-render current view)
```

### 5. Championship Calculation Flow
```
getChampionshipData(year, modality)
  → db.events (filter by modality + year, not deleted, not isPilot)
  → db.participants + db.series for those event IDs
  → group participants by normalized name (NFD accent-stripped, lowercased)
  → cross-reference db.masterCompetitors for canonical display name/category/tieRank
  → for each shooter: build scoresList[{eventId, score, status}] per event
      (dq/dns → 0 displayed as DQ/—, else sum of series.totalScore)
  → sort scores desc → assign isBaseFirme (top 2), isTaken (top 3),
      isAtRisk (3rd, if ≥4 events played → replaceable), isDiscarded (rest)
  → baseFirme = sum(top 2), totalActual = sum(top 3)
  → sortChampionshipRanking(rankings, 'totalActual' | 'baseFirme')
      → primary metric → secondary metric → manual championshipTieRank → alphabetical
```

### 6. Print Flow
```
EventDetailView / ChampionshipView
  → user clicks "Imprimir"
  → print.ts / printCF.ts builds self-contained HTML string
      printEventCards() / printRankingCard() / printBlankSheet()
      or printChampionship.ts → printChampionshipPreview()
  → openPrintModal(html, title)
      → injects HTML into an <iframe> inside a modal overlay
      → the iframe's own "Imprimir" button calls window.print() scoped to iframe content
  → CSV export: excel.ts / printChampionship.ts build UTF-8 BOM-prefixed CSV,
      download via Blob + <a download>
  → html2canvas used in EventDetailView.ts for canvas-based captures outside iframe
```

### 7. Auth / RBAC Flow
```
app.ts on load → checkAuth()
  → supabase.auth.getSession()
  → if session exists: query user_roles table → set currentRole (admin|staff|spectator)
  → if no session or no role found: currentRole = 'spectator' (default)
  → updateUIRoles():
      .admin-only elements: display:none unless admin
      .staff-only elements: display:none unless admin or staff
      navbar: show login button (spectator) or role badge + logout (admin/staff)

MutationObserver on #app-root:
  → watches for DOM changes (dynamic renders, modals)
  → re-applies updateUIRoles() on every mutation
  → ensures RBAC enforcement on dynamically-injected content

Spectator auto-pull:
  → setInterval every 30s
  → if navigator.onLine && currentRole === 'spectator'
  → pullCloudDatabaseToLocal() → re-render current view
```

## Module Dependency Graph

```
app.ts
 ├── router.ts
 ├── authManager.ts ──► supabase.ts
 ├── sync.ts ──────────► db.ts, supabase.ts, modals.ts
 ├── masterCompetitors.ts ──► db.ts, modals.ts
 └── views/
     ├── DashboardView.ts ──► db.ts, eventsManager.ts, championship.ts,
     │                        sync.ts, modals.ts, authManager.ts, backup.ts
     ├── NewEventView.ts ──► db.ts, modalityConfig.ts, modals.ts, router.ts
     ├── LoginView.ts ─────► supabase.ts, authManager.ts, router.ts
     ├── ChampionshipView.ts ► championship.ts, printChampionship.ts, excel.ts,
     │                        db.ts, modals.ts
     ├── event/EventDetailView.ts ──► db.ts, modalityConfig.ts, print.ts,
     │      printCF.ts, EventRosterView.ts, EventSeriesView.ts, EventStandingsView.ts,
     │      heatsRules.ts, heatsReorder.ts, masterCompetitors.ts, tiebreaker.ts, backup.ts,
     │      seeder.ts, html2canvas, authManager.ts
     └── scoring/SeriesScoringView.ts ──► db.ts, scoring.ts, scoringCentralFire.ts,
            modalityConfig.ts, print.ts, printCF.ts, modals.ts

scoring.ts ─────────────► types.ts
scoringCentralFire.ts ──► types.ts, modalityConfig.ts
modalityConfig.ts ──────► types.ts
championship.ts ────────► db.ts, types.ts
heatsManager.ts ────────► db.ts, types.ts, modals.ts (barrel)
heatsRules.ts ──────────► types.ts
heatsReorder.ts ────────► db.ts, types.ts, modals.ts, heatsRules.ts
EventRosterView.ts ─────► db.ts, types.ts, modals.ts
EventSeriesView.ts ─────► db.ts, types.ts, modals.ts, router.ts
EventStandingsView.ts ──► types.ts, tiebreaker.ts, printRankingCard.ts, printScoreSheet.ts, printCF.ts
eventsManager.ts ───────► db.ts, types.ts, modals.ts
tiebreaker.ts ──────────► db.ts, types.ts, modals.ts
backup.ts ──────────────► db.ts, types.ts, modals.ts
print.ts ───────────────► types.ts, scoring.ts, db.ts, tiebreaker.ts, modals.ts
printCF.ts ─────────────► types.ts, scoring.ts, db.ts, tiebreaker.ts, modals.ts
printChampionship.ts ───► types.ts, championship.ts, db.ts
excel.ts ───────────────► types.ts, tiebreaker.ts
sync.ts ────────────────► db.ts, supabase.ts, modals.ts
seeder.ts ──────────────► db.ts, types.ts
db.ts ──────────────────► types.ts (Dexie schema only; no upward deps)
```

`db.ts` and `types.ts` sit at the bottom of the dependency graph — every business-logic and view module ultimately depends on them, but they depend on nothing else in `src/lib/`, keeping the data model as the stable core.

## Database Schema (with relationships)

```
┌──────────────────────────┐
│ events                   │  PK: id (auto-increment)
│ ───────────────────────  │  Indexes: date, modality, createdAt
│ id, name, date, location │
│ modality ('.22 LR'|'.308'│
│           |'.223')       │
│ championshipDate         │
│ isPilot, createdAt,      │
│ is_deleted               │
└────────────┬─────────────┘
             │ 1
             │
             │ N
┌────────────▼─────────────┐
│ participants              │  PK: id (auto-increment)
│ ────────────────────────  │  Indexes: eventId, competitorNumber,
│ id, eventId (FK->events)   │            status, paymentStatus
│ name, competitorNumber    │
│ sector, spot, tanda       │  Series-1 heat placement
│ tandaS2, spotS2           │  Series-2 heat placement
│ category, tieRank         │
│ status ('active'|'dq'|    │
│         'dns')            │
│ paymentStatus ('paid'|    │
│   'pending'|'exempt')     │
│ presentForRaffle          │
│ sharedRifleId             │  Groups shooters sharing one rifle
│ is_deleted                │
└────────────┬───────────────┘
             │ 1
             │
             │ N
┌────────────▼─────────────┐
│ series                    │  PK: id (auto-increment)
│ ────────────────────────  │  Indexes: eventId, participantId,
│ id, eventId (FK->events)   │            seriesNumber
│ participantId (FK->participants)
│ seriesNumber              │
│ shots: Shot[]             │  Embedded array (shotNumber, targetType,
│                           │   hit, value)
│ totalScore                │
│ bonusActive (CF only)     │
│ createdAt, is_deleted     │
└───────────────────────────┘

┌──────────────────────────┐
│ masterCompetitors          │  PK: id (auto-increment)
│ ──────────────────────── │  Indexes: name, championshipTieRank, createdAt
│ id, name, category, phone│  Logical link to participants.name
│ championshipTieRank       │  (matched by normalized-name string,
│ createdAt, is_deleted     │   NOT a foreign key — no strict relation)
└───────────────────────────┘
```

**Relationships:**
- `events (1) ──► participants (N)` via `participants.eventId`
- `participants (1) ──► series (N)` via `series.participantId` (redundantly also carries `series.eventId` for query convenience)
- `masterCompetitors ⇢ participants` is a **soft/logical** relationship matched at query time by normalized shooter name (NFD accent-stripped + lowercased) — there is no enforced FK, by design, since the same person's name may be entered slightly differently across events.

**Cloud (Supabase) mirror:** each Dexie table has a matching Postgres table (`events`, `participants`, `series`, `master_competitors`) using UUID primary keys (deterministically derived from local integer IDs — see Key Design Decisions) and snake_case columns; every table also carries `is_deleted boolean`.

## Multi-Modality Architecture

The app supports 3 modalities configured via `modalityConfig.ts` as the single source of truth:

| Modalidad | shotsPerSeries | seriesPerEvent | spotsPerHeat | maxHeats | hasBonus | useFamilyRules | maxScore |
|---|---|---|---|---|---|---|---|
| .22 LR | 10 | 2 | 4 | 8 | false | true | 67 |
| .308 | 12 | 1 | 1 | 50 | true | false | 96 |
| .223 | 12 | 1 | 1 | 50 | true | false | 96 |

Each modality has its own scoring engine (`scoring.ts` for .22 LR, `scoringCentralFire.ts` for .308/.223) and its own print module (`print.ts` for .22 LR, `printCF.ts` for CF). View code detects modality at runtime via `isCentralFire(modality)` and branches accordingly (scoring UI, heat reorder modal, print sheets).

## Key Design Decisions

1. **Why Dexie/IndexedDB over server-first**
   Shooting ranges have no reliable connectivity. The app must be **fully functional offline** — creating events, scoring shots, computing rankings, and printing sheets all need to work with zero network access. IndexedDB (via Dexie) provides a robust, transactional, versioned local database that the app treats as its primary source of truth during live competition; Supabase is a secondary, eventually-consistent mirror synced opportunistically.

2. **Why vanilla DOM over React/Vue**
   Minimizing bundle size and runtime overhead matters for a PWA that must install and boot quickly on potentially older Android tablets in the field, and that must reliably survive being cached by a service worker. Astro's islands architecture combined with hand-written DOM manipulation avoids shipping a full framework runtime, keeping the client bundle lean.

3. **Why deterministic UUIDs (`toDeterministicUuid` / `fromDeterministicUuid`)**
   Dexie uses auto-incrementing integer primary keys locally, while Postgres/Supabase requires UUID primary keys for the shared cloud schema. Rather than maintaining a separate ID-mapping table (which itself would need to be synced and could drift), the app derives a **stable, reversible UUID** from each local integer ID plus a namespace segment (`0`=events, `1`=participants, `2`=series, `3`=masterCompetitors). This makes push (`upsert`) idempotent and pull (`fromDeterministicUuid`) trivially reversible without any additional state.

4. **Why soft delete (`is_deleted`) everywhere**
   Hard deletes are dangerous in a bidirectional, occasionally-offline sync system: a device offline during a delete could resurrect deleted data on its next push, or a delete could race with an in-flight edit from another device. Soft-delete flags are simply another field that syncs like any other column, making sync conflict-safe and idempotent in both directions.

5. **Why hash-based routing (`#/event/123`)**
   The app is served as static files (Astro SSG output) and installed as a PWA; a service worker intercepts navigation requests. Hash fragments never leave the browser and never trigger a server request, so routing works identically whether the app is online, offline, opened from a home-screen icon, or loaded straight from `file://`/cached assets — no server-side rewrite rules are required.

6. **Why 3 separate roles (admin/staff/spectator)**
   During a live competition, different people need different access. The range officer (staff) needs to score shots and manage rosters but should not delete events. The club administrator (admin) handles event lifecycle and master data. Spectators (unauthenticated) get read-only access with automatic background sync. This separation prevents accidental data loss during events while keeping the app usable for the audience.

7. **Why pull uses upsert instead of clear+reinsert**
   Earlier versions of the sync cleared all local Dexie tables before re-inserting. This was replaced with `put()` (Dexie upsert) so that data created offline is never lost during a pull. The cloud is a mirror, not the authoritative source — local data always survives.

## PWA & Offline Architecture

| Funcionalidad | Estrategia |
|---|---|
| **Carga inicial** | App Shell: HTML+CSS+JS cacheados al primer acceso (Cache-first) |
| **Datos de competencia** | IndexedDB local vía Dexie — toda la persistencia es local |
| **Service Worker** | Cache-first para assets; versión de caché inyectada post-build |
| **Instalable** | Manifest + iconos 192/512/maskable-512 + SVG, prompt de instalación |
| **Offline indicator** | Elemento parpadeante en navbar, toggled por eventos online/offline |
| **Sincronización** | Push/Pull manual + auto-pull cada 30s para espectadores |

## Security Considerations

- **Supabase Row Level Security (RLS)** policies must be configured on the Supabase side for `events`, `participants`, `series`, and `master_competitors` tables to enforce that only authenticated `admin`/`staff` roles can write, while reads may be broader (spectators need read access for auto-pull). RBAC in the client (`authManager.ts`) is a **UI convenience layer only** — it hides buttons and elements, but it is **not** a substitute for server-side RLS enforcement, since a determined client could still call the Supabase API directly.
- **Auth token handling**: Supabase's JS client manages session/token storage and refresh internally (`supabase.auth.getSession()`); the app does not manually persist or transmit tokens elsewhere.
- **XSS prevention**: all dynamically-injected user-supplied strings (shooter names, categories, event names, etc.) rendered into `innerHTML` templates must be passed through the shared `esc()` function in `modals.ts` before interpolation, to prevent stored/DOM-based XSS from competitor names or other free-text fields.
- **No hardcoded secrets**: Supabase URL and anon key are read exclusively from `import.meta.env.PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` (Astro's public env convention) — never committed as literals. If unset, `supabase.ts` falls back to non-functional dummy values and logs an error rather than throwing, so a misconfigured deployment still boots into offline-only mode instead of crashing.
- **Role enforcement at UI level**: `.admin-only` and `.staff-only` CSS classes are managed by `updateUIRoles()`, re-applied via `MutationObserver` on `#app-root` whenever the DOM changes dynamically, ensuring that even modal content respects role permissions.

## File Structure

```
cptp-scoring/
├── docs/
│   ├── ARCHITECTURE.md           # This architecture reference
│   ├── TECHNICAL.md              # Technical reference
│   └── MASTER-REFERENCE.md       # Integrated master reference
├── public/                        # Static assets served as-is
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (cache name patched at build time)
│   ├── favicon.svg / favicon.ico
│   ├── logo-cptp.svg, logo-long-range.svg, flag-paraguay.svg, ...
│   └── pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png
├── scripts/
│   ├── inject-sw-cache.js         # Post-build: patches unique cache version into dist/sw.js
│   ├── generate-icons.mjs         # Icon generation helper (pure Node, no deps)
│   └── migration_multimodality.sql # Supabase-side SQL migration for multi-modality
├── scratch/                       # Development patches (historical)
│   ├── patch.js                   # CF print support (226 lines)
│   ├── patch2.cjs / patch5.cjs    # CF layout adjustments
│   ├── fix_heats.cjs              # CF heat reorder modal (236 lines)
│   ├── patch_active_tab.py        # Tab system in EventDetailView
│   ├── patch_event_buttons.py     # RBAC buttons in EventDetailView
│   ├── patch_series_buttons.py    # RBAC buttons in SeriesScoringView
│   └── patch_print.py             # CF print Python version (256 lines)
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro       # <head> (PWA meta, fonts, manifest), navbar, toast container, offline indicator
│   ├── pages/
│   │   └── index.astro            # The single page: all view containers (#view-*)
│   └── lib/
│       ├── app.ts                 # Entry point: router wiring, auth bootstrap, sync timers, padron migration
│       ├── router.ts              # Hash routing primitives
│       ├── db.ts                  # Dexie schema (8 versions)
│       ├── types.ts               # Shared TypeScript interfaces/types
│       ├── supabase.ts            # Supabase client init
│       ├── authManager.ts         # Auth/session + RBAC UI toggling (admin/staff/spectator)
│       ├── sync.ts                # Push/pull cloud sync + deterministic UUIDs
│       ├── scoring.ts             # .22 LR scoring engine (10 shots, 67 max)
│       ├── scoringCentralFire.ts  # .308/.223 scoring engine (12 shots, bonus, 96 max)
│       ├── modalityConfig.ts      # Per-modality configuration (single source of truth)
│       ├── eventsManager.ts       # Event list filter/sort/paginate + edit modal
│       ├── heatsManager.ts        # Barrel (re-export)
│       ├── heatsRules.ts          # Reglas Dominguez + rifle compartido
│       ├── heatsReorder.ts        # Modal reorden manual + reset sorteo
│       ├── championship.ts        # Annual championship scoring math (Base Firme + Total Actual)
│       ├── masterCompetitors.ts   # Padron Maestro CRUD + management modal
│       ├── tiebreaker.ts          # Manual tie resolution logic + modal
│       ├── backup.ts              # JSON export/import of a full event
│       ├── print.ts               # .22 LR score sheet / ranking card print HTML + iframe modal
│       ├── printCF.ts             # Central fire score sheet print HTML
│       ├── printChampionship.ts   # Championship print preview + CSV export
│       ├── excel.ts               # CSV export (UTF-8 BOM) of event rankings
│       ├── seeder.ts              # Bulk participant/score simulation utility
│       ├── modals.ts              # esc(), toast, confirm, prompt, edit-participant modals
│       └── views/
│           ├── DashboardView.ts
│           ├── NewEventView.ts
│           ├── LoginView.ts
│           ├── ChampionshipView.ts
│           ├── event/
│           │   └── EventDetailView.ts     # Orchestrator (3 tabs)
│           ├── EventRosterView.ts       # Tiradores tab
│           ├── EventSeriesView.ts       # Series tab
│           ├── EventStandingsView.ts    # Posiciones tab
│           └── scoring/
│               └── SeriesScoringView.ts
├── package.json                   # scripts: dev, build, preview
├── tsconfig.json                  # extends astro/tsconfigs/strict
├── .env                           # PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
├── *.py                           # Refactoring scripts (refactor.py, fix.py, etc.)
├── cptp_backup_*.json             # Event backup exports
└── dist/                          # Build output (astro build + inject-sw-cache.js)
```

## Related Areas
- See [TECHNICAL.md](./TECHNICAL.md) for the full module map, scoring rule tables, and data model field-by-field reference.
- See [MASTER-REFERENCE.md](./MASTER-REFERENCE.md) for the integrated master reference covering business rules, development history, and the full project ecosystem.
