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

/**
 * Kurze Auswahl statt einer Liste mit hundertsechzig Einträgen.
 *
 * **Jeder Eintrag hier muss zwei Nachkommastellen haben** — siehe
 * `isValidCurrencyCode`. Der ungarische Forint stand ursprünglich in dieser
 * Liste und hat keine Untereinheit; jeder Betrag wäre um den Faktor hundert
 * daneben gewesen, auswählbar über das Aufklappmenü und ohne jede Warnung.
 * Ein Test prüft die Liste deshalb gegen dieselbe Regel wie das Freifeld,
 * damit beide nicht wieder auseinanderlaufen.
 */
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
  'RON',
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

/**
 * Taugt dieser Code als Abrechnungswährung?
 *
 * Zwei Bedingungen, und die zweite ist die wichtigere:
 *
 *  1. Drei Buchstaben, von `Intl` akzeptiert. Das prüft nur die Form —
 *     `Intl` nimmt auch erfundene Codes wie „XYZ" klaglos an.
 *  2. **Genau zwei Nachkommastellen.** Collective-Calc rechnet durchgehend in
 *     Hundertsteln. Bei Yen oder Won, die gar keine Untereinheit haben, wären
 *     alle Beträge um den Faktor hundert daneben — und zwar still. Solche
 *     Währungen werden deshalb abgelehnt, statt falsch zu rechnen.
 */
export function isValidCurrencyCode(code: string): boolean {
  if (!/^[A-Za-z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code.toUpperCase() }).format(1);
  } catch {
    return false;
  }
  return decimalsFor(code.toUpperCase()) === 2;
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
 *
 * **Dies ist die einzige Stelle im ganzen Programm, an der mit Fließkommazahlen
 * gerechnet wird.** Sie lässt sich nicht vermeiden: Ein Wechselkurs *ist* eine
 * Dezimalzahl. Das ist hier vertretbar, weil
 *
 *  - der Kurs ohnehin eine Schätzung ist, die der Nutzer eingetippt hat,
 *  - das Ergebnis sofort auf einen ganzen Cent festgelegt wird und
 *  - dieser Cent-Betrag danach die verbindliche Größe ist und nie neu
 *    aus dem Kurs abgeleitet wird.
 *
 * Genau auf der Rundungskante ist die Richtung deshalb nicht vorhersagbar —
 * 100 × 1,005 ergibt in Fließkomma 100,49999999999999. Zugesichert wird nur:
 * höchstens einen halben Cent neben dem rechnerischen Produkt.
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
