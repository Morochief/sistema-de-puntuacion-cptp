// ── Modalidades de Tiro ─────────────────────────────────────────────────────
export type Modality = '.22 LR' | '.308' | '.223';

// Tipos de blanco: .22 LR usa 15"/10"/5", fuego central usa Grande/Mediano/Pequeño
export type TargetType22 = '15"' | '10"' | '5"';
export type TargetTypeCF = 'grande' | 'mediano' | 'pequeño';
export type AnyTargetType = TargetType22 | TargetTypeCF | 'additional';

export interface Shot {
  shotNumber: number;  // 1-10 (.22 LR) o 1-12 (.308/.223)
  targetType: AnyTargetType;
  hit: boolean;
  value: number;
}

export interface Participant {
  id?: number;
  eventId: number;
  name: string;
  competitorNumber: number; // 1 a 32 (número correlativo de inscripción)
  sector?: 'A' | 'B';
  spot?: 1 | 2 | 3 | 4;
  tanda?: number; // 1, 2, 3 o 4 (Representa la Serie 1)
  tandaS2?: number; // Tanda para la Serie 2
  spotS2?: 1 | 2 | 3 | 4; // Mesa para la Serie 2
  category?: string;
  tieRank?: number;
  status?: 'active' | 'dq' | 'dns'; // Estado del competidor (Activo, Descalificado, No presentado)
  paymentStatus?: 'paid' | 'pending' | 'exempt'; // Estado de inscripción (Abonado, Pendiente, Exento)
  presentForRaffle?: boolean;
  sharedRifleId?: string; // Ej: 'Rifle A', 'Rifle B'
  is_deleted?: boolean;
}

export interface Series {
  id?: number;
  eventId: number;
  participantId: number; // Vinculado al participante
  seriesNumber: number;
  shots: Shot[];
  totalScore: number;
  bonusActive?: boolean; // Solo .308/.223: si el primer tiro activó el bonus x2
  createdAt: number;
  is_deleted?: boolean;
}

export interface ShootingEvent {
  id?: number;
  name: string;
  date: string; // ISO date
  location: string;
  modality?: Modality; // Modalidad del evento (.22 LR por defecto)
  championshipDate?: string; // Ej: "1ª Fecha", "2ª Fecha", "Final"
  createdAt: number;
  is_deleted?: boolean;
  isPilot?: boolean; // Si es true, no cuenta para el campeonato general
}

export interface MasterCompetitor {
  id?: number;
  name: string;
  category?: string;
  phone?: string;
  championshipTieRank?: number;
  createdAt: number;
  is_deleted?: boolean;
}
