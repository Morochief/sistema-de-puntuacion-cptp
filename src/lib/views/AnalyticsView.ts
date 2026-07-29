import { getSocialGrowthData, getCompetitiveGrowthData } from '../analyticsManager';
import Chart from 'chart.js/auto';

export async function renderAnalytics(): Promise<void> {
  const app = document.getElementById('view-analytics');
  if (!app) return;
  
  let currentModality = 'Todas';
  
  const layout = `
  <div class="max-w-[1200px] mx-auto p-4 animate-fade-in" style="font-family: 'Inter', sans-serif;">
    <div style="margin-bottom:20px;">
      <button class="btn-ghost-custom" id="btn-back-analytics" aria-label="Volver al inicio">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Inicio
      </button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-family:'Rajdhani', sans-serif; font-size:2.5rem; font-weight:800; color:#0f172a; margin:0; line-height:1.1;">Analíticas CPTP</h1>
        <p style="color:#64748b; font-size:1rem; margin:4px 0 0;">Crecimiento de inscriptos y evolución competitiva.</p>
      </div>
      <div>
        <select id="analytics-modality" style="padding:10px 16px; border:2px solid #cbd5e1; border-radius:12px; font-size:0.95rem; font-weight:700; color:#0f172a; background:#ffffff; cursor:pointer; outline:none; transition:all 0.2s; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <option value="Todas">Todas las Categorías</option>
          <option value=".22 LR">Solo .22 LR</option>
          <option value=".308">Solo Fuego Central (.308)</option>
          <option value=".223">Solo Fuego Central (.223)</option>
        </select>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
      
      <!-- Chart 1: Social Growth -->
      <div style="background:#ffffff; border-radius:24px; padding:24px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01); border:1px solid #f1f5f9;">
        <h2 style="font-family:'Rajdhani', sans-serif; font-size:1.4rem; font-weight:700; color:#1e293b; margin:0 0 4px;">Crecimiento de Inscriptos</h2>
        <p style="font-size:0.85rem; color:#64748b; margin-bottom:20px;">Evolución de la participación social por evento.</p>
        <div style="position:relative; height:300px; width:100%;">
          <canvas id="chart-social"></canvas>
        </div>
      </div>
      
      <!-- Chart 2: Competitive Growth -->
      <div style="background:#ffffff; border-radius:24px; padding:24px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01); border:1px solid #f1f5f9;">
        <h2 style="font-family:'Rajdhani', sans-serif; font-size:1.4rem; font-weight:700; color:#1e293b; margin:0 0 4px;">Evolución Competitiva</h2>
        <p style="font-size:0.85rem; color:#64748b; margin-bottom:20px;">Promedio general vs Puntaje más alto de la fecha.</p>
        <div style="position:relative; height:300px; width:100%;">
          <canvas id="chart-competitive"></canvas>
        </div>
      </div>
      
    </div>
  </div>
  `;
  
  app.innerHTML = layout;
  
  let socialChart: Chart | null = null;
  let compChart: Chart | null = null;
  
  async function drawCharts() {
    const socialData = await getSocialGrowthData(currentModality);
    const compData = await getCompetitiveGrowthData(currentModality);
    
    const ctxSocial = document.getElementById('chart-social') as HTMLCanvasElement;
    const ctxComp = document.getElementById('chart-competitive') as HTMLCanvasElement;
    
    if (socialChart) socialChart.destroy();
    if (compChart) compChart.destroy();
    
    socialChart = new Chart(ctxSocial, {
      type: 'bar',
      data: {
        labels: socialData.labels,
        datasets: [{
          label: 'Tiradores Activos',
          data: socialData.data1,
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
          borderColor: '#2563eb', // blue-600
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(37, 99, 235, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Inter' } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: { font: { family: 'Inter' } },
            grid: { display: false }
          }
        }
      }
    });
    
    compChart = new Chart(ctxComp, {
      type: 'line',
      data: {
        labels: compData.labels,
        datasets: [
          {
            label: 'Puntaje Máximo',
            data: compData.data2!,
            borderColor: '#10b981', // emerald-500
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          },
          {
            label: 'Puntaje Promedio',
            data: compData.data1,
            borderColor: '#f59e0b', // amber-500
            backgroundColor: 'transparent',
            borderWidth: 3,
            borderDash: [5, 5],
            tension: 0.4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#f59e0b',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Inter', weight: '600' }, usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { family: 'Inter' } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: { font: { family: 'Inter' } },
            grid: { display: false }
          }
        }
      }
    });
  }
  
  const selMod = document.getElementById('analytics-modality') as HTMLSelectElement;
  selMod.addEventListener('change', () => {
    currentModality = selMod.value;
    drawCharts();
  });
  
  document.getElementById('btn-back-analytics')?.addEventListener('click', () => {
    window.location.hash = '/';
  });
  
  await drawCharts();
}
