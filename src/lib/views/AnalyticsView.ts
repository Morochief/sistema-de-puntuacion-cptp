import { getSocialGrowthData, getCompetitiveGrowthData, getTopShootersData, getShooterHistoryData } from '../analyticsManager';
import { db } from '../db';
import Chart from 'chart.js/auto';

export async function renderAnalytics(): Promise<void> {
  const app = document.getElementById('view-analytics');
  if (!app) return;
  
  let currentModality = 'Todas';
  let currentYear = 'Todos';
  let currentShooter = 'Todos';
  
  const layout = `
  <div class="max-w-[1200px] mx-auto p-4 animate-fade-in" style="font-family: 'Rajdhani', sans-serif; background-color:#020617; min-height:100vh; padding:24px; border-radius:12px; border: 1px solid #1e293b;">
    
    <div style="margin-bottom:20px;">
      <button class="btn-ghost-custom" id="btn-back-analytics" aria-label="Volver al inicio" style="color:#94a3b8; display:flex; align-items:center; gap:6px; font-weight:600; text-transform:uppercase; letter-spacing:1px; background:transparent; border:1px solid #334155; padding:6px 12px; border-radius:4px; transition:all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        INICIO
      </button>
    </div>

    <!-- HEADER TÁCTICO -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px; border-bottom:1px solid #334155; padding-bottom:16px;">
      <div>
        <h1 style="font-family:'Orbitron', sans-serif; font-size:2.2rem; font-weight:800; color:#f8fafc; margin:0; line-height:1.1; letter-spacing:1px; text-transform:uppercase;">
          INTEL <span style="color:#d52b1e;">&</span> STATS
        </h1>
        <p style="color:#64748b; font-size:1.1rem; margin:4px 0 0; font-weight:600;">Monitor de rendimiento CPTP</p>
      </div>
      
      <!-- FILTROS GLOBALES -->
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <select id="analytics-year" style="padding:10px 16px; border:1px solid #334155; border-radius:4px; font-size:1rem; font-weight:600; color:#f8fafc; background:#0f172a; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; text-transform:uppercase;">
          <option value="Todos">AÑO: TODOS</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
        
        <select id="analytics-modality" style="padding:10px 16px; border:1px solid #334155; border-radius:4px; font-size:1rem; font-weight:600; color:#f8fafc; background:#0f172a; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; text-transform:uppercase;">
          <option value="Todas">MOD: TODAS</option>
          <option value=".22 LR">.22 LR</option>
          <option value=".308">F.CENTRAL .308</option>
          <option value=".223">F.CENTRAL .223</option>
        </select>
      </div>
    </div>
    
    <!-- GRID DE GRÁFICOS (MODO TÁCTICO) -->
    <div style="display:grid; grid-template-columns: 1fr; gap:32px; margin-bottom:32px;">
      
      <!-- Chart 1: Social Growth -->
      <div style="background:#0f172a; border-radius:8px; padding:24px; border:1px solid #1e293b; position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#0038a8;"></div> <!-- Banda Azul -->
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.3rem; font-weight:700; color:#e2e8f0; margin:0 0 4px; text-transform:uppercase; letter-spacing:1px;">Asistencia Global</h2>
        <p style="font-size:1rem; color:#64748b; margin-bottom:24px; font-weight:600;">Evolución de inscriptos activos por evento.</p>
        <div style="position:relative; height:350px; width:100%;">
          <canvas id="chart-social"></canvas>
        </div>
      </div>
      
      <!-- Chart 2: Competitive Growth -->
      <div style="background:#0f172a; border-radius:8px; padding:24px; border:1px solid #1e293b; position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#d52b1e;"></div> <!-- Banda Roja -->
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.3rem; font-weight:700; color:#e2e8f0; margin:0 0 4px; text-transform:uppercase; letter-spacing:1px;">Rendimiento del Campo</h2>
        <p style="font-size:1rem; color:#64748b; margin-bottom:24px; font-weight:600;">Puntaje promedio vs Score Top a través del tiempo.</p>
        <div style="position:relative; height:350px; width:100%;">
          <canvas id="chart-competitive"></canvas>
        </div>
      </div>

    </div>

    <!-- SECCIÓN INDIVIDUAL Y RANKINGS -->
    <div style="display:grid; grid-template-columns: 1fr; gap:32px;">
      
      <!-- Chart 3: Top Shooters -->
      <div style="background:#0f172a; border-radius:8px; padding:24px; border:1px solid #1e293b;">
        <h2 style="font-family:'Orbitron', sans-serif; font-size:1.3rem; font-weight:700; color:#e2e8f0; margin:0 0 4px; text-transform:uppercase; letter-spacing:1px;">Top 5 Promedios</h2>
        <p style="font-size:1rem; color:#64748b; margin-bottom:24px; font-weight:600;">Mejores promedios históricos de la liga (Mínimo 2 series).</p>
        <div style="position:relative; height:400px; width:100%;">
          <canvas id="chart-top-shooters"></canvas>
        </div>
      </div>

      <!-- Chart 4: Shooter Individual -->
      <div style="background:#0f172a; border-radius:8px; padding:24px; border:1px solid #1e293b;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-family:'Orbitron', sans-serif; font-size:1.3rem; font-weight:700; color:#e2e8f0; margin:0 0 4px; text-transform:uppercase; letter-spacing:1px;">Historial Individual</h2>
            <p style="font-size:1rem; color:#64748b; margin:0; font-weight:600;">Tendencia de puntos por tirador.</p>
          </div>
          <select id="analytics-shooter" style="padding:8px 16px; border:1px solid #334155; border-radius:4px; font-size:1rem; font-weight:600; color:#f8fafc; background:#1e293b; cursor:pointer; outline:none; font-family:'Rajdhani', sans-serif; min-width:250px;">
            <option value="Todos">-- SELECCIONAR TIRADOR --</option>
          </select>
        </div>
        <div style="position:relative; height:350px; width:100%;">
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
  
  // Estilo global táctico para tooltips y fuentes
  Chart.defaults.font.family = "'Rajdhani', sans-serif";
  Chart.defaults.color = '#94a3b8';
  
  async function drawCharts() {
    const socialData = await getSocialGrowthData(currentModality, currentYear);
    const compData = await getCompetitiveGrowthData(currentModality, currentYear);
    const topData = await getTopShootersData(currentModality, currentYear);
    
    // Si no hay tirador seleccionado, limpiar chart 4
    let historyData = { labels: [], data1: [] };
    if (currentShooter !== 'Todos') {
      historyData = await getShooterHistoryData(currentShooter, currentModality, currentYear);
    }
    
    const ctxSocial = document.getElementById('chart-social') as HTMLCanvasElement;
    const ctxComp = document.getElementById('chart-competitive') as HTMLCanvasElement;
    const ctxTop = document.getElementById('chart-top-shooters') as HTMLCanvasElement;
    const ctxHistory = document.getElementById('chart-shooter-history') as HTMLCanvasElement;
    
    if (socialChart) socialChart.destroy();
    if (compChart) compChart.destroy();
    if (topChart) topChart.destroy();
    if (historyChart) historyChart.destroy();
    
    // CHART 1
    socialChart = new Chart(ctxSocial, {
      type: 'bar',
      data: {
        labels: socialData.labels,
        datasets: [{
          label: 'Tiradores',
          data: socialData.data1,
          backgroundColor: 'rgba(0, 56, 168, 0.7)', // Azul Paraguay
          borderColor: '#0038a8',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1e293b', titleFont: { size: 14 }, bodyFont: { size: 16, weight: 'bold' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#1e293b' } },
          x: { grid: { display: false } }
        }
      }
    });
    
    // CHART 2
    compChart = new Chart(ctxComp, {
      type: 'line',
      data: {
        labels: compData.labels,
        datasets: [
          {
            label: 'Score Top',
            data: compData.data2!,
            borderColor: '#10b981', // Emerald
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2, tension: 0.2, fill: true,
            pointBackgroundColor: '#0f172a', pointBorderColor: '#10b981'
          },
          {
            label: 'Promedio',
            data: compData.data1,
            borderColor: '#f59e0b', // Amber
            borderWidth: 2, borderDash: [4, 4], tension: 0.2,
            pointBackgroundColor: '#0f172a', pointBorderColor: '#f59e0b'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#e2e8f0' } },
          tooltip: { backgroundColor: '#1e293b', titleFont: { size: 14 }, bodyFont: { size: 14, weight: 'bold' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#1e293b' } },
          x: { grid: { display: false } }
        }
      }
    });
    
    // CHART 3
    topChart = new Chart(ctxTop, {
      type: 'bar',
      data: {
        labels: topData.labels,
        datasets: [{
          label: 'Promedio Histórico',
          data: topData.data1,
          backgroundColor: 'rgba(213, 43, 30, 0.7)', // Rojo Paraguay
          borderColor: '#d52b1e',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b' } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#1e293b' } },
          y: { grid: { display: false } }
        }
      }
    });

    // CHART 4
    historyChart = new Chart(ctxHistory, {
      type: 'line',
      data: {
        labels: historyData.labels,
        datasets: [{
          label: currentShooter === 'Todos' ? 'Seleccione tirador' : currentShooter,
          data: historyData.data1,
          borderColor: '#38bdf8', // Sky
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 2, tension: 0.3, fill: true,
          pointBackgroundColor: '#0f172a', pointBorderColor: '#38bdf8', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b' } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#1e293b' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
  
  // Listeners
  const selMod = document.getElementById('analytics-modality') as HTMLSelectElement;
  selMod.addEventListener('change', () => { currentModality = selMod.value; drawCharts(); });
  
  const selYear = document.getElementById('analytics-year') as HTMLSelectElement;
  selYear.addEventListener('change', () => { currentYear = selYear.value; drawCharts(); });
  
  shooterSelect.addEventListener('change', () => { currentShooter = shooterSelect.value; drawCharts(); });
  
  document.getElementById('btn-back-analytics')?.addEventListener('click', () => {
    window.location.hash = '/';
  });
  
  await drawCharts();
}
