/**
 * Die Zahlen, mit denen jeder seinen Saldo im Kopf nachprüfen kann (F10).
 *
 *     ausgelegt − Anteil + zurückgezahlt − erhalten = Saldo
 *
 * Rückzahlungen erscheinen nur, wenn es welche gibt — sonst tragen sie im
 * Normalfall bloß Rauschen in eine Zeile, die knapp bleiben soll.
 */

import type { Translator } from '../i18n/index.js';

export interface SummaryNumbers {
  paid: number;
  share: number;
  repaidOut: number;
  repaidIn: number;
}

export function summaryText(
  s: SummaryNumbers,
  t: Translator,
  money: (cents: number) => string,
): string {
  const parts = [t.t('result.paidAndShare', { paid: money(s.paid), share: money(s.share) })];
  if (s.repaidOut > 0) parts.push(t.t('result.repaidOut', { amount: money(s.repaidOut) }));
  if (s.repaidIn > 0) parts.push(t.t('result.repaidIn', { amount: money(s.repaidIn) }));
  return parts.join(' · ');
}
