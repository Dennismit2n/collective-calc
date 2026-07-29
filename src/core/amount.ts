/**
 * Betrag eingeben und anzeigen.
 *
 * Die Anzeige ist der leichte Teil — `Intl.NumberFormat` kann das in allen zwölf
 * Sprachen ohne eigene Logik. Der schwierige Teil ist die **Eingabe** (F18):
 * Auf deutschen Handytastaturen liefert der Ziffernblock je nach Gerät mal ein
 * Komma, mal einen Punkt. Ein Feld, das „12.50" als Tausenderangabe missversteht,
 * erzeugt einen Geldfehler, der nur bei manchen Nutzern auftritt und deshalb spät auffällt.
 *
 * Deshalb: **Komma und Punkt werden gleichwertig akzeptiert.** Wo es mehrdeutig bleibt,
 * entscheidet eine Regel, und die Oberfläche zeigt sofort an, wie sie die Eingabe
 * verstanden hat. Das ist der eigentliche Schutz — nicht die Regel, sondern die Rückmeldung.
 */

import type { Cent } from './types.js';

export interface ParsedAmount {
  cents: Cent;
  /**
   * Wie die Eingabe gelesen wurde, in Alltagssprache — wird direkt unter dem Feld
   * angezeigt, damit ein Missverständnis sofort auffällt statt erst bei der Abrechnung.
   */
  interpretation: 'plain' | 'decimal-comma' | 'decimal-dot' | 'grouped';
}

/**
 * Liest einen eingetippten Betrag als ganze Cent.
 * Gibt `null` zurück, wenn daraus kein Betrag zu machen ist.
 *
 * Regeln, in dieser Reihenfolge:
 *  1. Kommen Punkt **und** Komma vor, ist das **letzte** Zeichen der Dezimaltrenner;
 *     das andere ist Tausendertrennung. Deckt "1.234,56" und "1,234.56" gleichermaßen ab.
 *  2. Kommt nur ein Trennzeichen vor und stehen danach **genau drei** Ziffern, ist es
 *     Tausendertrennung — "1.234" sind 1234, nicht 1,234. Bei Geld sind drei
 *     Nachkommastellen praktisch ausgeschlossen.
 *  3. Sonst ist es der Dezimaltrenner.
 */
export function parseAmount(input: string): ParsedAmount | null {
  // Währungszeichen, Leerzeichen und schmale Leerzeichen wegwerfen.
  const cleaned = input.replace(/[\s  ]/g, '').replace(/[^\d.,-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  if (cleaned.startsWith('-')) return null; // Negative Ausgaben gibt es nicht.
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let decimalAt = -1;
  let interpretation: ParsedAmount['interpretation'] = 'plain';

  if (lastDot >= 0 && lastComma >= 0) {
    decimalAt = Math.max(lastDot, lastComma);
    interpretation = decimalAt === lastComma ? 'decimal-comma' : 'decimal-dot';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const at = lastDot >= 0 ? lastDot : lastComma;
    const digitsAfter = cleaned.length - at - 1;
    const occurrences = cleaned.split(lastDot >= 0 ? '.' : ',').length - 1;
    if (digitsAfter === 3 && occurrences >= 1 && at > 0) {
      interpretation = 'grouped'; // Tausendertrennung
    } else {
      decimalAt = at;
      interpretation = lastComma >= 0 ? 'decimal-comma' : 'decimal-dot';
    }
  }

  let whole: string;
  let fraction: string;
  if (decimalAt >= 0) {
    whole = cleaned.slice(0, decimalAt).replace(/[.,]/g, '');
    fraction = cleaned.slice(decimalAt + 1).replace(/[.,]/g, '');
    if (fraction.length > 2) return null; // Mehr als Cent gibt es nicht.
  } else {
    whole = cleaned.replace(/[.,]/g, '');
    fraction = '';
  }

  if (whole === '' && fraction === '') return null;
  const euros = whole === '' ? 0 : Number(whole);
  const cents = Number(fraction.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isSafeInteger(euros) || !Number.isFinite(cents)) return null;

  const total = euros * 100 + cents;
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  return { cents: total, interpretation };
}

/** Zeigt einen Cent-Betrag in der Sprache des Lesers und der Währung des Anlasses. */
export function formatAmount(cents: Cent, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Wie `formatAmount`, aber mit Vorzeichen — für Salden. */
export function formatSigned(cents: Cent, locale: string, currency: string): string {
  const formatted = formatAmount(Math.abs(cents), locale, currency);
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`; // echtes Minuszeichen, kein Bindestrich
  return formatted;
}

/**
 * Der exakte, ungerundete Saldo als lesbarer Text — für den antippbaren Exaktwert (F13).
 * Zeigt so viele Nachkommastellen, wie nötig sind, höchstens sechs.
 */
export function formatExact(n: string, d: string, locale: string): string {
  const num = BigInt(n);
  const den = BigInt(d);
  if (den === 1n) return new Intl.NumberFormat(locale).format(Number(num) / 100);

  const negative = num < 0n;
  const abs = negative ? -num : num;
  const scale = 1_000_000n; // sechs Nachkommastellen in Cent
  const scaled = (abs * scale) / den;
  const asNumber = Number(scaled) / Number(scale) / 100;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(asNumber);
  return negative ? `−${text}` : text;
}
