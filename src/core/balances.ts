/**
 * Exakte Salden je Person.
 *
 * Hier wird **nicht** gerundet. Jeder Anteil bleibt ein Bruch, bis der Ausgleich
 * berechnet wird (F13). Der Grund ist messbar: Wer bei jeder einzelnen Ausgabe
 * rundet, sammelt bei 40 Ausgaben und 6 Personen rund einen Euro Rundungsrest an.
 * Wer einmal am Ende rundet, bleibt bei höchstens (Personenzahl − 1) Cent.
 */

import type { Cent, Entry, Ledger, PersonId } from './types.js';
import type { Rat } from './rational.js';
import { ZERO, add, fromInt, rat, sub } from './rational.js';

export interface ExactBalances {
  /** Exakter Saldo je Person in Cent. Positiv = bekommt, negativ = schuldet. */
  balance: Map<PersonId, Rat>;
  /** Was jede Person tatsächlich ausgelegt hat, in ganzen Cent. */
  paid: Map<PersonId, Cent>;
  /** Exakter Anteil je Person in Cent. */
  share: Map<PersonId, Rat>;
  /** Summe aller Ausgaben ohne Rückzahlungen. */
  totalExpenses: Cent;
}

/** Summe der Gewichte eines Eintrags. */
export function weightSum(entry: Entry): number {
  let sum = 0;
  for (const w of Object.values(entry.weights)) sum += w;
  return sum;
}

export class LedgerError extends Error {}

/**
 * Prüft die Eingabedaten, bevor gerechnet wird.
 *
 * Das ist die Eingangskontrolle aus F15: Sie schützt nicht vor Fehlern in dieser
 * Datei, sondern vor Daten, die von außen kommen — ein im Messenger abgeschnittener
 * Link, eine von Hand editierte JSON-Datei, eine fehlgeschlagene Migration.
 */
export function validateLedger(ledger: Ledger): string[] {
  const problems: string[] = [];
  const known = new Set(ledger.people.map((p) => p.id));

  if (known.size !== ledger.people.length) problems.push('Doppelte Personen-IDs.');

  const seenEntryIds = new Set<string>();
  for (const e of ledger.entries) {
    const where = `Eintrag ${e.id}`;
    if (seenEntryIds.has(e.id)) problems.push(`${where}: ID kommt doppelt vor.`);
    seenEntryIds.add(e.id);

    if (!Number.isSafeInteger(e.amount)) problems.push(`${where}: Betrag ist keine ganze Zahl.`);
    if (e.amount <= 0) problems.push(`${where}: Betrag muss größer als 0 sein.`);
    if (!known.has(e.payerId)) problems.push(`${where}: Zahler ist keine bekannte Person.`);

    let positive = 0;
    for (const [pid, w] of Object.entries(e.weights)) {
      if (!known.has(pid)) problems.push(`${where}: Gewicht für unbekannte Person ${pid}.`);
      if (!Number.isSafeInteger(w)) problems.push(`${where}: Gewicht ist keine ganze Zahl.`);
      if (w < 0) problems.push(`${where}: Negatives Gewicht.`);
      if (w > 0) positive += 1;
    }
    if (weightSum(e) <= 0) problems.push(`${where}: Kein Gewicht größer als 0 — Betrag unverteilbar.`);
    if (e.kind === 'repayment' && positive !== 1) {
      problems.push(`${where}: Eine Rückzahlung braucht genau einen Begünstigten.`);
    }
  }
  return problems;
}

/**
 * Rechnet die exakten Salden aus.
 *
 * Saldo einer Person = (was sie ausgelegt hat) − (was ihr an Anteilen zusteht).
 * Weil Ausgelegtes und Anteile über alle Einträge dieselbe Summe ergeben,
 * ist die Summe aller Salden exakt null — das ist keine Näherung, sondern folgt
 * aus der Konstruktion und wird in `invariants.ts` auch geprüft.
 */
export function computeBalances(ledger: Ledger): ExactBalances {
  const problems = validateLedger(ledger);
  if (problems.length > 0) {
    throw new LedgerError(`Abrechnung nicht berechenbar:\n- ${problems.join('\n- ')}`);
  }

  const balance = new Map<PersonId, Rat>();
  const share = new Map<PersonId, Rat>();
  const paid = new Map<PersonId, Cent>();
  for (const p of ledger.people) {
    balance.set(p.id, ZERO);
    share.set(p.id, ZERO);
    paid.set(p.id, 0);
  }

  let totalExpenses = 0;

  for (const entry of ledger.entries) {
    if (entry.kind === 'expense') totalExpenses += entry.amount;

    // Der Zahler hat den vollen Betrag ausgelegt.
    paid.set(entry.payerId, (paid.get(entry.payerId) ?? 0) + entry.amount);
    balance.set(entry.payerId, add(balance.get(entry.payerId) ?? ZERO, fromInt(entry.amount)));

    // Und jede beteiligte Person trägt ihren Gewichtsanteil.
    const total = BigInt(weightSum(entry));
    const amount = BigInt(entry.amount);
    for (const [pid, w] of Object.entries(entry.weights)) {
      if (w === 0) continue;
      const part = rat(amount * BigInt(w), total);
      share.set(pid, add(share.get(pid) ?? ZERO, part));
      balance.set(pid, sub(balance.get(pid) ?? ZERO, part));
    }
  }

  return { balance, paid, share, totalExpenses };
}
