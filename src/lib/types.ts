export interface Shot {
  shotNumber: number;  // 1-10
  targetType: '15"' | '10"' | '5"' | 'additional';
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
}

export interface Series {
  id?: number;
  eventId: number;
  participantId: number; // Vinculado al participante
  seriesNumber: number;
  shots: Shot[];
  totalScore: number;
  createdAt: number;
}

export interface ShootingEvent {
  id?: number;
  name: string;
  date: string; // ISO date
  location: string;
  championshipDate?: string; // Ej: "1ª Fecha", "2ª Fecha", "Final"
  createdAt: number;
}

export interface MasterCompetitor {
  id?: number;
  name: string;
  category?: string;
  phone?: string;
  createdAt: number;
}
