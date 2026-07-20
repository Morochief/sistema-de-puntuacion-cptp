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
  tanda?: number; // 1, 2, 3 o 4
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
  createdAt: number;
}
