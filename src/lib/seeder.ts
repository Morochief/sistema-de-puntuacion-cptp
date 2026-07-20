import { db } from './db';
import type { Participant, Series, Shot } from './types';
import { showToast, showConfirm, showPrompt } from './modals';

// --- HANDLER: POBLAR tiradores DEMO ---
 export async function handleSeedParticipants(id: string, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) {
  const currentCount = participants.length;
  if (currentCount >= 32) {
   showToast('Límite de 32 competidores ya alcanzado.', 'error');
   return;
  }

  const spaceLeft = 32 - currentCount;
  const defaultVal = Math.min(20, spaceLeft);
   const countStr = await showPrompt('Cargar Tiradores Demo', `¿Cuántos competidores demo deseas cargar? (Disponibles: ${spaceLeft})`, String(defaultVal));
   if (countStr === null) return; // Cancelado

  const count = parseInt(countStr.trim(), 10);
  if (isNaN(count) || count <= 0) {
   showToast('Por favor, ingresá un número válido mayor a 0.', 'error');
   return;
  }

  const finalCount = Math.min(count, spaceLeft);

  // Generador de nombres aleatorios realistas
  const firstNames = ["Carlos", "Jorge", "Alejandro", "Daniel", "Eduardo", "Federico", "Gustavo", "Hernán", "Ignacio", "Lucas", "Martín", "Nicolás", "Oscar", "Pablo", "Ricardo", "Santiago", "Tomás", "Walter", "Víctor", "Hugo", "Luis", "José", "Juan", "Pedro", "Miguel", "Ángel", "Francisco", "Javier", "Andrés", "Diego", "Fernando", "Gabriel"];
  const lastNames = ["Giménez", "Ramos", "Rossi", "López", "Benítez", "Silva", "Fernández", "Díaz", "Martínez", "González", "Sosa", "Romero", "Álvarez", "Torres", "Acosta", "Maidana", "Cardozo", "Gómez", "Sánchez", "Pérez", "Duarte", "Peralta", "Ayala", "Cáceres", "Rojas", "Galeano", "Miranda", "Rios", "Franco", "Sotomayor", "Gorostuaga", "Cardozo"];

  const shuffledFirst = [...firstNames].sort(() => Math.random() - 0.5);
  const shuffledLast = [...lastNames].sort(() => Math.random() - 0.5);
  const generatedNames = Array.from({ length: 32 }, (_, idx) => `${shuffledFirst[idx]} ${shuffledLast[idx]}`);

  const namesToSeed = generatedNames.slice(0, finalCount);

  try {

   const bulkData: Participant[] = [];
   const tempParticipants = [...participants];
   let currentMax = participants.length > 0 ? Math.max(...participants.map(p => p.competitorNumber)) : 0;
   const categories = ["Senior", "Damas", "Junior", "Promocional"];

   for (let i = 0; i < namesToSeed.length; i++) {
    currentMax++;
    const freeSpot = findFirstFreeSpot(tempParticipants);
    const rndCat = categories[Math.floor(Math.random() * categories.length)];
    const newParticipant: Participant = {
     eventId: id,
     name: namesToSeed[i],
     competitorNumber: currentMax,
     tanda: freeSpot?.tanda,
     sector: freeSpot?.sector,
     spot: freeSpot?.spot,
     category: rndCat
    };
    bulkData.push(newParticipant);
    tempParticipants.push(newParticipant);
   }

   await db.participants.bulkAdd(bulkData);
   showToast(`Se inscribieron ${bulkData.length} competidores demo`, 'success');

   await onComplete();
  } catch (err) {
   console.error('[DB] Error al poblar tiradores:', err);
   showToast('Error al cargar competidores demo.', 'error');
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
   // 1. Limpiar series anteriores para este evento
   await db.series.where('eventId').equals(id).delete();

   const bulkSeries: Series[] = [];

   // Función helper para generar disparos siguiendo el reglamento exacto

   // Generar 2 series para cada participante
   for (const p of participants) {
    const s1 = generateRealisticSeriesShots();
    bulkSeries.push({
     eventId: id,
     participantId: p.id!,
     seriesNumber: 1,
     shots: s1.shots,
     totalScore: s1.totalScore,
     createdAt: Date.now()
    });

    const s2 = generateRealisticSeriesShots();
    bulkSeries.push({
     eventId: id,
     participantId: p.id!,
     seriesNumber: 2,
     shots: s2.shots,
     totalScore: s2.totalScore,
     createdAt: Date.now() + 1000
    });
   }

   await db.series.bulkAdd(bulkSeries);
   showToast('Se simularon 2 series para cada tirador con éxito', 'success');

   await onComplete();
  } catch (err) {
   console.error('[DB] Error simulando puntuaciones:', err);
   showToast('Error al simular puntuaciones.', 'error');
  }
 }

export    function generateRealisticSeriesShots(): { shots: Shot[], totalScore: number } {
    const shots: Shot[] = [];
    let shotNum = 1;

    // Blanco 15"
    let hit15 = false;
    while (shotNum <= 10 && !hit15) {
     const hit = Math.random() > 0.15; // 85% probabilidad
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
     const hit = Math.random() > 0.25; // 75% probabilidad
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
     const hit = Math.random() > 0.4; // 60% probabilidad
     if (hit) {
      const val = [30, 26, 23, 20, 16, 13, 11, 7][shotNum - 3] || 7;
      shots.push({ shotNumber: shotNum, targetType: '5"', hit: true, value: val });
      hit5 = true;
     } else {
      shots.push({ shotNumber: shotNum, targetType: '5"', hit: false, value: 0 });
     }
     shotNum++;
    }

    // Adicionales automáticos (disparos sobrantes)
    if (hit5) {
     for (let n = shotNum; n <= 10; n++) {
      shots.push({ shotNumber: n, targetType: 'additional', hit: true, value: 1 });
     }
    }

    const totalScore = shots.reduce((sum, s) => sum + s.value, 0);
    return { shots, totalScore };
   }
