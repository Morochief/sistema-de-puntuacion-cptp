import { db } from './db';
import type { Modality, ShootingEvent, Participant, Series } from './types';

export interface ChartDataset {
  labels: string[];
  data1: number[];
  data2?: number[];
}

export async function getAnalyticsEvents(modalityFilter: string, yearFilter: string): Promise<ShootingEvent[]> {
  let events = await db.events.filter((e: any) => !e.is_deleted && !e.isPilot).toArray();
  
  if (modalityFilter !== 'Todas') {
    events = events.filter((e: any) => {
      let em = e.modality || '.22 LR';
      if (e.name?.includes('.308') || e.championshipDate?.includes('.308')) em = '.308';
      else if (e.name?.includes('.223') || e.championshipDate?.includes('.223')) em = '.223';
      return em === modalityFilter;
    });
  }
  
  if (yearFilter !== 'Todos') {
    events = events.filter((e: any) => e.date.startsWith(yearFilter));
  }
  
  // Orden cronológico ascendente (más viejo a más nuevo)
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function getSocialGrowthData(modality: string, year: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality, year);
  const labels: string[] = [];
  const data1: number[] = []; // Inscriptos
  
  for (const e of events) {
    if (!e.id) continue;
    const participants = await db.participants.where('eventId').equals(e.id).filter((p: any) => !p.is_deleted).toArray();
    
    // Contamos solo los activos (ni descalificados ni ausentes)
    const activeCount = participants.filter(p => p.status !== 'dq' && p.status !== 'dns').length;
    
    // Usamos el campeonato o el nombre corto si es muy largo
    const label = e.championshipDate || (e.name.length > 15 ? e.name.substring(0, 12) + '...' : e.name);
    
    labels.push(label);
    data1.push(activeCount);
  }
  
  return { labels, data1 };
}

export async function getCompetitiveGrowthData(modality: string, year: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality, year);
  const labels: string[] = [];
  const data1: number[] = []; // Promedio
  const data2: number[] = []; // Max Score
  
  for (const e of events) {
    if (!e.id) continue;
    
    // Traer todas las series válidas del evento
    const series = await db.series.where('eventId').equals(e.id).filter((s: any) => !s.is_deleted).toArray();
    
    const label = e.championshipDate || (e.name.length > 15 ? e.name.substring(0, 12) + '...' : e.name);
    
    if (series.length === 0) {
      labels.push(label);
      data1.push(0);
      data2.push(0);
      continue;
    }
    
    // Calcular score máximo y promedio
    let maxScore = 0;
    let sumScore = 0;
    
    for (const s of series) {
      const score = s.totalScore || 0;
      if (score > maxScore) maxScore = score;
      sumScore += score;
    }
    
    const avgScore = Number((sumScore / series.length).toFixed(2));
    
    labels.push(label);
    data1.push(avgScore);
    data2.push(maxScore);
  }
  
  return { labels, data1, data2 };
}

export async function getTopShootersData(modality: string, year: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality, year);
  const eventIds = events.map(e => e.id!);
  
  if (eventIds.length === 0) return { labels: [], data1: [] };

  // Diccionario para acumular scores
  const shooterMap = new Map<string, { totalScore: number, seriesCount: number }>();
  
  for (const eid of eventIds) {
    const participants = await db.participants.where('eventId').equals(eid).filter((p: any) => !p.is_deleted && p.status !== 'dq' && p.status !== 'dns').toArray();
    const series = await db.series.where('eventId').equals(eid).filter((s: any) => !s.is_deleted).toArray();
    
    for (const p of participants) {
      const pName = p.name.trim().toLowerCase();
      const pSeries = series.filter(s => s.participantId === p.id);
      
      let sum = 0;
      for (const s of pSeries) sum += (s.totalScore || 0);
      
      if (!shooterMap.has(pName)) {
        shooterMap.set(pName, { totalScore: 0, seriesCount: 0 });
      }
      const st = shooterMap.get(pName)!;
      st.totalScore += sum;
      st.seriesCount += pSeries.length;
    }
  }

  // Filtrar tiradores que al menos hayan participado en un mínimo de series (ej. 2)
  const averages = Array.from(shooterMap.entries())
    .filter(([name, data]) => data.seriesCount >= 2)
    .map(([name, data]) => ({
      name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      avg: Number((data.totalScore / data.seriesCount).toFixed(2))
    }));

  averages.sort((a, b) => b.avg - a.avg);
  const top5 = averages.slice(0, 5);

  return {
    labels: top5.map(t => t.name),
    data1: top5.map(t => t.avg)
  };
}

export async function getShooterHistoryData(masterName: string, modality: string, year: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality, year);
  
  const labels: string[] = [];
  const data1: number[] = []; // Puntaje Promedio que hizo el tirador en esa fecha
  
  const targetName = masterName.trim().toLowerCase();

  for (const e of events) {
    if (!e.id) continue;
    
    const participants = await db.participants.where('eventId').equals(e.id).filter((p: any) => !p.is_deleted && p.name.trim().toLowerCase() === targetName).toArray();
    
    // Usamos el campeonato o el nombre corto si es muy largo
    const label = e.championshipDate || (e.name.length > 15 ? e.name.substring(0, 12) + '...' : e.name);
    
    if (participants.length === 0 || participants[0].status === 'dq' || participants[0].status === 'dns') {
      // No asistió o DQ
      continue;
    }
    
    const p = participants[0];
    const series = await db.series.where('eventId').equals(e.id).filter((s: any) => s.participantId === p.id && !s.is_deleted).toArray();
    
    if (series.length === 0) continue;
    
    let sum = 0;
    for (const s of series) sum += (s.totalScore || 0);
    const avg = Number((sum / series.length).toFixed(2));
    
    labels.push(label);
    data1.push(avg);
  }
  
  return { labels, data1 };
}
