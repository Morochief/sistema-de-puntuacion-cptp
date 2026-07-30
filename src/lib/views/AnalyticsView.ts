import { 
  getSocialGrowthData, 
  getCompetitiveGrowthData, 
  getTopShootersData, 
  getShooterHistoryData,
  getTargetEffectivenessData,
  getScoreDistributionData,
  getRetentionData,
  getPrecisionFactorData,
  getAnnualChampionshipData
} from '../analyticsManager';
import { db } from '../db';
import Chart from 'chart.js/auto';

export async function renderAnalytics(): Promise<void> {
  const app = document.getElementById('view-analytics');
  if (!app) return;
  
  let currentModality = 'Todas';
  let currentYear = 'Todos';
  let currentShooter = 'Todos';
  let currentDistEvent = -1; // -1 significa "Ultima Fecha" o sin seleccionar
  
  const layout = `
  <div class="w-full max-w-[1200px] mx-auto p-4 animate-fade-in" style="font-family: 'Rajdhani', sans-serif; background-color:#f8fafc; min-height:100vh; padding:24px 16px;">
    
    <div style="margin-bottom:20px;">
      <button class="btn-ghost-custom" id="btn-back-analytics" aria-label="Volver al inicio" style="color:#0f1f3d; display:inline-flex; align-items:center; gap:6px; font-weight:700; text-transform:uppercase; letter-spacing:1px; background:#ffffff; border:1px solid #cbd5e1; padding:8px 16px; border-radius:6px; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.05); cursor:pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        INICIO
      </button>
    </div>

    <!-- HEADER TÁCTICO CPTP (Limpio / Rojo-Blanco-Azul) -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;flex-wrap:wrap;gap:16px; background:#ffffff; padding:20px 24px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div>
        <h1 style="font-family:'Orbitron', sans-serif; font-size:2.2rem; font-weight:900; color:#0056b3; margin:0; line-height:1.1; letter-spacing:0.5px; text-transform:uppercase;">
          ESTADÍSTICAS
        </h1>
        <p style="color:#b7201c; font-size:1.1rem; margin:4px 0 0; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Monitor de Rendimiento & Analíticas CPTP</p>
      </div>
      
      <!-- FILTROS GLOBALES -->
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <select id="analytics-year" style="padding:10px 16px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.95rem; font-weight:700; color:#0f1f3d; background:#ffffff; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; text-transform:uppercase; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <option value="Todos">AÑO: TODOS</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
        
        <select id="analytics-modality" style="padding:10px 16px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.95rem; font-weight:700; color:#0f1f3d; background:#ffffff; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; text-transform:uppercase; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <option value="Todas">MODALIDAD: TODAS</option>
          <option value=".22 LR">.22 LR</option>
          <option value=".308">F.CENTRAL .308</option>
          <option value=".223">F.CENTRAL .223</option>
        </select>
      </div>
    </div>
    
    <!-- COLUMNA ÚNICA DE GRÁFICOS (UN GRÁFICO DEBAJO DE OTRO) -->
    <div style="display:flex; flex-direction:column; gap:32px;">
      
      <!-- Chart 1: Asistencia Global -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0056b3;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Asistencia Global por Evento</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Evolución de inscriptos activos por fecha.</p>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-social"></canvas>
        </div>
      </div>

      <!-- Chart 2: Lealtad del Tirador -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#b7201c;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Lealtad del Tirador</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Distribución de participación en competencias durante el año.</p>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-retention"></canvas>
        </div>
      </div>

      <!-- Chart 3: Precisión (Factor X) -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0056b3;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Precisión Absoluta (Factor X)</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Suma total de blancos acertados a 5" (.22 LR) y blancos pequeños en Gran Calibre.</p>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-factor-x"></canvas>
        </div>
      </div>

      <!-- Chart 4: Efectividad por Blanco -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0f1f3d;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Efectividad por Blanco</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Porcentaje global de aciertos según el tamaño de cada blanco.</p>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-effectiveness"></canvas>
        </div>
      </div>

      <!-- Chart 5: Curva Competitiva -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#b7201c;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Curva Competitiva (Score Top vs Promedio)</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Comparativo del puntaje máximo vs puntaje medio en el tiempo.</p>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-competitive"></canvas>
        </div>
      </div>

      <!-- Chart 6: Distribución de Puntajes (Campana Gauss) -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0056b3;"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Distribución de Puntajes por Evento</h2>
            <p style="font-size:0.95rem; color:#64748b; margin:0; font-weight:600;">Frecuencia de puntuaciones conseguidas en cada serie.</p>
          </div>
          <select id="analytics-dist-event" style="padding:8px 16px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.95rem; font-weight:700; color:#0f1f3d; background:#ffffff; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; min-width:220px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <!-- Se poblará dinámicamente -->
          </select>
        </div>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-distribution"></canvas>
        </div>
      </div>

      <!-- Chart 7: Ranking Campeonato Anual -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#b7201c;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Ranking Campeonato Anual (Top 10)</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Suma de puntos acumulados en la temporada.</p>
        <div style="position:relative; height:420px; width:100%;">
          <canvas id="chart-championship"></canvas>
        </div>
      </div>

      <!-- Chart 8: Top 5 Promedios -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0056b3;"></div>
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Top 5 Mejores Promedios</h2>
        <p style="font-size:0.95rem; color:#64748b; margin-bottom:20px; font-weight:600;">Promedios por serie más altos registrados en el sistema.</p>
        <div style="position:relative; height:420px; width:100%;">
          <canvas id="chart-top-shooters"></canvas>
        </div>
      </div>

      <!-- Chart 9: Historial Individual por Tirador -->
      <div style="background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.04); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:6px; height:100%; background:#0f1f3d;"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-family:'Orbitron', sans-serif; font-size:1.25rem; font-weight:800; color:#0f1f3d; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px;">Historial Individual del Tirador</h2>
            <p style="font-size:0.95rem; color:#64748b; margin:0; font-weight:600;">Evolución de rendimiento fecha por fecha.</p>
          </div>
          <select id="analytics-shooter" style="padding:8px 16px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.95rem; font-weight:700; color:#0f1f3d; background:#ffffff; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; min-width:250px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <option value="Todos">-- SELECCIONAR TIRADOR --</option>
          </select>
        </div>
        <div style="position:relative; height:380px; width:100%;">
          <canvas id="chart-shooter-history"></canvas>
        </div>
      </div>

    </div>
  </div>
  `;
  
  app.innerHTML = layout;
  
  // Poblar Select de Tiradores
  const shooterSelect = document.getElementById('analytics-shooter') as HTMLSelectElement;
  const masterList = await db.masterCompetitors.filter(mc => !mc.is_deleted).toArray();
  masterList.sort((a, b) => a.name.localeCompare(b.name));
  
  for (const mc of masterList) {
    const opt = document.createElement('option');
    opt.value = mc.name;
    opt.textContent = mc.name;
    shooterSelect.appendChild(opt);
  }
  
  let socialChart: Chart | null = null;
  let compChart: Chart | null = null;
  let topChart: Chart | null = null;
  let historyChart: Chart | null = null;
  let retChart: Chart | null = null;
  let distChart: Chart | null = null;
  let effChart: Chart | null = null;
  let xChart: Chart | null = null;
  let champChart: Chart | null = null;
  
  // Estilo global claro CPTP para fuentes y textos
  Chart.defaults.font.family = "'Rajdhani', sans-serif";
  Chart.defaults.color = '#334155';
  
  async function drawCharts() {
    const socialData = await getSocialGrowthData(currentModality, currentYear);
    const compData = await getCompetitiveGrowthData(currentModality, currentYear);
    const topData = await getTopShootersData(currentModality, currentYear);
    const retentionData = await getRetentionData(currentModality, currentYear);
    const effectivenessData = await getTargetEffectivenessData(currentModality, currentYear);
    const xData = await getPrecisionFactorData(currentModality, currentYear);
    const champData = await getAnnualChampionshipData(currentModality, currentYear);
    
    // Configurar select de eventos para Distribución de Puntajes
    const distEventSelect = document.getElementById('analytics-dist-event') as HTMLSelectElement;
    const eventsList = await db.events.toArray();
    let filteredEvents = eventsList.filter(e => !e.is_deleted);
    if (currentModality !== 'Todas') filteredEvents = filteredEvents.filter(e => (e.modality || '.22 LR') === currentModality);
    if (currentYear !== 'Todos') filteredEvents = filteredEvents.filter(e => e.date.startsWith(currentYear));
    filteredEvents.sort((a, b) => b.date.localeCompare(a.date));
    
    if (distEventSelect.options.length === 0 || (currentDistEvent === -1 && filteredEvents.length > 0)) {
      distEventSelect.innerHTML = '';
      if (filteredEvents.length === 0) {
        distEventSelect.innerHTML = '<option value="-1">Sin eventos</option>';
        currentDistEvent = -1;
      } else {
        for (const e of filteredEvents) {
          const opt = document.createElement('option');
          opt.value = e.id!.toString();
          const [year, month, day] = e.date.split('T')[0].split('-');
          opt.textContent = `${e.championshipDate || e.name} (${day}-${month}-${year})`;
          distEventSelect.appendChild(opt);
        }
        currentDistEvent = filteredEvents[0].id!;
        distEventSelect.value = currentDistEvent.toString();
      }
    }
    
    let distributionData = { labels: [], data1: [] };
    if (currentDistEvent !== -1) {
      distributionData = await getScoreDistributionData(currentDistEvent, currentModality);
    }
    
    let historyData = { labels: [], data1: [] };
    if (currentShooter !== 'Todos') {
      historyData = await getShooterHistoryData(currentShooter, currentModality, currentYear);
    }
    
    const ctxSocial = document.getElementById('chart-social') as HTMLCanvasElement;
    const ctxComp = document.getElementById('chart-competitive') as HTMLCanvasElement;
    const ctxTop = document.getElementById('chart-top-shooters') as HTMLCanvasElement;
    const ctxHistory = document.getElementById('chart-shooter-history') as HTMLCanvasElement;
    const ctxRet = document.getElementById('chart-retention') as HTMLCanvasElement;
    const ctxDist = document.getElementById('chart-distribution') as HTMLCanvasElement;
    const ctxEff = document.getElementById('chart-effectiveness') as HTMLCanvasElement;
    const ctxX = document.getElementById('chart-factor-x') as HTMLCanvasElement;
    const ctxChamp = document.getElementById('chart-championship') as HTMLCanvasElement;
    
    if (socialChart) socialChart.destroy();
    if (compChart) compChart.destroy();
    if (topChart) topChart.destroy();
    if (historyChart) historyChart.destroy();
    if (retChart) retChart.destroy();
    if (distChart) distChart.destroy();
    if (effChart) effChart.destroy();
    if (xChart) xChart.destroy();
    if (champChart) champChart.destroy();
    
    const lightGridColor = '#f1f5f9';
    
    // CHART 1: Social Growth (Azul CPTP)
    socialChart = new Chart(ctxSocial, {
      type: 'bar',
      data: {
        labels: socialData.labels,
        datasets: [{
          label: 'Tiradores',
          data: socialData.data1,
          backgroundColor: 'rgba(0, 86, 179, 0.85)',
          borderColor: '#0056b3',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0f1f3d', titleFont: { size: 14 }, bodyFont: { size: 15, weight: 'bold' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });

    // CHART 2: Retention (Gris, Azul, Rojo CPTP)
    retChart = new Chart(ctxRet, {
      type: 'doughnut',
      data: {
        labels: retentionData.labels,
        datasets: [{
          data: retentionData.data1,
          backgroundColor: [
            'rgba(148, 163, 184, 0.85)', // Gris (Turistas)
            'rgba(0, 86, 179, 0.85)',   // Azul (Regulares)
            'rgba(183, 32, 28, 0.85)'    // Rojo CPTP (Fieles)
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#0f1f3d', font: { size: 14, weight: 'bold' } } },
          tooltip: { backgroundColor: '#0f1f3d', titleFont: { size: 14 }, bodyFont: { size: 15, weight: 'bold' } }
        },
        cutout: '60%'
      }
    });
    
    // CHART 3: Factor X (Azul CPTP)
    xChart = new Chart(ctxX, {
      type: 'bar',
      data: {
        labels: xData.labels,
        datasets: [{
          label: 'Total Moscas (X)',
          data: xData.data1,
          backgroundColor: 'rgba(0, 86, 179, 0.85)',
          borderColor: '#0056b3',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0f1f3d' }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });

    // CHART 4: Target Effectiveness (Navy CPTP)
    effChart = new Chart(ctxEff, {
      type: 'bar',
      data: {
        labels: effectivenessData.labels,
        datasets: [{
          label: '% Aciertos',
          data: effectivenessData.data1,
          backgroundColor: 'rgba(15, 31, 61, 0.85)',
          borderColor: '#0f1f3d',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { 
            backgroundColor: '#0f1f3d', 
            callbacks: {
              label: function(context) { return context.parsed.y + '%'; }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });

    // CHART 5: Competitive (Rojo & Azul CPTP)
    compChart = new Chart(ctxComp, {
      type: 'line',
      data: {
        labels: compData.labels,
        datasets: [
          {
            label: 'Score Top',
            data: compData.data2!,
            borderColor: '#b7201c', // Rojo CPTP
            backgroundColor: 'rgba(183, 32, 28, 0.08)',
            borderWidth: 3, tension: 0.2, fill: true,
            pointBackgroundColor: '#ffffff', pointBorderColor: '#b7201c', pointRadius: 5
          },
          {
            label: 'Promedio Global',
            data: compData.data1,
            borderColor: '#0056b3', // Azul CPTP
            borderWidth: 2, borderDash: [4, 4], tension: 0.2,
            pointBackgroundColor: '#ffffff', pointBorderColor: '#0056b3', pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#0f1f3d', font: { weight: 'bold' } } },
          tooltip: { backgroundColor: '#0f1f3d', titleFont: { size: 14 }, bodyFont: { size: 14, weight: 'bold' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });

    // CHART 6: Score Distribution (Rojo CPTP)
    distChart = new Chart(ctxDist, {
      type: 'bar',
      data: {
        labels: distributionData.labels,
        datasets: [{
          label: 'Series Completadas',
          data: distributionData.data1,
          backgroundColor: 'rgba(183, 32, 28, 0.85)',
          borderColor: '#b7201c',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0f1f3d', titleFont: { size: 14 }, bodyFont: { size: 15, weight: 'bold' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });

    // CHART 7: Championship Ranking (Azul CPTP)
    champChart = new Chart(ctxChamp, {
      type: 'bar',
      data: {
        labels: champData.labels,
        datasets: [{
          label: 'Total Acumulado',
          data: champData.data1,
          backgroundColor: 'rgba(0, 86, 179, 0.85)',
          borderColor: '#0056b3',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1f3d' } },
        scales: {
          x: { beginAtZero: true, grid: { color: lightGridColor } },
          y: { grid: { display: false } }
        }
      }
    });

    // CHART 8: Top 5 Shooters (Rojo CPTP)
    topChart = new Chart(ctxTop, {
      type: 'bar',
      data: {
        labels: topData.labels,
        datasets: [{
          label: 'Promedio Histórico',
          data: topData.data1,
          backgroundColor: 'rgba(183, 32, 28, 0.85)',
          borderColor: '#b7201c',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1f3d' } },
        scales: {
          x: { beginAtZero: true, grid: { color: lightGridColor } },
          y: { grid: { display: false } }
        }
      }
    });

    // CHART 9: History Individual (Azul CPTP)
    historyChart = new Chart(ctxHistory, {
      type: 'line',
      data: {
        labels: historyData.labels,
        datasets: [{
          label: currentShooter === 'Todos' ? 'Seleccione tirador' : currentShooter,
          data: historyData.data1,
          borderColor: '#0056b3',
          backgroundColor: 'rgba(0, 86, 179, 0.08)',
          borderWidth: 3, tension: 0.3, fill: true,
          pointBackgroundColor: '#ffffff', pointBorderColor: '#0056b3', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1f3d' } },
        scales: {
          y: { beginAtZero: true, grid: { color: lightGridColor } },
          x: { grid: { display: false } }
        }
      }
    });
  }
  
  // Listeners
  const selMod = document.getElementById('analytics-modality') as HTMLSelectElement;
  selMod.addEventListener('change', () => { currentModality = selMod.value; drawCharts(); });
  
  const selYear = document.getElementById('analytics-year') as HTMLSelectElement;
  selYear.addEventListener('change', () => { 
    currentYear = selYear.value; 
    currentDistEvent = -1;
    const distEventSelect = document.getElementById('analytics-dist-event') as HTMLSelectElement;
    if (distEventSelect) distEventSelect.innerHTML = '';
    drawCharts(); 
  });
  
  shooterSelect.addEventListener('change', () => { currentShooter = shooterSelect.value; drawCharts(); });
  
  const distEventSelectGlobal = document.getElementById('analytics-dist-event') as HTMLSelectElement;
  if (distEventSelectGlobal) {
    distEventSelectGlobal.addEventListener('change', () => {
      currentDistEvent = parseInt(distEventSelectGlobal.value);
      drawCharts();
    });
  }
  
  document.getElementById('btn-back-analytics')?.addEventListener('click', () => {
    window.location.hash = '/';
  });
  
  await drawCharts();
}
