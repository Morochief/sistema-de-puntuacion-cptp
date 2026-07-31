/**
 * scoringBlackjack.ts
 * 
 * Módulo puro de lógica matemática para la modalidad "21 Blackjack Challenge" (.22 LR - 200m).
 * 
 * Reglas:
 * - 12 disparos totales por serie.
 * - Secuencia obligatoria del rack:
 *   12" (1 pt) -> 10" (2 pts) -> 8" (3 pts) -> 6" (4 pts) -> 4" (5 pts) -> 2" (6 pts) = 21 pts
 * - Si completa el rack (acierta 2"), entra a la fase BONUS 2".
 * - Cada disparo adicional acertado al blanco de 2" otorga +21 puntos de bonus.
 * - Máximo teórico en 12 disparos = 147 puntos (21 + 6 x 21).
 */

import type { Shot, TargetTypeBJ } from './types';

export const BJ_SHOTS_PER_SERIES = 12;
export const BJ_MAX_SERIES_SCORE = 147;

export type BlackjackPhase = TargetTypeBJ;

export const BJ_TARGET_SEQUENCE: TargetTypeBJ[] = [
  '12"',
  '10"',
  '8"',
  '6"',
  '4"',
  '2"',
  '2" (bonus)'
];

export const BJ_TARGET_VALUES: Record<TargetTypeBJ, number> = {
  '12"': 1,
  '10"': 2,
  '8"': 3,
  '6"': 4,
  '4"': 5,
  '2"': 6,
  '2" (bonus)': 21
};

/**
 * Determina el blanco activo actual según el historial de disparos.
 * El tirador debe acertar cada blanco de la secuencia para avanzar al siguiente.
 */
export function deriveCurrentPhaseBJ(shots: Shot[]): BlackjackPhase {
  const hit12 = shots.some(s => s.targetType === '12"' && s.hit);
  const hit10 = shots.some(s => s.targetType === '10"' && s.hit);
  const hit8  = shots.some(s => s.targetType === '8"'  && s.hit);
  const hit6  = shots.some(s => s.targetType === '6"'  && s.hit);
  const hit4  = shots.some(s => s.targetType === '4"'  && s.hit);
  const hit2  = shots.some(s => s.targetType === '2"'  && s.hit);

  if (!hit12) return '12"';
  if (!hit10) return '10"';
  if (!hit8)  return '8"';
  if (!hit6)  return '6"';
  if (!hit4)  return '4"';
  if (!hit2)  return '2"';
  return '2" (bonus)';
}

/**
 * Retorna la siguiente fase tras un acierto.
 */
export function getNextPhaseBJ(current: BlackjackPhase): BlackjackPhase {
  switch (current) {
    case '12"': return '10"';
    case '10"': return '8"';
    case '8"':  return '6"';
    case '6"':  return '4"';
    case '4"':  return '2"';
    default:    return '2" (bonus)';
  }
}

/**
 * Calcula el valor del disparo si es impactado en la fase actual.
 */
export function calculateShotValueBJ(phase: BlackjackPhase, hit: boolean): number {
  if (!hit) return 0;
  return BJ_TARGET_VALUES[phase] || 0;
}

/**
 * Calcula el total de puntos acumulados en la serie.
 */
export function calculateSeriesTotalBJ(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + s.value, 0);
}

/**
 * Calcula el máximo teórico posible restante desde el disparo N.
 */
export function getMaxPossibleRemainingBJ(nextShotNumber: number, currentPhase: BlackjackPhase): number {
  if (nextShotNumber > BJ_SHOTS_PER_SERIES) return 0;

  const remainingShotsCount = BJ_SHOTS_PER_SERIES - nextShotNumber + 1;
  let max = 0;
  let phase = currentPhase;

  for (let i = 0; i < remainingShotsCount; i++) {
    if (phase === '2" (bonus)') {
      max += (remainingShotsCount - i) * 21;
      break;
    }
    max += BJ_TARGET_VALUES[phase] || 0;
    phase = getNextPhaseBJ(phase);
  }

  return max;
}

/**
 * Nombre de la fase para mostrar en la interfaz.
 */
export function getTargetLabelBJ(phase: BlackjackPhase): string {
  switch (phase) {
    case '12"': return 'Blanco 12" (1 pt)';
    case '10"': return 'Blanco 10" (2 pts)';
    case '8"':  return 'Blanco 8" (3 pts)';
    case '6"':  return 'Blanco 6" (4 pts)';
    case '4"':  return 'Blanco 4" (5 pts)';
    case '2"':  return 'Blanco 2" (6 pts - Blackjack)';
    case '2" (bonus)': return '🎯 BONUS 2" (+21 pts)';
    default:    return 'Fase Final';
  }
}

/**
 * Clase CSS o estilo del badge.
 */
export function getTargetBadgeStyleBJ(phase: BlackjackPhase): string {
  switch (phase) {
    case '12"': return 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
    case '10"': return 'background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;';
    case '8"':  return 'background:#dcfce7;color:#15803d;border:1px solid #86efac;';
    case '6"':  return 'background:#fef3c7;color:#b45309;border:1px solid #fde68a;';
    case '4"':  return 'background:#ffedd5;color:#c2410c;border:1px solid #fed7aa;';
    case '2"':  return 'background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;';
    case '2" (bonus)': return 'background:#f3e8ff;color:#7c3aed;border:1.5px solid #a855f7;font-weight:900;';
    default:    return 'background:#f1f5f9;color:#475569;';
  }
}
