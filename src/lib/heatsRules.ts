/**
 * heatsRules.ts
 * Reglas especiales de sorteo: Familia Dominguez y Rifle Compartido.
 */

import type { Participant } from './types';

/**
 * Aplica las Reglas Especiales de Sorteo de la Organizacion CPTP (Serie 2):
 * 1. Angel Dominguez y Facundo Dominguez NUNCA deben estar en la misma tanda.
 * 2. Facundo Dominguez debe tirar SIEMPRE en una tanda ANTERIOR (menor numero) que Angel Dominguez.
 */
export function applySpecialFamilySeedingRulesS2(participants: Participant[]): Participant[] {
  const facundoIndex = participants.findIndex(p => p.name.toLowerCase().includes('facundo domínguez') || p.name.toLowerCase().includes('facundo dominguez'));
  const angelIndex = participants.findIndex(p => p.name.toLowerCase().includes('ángel domínguez') || p.name.toLowerCase().includes('angel dominguez'));

  if (facundoIndex >= 0 && angelIndex >= 0) {
    const facundo = participants[facundoIndex];
    const angel = participants[angelIndex];

    if (facundo.tandaS2 !== undefined && angel.tandaS2 !== undefined) {
      const allowedTandas = [2, 3, 4];

      const swapWithCandidate = (p: Participant, candidate: Participant) => {
        const tempT = p.tandaS2;
        const tempS = p.spotS2;
        p.tandaS2 = candidate.tandaS2;
        p.spotS2 = candidate.spotS2;
        candidate.tandaS2 = tempT;
        candidate.spotS2 = tempS;
      };

      const enforceAllowedTanda = (p: Participant, otherId: number) => {
        if (!allowedTandas.includes(p.tandaS2!)) {
          const candidate = participants.find(x =>
            x.id !== p.id && x.id !== otherId && x.tandaS2 !== undefined && allowedTandas.includes(x.tandaS2)
          );
          if (candidate) { swapWithCandidate(p, candidate); }
          else { p.tandaS2 = 2; }
        }
      };

      enforceAllowedTanda(facundo, angel.id!);
      enforceAllowedTanda(angel, facundo.id!);

      if (facundo.tandaS2 > angel.tandaS2!) { swapWithCandidate(facundo, angel); }

      if (facundo.tandaS2 === angel.tandaS2) {
        let targetTanda = angel.tandaS2! < 4 ? angel.tandaS2! + 1 : facundo.tandaS2! - 1;
        let personToMove = angel.tandaS2! < 4 ? angel : facundo;
        const swapCandidate = participants.find(x => x.id !== facundo.id && x.id !== angel.id && x.tandaS2 === targetTanda);
        if (swapCandidate) { swapWithCandidate(personToMove, swapCandidate); }
        else { personToMove.tandaS2 = targetTanda; personToMove.spotS2 = 1; }
      }
    }
  }

  // Repack: max 4 per tanda, reassign spots
  const groups: Record<number, Participant[]> = {};
  for (const p of participants) {
    if (p.tandaS2 !== undefined) {
      if (!groups[p.tandaS2]) groups[p.tandaS2] = [];
      groups[p.tandaS2].push(p);
    }
  }

  const overfilled: Participant[] = [];
  for (const t in groups) {
    if (groups[t].length > 4) { overfilled.push(...groups[t].splice(4)); }
    groups[t].forEach((p, idx) => { p.spotS2 = (idx + 1) as 1|2|3|4; });
  }

  if (overfilled.length > 0) {
    for (const p of overfilled) {
      let found = false;
      for (let t = 1; t <= 8; t++) {
        if (!groups[t]) groups[t] = [];
        if (groups[t].length < 4) { p.tandaS2 = t; groups[t].push(p); p.spotS2 = groups[t].length as 1|2|3|4; found = true; break; }
      }
      if (!found) { p.tandaS2 = undefined; p.spotS2 = undefined; }
    }
  }

  return participants;
}

/**
 * Aplica las Reglas Especiales de Sorteo de la Organizacion CPTP (Serie 1):
 * 1. Angel Dominguez y Facundo Dominguez NUNCA deben estar en la misma tanda.
 * 2. Facundo Dominguez debe tirar SIEMPRE en una tanda ANTERIOR (menor numero) que Angel Dominguez.
 */
export function applySpecialFamilySeedingRules(participants: Participant[]): Participant[] {
  const facundoIndex = participants.findIndex(p => p.name.toLowerCase().includes('facundo domínguez') || p.name.toLowerCase().includes('facundo dominguez'));
  const angelIndex = participants.findIndex(p => p.name.toLowerCase().includes('ángel domínguez') || p.name.toLowerCase().includes('angel dominguez'));

  if (facundoIndex >= 0 && angelIndex >= 0) {
    const facundo = participants[facundoIndex];
    const angel = participants[angelIndex];

    if (facundo.tanda !== undefined && angel.tanda !== undefined) {
      const allowedTandas = [2, 3, 4];

      const swapWithCandidate = (p: Participant, candidate: Participant) => {
        const tempT = p.tanda;
        const tempS = p.spot;
        p.tanda = candidate.tanda;
        p.spot = candidate.spot;
        candidate.tanda = tempT;
        candidate.spot = tempS;
      };

      const enforceAllowedTanda = (p: Participant, otherId: number) => {
        if (!allowedTandas.includes(p.tanda!)) {
          const candidate = participants.find(x =>
            x.id !== p.id && x.id !== otherId && x.tanda !== undefined && allowedTandas.includes(x.tanda)
          );
          if (candidate) { swapWithCandidate(p, candidate); }
          else { p.tanda = 2; }
        }
      };

      enforceAllowedTanda(facundo, angel.id!);
      enforceAllowedTanda(angel, facundo.id!);

      if (facundo.tanda > angel.tanda!) { swapWithCandidate(facundo, angel); }

      if (facundo.tanda === angel.tanda) {
        let targetTanda = angel.tanda! < 4 ? angel.tanda! + 1 : facundo.tanda! - 1;
        let personToMove = angel.tanda! < 4 ? angel : facundo;
        const swapCandidate = participants.find(x => x.id !== facundo.id && x.id !== angel.id && x.tanda === targetTanda);
        if (swapCandidate) { swapWithCandidate(personToMove, swapCandidate); }
        else { personToMove.tanda = targetTanda; personToMove.spot = 1; }
      }
    }
  }

  // Repack: max 4 per tanda, reassign spots
  const groups: Record<number, Participant[]> = {};
  for (const p of participants) {
    if (p.tanda !== undefined) {
      if (!groups[p.tanda]) groups[p.tanda] = [];
      groups[p.tanda].push(p);
    }
  }

  const overfilled: Participant[] = [];
  for (const t in groups) {
    if (groups[t].length > 4) { overfilled.push(...groups[t].splice(4)); }
    groups[t].forEach((p, idx) => { p.spot = (idx + 1) as 1|2|3|4; });
  }

  if (overfilled.length > 0) {
    for (const p of overfilled) {
      let found = false;
      for (let t = 1; t <= 8; t++) {
        if (!groups[t]) groups[t] = [];
        if (groups[t].length < 4) { p.tanda = t; groups[t].push(p); p.spot = groups[t].length as 1|2|3|4; found = true; break; }
      }
      if (!found) { p.tanda = undefined; p.spot = undefined; }
    }
  }

  return participants;
}

/**
 * Reglas de Rifle Compartido.
 * Tiradores que comparten un rifle (sharedRifleId) no pueden estar en la misma tanda.
 */
export function applySharedRifleRules(participants: Participant[]): Participant[] {
  const groups: Record<string, Participant[]> = {};
  for (const p of participants) {
    if (p.sharedRifleId && p.tanda) {
      if (!groups[p.sharedRifleId]) groups[p.sharedRifleId] = [];
      groups[p.sharedRifleId].push(p);
    }
  }

  for (const rifleId in groups) {
    const members = groups[rifleId];
    if (members.length < 2) continue;

    let tandasOccupied = new Set<number>();
    for (const m of members) {
      if (tandasOccupied.has(m.tanda!)) {
        const candidate = participants.find(x =>
          x.tanda !== undefined &&
          x.tanda !== m.tanda &&
          !tandasOccupied.has(x.tanda!) &&
          x.sharedRifleId !== rifleId &&
          !x.name.toLowerCase().includes('domnguez') &&
          !x.name.toLowerCase().includes('dominguez') &&
          !m.name.toLowerCase().includes('domnguez') &&
          !m.name.toLowerCase().includes('dominguez')
        );
        if (candidate) {
          const tempT = m.tanda;
          const tempS = m.spot;
          m.tanda = candidate.tanda;
          m.spot = candidate.spot;
          candidate.tanda = tempT;
          candidate.spot = tempS;
          tandasOccupied.add(m.tanda!);
        }
      } else {
        tandasOccupied.add(m.tanda!);
      }
    }
  }
  return participants;
}
