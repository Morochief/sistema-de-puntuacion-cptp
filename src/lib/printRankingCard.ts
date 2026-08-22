/**
 * printRankingCard.ts
 * Tarjeta de ranking/tabla de posiciones en formato A4 vertical.
 * Incluye ranking total, por serie, y reporte de puntajes perfectos.
 */

import type { Series, ShootingEvent, Participant } from './types';
import { esc } from './modals';
import { sortRanking } from './tiebreaker';
import { openPrintModal } from './printModal';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return isoDate; }
}

export function printRankingCard(event: ShootingEvent, participants: Participant[], seriesList: Series[], isCF: boolean = false): void {
  const year = new Date(event.date + 'T12:00:00').getFullYear();

  const getRanking = (seriesNum: number | null) => {
    const data = participants.map(p => {
      let score = 0;
      if (seriesNum === null) {
        const pSeries = seriesList.filter(s => s.participantId === p.id);
        score = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
      } else {
        const s = seriesList.find(s => s.participantId === p.id && s.seriesNumber === seriesNum);
        if (s) score = s.totalScore;
      }
      return { participant: p, totalScore: score };
    });
    data.sort(sortRanking);
    return data;
  };

  const rankTotal = getRanking(null);
  const rankS1 = getRanking(1);
  const rankS2 = getRanking(2);

  const buildRows = (rankings: { participant: Participant, totalScore: number }[]) => {
    return rankings.map((r, i) => {
      const pos = i + 1;
      const p = r.participant;
      const isTop3 = pos <= 3;
      const isDq = p.status === 'dq';
      const isDns = p.status === 'dns';

      const posHtml = isDq
       ? `<div style="font-size:12px;font-weight:900;color:#b7201c;background:#fee2e2;padding:4px 8px;border-radius:4px;display:inline-block;">DQ</div>`
       : isDns
       ? `<div style="font-size:12px;font-weight:900;color:#d97706;background:#fef3c7;padding:4px 8px;border-radius:4px;display:inline-block;">DNS</div>`
       : isTop3 
       ? `<div class="pos-badge top-${pos}">${pos}</div>`
       : `<div class="pos-number">${pos}</div>`;
       
      const laneLabel = p.tanda
       ? `S1: T${p.tanda}·M${p.spot} | S2: T${p.tandaS2 || '—'}·M${p.spotS2 || '—'}`
       : 'Sin posición';
      const scoreDisplay = isDq ? '<span style="color:#ef4444;">DQ (0)</span>' : isDns ? '<span style="color:#f59e0b;">DNS</span>' : String(r.totalScore);

      return `
       <tr class="rank-row">
        <td class="td-pos">${posHtml}</td>
        <td class="td-name">
         <div class="name-text">${esc(p.name).toUpperCase()}</div>
         <div class="sub-text">COMPETIDOR · ${laneLabel} ${p.category ? `· ${esc(p.category)}` : ''}</div>
        </td>
        <td class="td-score">
         <div class="score-val">${scoreDisplay}</div>
        </td>
       </tr>`;
    }).join('');
  };

  const rowsTotalHtml = buildRows(rankTotal);
  const rowsS1Html = buildRows(rankS1);
  const rowsS2Html = buildRows(rankS2);

  const prizePerSeries = isCF ? [87, 96] : [67];
  const prizePerEvent  = isCF ? [87, 96] : [134];
  const prizeLabel     = isCF ? '87 / 96' : '67 / 134';

  const perfectScores = participants.map(p => {
    const pSeries = seriesList.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    const s1 = pSeries.find(s => s.seriesNumber === 1)?.totalScore || 0;
    const s2 = pSeries.find(s => s.seriesNumber === 2)?.totalScore || 0;
    return { p, s1, s2, totalScore };
  }).filter(x => {
    if (x.p.status === 'dq' || x.p.status === 'dns') return false;
    return prizePerSeries.some(v => x.s1 === v || x.s2 === v) || prizePerEvent.some(v => x.totalScore === v);
  });
  
  perfectScores.sort((a, b) => b.totalScore - a.totalScore);

  let perfectRowsHtml = perfectScores.map(r => {
    let reason: string[] = [];
    for (const v of prizePerSeries) {
      if (r.s1 === v) reason.push(`Serie 1 (${v} pts)`);
      if (r.s2 === v) reason.push(`Serie 2 (${v} pts)`);
    }
    for (const v of prizePerEvent) {
      if (r.totalScore === v) { reason = [`Evento Perfecto (${v} pts)`]; break; }
    }

    const p = r.p;

    return `
      <tr class="rank-row" style="background:#fffbeb;">
        <td class="td-pos"><div style="font-size:16px;font-weight:900;color:#d97706;text-align:center;">&#9733;</div></td>
        <td class="td-name">
         <div class="name-text">${esc(p.name).toUpperCase()}</div>
         <div class="sub-text">COMPETIDOR #${p.competitorNumber} ${p.category ? `· ${esc(p.category)}` : ''}</div>
        </td>
        <td class="td-score">
         <div class="score-val" style="font-size:14px;color:#d97706;">${reason.join(' / ')}</div>
        </td>
      </tr>`;
  }).join('');

  if (perfectRowsHtml.trim() === '') {
    perfectRowsHtml = `<tr><td colspan="3" style="text-align:center;padding:40px;color:#64748b;font-weight:bold;">Ningun tirador alcanzo puntaje premiado (${prizeLabel}).</td></tr>`;
  }

  const buildPage = (titleExtra: string, tableHtml: string, isLast: boolean = false) => `
  <div class="a4-page" ${!isLast ? 'style="page-break-after: always; break-after: page;"' : ''}>
    <div class="layout-border-red"></div>
    <div class="layout-border-blue"></div>
    <div class="layout-border-white"></div>

    <header class="header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:20px;gap:12px;">
     <div style="background:#ffffff;border-radius:6px;padding:2px;display:flex;align-items:center;justify-content:center;height:45px;width:45px;flex-shrink:0;">
      <img src="/logo-cptp.svg" alt="CPTP Logo" style="height:38px;width:38px;object-fit:contain;" />
     </div>

     <div class="header-left" style="flex:1;margin-left:8px;">
      <span class="category">Campeonato Nacional Long Range</span>
      <h1 class="title-main">TABLA DE POSICIONES</h1>
      <span class="event-name">${event.name.toUpperCase()} ${titleExtra ? `· <span style="color:#0056b3;font-weight:900;">${titleExtra.toUpperCase()}</span>` : ''}</span>
     </div>
     
     <div class="header-right" style="margin-right:8px;">
      <div class="year">${year}</div>
      <div class="date">${formatDate(event.date)}</div>
     </div>

     <div style="background:#ffffff;border-radius:6px;padding:2px;display:flex;align-items:center;justify-content:center;height:45px;width:55px;flex-shrink:0;">
      <img src="/logo-long-range.svg" alt="Long Range .22 LR" style="height:38px;width:48px;object-fit:contain;" />
     </div>
    </header>

    <table class="ranking-table">
     <thead>
      <tr>
       <th>Pos</th>
       <th>Tirador</th>
       <th class="th-score">Puntaje</th>
      </tr>
     </thead>
     <tbody>
      ${tableHtml}
     </tbody>
    </table>

    <footer class="footer">
     <div>Club Paraguayo de Tiro de Long Range · Planilla Oficial</div>
     <div class="footer-right">CPTP Scoring</div>
    </footer>
  </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Ranking — ${event.name}</title>
 <style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
   font-family: Arial, Helvetica, sans-serif;
   background: #f1f5f9;
   color: #0f172a;
   padding: 0;
   margin: 0;
   position: relative;
  }

  .pages-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
    align-items: center;
  }

  .a4-page {
   width: 210mm;
   min-height: 297mm;
   background: #ffffff;
   padding: 24px 28px 80px 52px;
   position: relative;
   overflow: hidden;
   box-shadow: 0 4px 32px rgba(15, 23, 42, 0.15);
  }

  @media print {
   body { background: none; }
   .pages-container { padding: 0; gap: 0; display: block; }
   .a4-page { margin: 0; padding: 24px 24px 80px 40px; box-shadow: none; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .no-print { display: none !important; }
  }

  .print-btn {
   display: block; margin: 10px auto; padding: 10px 30px;
   background: #0056b3; color: #fff; border: none; border-radius: 8px;
   font-size: 14px; font-weight: 700; cursor: pointer;
  }
  .print-btn:hover { background: #004085; }

  .layout-border-red { position: absolute; top: 0; left: 0; bottom: 0; width: 12px; background: #b7201c; }
  .layout-border-blue { position: absolute; top: 0; left: 12px; bottom: 0; width: 8px; background: #0056b3; }
  .layout-border-white { position: absolute; top: 0; left: 20px; bottom: 0; width: 4px; background: #cbd5e1; }

  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
  .header-left { display: flex; flex-direction: column; gap: 4px; }
  .header-left .category { font-size: 11px; font-weight: 800; color: #0056b3; letter-spacing: 0.15em; text-transform: uppercase; }
  .header-left .title-main { font-size: 26px; font-weight: 900; color: #b7201c; letter-spacing: -0.02em; }
  .header-left .event-name { font-size: 13px; color: #475569; font-weight: 500; }
  
  .header-right { text-align: right; }
  .header-right .year { font-size: 32px; font-weight: 900; color: rgba(0,86,179,0.07); font-style: italic; line-height: 0.8; }
  .header-right .date { font-size: 12px; color: #475569; font-family: monospace; font-weight: bold; }

  .ranking-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .ranking-table th { text-align: left; font-size: 10px; font-weight: 800; color: #0056b3; text-transform: uppercase; letter-spacing: 0.1em; padding: 8px 12px; border-bottom: 2px solid #cbd5e1; }
  .ranking-table th.th-score { text-align: right; }

  .rank-row { border-bottom: 1px solid #e2e8f0; transition: background 0.2s; }
  .rank-row td { padding: 10px 12px; vertical-align: middle; }
  
  .td-pos { width: 60px; }
  .pos-badge { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #ffffff; }
  .pos-badge.top-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000000; box-shadow: 0 0 12px rgba(245,158,11,0.4); }
  .pos-badge.top-2 { background: linear-gradient(135deg, #e2e8f0, #cbd5e1); color: #0f172a; }
  .pos-badge.top-3 { background: linear-gradient(135deg, #b7201c, #991b1b); color: #ffffff; }
  .pos-number { font-size: 15px; font-weight: bold; color: #475569; padding-left: 8px; }

  .td-name { flex: 1; }
  .name-text { font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
  .sub-text { font-size: 10px; color: #475569; font-weight: bold; margin-top: 2px; }

  .td-score { text-align: right; width: 100px; }
  .score-val { font-size: 20px; font-weight: 900; color: #16a34a; font-family: monospace; }

  .footer { position: absolute; bottom: 24px; left: 52px; right: 28px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
  .footer-right { color: #0056b3; }
 </style>
</head>
<body>
 <div class="no-print" style="text-align:center; padding:10px; background:#e2e8f0; border-bottom:1px solid #cbd5e1;">
   <button class="print-btn" onclick="window.print()" style="display:inline-block; margin:0;">Imprimir Reportes Completos</button>
 </div>
 <div class="pages-container">
   ${buildPage('Total Evento', rowsTotalHtml)}
   ${buildPage('Serie 1', rowsS1Html)}
   ${buildPage('Serie 2', rowsS2Html)}
   ${buildPage(`Reporte de Premios (${prizeLabel} pts)`, perfectRowsHtml, true)}
 </div>
</body>
</html>`;

  openPrintModal(html, `Ranking — ${event.name}`);
}
