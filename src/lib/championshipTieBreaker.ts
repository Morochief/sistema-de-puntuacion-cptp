/**
 * championshipTieBreaker.ts
 * Modal "Resolver Empates" del Campeonato General: permite ordenar a mano a los
 * tiradores con el mismo Top 3. Por defecto rige la regla del club (mayor descarte arriba);
 * el orden manual guardado tiene prioridad sobre esa regla.
 * El orden se guarda como championshipTieRank en el Padrón Maestro (se sincroniza a la nube)
 * y se aplica en la tabla, la impresión, el Top 6 y la exportación.
 */
import { db } from './db';
import { esc, showToast } from './modals';
import {
  detectChampionshipTies,
  encodeTieRank,
  getDiscards,
  normalizeName,
  type ChampionshipRankingRow,
  type ChampionshipSortKey
} from './championshipCore';


/** Guarda el orden de cada grupo (1 = va primero) en todos los registros del Padrón con ese nombre,
 *  codificado con el Top 3 del empate para que solo valga en ese empate. */
export async function saveChampionshipTieOrder(groups: ChampionshipRankingRow[][]): Promise<void> {
  const masters = await db.masterCompetitors.filter((m: any) => !m.is_deleted).toArray();
  for (const rows of groups) {
    for (let i = 0; i < rows.length; i++) {
      const key = normalizeName(rows[i].competitorName);
      const matches = masters.filter(m => normalizeName(m.name) === key);
      if (matches.length === 0) {
        await db.masterCompetitors.add({
          name: rows[i].competitorName,
          category: rows[i].category === 'General' ? '' : rows[i].category,
          phone: '',
          championshipTieRank: encodeTieRank(rows[i].totalActual, i + 1),
          createdAt: Date.now()
        });
      } else {
        for (const m of matches) await db.masterCompetitors.update(m.id!, { championshipTieRank: encodeTieRank(rows[i].totalActual, i + 1) });
      }
    }
  }
}

export function showChampionshipTieBreakerModal(
  rankings: ChampionshipRankingRow[],
  sortBy: ChampionshipSortKey,
  contextLabel: string,
  onSaved: () => void
): void {
  const groups = detectChampionshipTies(rankings, sortBy);
  if (groups.length === 0) {
    showToast('No hay empates en el campeonato con este orden.', 'info');
    return;
  }
  const working = groups.map(g => ({ startPosition: g.startPosition, rows: [...g.rows] }));

  const overlay = document.createElement('div');
  overlay.id = 'champ-tiebreak-modal';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
    z-index: 1000; display: flex; align-items: center; justify-content: center;
    padding: 16px; font-family: 'Rajdhani', sans-serif;`;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 5px solid #b7201c; border-radius: 16px;
    width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3); overflow: hidden; color: #0f172a;`;

  box.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;gap:10px;">
      <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:#0056b3;font-family:'Orbitron',sans-serif;">Resolver Empates</h3>
      <span style="font-size:0.75rem;background:#eff6ff;color:#0056b3;padding:4px 8px;border-radius:4px;font-weight:700;">${esc(contextLabel)}</span>
    </div>
    <div style="padding:10px 20px 0;font-size:0.8rem;color:#475569;font-weight:600;">
      Tiradores con el mismo Top 3. El orden sugerido sigue la regla del club (mayor descarte arriba); cambialo con ▲ ▼ si hace falta. El de arriba queda mejor ubicado.
    </div>
    <div data-tb-body style="padding:12px 20px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:14px;"></div>
    <div style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
      <button data-tb-cancel class="btn-ghost-custom" style="padding:8px 16px;">Cancelar</button>
      <button data-tb-save class="btn-primary-custom" style="padding:8px 20px;background:#0056b3;color:#ffffff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Aplicar Posiciones</button>
    </div>`;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const body = box.querySelector('[data-tb-body]') as HTMLElement;
  const close = () => overlay.remove();

  const render = () => {
    body.innerHTML = working.map((g, gi) => {
      const first = g.rows[0];
      const items = g.rows.map((r, ri) => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:#ffffff;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-family:monospace;font-size:0.8rem;background:#eff6ff;color:#0056b3;padding:2px 6px;border-radius:4px;font-weight:bold;">${g.startPosition + ri}° Lugar</span>
            <span style="font-weight:700;font-size:0.92rem;text-transform:uppercase;">${esc(r.competitorName)}</span>
            <span style="font-size:0.72rem;color:#64748b;font-weight:700;" title="Puntajes de descarte (fuera del Top 3)">Descarte: ${getDiscards(r).join(' · ') || '—'}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button data-tb-move="${gi}:${ri}:-1" ${ri === 0 ? 'disabled style="opacity:0.3;' : 'style="'}background:#e2e8f0;color:#0f172a;border:none;border-radius:4px;width:30px;height:30px;cursor:pointer;font-weight:bold;" title="Subir">▲</button>
            <button data-tb-move="${gi}:${ri}:1" ${ri === g.rows.length - 1 ? 'disabled style="opacity:0.3;' : 'style="'}background:#e2e8f0;color:#0f172a;border:none;border-radius:4px;width:30px;height:30px;cursor:pointer;font-weight:bold;" title="Bajar">▼</button>
          </div>
        </div>`).join('');
      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;">
          <div style="font-size:0.95rem;font-weight:700;color:#b7201c;margin-bottom:10px;display:flex;justify-content:space-between;gap:8px;">
            <span>Empate en Top 3: ${first.totalActual} pts</span>
            <span style="font-size:0.75rem;color:#64748b;white-space:nowrap;">${g.rows.length} tiradores</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">${items}</div>
        </div>`;
    }).join('');

    body.querySelectorAll<HTMLButtonElement>('[data-tb-move]').forEach(btn => {
      btn.onclick = () => {
        const [gi, ri, dir] = btn.dataset.tbMove!.split(':').map(Number);
        const rows = working[gi].rows;
        const target = ri + dir;
        if (target < 0 || target >= rows.length) return;
        [rows[ri], rows[target]] = [rows[target], rows[ri]];
        render();
      };
    });
  };
  render();

  (box.querySelector('[data-tb-cancel]') as HTMLButtonElement).onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const btnSave = box.querySelector('[data-tb-save]') as HTMLButtonElement;
  btnSave.onclick = async () => {
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';
    try {
      await saveChampionshipTieOrder(working.map(g => g.rows));
      showToast('Orden de los empates guardado. Recordá subir a la nube para que lo vean todos.', 'success');
      close();
      onSaved();
    } catch (err) {
      console.error('[champ-tiebreak] Error guardando desempates:', err);
      showToast('No se pudo guardar el orden de los empates.', 'error');
      btnSave.disabled = false;
      btnSave.textContent = 'Aplicar Posiciones';
    }
  };
}
