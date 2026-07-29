/**
 * Datenmodell von Collective-Calc.
 *
 * Grundsätze, die aus dem Interview stammen und hier bindend sind:
 *  - Beträge sind **immer ganze Cent** (F12). Nie Euro, nie Fließkomma.
 *  - Eine Ausgabe hat **genau einen Zahler** (F5). Zwei Zahler = zwei Ausgaben.
 *  - Aufteilung läuft ausschließlich über **Gewichte pro Person** (F5).
 *    gleich = alle 1 · nicht dabei = 0 · Anteile = Anteilszahl · Prozent = Prozentwert
 *    · genaue Beträge = der Betrag selbst als Gewicht.
 *  - Einträge werden **angehängt** (F3). Bearbeiten und Löschen sind erlaubt,
 *    aber IDs werden nie wiederverwendet, damit Nachtrag-Codes später konfliktfrei bleiben.
 */

/** Betrag in ganzen Cent. Negative Werte sind je nach Feld erlaubt (Salden), sonst nicht. */
export type Cent = number;

export type PersonId = string;
export type EntryId = string;

export interface Person {
  id: PersonId;
  /** Nur Vorname — das Tool fragt nie nach Nachnamen (F10). */
  name: string;
}

/**
 * Wie die Aufteilung in der Oberfläche zustande kam. Rein informativ:
 * Gerechnet wird immer mit `weights`. Der Modus dient dazu, beim Bearbeiten
 * wieder die passende Eingabemaske zu zeigen.
 */
export type SplitMode = 'equal' | 'shares' | 'percent' | 'exact';

/** Fremdwährungsangabe (F16). Der Kurs wird mitgespeichert und angezeigt. */
export interface Fx {
  /** ISO-4217-Code der Fremdwährung, z. B. "CHF". */
  currency: string;
  /** Betrag in der Fremdwährung, in deren kleinster Einheit (also auch Cent-artig). */
  foreignAmount: number;
  /**
   * Kurs als Text, wie der Nutzer ihn eingegeben hat (z. B. "1.05").
   * Bewusst der Rohwert: Der umgerechnete Betrag steht in `Entry.amount` und ist
   * die verbindliche Größe. Der Kurs dient der Nachvollziehbarkeit.
   */
  rate: string;
}

export type EntryKind =
  /** Gemeinsame Ausgabe. Zählt in die Gesamtausgaben des Anlasses. */
  | 'expense'
  /**
   * Rückzahlung zwischen zwei Personen (F6). Technisch eine Ausgabe mit genau
   * einem Begünstigten. Zählt **nicht** in die Gesamtausgaben, sonst behauptet
   * der Anlass, teurer gewesen zu sein, nur weil Geld im Kreis geflossen ist.
   */
  | 'repayment';

export interface Entry {
  id: EntryId;
  kind: EntryKind;
  /** Betrag in Cent der Abrechnungswährung. Immer > 0. */
  amount: Cent;
  payerId: PersonId;
  /**
   * Gewicht je Person. Fehlende Person = Gewicht 0 = war nicht dabei.
   * Mindestens ein Gewicht muss > 0 sein, sonst wäre der Betrag unverteilbar.
   * Gewichte sind ganzzahlig und >= 0.
   */
  weights: Readonly<Record<PersonId, number>>;
  mode: SplitMode;
  description: string;
  /** ISO-8601, wird für die Zeitleiste und die Kalendertag-Zählung gebraucht. */
  at: string;
  fx?: Fx;
}

/** Ein Anlass: Urlaub, Ferienhaus, Grillabend. */
export interface Ledger {
  /** Formatversion (F1). Wird beim Einlesen geprüft, bevor irgendetwas angefasst wird. */
  version: number;
  id: string;
  title: string;
  /** ISO-4217-Code der Abrechnungswährung, z. B. "EUR". */
  currency: string;
  createdAt: string;
  people: Person[];
  entries: Entry[];
}

export const LEDGER_VERSION = 1;

// ---------------------------------------------------------------------------
// Ergebnisse der Berechnung
// ---------------------------------------------------------------------------

/** Was eine Person ausgelegt hat und was ihr Anteil war — für den Ergebnis-Link (F10). */
export interface PersonSummary {
  personId: PersonId;
  /** Summe aller Beträge, die diese Person ausgelegt hat (inkl. Rückzahlungen). */
  paid: Cent;
  /** Exakter Anteil, auf ganze Cent zur Null hin abgeschnitten — nur zur Anzeige. */
  share: Cent;
  /**
   * Saldo in ganzen Cent, zur Null hin abgeschnitten.
   * Positiv = bekommt Geld, negativ = schuldet Geld.
   */
  balance: Cent;
  /** Derselbe Saldo exakt, ohne Rundung. Für den antippbaren Exaktwert (F13). */
  exactBalance: { n: string; d: string };
}

export interface Transfer {
  fromId: PersonId;
  toId: PersonId;
  amount: Cent;
}

/**
 * Der Cent, der durch Rundung nicht aufgeht (F12).
 * Wird niemandem zugewiesen, sondern namentlich ausgewiesen.
 */
export interface OpenRemainder {
  personId: PersonId;
  /** Immer 1 oder mehr Cent. */
  amount: Cent;
  /**
   * 'receives-less' — dieser Person fehlt der Betrag an dem, was ihr zusteht.
   * 'pays-less'     — diese Person zahlt den Betrag weniger, als sie rechnerisch schuldet.
   */
  direction: 'receives-less' | 'pays-less';
}

export interface Settlement {
  summaries: PersonSummary[];
  transfers: Transfer[];
  /** Leer, wenn die Abrechnung glatt aufgeht. Dann erscheint auch keine Restbetrag-Zeile. */
  remainders: OpenRemainder[];
  /** Summe aller Ausgaben ohne Rückzahlungen. */
  totalExpenses: Cent;
  /** Wurde das exakte Minimum berechnet oder der Rückfall benutzt? (F14) */
  method: 'exact-minimum' | 'greedy-fallback';
}
