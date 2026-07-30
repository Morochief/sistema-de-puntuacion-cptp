/**
 * backup.ts
 * Funciones para exportar e importar una copia de seguridad completa de un
 * evento o toda la base de datos en formato JSON con validación runtime estricta (Zod).
 */

import { z } from 'zod';
import { db } from './db';
import type { ShootingEvent, Participant, Series, MasterCompetitor } from './types';
import { showToast, showConfirm } from './modals';

const BACKUP_VERSION = 1;

// ── Esquemas Zod para Validación Runtime (Mastering TypeScript 5.9+) ──────

export const ShootingEventZodSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  date: z.string(),
  location: z.string().optional().default(''),
  championshipDate: z.string().optional().default(''),
  modality: z.string().optional().default('.22 LR'),
  createdAt: z.number().optional(),
  is_deleted: z.boolean().optional().default(false),
  isPilot: z.boolean().optional().default(false)
});

export const ParticipantZodSchema = z.object({
  id: z.number().optional(),
  eventId: z.number(),
  name: z.string(),
  competitorNumber: z.number(),
  category: z.string().optional().default(''),
  tanda: z.number().optional(),
  spot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  tieRank: z.number().optional(),
  paymentStatus: z.enum(['pending', 'paid']).optional().default('paid'),
  status: z.enum(['active', 'withdrawn', 'disqualified']).optional().default('active'),
  presentForRaffle: z.boolean().optional().default(true),
  tandaS2: z.number().optional(),
  spotS2: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  sector: z.string().optional(),
  sectorS2: z.string().optional(),
  sharedRifleId: z.string().optional(),
  is_deleted: z.boolean().optional().default(false)
});

export const SeriesZodSchema = z.object({
  id: z.number().optional(),
  eventId: z.number(),
  participantId: z.number(),
  seriesNumber: z.union([z.literal(1), z.literal(2)]),
  shots: z.array(z.number()),
  totalScore: z.number(),
  bonusActive: z.boolean().optional().default(false),
  createdAt: z.number().optional(),
  is_deleted: z.boolean().optional().default(false)
});

export const MasterCompetitorZodSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  championshipTieRank: z.number().optional(),
  createdAt: z.number().optional(),
  is_deleted: z.boolean().optional().default(false)
});

export const FullBackupZodSchema = z.object({
  version: z.number(),
  type: z.string().optional(),
  exportedAt: z.string(),
  events: z.array(ShootingEventZodSchema),
  participants: z.array(ParticipantZodSchema),
  series: z.array(SeriesZodSchema),
  masterCompetitors: z.array(MasterCompetitorZodSchema).optional().default([])
});

export const SingleEventBackupZodSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  event: ShootingEventZodSchema,
  participants: z.array(ParticipantZodSchema),
  series: z.array(SeriesZodSchema)
});

export type FullBackupFile = z.infer<typeof FullBackupZodSchema>;
export type BackupFile = z.infer<typeof SingleEventBackupZodSchema>;

// ── Exportación Completa de la Base de Datos ──────────────────────────────

export async function exportFullDatabaseBackup(): Promise<void> {
  try {
    const events = await db.events.filter((item: ShootingEvent) => !item.is_deleted).toArray();
    const participants = await db.participants.filter((item: Participant) => !item.is_deleted).toArray();
    const series = await db.series.filter((item: Series) => !item.is_deleted).toArray();
    const masterCompetitors = await db.masterCompetitors.filter((item: MasterCompetitor) => !item.is_deleted).toArray();

    const backup: FullBackupFile = {
      version: BACKUP_VERSION,
      type: 'full_cptp_database_backup',
      exportedAt: new Date().toISOString(),
      events: events as any,
      participants: participants as any,
      series: series as any,
      masterCompetitors: masterCompetitors as any,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
    link.download = `cptp_backup_COMPLETO_${dateStr}_${timeStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Copia COMPLETA descargada: ${events.length} eventos, ${participants.length} tiradores, ${series.length} series`, 'success', 4000);
  } catch (err) {
    console.error('[backup] Error al exportar copia completa:', err);
    showToast('Error al descargar la copia completa.', 'error');
  }
}

// ── Exportar Evento Individual ─────────────────────────────────────────────

export async function exportEventBackup(eventId: number): Promise<void> {
  try {
    const event = await db.events.get(eventId);
    if (!event) { showToast('Evento no encontrado.', 'error'); return; }

    const participants = await db.participants.where('eventId').equals(eventId).filter((item: Participant) => !item.is_deleted).toArray();
    const series       = await db.series.where('eventId').equals(eventId).filter((item: Series) => !item.is_deleted).toArray();

    const backup: BackupFile = {
      version:    BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      event:      event as any,
      participants: participants as any,
      series:     series as any,
    };

    const json     = JSON.stringify(backup, null, 2);
    const blob     = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const link     = document.createElement('a');
    link.href      = url;
    const safeName = event.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 24);
    const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.download  = `cptp_backup_${safeName}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Copia exportada: ${participants.length} tiradores, ${series.length} series`, 'success');
  } catch (err) {
    console.error('[backup] Error al exportar:', err);
    showToast('Error al exportar la copia.', 'error');
  }
}

// ── Importar Evento Individual con Zod Validation ─────────────────────────

export function importEventBackup(onComplete: () => void): void {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json,application/json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;

    try {
      const text = await file.text();
      const rawObj = JSON.parse(text);

      // Validar con Zod
      const parseResult = SingleEventBackupZodSchema.safeParse(rawObj);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        const msg = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Esquema no válido';
        showToast(`Archivo de respaldo inválido (${msg}).`, 'error', 5000);
        return;
      }

      const data = parseResult.data;

      const confirmed = await showConfirm(
        'Importar Evento',
        `¿Importar el evento "${data.event.name}" con ${data.participants.length} tiradores y ${data.series.length} series?`
      );
      if (!confirmed) return;

      const newEventId = await db.events.add({
        name:      data.event.name,
        date:      data.event.date,
        location:  data.event.location || '',
        championshipDate: data.event.championshipDate || '',
        modality:  data.event.modality || '.22 LR',
        createdAt: data.event.createdAt ?? Date.now(),
        isPilot:   !!data.event.isPilot,
        is_deleted: false
      } as ShootingEvent);

      const sortedParticipants = [...data.participants].sort(
        (a, b) => (a.competitorNumber ?? 0) - (b.competitorNumber ?? 0)
      );
      const participantIdMap = new Map<number, number>();
      let consecutiveNumber = 1;
      for (const p of sortedParticipants) {
        const oldPId = p.id ?? consecutiveNumber;
        const newPId = await db.participants.add({
          eventId:          newEventId as number,
          name:             p.name,
          competitorNumber: consecutiveNumber,
          category:         p.category || '',
          sector:           p.sector,
          spot:             p.spot,
          tanda:            p.tanda,
          tandaS2:          p.tandaS2,
          spotS2:           p.spotS2,
          status:           p.status || 'active',
          paymentStatus:    p.paymentStatus || 'paid',
          sharedRifleId:    p.sharedRifleId,
          presentForRaffle: p.presentForRaffle ?? true,
          is_deleted:       false
        } as Participant);
        participantIdMap.set(oldPId, newPId as number);
        consecutiveNumber++;
      }

      for (const s of data.series) {
        const newPId = participantIdMap.get(s.participantId);
        if (newPId === undefined) continue;
        await db.series.add({
          eventId:       newEventId as number,
          participantId: newPId,
          seriesNumber:  s.seriesNumber,
          shots:         s.shots,
          totalScore:    s.totalScore,
          bonusActive:   !!s.bonusActive,
          createdAt:     s.createdAt ?? Date.now(),
          is_deleted:    false
        } as Series);
      }

      showToast(
        `Evento "${data.event.name}" importado — ${data.participants.length} tiradores, ${data.series.length} series`,
        'success'
      );
      onComplete();

    } catch (err) {
      console.error('[backup] Error al importar:', err);
      showToast('Error al leer el archivo. Verificá que sea un backup válido.', 'error');
    }
  });

  input.click();
}

// ── Importar Base de Datos Completa con Zod Validation ────────────────────

export function importFullDatabaseBackup(onComplete: () => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;

    try {
      const text = await file.text();
      const rawObj = JSON.parse(text);

      // Validar con Zod
      const parseResult = FullBackupZodSchema.safeParse(rawObj);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        const msg = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Esquema completo no válido';
        showToast(`Archivo de copia completa inválido (${msg}).`, 'error', 5000);
        return;
      }

      const data = parseResult.data;

      const confirmed = await showConfirm(
        'Restaurar Base de Datos Completa',
        `¿Restaurar copia de seguridad con ${data.events.length} eventos, ${data.participants.length} competidores y ${data.series.length} series en este dispositivo?`
      );
      if (!confirmed) return;

      for (const e of data.events) {
        await db.events.put(e as ShootingEvent);
      }
      for (const p of data.participants) {
        await db.participants.put(p as Participant);
      }
      for (const s of data.series) {
        await db.series.put(s as Series);
      }
      if (Array.isArray(data.masterCompetitors)) {
        for (const mc of data.masterCompetitors) {
          await db.masterCompetitors.put(mc as MasterCompetitor);
        }
      }

      showToast(`Base de datos restaurada correctamente desde el archivo de respaldo`, 'success', 4000);
      onComplete();
    } catch (err) {
      console.error('[backup] Error al importar respaldo completo:', err);
      showToast('Error al leer el archivo de copia completa.', 'error');
    }
  });

  input.click();
}
