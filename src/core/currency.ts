/**
 * Währungen (F16).
 *
 * Ein Anlass rechnet in **einer** Währung. Eine einzelne Ausgabe darf in einer
 * anderen erfasst werden; umgerechnet wird beim Eintragen, mit einem Kurs, den
 * der Nutzer angibt. Gespeichert wird der Betrag in der Abrechnungswährung als
 * ganze Cent — damit bleibt alles dahinter exakt wie bisher.
 *
 * Der Kurs wird **mitgespeichert und angezeigt**. Das ist kein Detail: Eine
 * Umrechnung ohne sichtbaren Kurs behauptet eine Genauigkeit, die es nicht gibt.
 * Mit sichtbarem Kurs behauptet sie nur noch, was der Nutzer selbst eingetragen hat.
 */

/** Kurze Auswahl statt einer Liste mit hundertsechzig Einträgen. */
export const COMMON_CURRENCIES = [
  'EUR',
  'CHF',
  'GBP',
  'USD',
  'DKK',
  'NOK',
  'SEK',
  'PLN',
  'CZK',
  'HUF',
  'TRY',
  'THB',
] as const;

/** Wie viele Nachkommastellen hat diese Währung? Nicht überall sind es zwei. */
export function decimalsFor(currency: string): number {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency }).formatToParts(1);
    const fraction = parts.find((p) => p.type === 'fraction');
    return fraction ? fraction.value.length : 0;
  } catch {
    return 2;
  }
}

export function isValidCurrencyCode(code: string): boolean {
  if (!/^[A-Za-z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code.toUpperCase() }).format(1);
    return true;
  } catch {
    return false;
  }
}

export interface Conversion {
  /** Betrag in der Abrechnungswährung, in ganzen Cent. */
  cents: number;
  /** Der Kurs, wie er verstanden wurde — für die Anzeige. */
  rate: number;
}

/**
 * Rechnet einen Fremdbetrag um.
 *
 * Der Kurs wird als „1 Fremdwährung = x Abrechnungswährung" gelesen; das ist die
 * Richtung, in der Leute ihn im Urlaub nachschlagen („1 CHF sind 1,05 Euro").
 * Gibt `null` zurück, wenn der Kurs unbrauchbar ist.
 */
export function convert(foreignCents: number, rateText: string): Conversion | null {
  const normalized = rateText.trim().replace(',', '.');
  if (normalized === '') return null;
  const rate = Number(normalized);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const cents = Math.round(foreignCents * rate);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return { cents, rate };
}
