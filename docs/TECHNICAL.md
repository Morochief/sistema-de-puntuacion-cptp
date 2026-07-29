# CPTP Scoring — Technical Documentation

**Last Updated:** 2026-07-28
**Entry Points:** `src/lib/app.ts`, `src/pages/index.astro`, `src/layouts/BaseLayout.astro`
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [MASTER-REFERENCE.md](./MASTER-REFERENCE.md)

## Project Overview

CPTP Scoring is a Progressive Web App (PWA) built for **Club Paraguayo de Tiro (CPTP)** to score shooting competitions in three modalities: **.22 LR** (Long Range), **.308**, and **.223** (Central Fire). The app is designed **offline-first** because shooting ranges typically have no network connectivity — all scoring, event management, and ranking calculations work fully offline, with data syncing to the cloud only when connectivity is available (e.g., back at the clubhouse).

Built with **Astro 7 + TypeScript + Dexie.js (IndexedDB) + Supabase**, the app runs as a single HTML page with hash-based client-side routing, using vanilla DOM manipulation rather than a UI framework.

## Technology Stack

| Package | Version | Purpose |
|---|---|---|
| `astro` | ^7.1.1 | Static site generation (SSG) + islands architecture; builds the single-page shell |
| `typescript` | ^7.0.2 | Type-safe application logic across 21+ modules |
| `dexie` | ^4.4.4 | IndexedDB wrapper for local, offline-first persistence (4 tables, 8 migration versions) |
| `@supabase/supabase-js` | ^2.110.7 | PostgreSQL-backed cloud sync, authentication (email/password), and RBAC |
| `tailwindcss` / `@tailwindcss/vite` | ^4.3.3 | Utility-first CSS |
| `daisyui` | ^5.6.18 | Tailwind component classes (tabs, buttons, etc.) |
| `html2canvas` | ^1.4.1 | Renders DOM to canvas for print/export flows |
| `workbox-window` | ^7.4.1 | Service worker registration helper for the PWA |

- **Node engine requirement:** `>=22.12.0` (see `package.json` `engines`)
- **TypeScript config:** extends `astro/tsconfigs/strict`, includes `.astro/types.d.ts` and all files, excludes `dist`

## Architecture

CPTP Scoring is a **single-page application (SPA)** using **hash-based routing** (e.g. `#/event/123`, `#/series/456`) so that navigation works even when served from the filesystem or a static host with no server-side routing support — critical for offline/PWA use.

- All views are rendered via **vanilla DOM manipulation** (`document.createElement`, `innerHTML` templates) — there is no React/Vue/Svelte component tree.
- The application logic lives in **21+ TypeScript modules** under `src/lib/`.
- View-rendering functions live in `src/lib/views/` (and subfolders `views/event/`, `views/scoring/`).
- The single Astro page (`src/pages/index.astro`) contains all view containers (`<div id="view-dashboard">`, `<div id="view-login">`, etc.) which are shown/hidden by the router.
- **Entry point:** `src/lib/app.ts` — wires up hash-change routing, auth bootstrapping, silent padron migration, automatic cloud pull on empty local DB, periodic spectator auto-pull (every 30s), and a `MutationObserver` that re-applies RBAC visibility rules whenever the DOM changes.

### Views (in `src/lib/views/`)

| View | File | Responsibility |
|---|---|---|
| DashboardView | `views/DashboardView.ts` | Lists events (filter/sort/paginate by year, modality, text), Campeonato General tab, cloud sync UI, Padron Maestro access. Pagination: `dashPage` state, `dash-prev-page`/`dash-next-page` buttons, 6 items/page |
| NewEventView | `views/NewEventView.ts` | Form to create a new shooting event (name, date, location, modality, championship date) |
| LoginView | `views/LoginView.ts` | Supabase email/password login form |
| ChampionshipView | `views/ChampionshipView.ts` | Renders the annual championship ranking panel with year/modality selector |
| EventDetailView | `views/event/EventDetailView.ts` | Orchestrator — loads data, renders shell with 3 tabs, delegates to sub-views |
| EventRosterView | `views/event/EventRosterView.ts` | Tab "Tiradores": participant registration, heat seeding, roster grid, filter/sort list |
| EventSeriesView | `views/event/EventSeriesView.ts` | Tab "Series": per-shooter series list, new series creation, clear series |
| EventStandingsView | `views/event/EventStandingsView.ts` | Tab "Posiciones": event rankings, per-series tables, perfect score awards |
| SeriesScoringView | `views/scoring/SeriesScoringView.ts` | Live shot-by-shot scoring UI for a single competitor's series (modality-aware) |
| AnalyticsView     | `views/AnalyticsView.ts`             | Business Intelligence dashboard using Chart.js for social & competitive growth |

## Module Map (`src/lib/`)

| Module | Purpose |
|---|---|
| `types.ts` | Central type definitions: `Shot`, `Participant`, `Series`, `ShootingEvent`, `MasterCompetitor`, `Modality`, target types |
| `db.ts` | Dexie (`cptpScoring` database) schema definition across **8 migration versions** (v2–v8) |
| `supabase.ts` | Initializes the Supabase client from `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` |
| `router.ts` | Minimal hash-based SPA router: `navigate()`, `getRoute()`, `showView()` |
| `app.ts` | Application entry point — route dispatch, auth bootstrap, auto-sync timers, padron migration, MutationObserver for RBAC |
| `modals.ts` | Shared UI primitives: `esc()` (XSS-safe HTML escaping), `showToast`, `showConfirm`, `showPrompt`, `showEditParticipantModal` |
| `scoring.ts` | .22 LR scoring engine — 10 shots, progressive 15"/10"/5" targets, drag mechanic, max 67 pts |
| `scoringCentralFire.ts` | .308/.223 scoring engine — 12 shots, Grande/Mediano/Pequeño targets, bonus mechanic, max 96/87 pts |
| `modalityConfig.ts` | Centralized per-modality configuration (targets, shot counts, bonus rules, heat sizing, family/shared-rifle toggles) |
| `authManager.ts` | Supabase Auth session check + role-based UI toggling (`admin`/`staff`/`spectator`) |
| `eventsManager.ts` | Event CRUD helpers — filtering by year/modality/text, sorting, pagination (6/page), edit modal |
| `analyticsManager.ts`| Data layer for analytics. Fetches and transforms participant and score data for charting |
| `heatsManager.ts` | Barrel (re-export) — modules below |
| `heatsRules.ts` | Dominguez family seeding rules (S1 & S2), shared-rifle rotation logic |
| `heatsReorder.ts` | Manual heat reorder modal (different UI for .22 LR vs CF), reset seeding |
| `championship.ts` | Pure math module for the annual "Campeonato General" — Base Firme (Top 2) / Total Actual (Top 3), tiebreakers |
| `masterCompetitors.ts` | CRUD + management UI for the "Padron Maestro" (master competitor registry), with auto-migration from existing participants and deduplication |
| `tiebreaker.ts` | Manual tiebreaker ranking logic and modal for resolving equal-score ties within an event |
| `backup.ts` | JSON export/import of a full event (event + participants + series) for machine-to-machine transfer |
| `sync.ts` | Push (Dexie to Supabase via deterministic UUID upsert) and Pull (Supabase to Dexie via put/upsert) |
| `print.ts` | Generates .22 LR A4 landscape score sheets (2 series side by side) and portrait ranking cards |
| `printCF.ts` | Generates Central Fire A4 landscape score sheets (1 series, bonus column) |
| `printChampionship.ts` | Championship-specific print preview + CSV export |
| `seeder.ts` | Bulk participant loading and score simulation utility (testing/demo tool) |
| `excel.ts` | CSV export (with UTF-8 BOM) of event rankings |

## Data Model (IndexedDB, `db.ts`, current version 8)

The Dexie database is named `cptpScoring` and defines 4 tables. The current (v8) schema:

```js
db.version(8).stores({
  events:            '++id, date, modality, createdAt',
  participants:       '++id, eventId, competitorNumber, status, paymentStatus',
  series:             '++id, eventId, participantId, seriesNumber',
  masterCompetitors:  '++id, name, championshipTieRank, createdAt',
});
```

### `events` — `ShootingEvent`
- 3 supported modalities: `.22 LR` | `.308` | `.223` (default `.22 LR` if unset, migrated in v8 upgrade)
- `isPilot` flag: if true, the event does not count toward the annual championship
- Soft-delete via `is_deleted` flag (no hard deletes to keep sync consistent)
- Fields: `id`, `name`, `date` (ISO), `location`, `modality`, `championshipDate` (e.g. "1a Fecha", "Final"), `isPilot`, `createdAt`, `is_deleted`

### `participants` — `Participant`
- Up to ~32 per event (bounded by heat/spot slots, 4 spots per tanda for .22 LR)
- 2-series heat/spot assignment: `tanda`/`spot`/`sector` for Series 1, `tandaS2`/`spotS2` for Series 2
- `sharedRifleId` groups shooters sharing one physical rifle (Rifle A–E) — used by heat seeding logic
- `status`: `active` | `dq` (disqualified) | `dns` (did not show)
- `paymentStatus`: `paid` | `pending` | `exempt`
- `presentForRaffle`, `tieRank` (manual tiebreak), `is_deleted`

### `series` — `Series`
- One row per competitor per series-number within an event
- `shots: Shot[]` — 10 shots (.22 LR) or 12 shots (Central Fire)
- `totalScore`, `bonusActive` (Central Fire only — true if the first shot hit the bonus zone)
- `is_deleted`

### `masterCompetitors` — `MasterCompetitor`
- The permanent shooter registry ("Padron Maestro")
- Case-insensitive, accent-insensitive deduplication (application-level, not a DB constraint — v6 migration removed the `&name` unique index to allow safe app-level dedup)
- `championshipTieRank` — manual override used as a tertiary tiebreaker in the annual championship
- `is_deleted`

### Migration history (`db.ts`)

| Version | Change |
|---|---|
| v2 | Base `events`/`series` schema |
| v3 | Upgrade hook resets `shots`/`totalScore` on all series |
| v4 | Introduces multi-participant model (`participants` table); migrates legacy single-shooter events |
| v5 | Adds `masterCompetitors` (Padron Maestro) and status/payment fields on participants |
| v6 | Removes unique constraint on `masterCompetitors.name` (dedup moved to app logic) |
| v7 | Adds `championshipTieRank` to `masterCompetitors` |
| v8 | Adds `modality` index to `events`; migrates existing events to `.22 LR` |

### Embedded type: `Shot`

```typescript
interface Shot {
  shotNumber: number;   // 1-10 (.22 LR) o 1-12 (.308/.223)
  targetType: '15"' | '10"' | '5"' | 'grande' | 'mediano' | 'pequeño' | 'additional';
  hit: boolean;         // true = O (hit), false = X (miss)
  value: number;        // Points awarded (auto-calculated)
}
```

## Scoring Rules

### .22 LR (`scoring.ts`)
- **10 shots** per series, progressing through 3 targets in strict order: **15" → 10" → 5" → additional**
- A shot's value depends on the shot **number** (column), not a chosen ring value — missing a target delays subsequent targets ("drag"), reducing their maximum value.
- Score tables (index = shot number, offset per target):

  | Target | Table (pts) | First eligible shot |
  |---|---|---|
  | 15" | `[10,9,8,7,6,5,4,3,2,1]` | shot 1 |
  | 10" | `[20,18,16,14,12,10,8,6,4]` | shot 2 |
  | 5"  | `[30,26,23,20,16,13,11,7]` | shot 3 |
  | additional | 1 pt each | after 5" is hit |

- **Max series score: 67** (10 + 20 + 30 + 7 additional shots × 1 pt)

### Central Fire — .308 / .223 (`scoringCentralFire.ts`, `modalityConfig.ts`)
- **12 shots** per series, progressing **Grande → Mediano → Pequeño → additional**
- **Bonus mechanic:** if the *first* shot hits the bonus zone on the Grande target, all subsequent additional shots are worth **2 pts instead of 1**
- Score tables:

  | Target | Table (pts) | First eligible shot |
  |---|---|---|
  | Grande  | `[12,11,10,9,8,7,6,5,4,3,2,1]` | shot 1 |
  | Mediano | `[24,22,20,18,16,14,12,10,8,6,4]` | shot 2 |
  | Pequeño | `[42,38,34,30,26,22,18,14,11,7]` | shot 3 |
  | additional (no bonus) | 1 pt each | — |
  | additional (bonus active) | 2 pts each | — |

- **Max series score with bonus: 96** (12 + 24 + 42 + 9 additional × 2 pts)
- **Max series score without bonus: 87** (12 + 24 + 42 + 9 additional × 1 pt)

### "Drag" mechanic (both modalities)
Missing a target does not cost points directly — instead it delays when subsequent targets become reachable, which reduces their maximum achievable value because the scoring tables decrease with shot number. `getMaxPossibleRemaining()` / `getCostOfMiss()` (and their CF equivalents) compute the exact point cost of a miss for live UI feedback.

### `modalityConfig.ts` — single source of truth per modality
Each `Modality` (`.22 LR` | `.308` | `.223`) has a `ModalityConfig` describing:

| Property | .22 LR | .308 | .223 |
|---|---|---|---|
| shotsPerSeries | 10 | 12 | 12 |
| seriesPerEvent | 2 | 1 | 1 |
| spotsPerHeat | 4 | 1 | 1 |
| maxHeats | 8 | 50 | 50 |
| hasBonus | false | true | true |
| additionalValue | 1 | 1 | 1 |
| bonusMultiplier | 1 | 2 | 2 |
| maxSeriesScore | 67 | 96 | 96 |
| useFamilyRules | true | false | false |
| useSharedRifle | true | false | false |

## Authentication & RBAC

- **Supabase Auth** (email/password) via `authManager.ts`
- **3 roles**, stored in a `user_roles` table keyed by `user_id`, queried on `checkAuth()`:
  - `admin` — full CRUD (create/delete events, manage padron, everything)
  - `staff` — live scoring and cloud upload permitted; event creation/deletion restricted to admin
  - `spectator` — read-only; default role for unauthenticated sessions; receives automatic background sync every 30 seconds
- **RBAC enforcement is UI-level**, driven by CSS classes:
  - `.admin-only` elements are hidden unless `role === 'admin'`
  - `.staff-only` elements are visible for `admin` or `staff`
  - `updateUIRoles()` is re-invoked after every route render and via a `MutationObserver` watching `#app-root`, so dynamically-injected DOM (e.g., modals) is also re-secured
- Login/logout controlled from the navbar (`#nav-btn-login`, `#nav-btn-logout`, `#nav-user-badge`)

## Heat Seeding System (`heatsRules.ts` + `heatsReorder.ts`)

### Automatic Draw (`automaticDrawHeats`)
- Participants are sorted into sectors (A/B) and assigned to 4-person groups
- Groups are distributed across tandas 1–8 with spots 1–4
- After initial assignment, the following rules are enforced:

### Dominguez Family Rules
1. **Ángel Domínguez** and **Facundo Domínguez** must never be in the same tanda
2. **Facundo** must always shoot in an earlier tanda (lower number) than **Ángel**
3. Both are restricted to tandas 2, 3, 4 only
4. If they land in the same tanda, one is auto-swapped with another competitor in an allowed tanda

### Shared Rifle Rules
- Competitors with the same `sharedRifleId` (Rifle A, B, C, D, E) cannot be in the same tanda
- If two share-rifle members land in the same tanda, one swaps with a competitor from a different rifle group
- The swap candidate must not be a Dominguez family member

### Manual Reorder Modal
- **.22 LR**: tanda/mesa grid with select dropdowns per participant + up/down arrows for spot reordering within a tanda
- **CF**: flat sequential list with up/down arrows for individual turn ordering (since CF uses 1 shooter per tanda)
- On save: re-applies family rules + shared rifle rules for .22 LR, copies tandas to tandaS2/spots to spotS2 for Series 2

## Cloud Sync (`sync.ts`)

- **Push (`pushLocalDatabaseToCloud`)**: Uploads all non-deleted local records (events, participants, series, masterCompetitors) to Supabase via `upsert(..., { onConflict: 'id' })`. Local Dexie auto-increment numeric IDs are mapped to **deterministic UUIDs** using `toDeterministicUuid(id, namespace)`:
  ```
  00000000-0000-4000-{namespace:0000}-{id:000000000000}
  ```
  Namespaces: `0` = events, `1` = participants, `2` = series, `3` = masterCompetitors. This guarantees the same local ID always maps to the same UUID, enabling stable upserts without a server-side ID-mapping table.
- **Pull (`pullCloudDatabaseToLocal`)**: Downloads *all* rows from Supabase, then inserts/updates each row into Dexie using `put()` (upsert). **No local data is cleared** — this prevents data loss from offline-created records. UUIDs are converted back to numeric IDs via `fromDeterministicUuid()` (parses the trailing UUID segment as an integer). If a cloud record carries `is_deleted: true`, it is upserted into Dexie with the same flag, so sync is eventually consistent.
- **Soft delete everywhere**: no destructive deletes are synced; every table carries `is_deleted`, and both push/pull propagate this flag rather than physically removing rows.
- **Silent auto-pull on startup**: in `app.ts`, if the local `events` table is empty and the browser is online, the app silently pulls the cloud database ~1.2s after load.
- **Periodic auto-pull for spectators**: every 30 seconds, if `navigator.onLine` and the current role is `spectator`, the app re-pulls and re-renders the current view (dashboard/event/series) to keep read-only viewers live-updated.

## Championship System (`championship.ts`)

- Aggregates a shooter's results across **all events of a given year and modality**, grouping participants by **normalized name** (NFD accent-stripped, lowercased) across events, cross-referenced with the Padron Maestro for canonical display name/category.
- Events with `isPilot: true` are excluded from championship calculations.
- Scores are sorted descending; then:
  - **Base Firme** = sum of the **Top 2** scores
  - **Total Actual** = sum of the **Top 3** scores
  - The 3rd-best score is flagged `isAtRisk` if the shooter has **4 or more** event participations that year (it may be discarded once a 4th event is scored, raising the 4th score into the top 3)
  - Scores beyond the top 3 are `isDiscarded` (displayed with strikethrough in the UI)
- **Sorting (`sortChampionshipRanking`)** applies, in order:
  1. Primary metric (`baseFirme` or `totalActual`, user-selectable)
  2. Secondary metric (the other of the two totals)
  3. Manual `championshipTieRank` from Padron Maestro (lower = better; unset treated as 999)
  4. Alphabetical by competitor name

## Print System (`print.ts`, `printCF.ts`, `printChampionship.ts`)

- **.22 LR A4 landscape score sheets** (`printEventCards`): one page per competitor, showing two series side by side (Serie 1 + Serie 2), progressive target rows (15"/10"/5"/additional), cell-by-cell hit/miss display with point values
- **Central Fire A4 landscape score sheets** (`printCFSeriesCard`): single series, 12-shot layout with Grande/Mediano/Pequeño/additional rows, bonus column
- **A4 portrait ranking cards** (`printRankingCard`): with medal styling for podium places (Top 3)
- **Championship tables** (`printChampionshipPreview`): dedicated print preview plus CSV export (`exportChampionshipToExcel`)
- **Blank sheets** (`printBlankSheet`): for manual/offline scoring with reference values printed
- All print flows funnel through `openPrintModal(htmlContent, title)`, which injects the generated HTML into an **iframe-based modal** and triggers `window.print()` from a button inside the printable document — this keeps the printable layout isolated from the app's own styles.
- **CSS Layout Print Restrictions**: For multi-column and single-column print views (both `.22 LR` and `.308 / .223` CF), the container must rely on relative sizing (`width: 100%; height: auto; align-items: flex-start;`) and `@page` with generous margins (e.g., `margin-top: 18mm` to allow for physical hole punching). Fixed dimensions like `297mm` or stray closing `</div>` tags will trigger Chrome's rendering engine to prematurely wrap or page-break flex items, and missing `align-items: flex-start` will cause the flex container to stretch the border down to the end of the printed page.
- `html2canvas` is used in `EventDetailView.ts` (imported directly) for rendering the DOM to a canvas/image where needed (e.g., visual captures outside the iframe print flow).

## PWA Configuration

- **`public/manifest.json`**: name "CPTP .22 LR Scoring", `display: standalone`, `orientation: portrait`, icons at 192/512/maskable-512 plus an SVG "any" icon, `start_url`/`id` both `/`
- **Service Worker**: `public/sw.js`, registered from `BaseLayout.astro` inline script (`navigator.serviceWorker.register('/sw.js')`) on `window load`
- **Post-build cache injection**: `scripts/inject-sw-cache.js` runs after `astro build`, rewriting the `cptp-scoring-cache-v<timestamp>` string inside `dist/sw.js` so every production build gets a fresh, unique cache name (busts old caches automatically)
- **iOS PWA support**: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `mobile-web-app-capable` meta tags in `BaseLayout.astro`
- **Offline indicator**: a `#offline-indicator` element toggled by `navigator.onLine` / `online`/`offline` window events (inline script in `BaseLayout.astro`)

## Backup & Restore (`backup.ts`)

- **Export**: Serializes an event + its participants + their series into a JSON file with versioned format (`version: 1`). File name: `cptp_backup_{eventName}_{date}.json`.
- **Import**: Reads a JSON backup, re-creates the event with fresh Dexie IDs (auto-increment), reorders participants by `competitorNumber`, preserves referential integrity by re-mapping participant IDs in series data.
- Useful for transferring events between devices without cloud sync (e.g., staff brings home a backup on USB and the admin imports it on their machine).

## Build & Deploy

```bash
npm run dev       # astro dev — local dev server
npm run build     # astro build && node scripts/inject-sw-cache.js
npm run preview   # astro preview — preview the production build
```

- **Node requirement:** `>=22.12.0`
- **Environment variables** (client-exposed, must be prefixed `PUBLIC_` per Astro convention):
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
- If these are missing, `supabase.ts` logs an error and falls back to dummy values so the app doesn't crash — cloud features simply fail gracefully while local/offline scoring continues to work.

## Development Scripts (refactoring history)

The Python scripts at the project root document the modular extraction from the original monolithic `app.ts`:

| Script | Action |
|---|---|
| `refactor.py` | Extracted `modals.ts` (toast, confirm, prompt) |
| `refactor2.py` | Extracted `router.ts` (hash navigation) |
| `refactor_all.py` | Extracted `excel.ts` + `seeder.ts` simultaneously |
| `refactor_brace.py` | Used brace-counting parser instead of regex for nested functions |
| `refactor_final.py` | Extracted seed handlers from `EventDetailView.ts` to `seeder.ts` |
| `refactor_seeder.py` / `refactor_seeder2.py` | Refined seed handler extraction |
| `fix.py` | Changed button text: "Sorteo (X/32)" → "Sorteo y Puestos (X/32)" |

The Multi-Modality (CF) feature was implemented through sequential patches in `scratch/`:

| Patch | Target | Change |
|---|---|---|
| `patch.js` (226 lines) | `print.ts` | Added CF conditional tables, dynamic totals (/67 vs /96) |
| `patch2.cjs` / `patch5.cjs` | `print.ts` | CF column layout adjustments |
| `fix_heats.cjs` (236 lines) | `heatsManager.ts` | CF flat sequential reorder modal |
| `patch_print.py` (256 lines) | `print.ts` | Python version of CF print patch |
| `patch_active_tab.py` | `EventDetailView.ts` | Tab system (tiradores/series/posiciones) |
| `patch_event_buttons.py` | `EventDetailView.ts` | RBAC `.staff-only` on action buttons |
| `patch_series_buttons.py` | `SeriesScoringView.ts` | RBAC on new/save series buttons |
