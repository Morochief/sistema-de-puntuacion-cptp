/**
 * print.ts — Barrel de re-export para compatibilidad hacia atras.
 *
 * Los modulos de impresion se dividieron en:
 *   - printModal.ts        → openPrintModal
 *   - printScoreSheet.ts   → printSeriesCard, printEventCards, printBlankSheet
 *   - printRankingCard.ts  → printRankingCard
 *
 * Toda la logica nueva de impresion debe importar directamente
 * desde los modulos especificos, no desde este barrel.
 */

export { openPrintModal } from './printModal';
export { printSeriesCard, printEventCards, printBlankSheet } from './printScoreSheet';
export { printRankingCard } from './printRankingCard';
