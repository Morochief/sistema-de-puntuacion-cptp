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

// ── Exportar ───────────────────────────────────────────────────────────────

/**
 * Exporta todos los datos de un evento (participantes + series) como un
 * archivo JSON descargable.
 */
export async function exportEventBackup(eventId: number): Promise<void> {
  try {
    const event = await db.events.get(eventId);
    if (!event) { showToast('Evento no encontrado.', 'error'); return; }

    const participants = await db.participants.where('eventId').equals(eventId).toArray();
    const series       = await db.series.where('eventId').equals(eventId).toArray();

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
