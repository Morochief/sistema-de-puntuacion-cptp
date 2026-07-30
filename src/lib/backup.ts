/**
 * backup.ts
 * Funciones para exportar e importar una copia de seguridad completa de un
 * evento en formato JSON. Permite trasladar datos de una máquina a otra.
 */

import { db } from './db';
import type { ShootingEvent, Participant, Series } from './types';
import { showToast, showConfirm } from './modals';

const BACKUP_VERSION = 1;

// ── Tipos internos del backup ──────────────────────────────────────────────

interface BackupFile {
  version: number;
  exportedAt: string;
  event: ShootingEvent;
  participants: Participant[];
  series: Series[];
}

export interface FullBackupFile {
  version: number;
  type: 'full_cptp_database_backup';
  exportedAt: string;
  events: ShootingEvent[];
  participants: Participant[];
  series: Series[];
  masterCompetitors?: any[];
}

// ── Exportación Completa de la Base de Datos ──────────────────────────────

export async function exportFullDatabaseBackup(): Promise<void> {
  try {
    const events = await db.events.filter((item: any) => !item.is_deleted).toArray();
    const participants = await db.participants.filter((item: any) => !item.is_deleted).toArray();
    const series = await db.series.filter((item: any) => !item.is_deleted).toArray();
    const masterCompetitors = await db.masterCompetitors.filter((item: any) => !item.is_deleted).toArray();

    const backup: FullBackupFile = {
      version: BACKUP_VERSION,
      type: 'full_cptp_database_backup',
      exportedAt: new Date().toISOString(),
      events,
      participants,
      series,
      masterCompetitors,
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

// ── Exportar ───────────────────────────────────────────────────────────────

/**
 * Exporta todos los datos de un evento (participantes + series) como un
 * archivo JSON descargable.
 */
export async function exportEventBackup(eventId: number): Promise<void> {
  try {
    const event = await db.events.get(eventId);
    if (!event) { showToast('Evento no encontrado.', 'error'); return; }

    const participants = await db.participants.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();
    const series       = await db.series.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();

    const backup: BackupFile = {
      version:    BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      event,
      participants,
      series,
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

// ── Importar ───────────────────────────────────────────────────────────────

/**
 * Abre un selector de archivo JSON y, si el usuario elige un backup válido,
 * lo importa en la base de datos local reasignando todos los IDs para evitar
 * colisiones con datos ya existentes.
 *
 * @param onComplete  Callback que se invoca al terminar (ej: re-renderizar dashboard)
 */
export function importEventBackup(onComplete: () => void): void {
  // Crear input[type=file] oculto para disparar el selector nativo
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
      const data: BackupFile = JSON.parse(text);

      // ── Validación básica ──────────────────────────────────────────────
      if (data.version !== BACKUP_VERSION) {
        showToast('Versión de backup no compatible.', 'error');
        return;
      }
      if (!data.event || !Array.isArray(data.participants) || !Array.isArray(data.series)) {
        showToast('Archivo de backup inválido o corrupto.', 'error');
        return;
      }

      const confirmed = await showConfirm(
        'Importar Evento',
        `¿Importar el evento "${data.event.name}" con ${data.participants.length} tiradores y ${data.series.length} series?`
      );
      if (!confirmed) return;

      // ── Insertar evento (sin ID — Dexie asigna uno nuevo) ─────────────
      const oldEventId = data.event.id!;
      const newEventId = await db.events.add({
        name:      data.event.name,
        date:      data.event.date,
        location:  data.event.location,
        createdAt: data.event.createdAt ?? Date.now(),
      } as ShootingEvent);

      // ── Insertar participantes y construir mapa de IDs viejos → nuevos ─
      // Ordenar por competitorNumber original y renumerar consecutivamente
      const sortedParticipants = [...data.participants].sort(
        (a, b) => (a.competitorNumber ?? 0) - (b.competitorNumber ?? 0)
      );
      const participantIdMap = new Map<number, number>();
      let consecutiveNumber = 1;
      for (const p of sortedParticipants) {
        const oldPId = p.id!;
        const newPId = await db.participants.add({
          eventId:          newEventId as number,
          name:             p.name,
          competitorNumber: consecutiveNumber,
          category:         p.category,
          sector:           p.sector,
          spot:             p.spot,
          tanda:            p.tanda,
          tandaS2:          p.tandaS2,
          spotS2:           p.spotS2,
          status:           p.status,
          paymentStatus:    p.paymentStatus,
          sharedRifleId:    p.sharedRifleId,
          presentForRaffle: p.presentForRaffle,
        } as Participant);
        participantIdMap.set(oldPId, newPId as number);
        consecutiveNumber++;
      }

      // ── Insertar series con IDs reasignados ───────────────────────────
      for (const s of data.series) {
        const newPId = participantIdMap.get(s.participantId);
        if (newPId === undefined) continue; // seguridad: saltar huérfanos
        await db.series.add({
          eventId:       newEventId as number,
          participantId: newPId,
          seriesNumber:  s.seriesNumber,
          shots:         s.shots,
          totalScore:    s.totalScore,
          createdAt:     s.createdAt ?? Date.now(),
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

/**
 * Importa un respaldo completo de la base de datos desde un archivo JSON.
 */
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
      const data: FullBackupFile = JSON.parse(text);

      if (!data.events || !Array.isArray(data.events) || !Array.isArray(data.participants) || !Array.isArray(data.series)) {
        showToast('Archivo de backup completo inválido o corrupto.', 'error');
        return;
      }

      const confirmed = await showConfirm(
        'Restaurar Base de Datos Completa',
        `¿Restaurar copia de seguridad con ${data.events.length} eventos, ${data.participants.length} competidores y ${data.series.length} series en este dispositivo?`
      );
      if (!confirmed) return;

      for (const e of data.events) {
        await db.events.put(e);
      }
      for (const p of data.participants) {
        await db.participants.put(p);
      }
      for (const s of data.series) {
        await db.series.put(s);
      }
      if (Array.isArray(data.masterCompetitors)) {
        for (const mc of data.masterCompetitors) {
          await db.masterCompetitors.put(mc);
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
