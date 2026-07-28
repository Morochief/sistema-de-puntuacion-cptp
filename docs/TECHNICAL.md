# CPTP Scoring — Technical Documentation

**Last Updated:** 2025-06-01
**Entry Points:** `src/lib/app.ts`, `src/pages/index.astro`, `src/layouts/BaseLayout.astro`

## Project Overview

CPTP Scoring is a Progressive Web App (PWA) built for **Club Paraguayo de Tiro (CPTP)** to score shooting competitions in three modalities: **.22 LR** (Long Range), **.308**, and **.223** (Central Fire). The app is designed **offline-first** because shooting ranges typically have no network connectivity — all scoring, event management, and ranking calculations work fully offline, with data syncing to the cloud only when connectivity is available (e.g., back at the clubhouse).

Built with **Astro 7 + TypeScript + Dexie.js (IndexedDB) + Supabase**, the app runs as a single HTML page with hash-based client-side routing, using vanilla DOM manipulation rather than a UI framework.

## Technology Stack

| Package | Version | Purpose |
|---|---|---|
| `astro` | ^7.1.1 | Static site generation (SSG) + islands architecture; builds the single-page shell |
| `typescript` | ^7.0.2 | Type-safe application logic across 21+ modules |
| `dexie` | ^4.4.4 | IndexedDB wrapper for local, offline-first persistence |
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
- The application logic lives in **21 TypeScript modules** under `src/lib/`.
- View-rendering functions live in `src/lib/views/` (and subfolders `views/event/`, `views/scoring/`).
- The single Astro page (`src/pages/index.astro`) contains all view containers (`<div id="view-dashboard">`, `<div id="view-login">`, etc.) which are shown/hidden by the router.
- **Entry point:** `src/lib/app.ts` — wires up hash-change routing, auth bootstrapping, auto cloud-pull on empty local DB, periodic spectator auto-pull (every 30s), and a `MutationObserver` that re-applies RBAC visibility rules whenever the DOM changes.

### Views (in `src/lib/views/`)

| View | File | Responsibility |
|---|---|---|
| DashboardView | `views/DashboardView.ts` | Lists events (filter/sort/paginate), Campeonato General tab, cloud sync UI |
| NewEventView | `views/NewEventView.ts` | Form to create a new shooting event |
| LoginView | `views/LoginView.ts` | Supabase email/password login form |
| ChampionshipView | `views/ChampionshipView.ts` | Renders the annual championship ranking panel |
| EventDetailView | `views/event/EventDetailView.ts` | Event roster, heat/seeding management, print/export triggers, html2canvas usage |
| SeriesScoringView | `views/scoring/SeriesScoringView.ts` | Live shot-by-shot scoring UI for a single competitor's series |

## Module Map (`src/lib/`)

| Module | Purpose |
|---|---|
| `types.ts` | Central type definitions: `Shot`, `Participant`, `Series`, `ShootingEvent`, `MasterCompetitor`, `Modality` |
| `db.ts` | Dexie (`cptpScoring` database) schema definition across **8 migration versions** |
| `supabase.ts` | Initializes the Supabase client from `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` |
| `router.ts` | Minimal hash-based SPA router: `navigate()`, `getRoute()`, `showView()` |
| `app.ts` | Application entry point — route dispatch, auth bootstrap, auto-sync timers, padron migration, MutationObserver for RBAC |
| `modals.ts` | Shared UI primitives: `esc()` (XSS-safe HTML escaping), `showToast`, `showConfirm`, `showPrompt`, `showEditParticipantModal` |
| `scoring.ts` | .22 LR scoring engine — 10 shots, progressive 15"/10"/5" targets, max 67 pts |
| `scoringCentralFire.ts` | .308/.223 scoring engine — 12 shots, Grande/Mediano/Pequeño targets, bonus mechanic, max 96 pts |
| `modalityConfig.ts` | Centralized per-modality configuration (targets, shot counts, bonus rules, heat sizing) |
| `authManager.ts` | Supabase Auth session check + role-based UI toggling (`admin`/`staff`/`spectator`) |
| `eventsManager.ts` | Event CRUD helpers — filtering, sorting, pagination, edit modal |
| `heatsManager.ts` | Heat/tanda (turn) assignment logic, including the Dominguez family seeding rule and shared-rifle rotation |
| `championship.ts` | Pure math module for the annual "Campeonato General" — Base Firme (Top 2) / Total Actual (Top 3) |
| `masterCompetitors.ts` | CRUD + management UI for the "Padron Maestro" (master competitor registry), with auto-migration from existing participants |
| `tiebreaker.ts` | Manual tiebreaker ranking logic and modal for resolving equal-score ties |
| `backup.ts` | JSON export/import of a full event (event + participants + series) for machine-to-machine transfer |
| `sync.ts` | Push (Dexie to Supabase) and Pull (Supabase to Dexie) sync, with deterministic UUID mapping |
| `print.ts` | Generates A4 landscape score sheets and portrait ranking cards, opened in a print iframe modal |
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
- Soft-delete via `is_deleted` flag (no hard deletes to keep sync consistent)
- Fields: `id`, `name`, `date` (ISO), `location`, `modality`, `championshipDate` (e.g. "1a Fecha", "Final"), `createdAt`

### `participants` — `Participant`
- Up to ~32 per event (bounded by heat/spot slots, 4 spots per tanda for .22 LR)
- 2-series heat/spot assignment: `tanda`/`spot`/`sector` for Series 1, `tandaS2`/`spotS2` for Series 2
- `category`, `sharedRifleId` (for shared-rifle rotation logic)
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
- Case-insensitive, accent-insensitive deduplication (application-level, not a DB constraint — the v6 migration removed the `&name` unique index precisely to allow safe app-level dedup)
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

## Scoring Rules

### .22 LR (`scoring.ts`)
- **10 shots** per series, progressing through 3 targets in strict order: **15" to 10" to 5" to additional**
- A shot's value depends on the shot **number** (column), not a chosen ring value — missing a target delays subsequent targets ("drag"), reducing their maximum value.
- Score tables (index = shot number, offset per target):

  | Target | Table (pts) | First eligible shot |
  |---|---|---|
  | 15" | `[10,9,8,7,6,5,4,3,2,1]` | shot 1 |
  | 10" | `[20,18,16,14,12,10,8,6,4]` | shot 2 |
  | 5"  | `[30,26,23,20,16,13,11,7]` | shot 3 |
  | additional | 1 pt each | after 5" is hit |

- **Max series score: 67** (10 + 20 + 30 + 7 additional shots x 1 pt)

### Central Fire — .308 / .223 (`scoringCentralFire.ts`, `modalityConfig.ts`)
- **12 shots** per series, progressing **Grande to Mediano to Pequeño to additional**
- **Bonus mechanic:** if the *first* shot hits the bonus zone on the Grande target, all subsequent additional shots are worth **2 pts instead of 1**
- Score tables:

  | Target | Table (pts) | First eligible shot |
  |---|---|---|
  | Grande  | `[12,11,10,9,8,7,6,5,4,3,2,1]` | shot 1 |
  | Mediano | `[24,22,20,18,16,14,12,10,8,6,4]` | shot 2 |
  | Pequeño | `[42,38,34,30,26,22,18,14,11,7]` | shot 3 |
  | additional (no bonus) | 1 pt each | — |
  | additional (bonus active) | 2 pts each | — |

- **Max series score with bonus: 96** (12 + 24 + 42 + 9 additional x 2 pts)
- **Max series score without bonus: 87** (12 + 24 + 42 + 9 additional x 1 pt)

### "Drag" mechanic (both modalities)
Missing a target does not cost points directly — instead it delays when subsequent targets become reachable, which reduces their maximum achievable value because the scoring tables decrease with shot number. `getMaxPossibleRemaining()` / `getCostOfMiss()` (and their CF equivalents) compute the exact point cost of a miss for live UI feedback.

### `modalityConfig.ts` — single source of truth per modality
Each `Modality` (`.22 LR` | `.308` | `.223`) has a `ModalityConfig` describing: `shotsPerSeries`, `seriesPerEvent` (2 for .22 LR, 1 for Central Fire), `spotsPerHeat` (4 for .22 LR, 1 for Central Fire — individual turns), `maxHeats`, `hasBonus`, `bonusMultiplier`, `targets[]` (with `scoreTable` and `shotOffset`), `maxSeriesScore`, `useFamilyRules`, and `useSharedRifle` (both `true` only for `.22 LR`).

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

## Cloud Sync (`sync.ts`)

- **Push (`pushLocalDatabaseToCloud`)**: Uploads all non-deleted local records (events, participants, series, masterCompetitors) to Supabase via `upsert(..., { onConflict: 'id' })`. Local Dexie auto-increment numeric IDs are mapped to **deterministic UUIDs** using `toDeterministicUuid(id, namespace)`:
  ```
  00000000-0000-4000-{namespace:0000}-{id:000000000000}
  ```
  Namespaces: `0` = events, `1` = participants, `2` = series, `3` = masterCompetitors. This guarantees the same local ID always maps to the same UUID, enabling stable upserts without a server-side ID-mapping table.
- **Pull (`pullCloudDatabaseToLocal`)**: Downloads *all* rows from Supabase, **clears** all local Dexie tables, then re-inserts everything, converting UUIDs back to numeric IDs via `fromDeterministicUuid()` (parses the trailing UUID segment as an integer).
- **Soft delete everywhere**: no destructive deletes are synced; every table carries `is_deleted`, and both push/pull propagate this flag rather than physically removing rows.
- **Silent auto-pull on startup**: in `app.ts`, if the local `events` table is empty and the browser is online, the app silently pulls the cloud database ~1.2s after load.
- **Periodic auto-pull for spectators**: every 30 seconds, if `navigator.onLine` and the current role is `spectator`, the app re-pulls and re-renders the current view (dashboard/event/series) to keep read-only viewers live-updated.

## Championship System (`championship.ts`)

- Aggregates a shooter's results across **all events of a given year and modality**, grouping participants by **normalized name** (accent-stripped, lowercased) across events, cross-referenced with the Padron Maestro for canonical display name/category.
- Scores are sorted descending; then:
  - **Base Firme** = sum of the **Top 2** scores
  - **Total Actual** = sum of the **Top 3** scores
  - The 3rd-best score is flagged `isAtRisk` if the shooter has fewer than 4 event participations that year (it may still be discarded once a 4th event is scored)
  - Scores beyond the top 3 are `isDiscarded`
- **Sorting (`sortChampionshipRanking`)** applies, in order:
  1. Primary metric (`baseFirme` or `totalActual`, selectable)
  2. Secondary metric (the other of the two totals)
  3. Manual `championshipTieRank` from Padron Maestro (lower = better; unset treated as 999)
  4. Alphabetical by competitor name

## Print System (`print.ts`, `printChampionship.ts`)

- **A4 landscape score sheets**: one page per competitor, showing two series side by side (`printEventCards`)
- **A4 portrait ranking cards**: with medal styling for podium places (`printRankingCard`)
- **Championship tables**: dedicated print preview plus CSV export (`printChampionshipPreview`, `exportChampionshipToExcel`)
- **Blank sheets**: for manual/offline scoring (`printBlankSheet`)
- All print flows funnel through `openPrintModal(htmlContent, title)`, which injects the generated HTML into an **iframe-based modal** and triggers `window.print()` from a button inside the printable document — this keeps the printable layout isolated from the app's own styles.
- `html2canvas` is used in `EventDetailView.ts` (imported directly) for rendering the DOM to a canvas/image where needed (e.g., visual captures outside the iframe print flow).

## PWA Configuration

- **`public/manifest.json`**: name "CPTP .22 LR Scoring", `display: standalone`, `orientation: portrait`, icons at 192/512/maskable-512 plus an SVG "any" icon, `start_url`/`id` both `/`
- **Service Worker**: `public/sw.js`, registered from `BaseLayout.astro` inline script (`navigator.serviceWorker.register('/sw.js')`) on `window load`
- **Post-build cache injection**: `scripts/inject-sw-cache.js` runs after `astro build`, rewriting the `cptp-scoring-cache-v<timestamp>` string inside `dist/sw.js` so every production build gets a fresh, unique cache name (busts old caches automatically)
- **iOS PWA support**: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `mobile-web-app-capable` meta tags in `BaseLayout.astro`
- **Offline indicator**: a `#offline-indicator` element toggled by `navigator.onLine` / `online`/`offline` window events (inline script in `BaseLayout.astro`)

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
