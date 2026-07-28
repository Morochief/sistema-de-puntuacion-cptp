/**
 * scoringCentralFire.ts
 * 
 * Motor de puntuación para las modalidades de fuego central (.308 y .223).
 * 
 * Diferencias con .22 LR (scoring.ts):
 *   - 12 tiros por serie (en vez de 10)
 *   - Blancos: Grande, Mediano, Pequeño (en vez de 15", 10", 5")
 *   - Mecánica de BONUS: si el primer tiro impacta en la zona bonus del Grande,
 *     los adicionales valen x2 (2 pts en lugar de 1)
 *   - Puntaje máximo: 96 pts (12 + 24 + 42 + 18 adicionales con bonus)
 */

import type { Shot, TargetTypeCF } from './types';
import { getModalityConfig } from './modalityConfig';
import type { TargetConfig } from './modalityConfig';

// ── Tipos ───────────────────────────────────────────────────────────────────

export type CFTarget = TargetTypeCF;
export type CFPhase  = CFTarget | 'additional';

// ── Constantes ──────────────────────────────────────────────────────────────

export const CF_SHOTS_PER_SERIES = 12;
export const CF_MAX_SCORE_WITH_BONUS = 96;  // 12 + 24 + 42 + (9 × 2)
export const CF_MAX_SCORE_NO_BONUS = 87;    // 12 + 24 + 42 + (9 × 1)

// Obtenemos la config de .308 (igual que .223 para tablas de puntos)
const cfConfig = getModalityConfig('.308');

// ── Funciones de scoring ────────────────────────────────────────────────────

/**
 * Obtiene la configuración del blanco por su id.
 */
function getTargetConfig(targetId: CFTarget): TargetConfig {
  return cfConfig.targets.find(t => t.id === targetId)!;
}

/**
 * Calcula el valor de un disparo dado su número secuencial y la fase actual.
 * En fuego central, los adicionales valen 1 pt (sin bonus) o 2 pts (con bonus).
 */
export function calculateShotValueCF(
  shotNumber: number,
  phase: CFPhase,
  hit: boolean,
  bonusActive: boolean = false,
): number {
  if (!hit) return 0;
  if (phase === 'additional') return bonusActive ? 2 : 1;

  const target = getTargetConfig(phase);
  const idx = shotNumber - target.shotOffset;
  return target.scoreTable[idx] ?? 0;
}

/**
 * Determina la fase actual (qué blanco se está intentando)
 * a partir del historial de disparos.
 *
 * Progresión obligatoria: Grande → Mediano → Pequeño → adicional
 */
export function deriveCurrentPhaseCF(shots: Shot[]): CFPhase {
  const hitGrande  = shots.some((s) => s.targetType === 'grande' && s.hit);
  const hitMediano = shots.some((s) => s.targetType === 'mediano' && s.hit);
  const hitPequeño = shots.some((s) => s.targetType === 'pequeño' && s.hit);
  if (!hitGrande)  return 'grande';
  if (!hitMediano) return 'mediano';
  if (!hitPequeño) return 'pequeño';
  return 'additional';
}

/**
 * Avanza al siguiente blanco tras un impacto.
 */
export function getNextPhaseCF(current: CFPhase): CFPhase {
  switch (current) {
    case 'grande':  return 'mediano';
    case 'mediano': return 'pequeño';
    default:        return 'additional';
  }
}

/**
 * Calcula la suma total de puntos de todos los disparos.
 */
export function calculateSeriesTotalCF(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + s.value, 0);
}

/**
 * Calcula el puntaje máximo posible a partir del próximo disparo,
 * asumiendo que se acierta todo el resto de los blancos.
 */
export function getMaxPossibleRemainingCF(
  nextShotNumber: number,
  currentPhase: CFPhase,
  bonusActive: boolean = false,
): number {
  if (nextShotNumber > CF_SHOTS_PER_SERIES) return 0;

  let max = 0;
  let phase: CFPhase = currentPhase;

  for (let n = nextShotNumber; n <= CF_SHOTS_PER_SERIES; n++) {
    if (phase === 'additional') {
      const remaining = CF_SHOTS_PER_SERIES - n + 1;
      max += remaining * (bonusActive ? 2 : 1);
      break;
    }
    const target = getTargetConfig(phase);
    const idx = n - target.shotOffset;
    const val = target.scoreTable[idx] ?? 0;
    max += val;
    phase = getNextPhaseCF(phase);
  }
  return max;
}

/**
 * Si se falla el disparo actual, ¿cuánto baja el máximo posible?
 */
export function getCostOfMissCF(
  nextShotNumber: number,
  currentPhase: CFPhase,
  bonusActive: boolean = false,
): number {
  if (currentPhase === 'additional') return bonusActive ? 2 : 1;
  const maxIfHit  = getMaxPossibleRemainingCF(nextShotNumber, currentPhase, bonusActive);
  const maxIfMiss = getMaxPossibleRemainingCF(nextShotNumber + 1, currentPhase, bonusActive);
  return maxIfHit - maxIfMiss;
}

/**
 * Nombre de blanco para mostrar en UI.
 */
export function getTargetLabelCF(phase: CFPhase): string {
  switch (phase) {
    case 'grande':  return 'Blanco Grande';
    case 'mediano': return 'Blanco Mediano';
    case 'pequeño': return 'Blanco Pequeño';
    default:        return 'Adicional';
  }
}

/**
 * Clase CSS del badge de blanco.
 */
export function getTargetBadgeClassCF(phase: CFPhase): string {
  switch (phase) {
    case 'grande':  return 'target-badge t-grande';
    case 'mediano': return 'target-badge t-mediano';
    case 'pequeño': return 'target-badge t-pequeño';
    default:        return 'target-badge tadd';
  }
}

/**
 * Para blancos principales: valor que se anotaría al acertar
 * en el disparo N. Retorna null si ese disparo/blanco no es posible.
 */
export function getValueIfHitCF(
  shotNumber: number,
  phase: CFPhase,
  bonusActive: boolean = false,
): number | null {
  if (phase === 'additional') return bonusActive ? 2 : 1;
  if (phase !== 'grande' && phase !== 'mediano' && phase !== 'pequeño') return null;
  const target = getTargetConfig(phase);
  const idx = shotNumber - target.shotOffset;
  if (idx < 0) return null;
  return target.scoreTable[idx] ?? null;
}
