import type { Shot, AnyTargetType } from './types';

// ── Tablas de puntuación ────────────────────────────────────────────────────
//
// CLAVE: el ÍNDICE en la tabla corresponde al NÚMERO DE DISPARO en que tocás.
//   15": disparo 1 = 10 pts, disparo 2 = 9 pts, ..., disparo 10 = 1 pt
//   10": disparo 2 = 20 pts, disparo 3 = 18 pts, ..., disparo 10 = 4 pts
//    5": disparo 3 = 30 pts, disparo 4 = 26 pts, ..., disparo 10 = 7 pts
//
// Si errás el primer blanco, el arrastre hace que todos los siguientes
// valgan menos porque los tocás en disparos posteriores.
//
export const SCORING_TABLES = {
  '15"': [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const, // índice = shotNumber - 1
  '10"': [20, 18, 16, 14, 12, 10, 8, 6, 4] as const, // índice = shotNumber - 2
  '5"':  [30, 26, 23, 20, 16, 13, 11, 7] as const,   // índice = shotNumber - 3
} as const satisfies Record<'15"' | '10"' | '5"', readonly number[]>;

export type MainTarget = '15"' | '10"' | '5"';
export type ShotPhase  = MainTarget | 'additional';

export const SHOTS_PER_SERIES = 10;
export const MAX_SERIES_SCORE = 67; // 10 + 20 + 30 + 7 adicionales

// Offset de columna en la tabla de cada blanco:
//   El blanco 15" empieza en la columna 1 (disparo 1)
//   El blanco 10" empieza en la columna 2 (disparo 2)
//   El blanco 5"  empieza en la columna 3 (disparo 3)
const SHOT_OFFSET: Record<MainTarget, number> = {
  '15"': 1,
  '10"': 2,
  '5"':  3,
};

// ── Funciones de scoring ────────────────────────────────────────────────────

/**
 * Calcula el valor de un disparo dado su número secuencial y la fase actual.
 *
 * El valor NO es elegido por el usuario — se calcula automáticamente
 * según en qué disparo (columna de la tabla) se logra el impacto.
 *
 * Ejemplo:
 *   - Falla disparo 1 (15"), impacta disparo 2 (15") → 9 pts (no 10)
 *   - Por arrastre, el 10" empieza desde disparo 3 → max 18 pts (no 20)
 */
export function calculateShotValue(
  shotNumber: number,
  phase: ShotPhase,
  hit: boolean,
): number {
  if (!hit) return 0;
  if (phase === 'additional') return 1;

  const table = SCORING_TABLES[phase];
  const idx   = shotNumber - SHOT_OFFSET[phase];
  return table[idx] ?? 0;
}

/**
 * Determina la fase actual (qué blanco se está intentando)
 * a partir del historial de disparos.
 *
 * Progresión obligatoria: 15" → 10" → 5" → adicional
 * No se puede saltar un blanco.
 */
export function deriveCurrentPhase(shots: Shot[]): ShotPhase {
  const hit15 = shots.some((s) => s.targetType === '15"' && s.hit);
  const hit10 = shots.some((s) => s.targetType === '10"' && s.hit);
  const hit5  = shots.some((s) => s.targetType === '5"'  && s.hit);
  if (!hit15) return '15"';
  if (!hit10) return '10"';
  if (!hit5)  return '5"';
  return 'additional';
}

/**
 * Avanza al siguiente blanco tras un impacto.
 */
export function getNextPhase(current: ShotPhase): ShotPhase {
  switch (current) {
    case '15"': return '10"';
    case '10"': return '5"';
    default:    return 'additional';
  }
}

/**
 * Calcula la suma total de puntos de todos los disparos.
 */
export function calculateSeriesTotal(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + s.value, 0);
}

/**
 * Calcula el puntaje máximo posible a partir del próximo disparo,
 * asumiendo que se acierta todo el resto de los blancos.
 *
 * Útil para mostrarle al tirador cuánto puede perder si falla.
 */
export function getMaxPossibleRemaining(
  nextShotNumber: number,
  currentPhase: ShotPhase,
): number {
  if (nextShotNumber > SHOTS_PER_SERIES) return 0;

  let max = 0;
  let phase: ShotPhase = currentPhase;

  for (let n = nextShotNumber; n <= SHOTS_PER_SERIES; n++) {
    if (phase === 'additional') {
      max += SHOTS_PER_SERIES - n + 1; // shots restantes × 1 pt
      break;
    }
    const offset = SHOT_OFFSET[phase];
    const table  = SCORING_TABLES[phase];
    const val    = table[n - offset] ?? 0;
    max  += val;
    phase = getNextPhase(phase);
  }
  return max;
}

/**
 * Si se falla el disparo actual, ¿cuánto baja el máximo posible?
 * Sirve para mostrar el "costo" de fallar.
 */
export function getCostOfMiss(
  nextShotNumber: number,
  currentPhase: ShotPhase,
): number {
  if (currentPhase === 'additional') return 1;
  const maxIfHit  = getMaxPossibleRemaining(nextShotNumber, currentPhase);
  const maxIfMiss = getMaxPossibleRemaining(nextShotNumber + 1, currentPhase); // fase no avanza
  return maxIfHit - maxIfMiss;
}

/**
 * Nombre de blanco para mostrar en UI.
 */
export function getTargetLabel(phase: ShotPhase): string {
  switch (phase) {
    case '15"': return 'Blanco 15"';
    case '10"': return 'Blanco 10"';
    case '5"':  return 'Blanco 5"';
    default:    return 'Adicional';
  }
}

/**
 * Clase CSS del badge de blanco.
 */
export function getTargetBadgeClass(phase: ShotPhase): string {
  switch (phase) {
    case '15"': return 'target-badge t15';
    case '10"': return 'target-badge t10';
    case '5"':  return 'target-badge t5';
    default:    return 'target-badge tadd';
  }
}

/**
 * Para blancos principales: valor que se anotaría al acertar
 * en el disparo N. Retorna null si ese disparo/blanco no es posible.
 */
export function getValueIfHit(shotNumber: number, phase: ShotPhase): number | null {
  if (phase === 'additional') return 1;
  if (phase !== '15"' && phase !== '10"' && phase !== '5"') return null;
  const idx = shotNumber - SHOT_OFFSET[phase];
  if (idx < 0) return null;
  return SCORING_TABLES[phase][idx] ?? null;
}
