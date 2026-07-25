/**
 * CPTP .22 LR Scoring — Entrypoint & Router
 */

import { showToast } from './modals';
import { navigate, getRoute, showView } from './router';
import { db } from './db';
import { renderDashboard, setupCloudSync, setupDashboardTabs } from './views/DashboardView';
import { renderNewEvent } from './views/NewEventView';
import { renderEvent } from './views/event/EventDetailView';
import { renderSeries } from './views/scoring/SeriesScoringView';
import { migrateParticipantsToPadron } from './masterCompetitors';
import { pullCloudDatabaseToLocal } from './sync';

export async function router(): Promise<void> {
  const route = getRoute();
  showView(route.view);
  try {
    switch (route.view) {
      case 'dashboard': await renderDashboard(); break;
      case 'new-event': await renderNewEvent(); break;
      case 'event':   await renderEvent(route.params.id); break;
      case 'series':   await renderSeries(route.params.id); break;
    }
  } catch (err) {
    console.error('[Router] Error inesperado:', err);
    showToast('Ocurrió un error inesperado. Recargá la app.', 'error', 5000);
  }
}

// Router routing listeners
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Setup on load
window.addEventListener('load', () => {
  setupCloudSync();
  
  // Auto-download cloud data silently if local db is empty
  if (navigator.onLine) {
    setTimeout(async () => {
      const localEvents = await db.events.toArray();
      if (localEvents.length === 0) {
        console.log('[Sync] Base de datos vacía. Iniciando descarga automática...');
        const pullRes = await pullCloudDatabaseToLocal();
        if (pullRes.success) {
          await router();
        }
      }
    }, 1200);
  }

  // Silent padron migration
  setTimeout(async () => {
    try {
      const added = await migrateParticipantsToPadron();
      if (added > 0) {
        console.log(`[Padron] Migracion completada: ${added} tiradores nuevos agregados.`);
        showToast(`${added} tiradores migrados al Padron Maestro.`, 'info', 3000);
      }
    } catch (err) {
      console.error('[Padron] Error en migracion silenciosa:', err);
    }
  }, 2000);

  setupDashboardTabs();
});

window.addEventListener('hashchange', () => {
  setTimeout(() => {
    setupCloudSync();
    setupDashboardTabs();
  }, 100);
});
