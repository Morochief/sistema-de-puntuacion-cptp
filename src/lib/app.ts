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
import { renderLogin } from './views/LoginView';
import { checkAuth, getCurrentRole, logout, updateUIRoles } from './authManager';

export async function router(): Promise<void> {
  const route = getRoute();
  showView(route.view);
  try {
    switch (route.view) {
      case 'dashboard': await renderDashboard(); break;
      case 'new-event': await renderNewEvent(); break;
      case 'event':   await renderEvent(route.params.id); break;
      case 'series':   await renderSeries(route.params.id); break;
      case 'login':   await renderLogin(); break;
    }
    // Después de cada render, volver a aplicar los permisos
    updateUIRoles();
  } catch (err) {
    console.error('[Router] Error inesperado:', err);
    showToast('Ocurrió un error inesperado. Recargá la app.', 'error', 5000);
  }
}

// Router routing listeners
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Setup on load
window.addEventListener('load', async () => {
  setupCloudSync();
  await checkAuth();

  // Navbar Listeners
  const btnLogin = document.getElementById('nav-btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      navigate('/login');
    });
  }
  const btnLogout = document.getElementById('nav-btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await logout();
      navigate('/');
    });
  }
  
  // Auto-download cloud data silently if local db is empty
  if (navigator.onLine) {
    setTimeout(async () => {
      const localEvents = await db.events.filter((item: any) => !item.is_deleted).toArray();
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

  // Auto-pull periódico para Espectadores (cada 30s)
  setInterval(async () => {
    if (navigator.onLine && getCurrentRole() === 'spectator') {
      try {
        const result = await pullCloudDatabaseToLocal();
        if (result.success) {
          // Si estamos en dashboard o evento, recargar vista actual
          const r = getRoute();
          if (r.view === 'dashboard' || r.view === 'event' || r.view === 'series') {
            await router();
          }
        }
      } catch (err) {}
    }
  }, 30000);
});

window.addEventListener('hashchange', () => {
  setTimeout(() => {
    setupCloudSync();
    setupDashboardTabs();
  }, 100);
});
