/**
 * heatsManager.ts — Barrel de re-export para compatibilidad hacia atras.
 *
 * Los modulos se dividieron en:
 *   - heatsRules.ts    → applySpecialFamilySeedingRules, applySpecialFamilySeedingRulesS2, applySharedRifleRules
 *   - heatsReorder.ts  → showManualHeatsReorderModal, resetEventSeeding
 */

export { applySpecialFamilySeedingRules, applySpecialFamilySeedingRulesS2, applySharedRifleRules } from './heatsRules';
export { showManualHeatsReorderModal, resetEventSeeding } from './heatsReorder';
