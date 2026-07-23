import type { ShootingEvent, Participant, Series } from './types';
import { sortRanking } from './tiebreaker';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return isoDate; }
}

/** Escapa un valor para CSV: envuelve en comillas si tiene coma, comillas o salto de línea */
function csvCell(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRankingToExcel(
  evt: ShootingEvent,
  pts: Participant[],
  sers: Series[]
): void {
  // 1. Construir tabla de ranking
  const rankingData = pts.map(p => {
    const pSeries = sers.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    return {
      participant: p,
      series: pSeries.sort((a, b) => a.seriesNumber - b.seriesNumber),
      totalScore
    };
  });
  rankingData.sort(sortRanking);

  // 2. Construir filas CSV
  const rows: string[][] = [];

  // Cabecera del evento (fila 1)
  rows.push([`CPTP SCORING — PLANILLA GENERAL — ${evt.name} (${formatDate(evt.date)})`]);
  rows.push([]); // fila vacía separadora

  // Cabecera de columnas
  rows.push([
    'Pos', 'Nombre', 'Categoría', 'Tanda', 'Mesa', 'Serie',
    'D1 (15")', 'D2 (10")', 'D3 (5")',
    'D4 (Ad)', 'D5 (Ad)', 'D6 (Ad)', 'D7 (Ad)', 'D8 (Ad)', 'D9 (Ad)', 'D10 (Ad)',
    'Total Serie', 'Total General'
  ]);

  // Filas de datos
  rankingData.forEach((row, rankIdx) => {
    const p = row.participant;

    if (row.series.length === 0) {
      rows.push([
        String(rankIdx + 1),
        `#${p.competitorNumber}`,
        p.name,
        p.category ?? '',
        String(p.tanda ?? '—'),
        String(p.spot ?? '—'),
        '—',
        ...Array(10).fill('—'),
        '0',
        '0'
      ]);
    } else {
      row.series.forEach((s, sIdx) => {
        const shotCells: string[] = [];
        for (let shotN = 1; shotN <= 10; shotN++) {
          const shot = s.shots.find(sh => sh.shotNumber === shotN);
          if (shot) {
            shotCells.push(shot.hit ? String(shot.value) : 'X');
          } else {
            shotCells.push('—');
          }
        }

        rows.push([
          String(rankIdx + 1),
          `#${p.competitorNumber}`,
          p.name,
          p.category ?? '',
          String(p.tanda ?? '—'),
          String(p.spot ?? '—'),
          `Serie ${s.seriesNumber}`,
          ...shotCells,
          String(s.totalScore),
          sIdx === 0 ? String(row.totalScore) : ''
        ]);
      });
    }
  });

  // 3. Serializar a CSV con BOM UTF-8 para que Excel lo interprete correctamente
  const csvLines = rows.map(row => row.map(csvCell).join(','));
  const bom = '\uFEFF'; // UTF-8 BOM — hace que Excel abra el CSV en español sin romper tildes
  const csvText = bom + csvLines.join('\r\n');

  // 4. Descargar
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanEventName = evt.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 20);
  link.download = `cptp_resultados_${cleanEventName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Planilla descargada como CSV — abrí con Excel o Google Sheets', 'success');
}
