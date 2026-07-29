import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { settle } from './settle.js';
import { checkSettlement } from './invariants.js';
import { computeBalances } from './balances.js';
import { entry, equalWeights, ledger, people } from './testing.js';
import type { Entry, Ledger } from './types.js';
import { LEDGER_VERSION } from './types.js';

// ---------------------------------------------------------------------------
// Goldene Fälle — von Hand nachgerechnet (F15)
// ---------------------------------------------------------------------------

describe('goldene Fälle', () => {
  it('10,00 € auf drei Köpfe: geht ohne offenen Rest auf', () => {
    // Anna legt 1000 Cent aus, alle drei tragen zu gleichen Teilen.
    // Exakt: Anna +666,67 · Ben −333,33 · Clara −333,33
    // Abgeschnitten: +666 / −333 / −333 — beide Seiten ergeben 666, also bleibt nichts offen.
    const p = people('Anna', 'Ben', 'Clara');
    const l = ledger(p, [entry(1000, 'p1', equalWeights(p))]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([666, -333, -333]);
    expect(s.remainders).toEqual([]);
    expect(s.transfers).toEqual([
      { fromId: 'p2', toId: 'p1', amount: 333 },
      { fromId: 'p3', toId: 'p1', amount: 333 },
    ]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('1,01 € auf drei Köpfe: ein Cent bleibt namentlich offen', () => {
    // Exakt: Anna +67,33 · Ben −33,67 · Clara −33,67
    // Abgeschnitten: +67 / −33 / −33 — Schuldnerseite 66, Gläubigerseite 67.
    // Der eine Cent Differenz wird niemandem untergeschoben, sondern ausgewiesen.
    const p = people('Anna', 'Ben', 'Clara');
    const l = ledger(p, [entry(101, 'p1', equalWeights(p))]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([67, -33, -33]);
    expect(s.remainders).toEqual([{ personId: 'p1', amount: 1, direction: 'receives-less' }]);
    expect(s.transfers.reduce((a, t) => a + t.amount, 0)).toBe(66);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('findet das Minimum dort, wo das gierige Verfahren eine Überweisung mehr bräuchte', () => {
    // Salden: +4 / −1 / −3 / +2 / −2
    // Zerlegbar in {+4,−1,−3} und {+2,−2} → 2 Gruppen → 5 − 2 = 3 Überweisungen.
    // Gierig (größter Schuldner an größten Gläubiger) käme auf 4.
    const p = people('A', 'B', 'C', 'D', 'E');
    const l = ledger(p, [
      entry(4, 'p1', { p2: 1, p3: 3 }),
      entry(2, 'p4', { p5: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([4, -1, -3, 2, -2]);
    expect(s.method).toBe('exact-minimum');
    expect(s.transfers).toHaveLength(3);
    expect(s.remainders).toEqual([]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('Rückzahlungen verändern den Saldo, zählen aber nicht in die Gesamtausgaben', () => {
    const p = people('Anna', 'Ben');
    const l = ledger(p, [
      entry(1000, 'p1', equalWeights(p)), // Anna legt 10 € aus, beide je 5 €
      entry(200, 'p2', { p1: 1 }, { kind: 'repayment' }), // Ben gibt Anna 2 € zurück
    ]);
    const s = settle(l);

    expect(s.totalExpenses).toBe(1000); // nicht 1200
    expect(s.summaries.map((x) => x.balance)).toEqual([300, -300]);
    expect(s.transfers).toEqual([{ fromId: 'p2', toId: 'p1', amount: 300 }]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('eine vollständig beglichene Gruppe erzeugt keine Überweisung', () => {
    const p = people('Anna', 'Ben');
    const l = ledger(p, [entry(500, 'p1', { p1: 1 })]);
    const s = settle(l);
    expect(s.transfers).toEqual([]);
    expect(s.remainders).toEqual([]);
  });

  it('gleiche Daten ergeben zweimal exakt dasselbe Ergebnis', () => {
    const p = people('Anna', 'Ben', 'Clara', 'Dora');
    const l = ledger(p, [
      entry(1337, 'p1', equalWeights(p)),
      entry(499, 'p3', { p2: 2, p3: 1, p4: 3 }),
      entry(7, 'p4', { p1: 1, p2: 1 }),
    ]);
    expect(settle(l)).toEqual(settle(l));
  });
});

// ---------------------------------------------------------------------------
// Eigenschaftstests — zufällige Abrechnungen gegen die Invarianten aus F15
// ---------------------------------------------------------------------------

const arbLedger: fc.Arbitrary<Ledger> = fc.integer({ min: 1, max: 8 }).chain((n) => {
  const persons = people(...Array.from({ length: n }, (_, i) => `P${i + 1}`));
  const arbEntry = fc.record({
    amount: fc.integer({ min: 1, max: 500_000 }),
    payer: fc.integer({ min: 0, max: n - 1 }),
    weights: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: n, maxLength: n }),
    asRepayment: fc.boolean(),
    beneficiary: fc.integer({ min: 0, max: n - 1 }),
  });

  return fc.array(arbEntry, { maxLength: 15 }).map((raw): Ledger => {
    const entries: Entry[] = raw.map((r, i) => {
      let weights: Record<string, number>;
      let kind: Entry['kind'] = 'expense';

      if (r.asRepayment && n > 1) {
        const target = r.beneficiary === r.payer ? (r.payer + 1) % n : r.beneficiary;
        weights = Object.fromEntries(persons.map((p, idx) => [p.id, idx === target ? 1 : 0]));
        kind = 'repayment';
      } else {
        const w = r.weights.some((x) => x > 0) ? r.weights : r.weights.map((_, idx) => (idx === 0 ? 1 : 0));
        weights = Object.fromEntries(persons.map((p, idx) => [p.id, w[idx] ?? 0]));
      }

      return {
        id: `e${i}`,
        kind,
        amount: r.amount,
        payerId: persons[r.payer]!.id,
        weights,
        mode: 'equal',
        description: '',
        at: '2026-07-29T12:00:00.000Z',
      };
    });

    return {
      version: LEDGER_VERSION,
      id: 'prop',
      title: 'Zufall',
      currency: 'EUR',
      createdAt: '2026-07-29T12:00:00.000Z',
      people: persons,
      entries,
    };
  });
});

describe('Eigenschaften', () => {
  it('alle Invarianten halten für zufällige Abrechnungen', () => {
    fc.assert(
      fc.property(arbLedger, (l) => {
        const report = checkSettlement(l, settle(l));
        if (!report.ok) throw new Error(report.problems.join('\n'));
      }),
      { numRuns: 3000 },
    );
  });

  it('die Summe aller exakten Salden ist immer exakt null', () => {
    fc.assert(
      fc.property(arbLedger, (l) => {
        const { balance } = computeBalances(l);
        let n = 0n;
        let d = 1n;
        for (const b of balance.values()) {
          n = n * b.d + b.n * d;
          d = d * b.d;
        }
        expect(n).toBe(0n);
      }),
      { numRuns: 2000 },
    );
  });

  it('es gibt nie mehr Überweisungen als Personen mit offenem Saldo minus eins', () => {
    fc.assert(
      fc.property(arbLedger, (l) => {
        const s = settle(l);
        const active = s.summaries.filter((x) => x.balance !== 0).length;
        if (active === 0) expect(s.transfers).toHaveLength(0);
        else expect(s.transfers.length).toBeLessThanOrEqual(active - 1);
      }),
      { numRuns: 2000 },
    );
  });

  it('das Ergebnis ist reproduzierbar', () => {
    fc.assert(
      fc.property(arbLedger, (l) => {
        expect(settle(l)).toEqual(settle(l));
      }),
      { numRuns: 500 },
    );
  });
});
