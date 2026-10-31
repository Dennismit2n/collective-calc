import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { MAX_EXACT_PARTICIPANTS, greedyTransfers, settle } from './settle.js';
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

  it('Rückzahlungen erscheinen getrennt vom Anteil an den Ausgaben', () => {
    // Sonst hätte Anna nach einer erhaltenen Rückzahlung plötzlich einen viel
    // größeren „Anteil an den Ausgaben", obwohl sie nichts mehr verbraucht hat.
    const p = people('Anna', 'Ben');
    const l = ledger(p, [
      entry(1000, 'p1', equalWeights(p)), // Anna legt 10 € aus, je 5 €
      entry(300, 'p2', { p1: 1 }, { kind: 'repayment' }), // Ben zahlt 3 € zurück
    ]);
    const s = settle(l);
    const anna = s.summaries[0]!;
    const ben = s.summaries[1]!;

    expect(anna).toMatchObject({ paid: 1000, share: 500, repaidOut: 0, repaidIn: 300, balance: 200 });
    expect(ben).toMatchObject({ paid: 0, share: 500, repaidOut: 300, repaidIn: 0, balance: -200 });

    // Die Zahlen müssen sich im Kopf zum Saldo zusammenrechnen lassen.
    for (const x of [anna, ben]) {
      expect(x.paid - x.share + x.repaidOut - x.repaidIn).toBe(x.balance);
    }
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('eine vollständig beglichene Gruppe erzeugt keine Überweisung', () => {
    const p = people('Anna', 'Ben');
    const l = ledger(p, [entry(500, 'p1', { p1: 1 })]);
    const s = settle(l);
    expect(s.transfers).toEqual([]);
    expect(s.remainders).toEqual([]);
  });

  it('der Rest-Cent geht an den, der beim Abschneiden am wenigsten verloren hat', () => {
    // Ben zahlt 1,00 € für Anna, Ben, Clara; Dora zahlt 1,00 € für dieselben drei.
    // Exakt: Anna −66,67 · Ben +33,33 · Clara −66,67 · Dora +100
    // Abgeschnitten: −66 / +33 / −66 / +100 — Gläubiger 133, Schuldner 132.
    // Ben hat 1/3 Cent verloren, Dora nichts. Also trägt Dora den Cent, obwohl
    // Ben in der Liste vorher steht.
    const p = people('Anna', 'Ben', 'Clara', 'Dora');
    const l = ledger(p, [
      entry(100, 'p2', { p1: 1, p2: 1, p3: 1 }),
      entry(100, 'p4', { p1: 1, p2: 1, p3: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([-66, 33, -66, 100]);
    expect(s.remainders).toEqual([{ personId: 'p4', amount: 1, direction: 'receives-less' }]);
    expect(s.transfers).toEqual([
      { fromId: 'p1', toId: 'p4', amount: 66 },
      { fromId: 'p3', toId: 'p2', amount: 33 },
      { fromId: 'p3', toId: 'p4', amount: 33 },
    ]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('dieselbe Regel gilt auf der Schuldnerseite', () => {
    // Anna zahlt 1,00 € für Anna, Ben, Clara; Ben zahlt 1,00 € für alle vier.
    // Exakt: Anna +41,67 · Ben +41,67 · Clara −58,33 · Dora −25
    // Abgeschnitten: +41 / +41 / −58 / −25 — Schuldner 83, Gläubiger 82.
    // Clara hat 1/3 Cent verloren, Dora nichts: Dora zahlt einen Cent weniger.
    const p = people('Anna', 'Ben', 'Clara', 'Dora');
    const l = ledger(p, [
      entry(100, 'p1', { p1: 1, p2: 1, p3: 1 }),
      entry(100, 'p2', { p1: 1, p2: 1, p3: 1, p4: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([41, 41, -58, -25]);
    expect(s.remainders).toEqual([{ personId: 'p4', amount: 1, direction: 'pays-less' }]);
    expect(s.transfers.reduce((a, t) => a + t.amount, 0)).toBe(82);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('zwei offene Cent landen bei zwei Personen, nicht zweimal bei derselben', () => {
    // Dora und Emil zahlen je 1,00 € für Anna, Ben und Clara.
    // Exakt: die drei je −66,67, Dora und Emil je +100 — abgeschnitten 198 gegen 200.
    // Dora und Emil haben nichts verloren, Gleichstand: Dora steht vorne und trägt
    // den ersten Cent. Danach hat sie einen Cent getragen, Emil keinen, also trägt
    // Emil den zweiten.
    const p = people('Anna', 'Ben', 'Clara', 'Dora', 'Emil');
    const l = ledger(p, [
      entry(100, 'p4', { p1: 1, p2: 1, p3: 1 }),
      entry(100, 'p5', { p1: 1, p2: 1, p3: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([-66, -66, -66, 100, 100]);
    expect(s.remainders).toEqual([
      { personId: 'p4', amount: 1, direction: 'receives-less' },
      { personId: 'p5', amount: 1, direction: 'receives-less' },
    ]);
    expect(s.transfers).toEqual([
      { fromId: 'p1', toId: 'p4', amount: 66 },
      { fromId: 'p2', toId: 'p4', amount: 33 },
      { fromId: 'p2', toId: 'p5', amount: 33 },
      { fromId: 'p3', toId: 'p5', amount: 66 },
    ]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('bei Gleichstand trägt den Rest-Cent, wer in der Liste weiter vorne steht', () => {
    // Dora zahlt 1,00 € für Anna, Ben, Clara, Emil zahlt 0,30 € für dieselben drei.
    // Exakt: die drei je −43,33, Dora +100, Emil +30. Abgeschnitten 129 gegen 130.
    // Dora und Emil haben beide nichts verloren, Dora steht vorne.
    const p = people('Anna', 'Ben', 'Clara', 'Dora', 'Emil');
    const l = ledger(p, [
      entry(100, 'p4', { p1: 1, p2: 1, p3: 1 }),
      entry(30, 'p5', { p1: 1, p2: 1, p3: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([-43, -43, -43, 100, 30]);
    expect(s.remainders).toEqual([{ personId: 'p4', amount: 1, direction: 'receives-less' }]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('listet offene Cent in der Reihenfolge der Personen, nicht der Vergabe', () => {
    // Anna zahlt 1,00 € für Anna, Ben, Clara; Emil zahlt 1,02 € für die ersten vier.
    // Exakt: Anna +41,17 · Ben −58,83 · Clara −58,83 · Dora −25,50 · Emil +102
    // Abgeschnitten 141 gegen 143. Emil hat nichts verloren und trägt den ersten
    // Cent, danach Anna mit 1/6. Angezeigt wird trotzdem Anna zuerst.
    const p = people('Anna', 'Ben', 'Clara', 'Dora', 'Emil');
    const l = ledger(p, [
      entry(100, 'p1', { p1: 1, p2: 1, p3: 1 }),
      entry(102, 'p5', { p1: 1, p2: 1, p3: 1, p4: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([41, -58, -58, -25, 102]);
    expect(s.remainders).toEqual([
      { personId: 'p1', amount: 1, direction: 'receives-less' },
      { personId: 'p5', amount: 1, direction: 'receives-less' },
    ]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('nimmt niemandem mehr Cent weg, als ihm überhaupt zustehen', () => {
    // Anna legt 1 Cent für Clara aus, Ben 1,03 € für Clara, Dora, Emil, Frida.
    // Exakt: Anna +1 · Ben +103 · Clara −26,75 · Dora, Emil, Frida je −25,75
    // Abgeschnitten 101 gegen 104, drei Cent bleiben offen. Anna und Ben haben
    // nichts verloren. Erster Cent an Anna (vorne), zweiter an Ben (weniger getragen),
    // der dritte wieder an Anna wäre an der Reihe, aber sie hat keinen mehr: Ben.
    const p = people('Anna', 'Ben', 'Clara', 'Dora', 'Emil', 'Frida');
    const l = ledger(p, [
      entry(1, 'p1', { p3: 1 }),
      entry(103, 'p2', { p3: 1, p4: 1, p5: 1, p6: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([1, 103, -26, -25, -25, -25]);
    expect(s.remainders).toEqual([
      { personId: 'p1', amount: 1, direction: 'receives-less' },
      { personId: 'p2', amount: 2, direction: 'receives-less' },
    ]);
    expect(s.transfers.every((t) => t.toId === 'p2')).toBe(true);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('verteilt viele offene Cent reihum, statt sie bei einer Person zu sammeln', () => {
    // Anna zahlt 1,04 € für Clara bis Greta (je 20,8 Cent), Ben 0,04 € für sich und Hanna.
    // Abgeschnitten: Anna +104, Ben +2, fünfmal −20, Hanna −2 — 102 gegen 106.
    // Vier Cent bleiben offen. Beide haben nichts verloren, also abwechselnd:
    // Anna, Ben, Anna, Ben. Wer schon getragen hat, kommt erst danach wieder dran.
    const p = people('Anna', 'Ben', 'Clara', 'Dora', 'Emil', 'Frida', 'Greta', 'Hanna');
    const l = ledger(p, [
      entry(104, 'p1', { p3: 1, p4: 1, p5: 1, p6: 1, p7: 1 }),
      entry(4, 'p2', { p2: 1, p8: 1 }),
    ]);
    const s = settle(l);

    expect(s.summaries.map((x) => x.balance)).toEqual([104, 2, -20, -20, -20, -20, -20, -2]);
    expect(s.remainders).toEqual([
      { personId: 'p1', amount: 2, direction: 'receives-less' },
      { personId: 'p2', amount: 2, direction: 'receives-less' },
    ]);
    expect(checkSettlement(l, s).problems).toEqual([]);
  });

  it('gibt den exakten Saldo als ungekürzten Text mit, für den antippbaren Exaktwert', () => {
    const p = people('Anna', 'Ben', 'Clara');
    const s = settle(ledger(p, [entry(1000, 'p1', equalWeights(p))]));
    expect(s.summaries.map((x) => x.exactBalance)).toEqual([
      { n: '2000', d: '3' },
      { n: '-1000', d: '3' },
      { n: '-1000', d: '3' },
    ]);
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
// Das gierige Verfahren und die Grenze zum exakten (F14)
// ---------------------------------------------------------------------------

describe('gieriges Verfahren', () => {
  it('lässt den größten Schuldner an den größten Gläubiger zahlen', () => {
    // Größter Schuldner a (5) an größten Gläubiger y (6), dann b den Rest.
    const t = greedyTransfers(
      [['b', 3], ['a', 5]],
      [['x', 2], ['y', 6]],
    );
    expect(t).toEqual([
      { fromId: 'a', toId: 'y', amount: 5 },
      { fromId: 'b', toId: 'y', amount: 1 },
      { fromId: 'b', toId: 'x', amount: 2 },
    ]);
  });

  it('entscheidet Gleichstände nach der Kennung, nicht nach der Eingabereihenfolge', () => {
    expect(greedyTransfers([['b', 3], ['a', 3]], [['x', 4], ['y', 2]])).toEqual([
      { fromId: 'a', toId: 'x', amount: 3 },
      { fromId: 'b', toId: 'x', amount: 1 },
      { fromId: 'b', toId: 'y', amount: 2 },
    ]);
    expect(greedyTransfers([['a', 4], ['b', 2]], [['y', 3], ['x', 3]])).toEqual([
      { fromId: 'a', toId: 'x', amount: 3 },
      { fromId: 'a', toId: 'y', amount: 1 },
      { fromId: 'b', toId: 'y', amount: 2 },
    ]);
  });
});

describe('Grenze des exakten Verfahrens', () => {
  /** n Personen in Paaren: jede ungerade legt 1,00 € für die nächste aus. */
  function pairs(n: number): Ledger {
    const p = people(...Array.from({ length: n }, (_, i) => `P${i + 1}`));
    const entries: Entry[] = [];
    for (let i = 0; i + 1 < n; i += 2) entries.push(entry(100, p[i]!.id, { [p[i + 1]!.id]: 1 }));
    return ledger(p, entries);
  }

  it(`rechnet bei genau ${MAX_EXACT_PARTICIPANTS} offenen Salden noch exakt`, () => {
    const s = settle(pairs(MAX_EXACT_PARTICIPANTS));
    expect(s.summaries.filter((x) => x.balance !== 0)).toHaveLength(MAX_EXACT_PARTICIPANTS);
    expect(s.method).toBe('exact-minimum');
  });

  it('fällt darüber auf das gierige Verfahren zurück', () => {
    // 16 Personen in Paaren plus X, der 1,00 € für P2 auslegt:
    // P2 schuldet dann 2,00 €, X bekommt 1,00 €. 17 offene Salden, einer zu viel.
    const l = pairs(MAX_EXACT_PARTICIPANTS);
    const p = [...l.people, { id: 'x', name: 'X' }];
    const withOne = ledger(p, [...l.entries, entry(100, 'x', { p2: 1 })]);
    const s = settle(withOne);
    expect(s.summaries.filter((x) => x.balance !== 0)).toHaveLength(MAX_EXACT_PARTICIPANTS + 1);
    expect(s.method).toBe('greedy-fallback');
    expect(checkSettlement(withOne, s).problems).toEqual([]);
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
