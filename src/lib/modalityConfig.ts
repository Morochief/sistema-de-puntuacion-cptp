/**
 * modalityConfig.ts
 * 
 * Configuración central de reglas por modalidad de tiro.
 * Cada modalidad define sus propios parámetros de juego:
 * tiros, blancos, puntajes, sorteo y reglas especiales.
 */

import type { Modality } from './types';

// ── Configuración de Blancos ────────────────────────────────────────────────

export interface TargetConfig {
  id: string;           // Identificador interno ('15"', 'grande', '12"', etc.)
  label: string;        // Nombre para la UI
  scoreTable: readonly number[]; // Puntos por arrastre (idx 0 = primer tiro posible)
  shotOffset: number;   // Disparo mínimo en el que se puede impactar este blanco
}

// ── Configuración de Modalidad ──────────────────────────────────────────────

export interface ModalityConfig {
  key: Modality;
  label: string;             // Nombre para la UI
  shortLabel: string;        // Para badges compactos
  color: string;             // Color de acento para badges
  bgColor: string;           // Color de fondo para badges

  shotsPerSeries: number;    // Tiros por serie (10 para .22 LR, 12 para fuego central/blackjack)
  seriesPerEvent: number;    // Series por evento (2 para .22 LR, 1 para fuego central y 21 Blackjack)
  spotsPerHeat: number;      // Tiradores por tanda (4 para .22 LR, 1 para fuego central y 21 Blackjack)
  maxHeats: number;          // Máximo de tandas/turnos

  hasBonus: boolean;         // Si existe la mecánica del Bonus
  additionalValue: number;   // Valor base de cada tiro adicional
  bonusMultiplier: number;   // Multiplicador de adicionales con bonus activo

  targets: TargetConfig[];   // Configuración de blancos en orden
  maxSeriesScore: number;    // Puntaje máximo teórico por serie

  useFamilyRules: boolean;   // Si aplican las reglas especiales Domínguez
  useSharedRifle: boolean;   // Si aplica la lógica de rifle compartido
}

// ── Tablas de Puntuación ────────────────────────────────────────────────────

// .22 LR: Blancos 15", 10", 5"
const TARGETS_22LR: TargetConfig[] = [
  { id: '15"',  label: 'Blanco 15"',  scoreTable: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],          shotOffset: 1 },
  { id: '10"',  label: 'Blanco 10"',  scoreTable: [20, 18, 16, 14, 12, 10, 8, 6, 4],         shotOffset: 2 },
  { id: '5"',   label: 'Blanco 5"',   scoreTable: [30, 26, 23, 20, 16, 13, 11, 7],           shotOffset: 3 },
];

// Fuego Central (.308 / .223): Blancos Grande, Mediano, Pequeño
const TARGETS_CF: TargetConfig[] = [
  { id: 'grande',  label: 'Blanco Grande',  scoreTable: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],  shotOffset: 1 },
  { id: 'mediano', label: 'Blanco Mediano', scoreTable: [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4], shotOffset: 2 },
  { id: 'pequeño', label: 'Blanco Pequeño', scoreTable: [42, 38, 34, 30, 26, 22, 18, 14, 11, 7],   shotOffset: 3 },
];

// 21 Blackjack Challenge (.22 LR 200m)
const TARGETS_BLACKJACK: TargetConfig[] = [
  { id: '12"', label: 'Blanco 12"', scoreTable: [1], shotOffset: 1 },
  { id: '10"', label: 'Blanco 10"', scoreTable: [2], shotOffset: 2 },
  { id: '8"',  label: 'Blanco 8"',  scoreTable: [3], shotOffset: 3 },
  { id: '6"',  label: 'Blanco 6"',  scoreTable: [4], shotOffset: 4 },
  { id: '4"',  label: 'Blanco 4"',  scoreTable: [5], shotOffset: 5 },
  { id: '2"',  label: 'Blanco 2"',  scoreTable: [6], shotOffset: 6 },
  { id: '2" (bonus)', label: 'Bonus 2"', scoreTable: [21], shotOffset: 7 },
];

// ── Configuraciones por Modalidad ───────────────────────────────────────────

const CONFIG_22LR: ModalityConfig = {
  key: '.22 LR',
  label: '.22 LR — Long Range',
  shortLabel: '.22 LR',
  color: '#0056b3',
  bgColor: '#e0f0ff',

  shotsPerSeries: 10,
  seriesPerEvent: 2,
  spotsPerHeat: 4,
  maxHeats: 8,

  hasBonus: false,
  additionalValue: 1,
  bonusMultiplier: 1,

  targets: TARGETS_22LR,
  maxSeriesScore: 67,  // 10 + 20 + 30 + 7 adicionales

  useFamilyRules: true,
  useSharedRifle: true,
};

const CONFIG_308: ModalityConfig = {
  key: '.308',
  label: '.308 — Fuego Central',
  shortLabel: '.308',
  color: '#b7201c',
  bgColor: '#fee2e2',

  shotsPerSeries: 12,
  seriesPerEvent: 1,
  spotsPerHeat: 1,
  maxHeats: 50, // Hasta 50 turnos individuales

  hasBonus: true,
  additionalValue: 1,
  bonusMultiplier: 2,

  targets: TARGETS_CF,
  maxSeriesScore: 96,  // 12 + 24 + 42 + (9 × 2)

  useFamilyRules: false,
  useSharedRifle: false,
};

const CONFIG_223: ModalityConfig = {
  key: '.223',
  label: '.223 — Fuego Central',
  shortLabel: '.223',
  color: '#16a34a',
  bgColor: '#f0fdf4',

  shotsPerSeries: 12,
  seriesPerEvent: 1,
  spotsPerHeat: 1,
  maxHeats: 50,

  hasBonus: true,
  additionalValue: 1,
  bonusMultiplier: 2,

  targets: TARGETS_CF,
  maxSeriesScore: 96,

  useFamilyRules: false,
  useSharedRifle: false,
};

const CONFIG_BLACKJACK: ModalityConfig = {
  key: '21 Blackjack',
  label: '21 Blackjack Challenge (.22 LR 200m)',
  shortLabel: '21 Blackjack',
  color: '#7c3aed',
  bgColor: '#f3e8ff',

  shotsPerSeries: 12,
  seriesPerEvent: 1, // 1 serie única de 12 disparos
  spotsPerHeat: 1,  // 1 tirador por turno (igual a .308 y .223)
  maxHeats: 50,     // Hasta 50 turnos individuales

  hasBonus: true,
  additionalValue: 21,
  bonusMultiplier: 1,

  targets: TARGETS_BLACKJACK,
  maxSeriesScore: 147, // 21 (rack) + 6 x 21 (bonus)

  useFamilyRules: false,
  useSharedRifle: false,
};

// ── Mapa de Configuraciones ─────────────────────────────────────────────────

export const MODALITY_CONFIGS: Record<Modality, ModalityConfig> = {
  '.22 LR': CONFIG_22LR,
  '.308': CONFIG_308,
  '.223': CONFIG_223,
  '21 Blackjack': CONFIG_BLACKJACK,
};

/**
 * Obtiene la configuración de una modalidad.
 * Si no se especifica, devuelve .22 LR por defecto.
 */
export function getModalityConfig(modality?: Modality): ModalityConfig {
  return MODALITY_CONFIGS[modality || '.22 LR'];
}

/**
 * Lista de todas las modalidades disponibles para selectores de UI.
 */
export const ALL_MODALITIES: Modality[] = ['.22 LR', '.308', '.223', '21 Blackjack'];
