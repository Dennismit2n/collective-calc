/**
 * Die Invarianten aus F15.
 *
 * Dieselbe Funktion wird an zwei Stellen benutzt:
 *  - in den Tests, gegen zehntausende zufällig erzeugte Abrechnungen;
 *  - zur Laufzeit, **als Eingangskontrolle für fremde Daten** — ein im Messenger
 *    abgeschnittener Link, eine von Hand editierte JSON-Datei, eine fehlgeschlagene
 *    Migration. Das ist ausdrücklich kein Misstrauen gegen die Rechnung in `settle.ts`:
 *    Solche Daten stammen nicht aus diesem Programm, und keine Testsuite kann sie abdecken.
 *
 * Schlägt hier etwas an, zeigt die Oberfläche **keine Zahlen**, sondern eine Meldung
 * und bietet den Export der Rohdaten an. Halb richtige Beträge sind schlimmer als keine.
 */

import type { Ledger, Settlement } from './types.js';
import { computeBalances, weightSum } from './balances.js';
import { ZERO, add, fromInt, isZero, rat } from './rational.js';

export interface InvariantReport {
  ok: boolean;
  problems: string[];
}

export function checkSettlement(ledger: Ledger, settlement: Settlement): InvariantReport {
  const problems: string[] = [];
  const n = ledger.people.length;

  // (1) Die Anteile einer Ausgabe ergeben zusammen exakt den Ausgabebetrag.
  for (const entry of ledger.entries) {
    const total = BigInt(weightSum(entry));
    let sum = ZERO;
    for (const [, w] of Object.entries(entry.weights)) {
      if (w === 0) continue;
      sum = add(sum, rat(BigInt(entry.amount) * BigInt(w), total));
    }
    if (sum.d !== 1n || sum.n !== BigInt(entry.amount)) {
      problems.push(`(1) Eintrag ${entry.id}: Anteile ergeben nicht den Ausgabebetrag.`);
    }
  }

  // (2) Die Summe aller exakten Salden ist exakt null.
  const { balance } = computeBalances(ledger);
  let sumExact = ZERO;
  for (const b of balance.values()) sumExact = add(sumExact, b);
  if (!isZero(sumExact)) {
    problems.push('(2) Die Summe aller Salden ist nicht null.');
  }

  const byId = new Map(settlement.summaries.map((s) => [s.personId, s]));

  // (6) Keine Überweisung an sich selbst, kein Betrag <= 0.
  for (const t of settlement.transfers) {
    if (t.fromId === t.toId) problems.push('(6) Überweisung an sich selbst.');
    if (!Number.isSafeInteger(t.amount) || t.amount <= 0) {
      problems.push('(6) Überweisungsbetrag ist keine positive ganze Zahl.');
    }
    if (!byId.has(t.fromId) || !byId.has(t.toId)) {
      problems.push('(6) Überweisung betrifft eine unbekannte Person.');
    }
  }

  // (4) Für jede Person: eingehend − ausgehend entspricht ihrem Saldo,
  //     bereinigt um den ihr zugeordneten offenen Rest.
  const net = new Map<string, number>();
  for (const s of settlement.summaries) net.set(s.personId, 0);
  for (const t of settlement.transfers) {
    net.set(t.fromId, (net.get(t.fromId) ?? 0) - t.amount);
    net.set(t.toId, (net.get(t.toId) ?? 0) + t.amount);
  }
  const signedRemainder = new Map<string, number>();
  for (const r of settlement.remainders) {
    signedRemainder.set(r.personId, r.direction === 'receives-less' ? r.amount : -r.amount);
  }
  for (const s of settlement.summaries) {
    const expected = s.balance - (signedRemainder.get(s.personId) ?? 0);
    if ((net.get(s.personId) ?? 0) !== expected) {
      problems.push(
        `(4) ${s.personId}: Überweisungen ergeben ${net.get(s.personId)}, erwartet ${expected}.`,
      );
    }
  }

  // (3) Überweisungen + ausgewiesener Rest = Gesamtschuld.
  const moved = settlement.transfers.reduce((a, t) => a + t.amount, 0);
  const open = settlement.remainders.reduce((a, r) => a + r.amount, 0);
  const owed = settlement.summaries.reduce((a, s) => a + (s.balance < 0 ? -s.balance : 0), 0);
  const claimed = settlement.summaries.reduce((a, s) => a + (s.balance > 0 ? s.balance : 0), 0);
  if (moved + open !== Math.max(owed, claimed)) {
    problems.push(`(3) Überweisungen (${moved}) + Rest (${open}) ≠ Gesamtschuld (${Math.max(owed, claimed)}).`);
  }

  // (5) Der offene Rest bleibt insgesamt unter der Personenzahl.
  if (n > 0 && open > n - 1) {
    problems.push(`(5) Offener Rest ${open} Cent übersteigt die Grenze von ${n - 1} Cent.`);
  }

  // (9) Die angezeigten Zahlen müssen im Kopf zum Saldo führen (F10):
  //     ausgelegt − Anteil + zurückgezahlt − erhalten = Saldo.
  //     Weil Anteil und Saldo unabhängig voneinander abgeschnitten werden, darf
  //     das Ergebnis um höchstens einen Cent danebenliegen.
  for (const s of settlement.summaries) {
    const derived = s.paid - s.share + s.repaidOut - s.repaidIn;
    if (Math.abs(derived - s.balance) > 1) {
      problems.push(
        `(9) ${s.personId}: angezeigte Zahlen ergeben ${derived}, der Saldo ist aber ${s.balance}.`,
      );
    }
  }

  // Zusatz: Ein Saldo darf nie weiter als 1 Cent vom exakten Wert abweichen.
  for (const s of settlement.summaries) {
    const exact = balance.get(s.personId);
    if (!exact) continue;
    const diff = add(exact, fromInt(-s.balance));
    if (diff.n < 0n || diff.n >= diff.d) {
      // Abschneiden zur Null hin: Der Rest muss in [0,1) liegen und dasselbe
      // Vorzeichen wie der Saldo haben. Negative Salden prüfen wir gespiegelt.
      const mirrored = add(fromInt(-s.balance), exact);
      if (!(mirrored.n <= 0n && -mirrored.n < mirrored.d)) {
        problems.push(`(Zusatz) ${s.personId}: gerundeter Saldo weicht um mehr als 1 Cent ab.`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}
