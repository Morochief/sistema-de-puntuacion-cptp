# CPTP Scoring — Architecture Documentation

**Last Updated:** 2025-06-01
**Related:** [TECHNICAL.md](./TECHNICAL.md)

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
│ Logic:        │ │ eventsManager│ │ Export:     │ │ authManager.ts     │
│ scoring.ts    │ │ heatsManager │ │ print.ts    │ │ (Supabase Auth)    │
│ scoringCF.ts  │ │ championship │ │ printChamp. │ │                    │
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
                    → deriveCurrentPhase(shots) / deriveCurrentPhaseCF(shots)
                        determines active target (15"/10"/5"/additional
                        or grande/mediano/pequeño/additional)
                    → user taps HIT/MISS
                    → calculateShotValue() / calculateShotValueCF()
                        computes point value from shot number + phase (+bonus for CF)
                    → shots.push({shotNumber, targetType, hit, value})
                    → calculateSeriesTotal(shots) → db.series.put(...)
                    → UI re-renders running total + "cost of miss" preview
                      via getMaxPossibleRemaining()/getCostOfMiss()
```

### 3. Cloud Sync Flow

**Push (local → cloud)**
```
pushLocalDatabaseToCloud()
  → read non-deleted rows: db.events / db.participants / db.series / db.masterCompetitors
  → map each numeric id → deterministic UUID (00000000-0000-4000-{ns}-{id})
  → supabase.from(table).upsert(rows, { onConflict: 'id' })
  → returns SyncResult { success, eventsSynced, participantsSynced, seriesSynced, error? }
```

**Pull (cloud → local)**
```
pullCloudDatabaseToLocal()
  → supabase.from(table).select('*')  for events/participants/series/masterCompetitors
  → db.events.clear() / db.participants.clear() / db.series.clear() / db.masterCompetitors.clear()
  → fromDeterministicUuid(uuid) → numeric id (parses trailing UUID segment)
  → db.<table>.put(convertedRow)  for every cloud row
  → triggered: (a) silently on app load if local events table is empty and online
               (b) every 30s for role === 'spectator'
```

### 4. Championship Calculation Flow
```
getChampionshipData(year, modality)
  → db.events (filter by modality + year, not deleted)
  → db.participants + db.series for those event IDs
  → group participants by normalized name (accents/case stripped)
  → cross-reference db.masterCompetitors for canonical name/category/tieRank
  → for each shooter: build scoresList[{eventId, score, status}] per event
      (dq/dns → 0, else sum of series.totalScore)
  → sort scores desc → assign isBaseFirme (top 2), isTaken (top 3),
      isAtRisk (3rd, if <4 events played), isDiscarded (rest)
  → baseFirme = sum(top 2), totalActual = sum(top 3)
  → sortChampionshipRanking(rankings, 'totalActual' | 'baseFirme')
      → primary metric → secondary metric → manual tieRank → alphabetical
```

### 5. Print Flow
```
EventDetailView / ChampionshipView
  → user clicks "Imprimir"
  → print.ts builds a self-contained HTML string (embedded <style>, tables, page-break rules)
      printEventCards() / printRankingCard() / printBlankSheet()
      or printChampionship.ts → printChampionshipPreview()
  → openPrintModal(html, title)
      → injects HTML into an <iframe> inside a modal overlay
      → the iframe's own "Imprimir" button calls window.print() scoped to iframe content
  → (separately) html2canvas used in EventDetailView.ts for canvas-based captures
  → CSV export path: excel.ts / printChampionship.ts build UTF-8 BOM-prefixed CSV,
      download via Blob + <a download>
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
     │                        sync.ts, modals.ts, authManager.ts
     ├── NewEventView.ts ──► db.ts, modalityConfig.ts, modals.ts, router.ts
     ├── LoginView.ts ─────► supabase.ts, authManager.ts, router.ts
     ├── ChampionshipView.ts ► championship.ts, printChampionship.ts, excel.ts
     ├── event/EventDetailView.ts ──► db.ts, modalityConfig.ts, print.ts,
     │      heatsManager.ts, masterCompetitors.ts, tiebreaker.ts, backup.ts,
     │      html2canvas, authManager.ts
     └── scoring/SeriesScoringView.ts ──► db.ts, scoring.ts, scoringCentralFire.ts,
            modalityConfig.ts, modals.ts

scoring.ts ─────────────► types.ts
scoringCentralFire.ts ──► types.ts, modalityConfig.ts
modalityConfig.ts ──────► types.ts
championship.ts ────────► db.ts, types.ts
heatsManager.ts ────────► db.ts, types.ts, modals.ts
eventsManager.ts ───────► db.ts, types.ts, modals.ts
tiebreaker.ts ──────────► db.ts, types.ts, modals.ts
backup.ts ──────────────► db.ts, types.ts, modals.ts
print.ts ───────────────► types.ts
printChampionship.ts ───► types.ts, championship.ts
excel.ts ───────────────► types.ts, tiebreaker.ts
sync.ts ────────────────► db.ts, supabase.ts, modals.ts
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
│ createdAt, is_deleted    │
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
- `masterCompetitors ⇢ participants` is a **soft/logical** relationship matched at query time by normalized shooter name (accent + case-insensitive) — there is no enforced FK, by design, since the same person's name may be entered slightly differently across events.

**Cloud (Supabase) mirror:** each Dexie table has a matching Postgres table (`events`, `participants`, `series`, `master_competitors`) using UUID primary keys (deterministically derived from local integer IDs — see Key Design Decisions) and snake_case columns; every table also carries `is_deleted boolean`.

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

## Security Considerations

- **Supabase Row Level Security (RLS)** policies must be configured on the Supabase side for `events`, `participants`, `series`, and `master_competitors` tables to enforce that only authenticated `admin`/`staff` roles can write, while reads may be broader (spectators need read access for auto-pull). RBAC in the client (`authManager.ts`) is a **UI convenience layer only** — it hides buttons and elements, but it is **not** a substitute for server-side RLS enforcement, since a determined client could still call the Supabase API directly.
- **Auth token handling**: Supabase's JS client manages session/token storage and refresh internally (`supabase.auth.getSession()`); the app does not manually persist or transmit tokens elsewhere.
- **XSS prevention**: all dynamically-injected user-supplied strings (shooter names, categories, event names, etc.) rendered into `innerHTML` templates must be passed through the shared `esc()` function in `modals.ts` before interpolation, to prevent stored/DOM-based XSS from competitor names or other free-text fields.
- **No hardcoded secrets**: Supabase URL and anon key are read exclusively from `import.meta.env.PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` (Astro's public env convention) — never committed as literals. If unset, `supabase.ts` falls back to non-functional dummy values and logs an error rather than throwing, so a misconfigured deployment still boots into offline-only mode instead of crashing.

## File Structure

```
cptp-scoring/
├── docs/
│   ├── TECHNICAL.md              # This technical reference
│   └── ARCHITECTURE.md           # This architecture reference
├── public/                        # Static assets served as-is
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (cache name patched at build time)
│   ├── favicon.svg / favicon.ico
│   ├── logo-cptp.svg, logo-long-range.svg, flag-paraguay.svg, ...
│   └── pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png
├── scripts/
│   ├── inject-sw-cache.js         # Post-build: patches unique cache version into dist/sw.js
│   ├── generate-icons.mjs         # Icon generation helper
│   └── migration_multimodality.sql # Supabase-side SQL migration for multi-modality support
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro       # <head> (PWA meta, fonts, manifest), navbar, toast container
│   ├── pages/
│   │   └── index.astro            # The single page: all view containers (#view-*)
│   └── lib/
│       ├── app.ts                 # Entry point: router wiring, auth bootstrap, sync timers
│       ├── router.ts              # Hash routing primitives
│       ├── db.ts                  # Dexie schema (8 versions)
│       ├── types.ts               # Shared TypeScript interfaces/types
│       ├── supabase.ts            # Supabase client init
│       ├── authManager.ts         # Auth/session + RBAC UI toggling
│       ├── sync.ts                # Push/pull cloud sync + deterministic UUIDs
│       ├── scoring.ts             # .22 LR scoring engine
│       ├── scoringCentralFire.ts  # .308/.223 scoring engine
│       ├── modalityConfig.ts      # Per-modality configuration (single source of truth)
│       ├── eventsManager.ts       # Event list filter/sort/paginate + edit modal
│       ├── heatsManager.ts        # Heat/tanda seeding rules (family rule, shared rifle)
│       ├── championship.ts        # Annual championship scoring math
│       ├── masterCompetitors.ts   # Padron Maestro CRUD + management modal
│       ├── tiebreaker.ts          # Manual tie resolution logic + modal
│       ├── backup.ts              # JSON export/import of a full event
│       ├── print.ts               # Score sheet / ranking card print HTML + iframe modal
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
│           │   └── EventDetailView.ts
│           └── scoring/
│               └── SeriesScoringView.ts
├── package.json                   # scripts: dev, build, preview; deps as listed in TECHNICAL.md
├── tsconfig.json                  # extends astro/tsconfigs/strict
└── dist/                          # Build output (astro build + inject-sw-cache.js)
```

## Related Areas
- See [TECHNICAL.md](./TECHNICAL.md) for the full module map, scoring rule tables, and data model field-by-field reference.
