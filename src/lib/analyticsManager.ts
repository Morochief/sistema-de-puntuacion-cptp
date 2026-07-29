import { db } from './db';
import type { Modality, ShootingEvent } from './types';

export interface ChartDataset {
  labels: string[];
  data1: number[];
  data2?: number[];
}

export async function getAnalyticsEvents(modalityFilter: string): Promise<ShootingEvent[]> {
  let events = await db.events.filter((e: any) => !e.is_deleted && !e.isPilot).toArray();
  
  if (modalityFilter !== 'Todas') {
    events = events.filter((e: any) => {
      let em = e.modality || '.22 LR';
      if (e.name?.includes('.308') || e.championshipDate?.includes('.308')) em = '.308';
      else if (e.name?.includes('.223') || e.championshipDate?.includes('.223')) em = '.223';
      return em === modalityFilter;
    });
  }
  
  // Orden cronológico ascendente (más viejo a más nuevo)
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function getSocialGrowthData(modality: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality);
  const labels: string[] = [];
  const data1: number[] = []; // Inscriptos
  
  for (const e of events) {
    if (!e.id) continue;
    const participants = await db.participants.where('eventId').equals(e.id).filter((p: any) => !p.is_deleted).toArray();
    
    // Contamos solo los activos (ni descalificados ni ausentes)
    const activeCount = participants.filter(p => p.status !== 'dq' && p.status !== 'dns').length;
    
    // Usamos el campeonato o el nombre corto si es muy largo
    const label = e.championshipDate || (e.name.length > 20 ? e.name.substring(0, 17) + '...' : e.name);
    
    labels.push(label);
    data1.push(activeCount);
  }
  
  return { labels, data1 };
}

export async function getCompetitiveGrowthData(modality: string): Promise<ChartDataset> {
  const events = await getAnalyticsEvents(modality);
  const labels: string[] = [];
  const data1: number[] = []; // Promedio
  const data2: number[] = []; // Max Score
  
  for (const e of events) {
    if (!e.id) continue;
    
    // Traer todas las series válidas del evento
    const series = await db.series.where('eventId').equals(e.id).filter((s: any) => !s.is_deleted).toArray();
    
    const label = e.championshipDate || (e.name.length > 20 ? e.name.substring(0, 17) + '...' : e.name);
    
    if (series.length === 0) {
      labels.push(label);
      data1.push(0);
      data2.push(0);
      continue;
    }
    
    // Calcular score máximo
    let maxScore = 0;
    let sumScore = 0;
    
    for (const s of series) {
      const score = s.totalScore || 0;
      if (score > maxScore) maxScore = score;
      sumScore += score;
    }
    
    // Promedio de todas las series (redondeado a 2 decimales)
    const avgScore = Number((sumScore / series.length).toFixed(2));
    
    labels.push(label);
    data1.push(avgScore);
    data2.push(maxScore);
  }
  
  return { labels, data1, data2 };
}
