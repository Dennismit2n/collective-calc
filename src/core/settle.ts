/**
 * Vom exakten Saldo zur Überweisungsliste.
 *
 * Zwei Entscheidungen aus dem Interview stecken hier drin:
 *
 * F12 — Der Rest-Cent wird **niemandem untergeschoben**. Alle Salden werden zur Null
 *       hin abgeschnitten; was dadurch nicht aufgeht, wird namentlich ausgewiesen
 *       ("Bei Anna bleibt 1 Cent offen"). Die Invariante lautet deshalb nicht
 *       "alles geht auf", sondern: Überweisungen + ausgewiesener Rest = Gesamtschuld.
 *
 * F14 — Ausgeglichen wird mit der **kleinstmöglichen** Zahl an Überweisungen, berechnet
 *       durch Zerlegung in Teilmengen, die für sich genommen auf null aufgehen.
 *       Ab einer Gruppengröße, ab der das zu teuer wird, fällt die Funktion automatisch
 *       auf das gierige Verfahren zurück.
 */

import type { Cent, Ledger, PersonId, Settlement, Transfer, OpenRemainder } from './types.js';
import { computeBalances } from './balances.js';
import type { Rat } from './rational.js';
import { ZERO, add, cmp, fromInt, truncToward0, truncatedPart } from './rational.js';

/**
 * Ab wie vielen Personen mit offenem Saldo auf das gierige Verfahren zurückgefallen wird.
 * Der exakte Weg kostet in der Größenordnung 3^n Schritte; bei 16 ist er noch im
 * Millisekundenbereich, darüber wird er spürbar. Reale Gruppen liegen weit darunter.
 */
export const MAX_EXACT_PARTICIPANTS = 16;

interface Side {
  personId: PersonId;
  /** Ganze Cent, immer > 0. */
  amount: Cent;
  /** Was beim Abschneiden verloren ging, in [0,1). Basis für die faire Restverteilung. */
  lost: Rat;
  /** Reihenfolge in der Personenliste — sorgt für reproduzierbare Ergebnisse. */
  order: number;
}

/**
 * Verteilt `remaining` Cent Fehlbetrag auf eine Seite (Schuldner oder Gläubiger).
 *
 * Fair heißt hier: Der zusätzliche Cent geht jeweils an die Person, die bisher am
 * wenigsten durch das Abschneiden verloren hat. Damit gleicht sich der Verlust über
 * die Gruppe aus, statt sich bei denselben Leuten zu sammeln. Bei Gleichstand
 * entscheidet die Reihenfolge in der Personenliste — deterministisch, weil bei
 * gleichen Daten zweimal dasselbe herauskommen muss (F12, Invariante 7).
 */
function absorbRemainder(side: Side[], remaining: number): Map<PersonId, Cent> {
  const extra = new Map<PersonId, Cent>();
  const load = new Map<PersonId, Rat>();
  for (const s of side) load.set(s.personId, s.lost);

  let left = remaining;
  while (left > 0) {
    let best: Side | undefined;
    for (const s of side) {
      const alreadyTaken = extra.get(s.personId) ?? 0;
      if (s.amount - alreadyTaken <= 0) continue; // nichts mehr wegzunehmen
      if (best === undefined) {
        best = s;
        continue;
      }
      const a = load.get(s.personId) ?? ZERO;
      const b = load.get(best.personId) ?? ZERO;
      const c = cmp(a, b);
      if (c < 0 || (c === 0 && s.order < best.order)) best = s;
    }
    if (best === undefined) break; // kann rechnerisch nicht eintreten, aber nie endlos laufen
    extra.set(best.personId, (extra.get(best.personId) ?? 0) + 1);
    load.set(best.personId, add(load.get(best.personId) ?? ZERO, fromInt(1)));
    left -= 1;
  }
  return extra;
}

/** Gieriges Verfahren: größter Schuldner zahlt an größten Gläubiger. Höchstens n−1 Überweisungen. */
export function greedyTransfers(debtors: Array<[PersonId, Cent]>, creditors: Array<[PersonId, Cent]>): Transfer[] {
  const d = debtors.map(([id, a]) => ({ id, a })).sort((x, y) => y.a - x.a || (x.id < y.id ? -1 : 1));
  const c = creditors.map(([id, a]) => ({ id, a })).sort((x, y) => y.a - x.a || (x.id < y.id ? -1 : 1));
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < d.length && j < c.length) {
    const from = d[i]!;
    const to = c[j]!;
    const amount = Math.min(from.a, to.a);
    if (amount > 0) out.push({ fromId: from.id, toId: to.id, amount });
    from.a -= amount;
    to.a -= amount;
    if (from.a === 0) i += 1;
    if (to.a === 0) j += 1;
  }
  return out;
}

/**
 * Zerlegt die Teilnehmer in möglichst viele Teilmengen, die je für sich auf null aufgehen.
 * Jede solche Teilmenge spart eine Überweisung: k Personen brauchen k−1 Überweisungen.
 * Rückgabe: Liste von Masken. Undefined, wenn die Gruppe zu groß ist.
 */
function partitionIntoZeroSumGroups(values: number[]): number[] | undefined {
  const m = values.length;
  if (m === 0) return [];
  if (m > MAX_EXACT_PARTICIPANTS) return undefined;

  const size = 1 << m;
  const sums = new Int32Array(size);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    const idx = 31 - Math.clz32(low);
    sums[mask] = sums[mask ^ low]! + values[idx]!;
  }

  const dp = new Int32Array(size).fill(-1); // -1 = noch nicht berechnet / unmöglich
  const choice = new Int32Array(size);
  dp[0] = 0;

  for (let mask = 1; mask < size; mask++) {
    if (sums[mask] !== 0) continue; // nur nullsummige Masken sind zerlegbar
    const low = mask & -mask;
    let best = -1;
    let bestSub = 0;
    // Alle Teilmengen durchgehen, die das niedrigste gesetzte Bit enthalten.
    // Damit wird jede Zerlegung genau einmal betrachtet.
    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if ((sub & low) === 0) continue;
      if (sums[sub] !== 0) continue;
      const rest = dp[mask ^ sub]!;
      if (rest < 0) continue;
      if (rest + 1 > best) {
        best = rest + 1;
        bestSub = sub;
      }
    }
    dp[mask] = best;
    choice[mask] = bestSub;
  }

  const full = size - 1;
  if (dp[full]! < 0) return undefined; // kann bei Summe 0 nicht eintreten
  const groups: number[] = [];
  let mask = full;
  while (mask !== 0) {
    const sub = choice[mask]!;
    groups.push(sub);
    mask ^= sub;
  }
  return groups;
}

/**
 * Berechnet die vollständige Abrechnung: Zusammenfassung je Person, Überweisungen
 * und den offen bleibenden Rest.
 */
export function settle(ledger: Ledger, options: { forceGreedy?: boolean } = {}): Settlement {
  const { balance, paid, share, totalExpenses } = computeBalances(ledger);

  const order = new Map<PersonId, number>();
  ledger.people.forEach((p, i) => order.set(p.id, i));

  const debtSide: Side[] = [];
  const creditSide: Side[] = [];

  for (const person of ledger.people) {
    const exact = balance.get(person.id) ?? ZERO;
    const truncated = Number(truncToward0(exact));
    if (truncated > 0) {
      creditSide.push({
        personId: person.id,
        amount: truncated,
        lost: truncatedPart(exact),
        order: order.get(person.id) ?? 0,
      });
    } else if (truncated < 0) {
      debtSide.push({
        personId: person.id,
        amount: -truncated,
        lost: truncatedPart(exact),
        order: order.get(person.id) ?? 0,
      });
    }
  }

  const totalDebt = debtSide.reduce((s, x) => s + x.amount, 0);
  const totalCredit = creditSide.reduce((s, x) => s + x.amount, 0);

  // Beide Seiten wurden zur Null hin abgeschnitten und können dadurch unterschiedlich
  // groß sein. Die kleinere Seite bestimmt, wie viel überhaupt fließen kann; die
  // Differenz bleibt offen und wird namentlich ausgewiesen.
  const remainders: OpenRemainder[] = [];
  const reduce = Math.abs(totalDebt - totalCredit);
  let extra = new Map<PersonId, Cent>();

  if (reduce > 0) {
    if (totalCredit > totalDebt) {
      extra = absorbRemainder(creditSide, reduce);
      for (const [personId, amount] of extra) {
        remainders.push({ personId, amount, direction: 'receives-less' });
      }
    } else {
      extra = absorbRemainder(debtSide, reduce);
      for (const [personId, amount] of extra) {
        remainders.push({ personId, amount, direction: 'pays-less' });
      }
    }
  }

  const finalDebts: Array<[PersonId, Cent]> = debtSide
    .map((s) => [s.personId, s.amount - (extra.get(s.personId) ?? 0)] as [PersonId, Cent])
    .filter(([, a]) => a > 0);
  const finalCredits: Array<[PersonId, Cent]> = creditSide
    .map((s) => [s.personId, s.amount - (extra.get(s.personId) ?? 0)] as [PersonId, Cent])
    .filter(([, a]) => a > 0);

  // Jetzt sind beide Seiten gleich groß. Nur noch verteilen.
  const participants = [...finalDebts.map(([id, a]) => ({ id, v: -a })), ...finalCredits.map(([id, a]) => ({ id, v: a }))];

  let transfers: Transfer[];
  let method: Settlement['method'];
  const groups = options.forceGreedy
    ? undefined
    : partitionIntoZeroSumGroups(participants.map((p) => p.v));

  if (groups === undefined) {
    method = 'greedy-fallback';
    transfers = greedyTransfers(finalDebts, finalCredits);
  } else {
    method = 'exact-minimum';
    transfers = [];
    for (const mask of groups) {
      const gDebt: Array<[PersonId, Cent]> = [];
      const gCredit: Array<[PersonId, Cent]> = [];
      for (let i = 0; i < participants.length; i++) {
        if ((mask & (1 << i)) === 0) continue;
        const p = participants[i]!;
        if (p.v < 0) gDebt.push([p.id, -p.v]);
        else if (p.v > 0) gCredit.push([p.id, p.v]);
      }
      transfers.push(...greedyTransfers(gDebt, gCredit));
    }
  }

  // Reproduzierbare Reihenfolge (Invariante 7).
  transfers.sort(
    (a, b) =>
      (order.get(a.fromId) ?? 0) - (order.get(b.fromId) ?? 0) ||
      (order.get(a.toId) ?? 0) - (order.get(b.toId) ?? 0) ||
      a.amount - b.amount,
  );
  remainders.sort((a, b) => (order.get(a.personId) ?? 0) - (order.get(b.personId) ?? 0));

  const summaries = ledger.people.map((p) => {
    const exact = balance.get(p.id) ?? ZERO;
    const sh = share.get(p.id) ?? ZERO;
    return {
      personId: p.id,
      paid: paid.get(p.id) ?? 0,
      share: Number(truncToward0(sh)),
      balance: Number(truncToward0(exact)),
      exactBalance: { n: exact.n.toString(), d: exact.d.toString() },
    };
  });

  return { summaries, transfers, remainders, totalExpenses, method };
}
