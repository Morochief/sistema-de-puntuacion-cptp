import { db } from './db';
import type { Participant, Series, Shot } from './types';
import { showToast, showConfirm, showPrompt } from './modals';
import { getModalityConfig } from './modalityConfig';

export async function handleSeedParticipants(id: number, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) {
  const currentCount = participants.length;
  if (currentCount >= 32) {
    showToast('Límite de 32 competidores ya alcanzado.', 'error');
    return;
  }

  // 1. Obtener tiradores reales del Padrón Maestro
  let padronTiradores = [];
  try {
    padronTiradores = await db.masterCompetitors.filter((item: any) => !item.is_deleted).toArray();
  } catch (err) {
    console.warn('[Seeder] Error leyendo Padrón Maestro:', err);
  }

  // Filtrar tiradores del padrón que ya están inscritos en este evento (comparación de nombres case-insensitive)
  const registeredNames = new Set(participants.map(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));
  const availableFromPadron = padronTiradores.filter(mc => !registeredNames.has(mc.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));

  const spaceLeft = 32 - currentCount;
  let countToLoad = Math.min(availableFromPadron.length, spaceLeft);
  let usingFictional = false;

  // Si no hay tiradores en el padrón o ya están todos inscritos, preguntar si carga ficticios
  if (countToLoad === 0) {
    const confirmFictional = await showConfirm(
      'Padrón Vacío o Completo',
      'No hay tiradores en el Padrón Maestro disponibles para inscribir (están todos inscritos o el padrón está vacío). ¿Deseas cargar tiradores ficticios de demostración?'
    );
    if (!confirmFictional) return;
    usingFictional = true;
    countToLoad = Math.min(20, spaceLeft);
  }

  let namesToSeed: { name: string; category?: string }[] = [];

  if (usingFictional) {
    const firstNames = ["Carlos", "Jorge", "Alejandro", "Daniel", "Eduardo", "Federico", "Gustavo", "Hernán", "Ignacio", "Lucas", "Martín", "Nicolás", "Oscar", "Pablo", "Ricardo", "Santiago", "Tomás", "Walter", "Víctor", "Hugo", "Luis", "José", "Juan", "Pedro", "Miguel", "Ángel", "Francisco", "Javier", "Andrés", "Diego", "Fernando", "Gabriel"];
    const lastNames = ["Giménez", "Ramos", "Rossi", "López", "Benítez", "Silva", "Fernández", "Díaz", "Martínez", "González", "Sosa", "Romero", "Álvarez", "Torres", "Acosta", "Maidana", "Cardozo", "Gómez", "Sánchez", "Pérez", "Duarte", "Peralta", "Ayala", "Cáceres", "Rojas", "Galeano", "Miranda", "Rios", "Franco", "Sotomayor", "Gorostuaga", "Cardozo"];
    const shuffledFirst = [...firstNames].sort(() => Math.random() - 0.5);
    const shuffledLast = [...lastNames].sort(() => Math.random() - 0.5);
    const categories = ["Senior", "Damas", "Junior", "Promocional"];
    namesToSeed = Array.from({ length: countToLoad }, (_, idx) => ({
      name: `${shuffledFirst[idx % shuffledFirst.length]} ${shuffledLast[idx % shuffledLast.length]}`,
      category: categories[Math.floor(Math.random() * categories.length)]
    }));
  } else {
    // Preguntar cuántos del padrón quiere cargar
    const countStr = await showPrompt(
      'Cargar desde Padrón',
      `¿Cuántos tiradores del Padrón Maestro deseas inscribir? (Disponibles: ${availableFromPadron.length})`,
      String(countToLoad)
    );
    if (countStr === null) return;
    const requested = parseInt(countStr.trim(), 10);
    if (isNaN(requested) || requested <= 0) {
      showToast('Ingresá un número válido.', 'error');
      return;
    }
    const finalRequest = Math.min(requested, availableFromPadron.length, spaceLeft);
    namesToSeed = availableFromPadron.slice(0, finalRequest).map(mc => ({
      name: mc.name,
      category: mc.category
    }));
  }

  try {
    const bulkData: Participant[] = [];
    const tempParticipants = [...participants];
    let currentMax = participants.length > 0 ? Math.max(...participants.map(p => p.competitorNumber)) : 0;

    for (let i = 0; i < namesToSeed.length; i++) {
      currentMax++;
      const freeSpot = findFirstFreeSpot(tempParticipants);
      const newParticipant: Participant = {
        eventId: id,
        name: namesToSeed[i].name,
        competitorNumber: currentMax,
        tanda: freeSpot?.tanda,
        sector: freeSpot?.sector,
        spot: freeSpot?.spot,
        category: namesToSeed[i].category || 'General',
        status: 'active',
        paymentStatus: 'paid',
        presentForRaffle: true
      };
      bulkData.push(newParticipant);
      tempParticipants.push(newParticipant);
    }

    await db.participants.bulkAdd(bulkData);
    showToast(
      usingFictional 
        ? `Se inscribieron ${bulkData.length} competidores ficticios.` 
        : `Se inscribieron ${bulkData.length} competidores reales desde el Padrón.`,
      'success'
    );

    await onComplete();
  } catch (err) {
    console.error('[DB] Error al poblar tiradores:', err);
    showToast('Error al cargar competidores.', 'error');
  }
}

// --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---
export async function handleSeedScores(id: string, participants: Participant[], onComplete: () => Promise<void>) {
  if (participants.length === 0) {
    showToast('No hay competidores inscritos para simular.', 'error');
    return;
  }

  if (!await showConfirm('Simular Puntuaciones', '¿Simular puntuaciones de prueba para todos los competidores? Esto borrará las series actuales de este evento.')) return;

  try {
    const event = await db.events.get(Number(id));
    const modality = event?.modality || '.22 LR';
    const mConfig = getModalityConfig(modality);
    const isSingleSeries = mConfig.seriesPerEvent === 1;
    const isBJ = modality === '21 Blackjack';
    const isCF = modality === '.308' || modality === '.223';
    
    // 1. Limpiar series anteriores para este evento
    await db.series.where('eventId').equals(id).delete();

    const bulkSeries: Series[] = [];

    // Generar series para cada participante
    for (const p of participants) {
      if (isBJ) {
        const s1 = generateRealisticSeriesShotsBJ();
        bulkSeries.push({
          eventId: Number(id),
          participantId: p.id!,
          seriesNumber: 1,
          shots: s1.shots,
          totalScore: s1.totalScore,
          createdAt: Date.now()
        });
      } else if (isCF || isSingleSeries) {
        const s1 = generateRealisticSeriesShotsCF();
        bulkSeries.push({
          eventId: Number(id),
          participantId: p.id!,
          seriesNumber: 1,
          shots: s1.shots,
          totalScore: s1.totalScore,
          bonusActive: s1.bonusActive,
          createdAt: Date.now()
        });
      } else {
        // 2 series (.22 LR standard)
        const s1 = generateRealisticSeriesShots();
        bulkSeries.push({
          eventId: Number(id),
          participantId: p.id!,
          seriesNumber: 1,
          shots: s1.shots,
          totalScore: s1.totalScore,
          createdAt: Date.now()
        });

        const s2 = generateRealisticSeriesShots();
        bulkSeries.push({
          eventId: Number(id),
          participantId: p.id!,
          seriesNumber: 2,
          shots: s2.shots,
          totalScore: s2.totalScore,
          createdAt: Date.now() + 1000
        });
      }
    }

    await db.series.bulkAdd(bulkSeries);
    showToast(`Se simularon ${isSingleSeries ? '1' : '2'} series para cada tirador con éxito`, 'success');

    await onComplete();
  } catch (err) {
    console.error('[DB] Error simulando puntuaciones:', err);
    showToast('Error al simular puntuaciones.', 'error');
  }
}

export function generateRealisticSeriesShots(): { shots: Shot[], totalScore: number } {
  const shots: Shot[] = [];
  let shotNum = 1;

  // Blanco 15"
  let hit15 = false;
  while (shotNum <= 10 && !hit15) {
    const hit = Math.random() > 0.15;
    if (hit) {
      const val = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1][shotNum - 1] || 1;
      shots.push({ shotNumber: shotNum, targetType: '15"', hit: true, value: val });
      hit15 = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: '15"', hit: false, value: 0 });
    }
    shotNum++;
  }

  // Blanco 10"
  let hit10 = false;
  while (shotNum <= 10 && hit15 && !hit10) {
    const hit = Math.random() > 0.25;
    if (hit) {
      const val = [20, 18, 16, 14, 12, 10, 8, 6, 4][shotNum - 2] || 4;
      shots.push({ shotNumber: shotNum, targetType: '10"', hit: true, value: val });
      hit10 = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: '10"', hit: false, value: 0 });
    }
    shotNum++;
  }

  // Blanco 5"
  let hit5 = false;
  while (shotNum <= 10 && hit10 && !hit5) {
    const hit = Math.random() > 0.4;
    if (hit) {
      const val = [30, 26, 23, 20, 16, 13, 11, 7][shotNum - 3] || 7;
      shots.push({ shotNumber: shotNum, targetType: '5"', hit: true, value: val });
      hit5 = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: '5"', hit: false, value: 0 });
    }
    shotNum++;
  }

  // Adicionales
  if (hit5) {
    for (let n = shotNum; n <= 10; n++) {
      shots.push({ shotNumber: n, targetType: 'additional', hit: true, value: 1 });
    }
  }

  const totalScore = shots.reduce((sum, s) => sum + s.value, 0);
  return { shots, totalScore };
}

export function generateRealisticSeriesShotsCF(): { shots: Shot[], totalScore: number, bonusActive: boolean } {
  const shots: Shot[] = [];
  let shotNum = 1;
  let bonusActive = false;

  // Blanco Grande
  let hitGrande = false;
  while (shotNum <= 12 && !hitGrande) {
    const hit = Math.random() > 0.15;
    if (hit) {
      if (shotNum === 1) bonusActive = Math.random() > 0.5;
      const baseVal = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1][shotNum - 1] || 1;
      shots.push({ shotNumber: shotNum, targetType: 'grande', hit: true, value: baseVal });
      hitGrande = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: 'grande', hit: false, value: 0 });
    }
    shotNum++;
  }

  // Blanco Mediano
  let hitMediano = false;
  while (shotNum <= 12 && hitGrande && !hitMediano) {
    const hit = Math.random() > 0.25;
    if (hit) {
      const baseVal = [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4][shotNum - 2] || 4;
      shots.push({ shotNumber: shotNum, targetType: 'mediano', hit: true, value: baseVal });
      hitMediano = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: 'mediano', hit: false, value: 0 });
    }
    shotNum++;
  }

  // Blanco Pequeño
  let hitPequeno = false;
  while (shotNum <= 12 && hitMediano && !hitPequeno) {
    const hit = Math.random() > 0.4;
    if (hit) {
      const baseVal = [42, 38, 34, 30, 26, 22, 18, 14, 11, 7][shotNum - 3] || 7;
      shots.push({ shotNumber: shotNum, targetType: 'pequeño' as any, hit: true, value: baseVal });
      hitPequeno = true;
    } else {
      shots.push({ shotNumber: shotNum, targetType: 'pequeño' as any, hit: false, value: 0 });
    }
    shotNum++;
  }

  // Adicionales
  if (hitPequeno) {
    for (let n = shotNum; n <= 12; n++) {
      shots.push({ shotNumber: n, targetType: 'additional', hit: true, value: bonusActive ? 2 : 1 });
    }
  }

  const totalScore = shots.reduce((acc, s) => acc + s.value, 0);
  return { shots, totalScore, bonusActive };
}

export function generateRealisticSeriesShotsBJ(): { shots: Shot[], totalScore: number } {
  const shots: Shot[] = [];
  let shotNum = 1;

  const rackTargets: { type: any; val: number }[] = [
    { type: '12"', val: 1 },
    { type: '10"', val: 2 },
    { type: '8"', val: 3 },
    { type: '6"', val: 4 },
    { type: '4"', val: 5 },
    { type: '2"', val: 6 },
  ];

  let rackCompleted = false;
  let currentTargetIdx = 0;

  while (shotNum <= 12 && !rackCompleted) {
    const target = rackTargets[currentTargetIdx];
    const hitProb = 0.85 - (currentTargetIdx * 0.08);
    const hit = Math.random() < hitProb;

    if (hit) {
      shots.push({ shotNumber: shotNum, targetType: target.type, hit: true, value: target.val });
      currentTargetIdx++;
      if (currentTargetIdx >= rackTargets.length) {
        rackCompleted = true;
      }
    } else {
      shots.push({ shotNumber: shotNum, targetType: target.type, hit: false, value: 0 });
    }
    shotNum++;
  }

  if (rackCompleted) {
    while (shotNum <= 12) {
      const hit = Math.random() > 0.35;
      shots.push({ shotNumber: shotNum, targetType: '2" (bonus)', hit, value: hit ? 21 : 0 });
      shotNum++;
    }
  }

  const totalScore = shots.reduce((acc, s) => acc + s.value, 0);
  return { shots, totalScore };
}
