/**
 * Prüft die Prüfung.
 *
 * Eine grüne Testsuite beweist nur, dass sie gelaufen ist. Diese Datei zeigt, dass
 * die Invarianten aus F15 tatsächlich anschlagen — sie füttert die Kontrolle mit
 * absichtlich verfälschten Ergebnissen, so wie sie durch einen abgeschnittenen Link
 * oder eine von Hand editierte Datei entstehen könnten.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { settle, greedyTransfers } from './settle.js';
import { checkSettlement } from './invariants.js';
import { entry, equalWeights, ledger, people } from './testing.js';
import type { Settlement } from './types.js';

const p = people('Anna', 'Ben', 'Clara', 'Dora');
const l = ledger(p, [
  entry(1200, 'p1', equalWeights(p)),
  entry(500, 'p2', { p1: 1, p3: 1 }),
  entry(333, 'p4', { p2: 2, p4: 1 }),
]);

function corrupt(fn: (s: Settlement) => void): Settlement {
  const s: Settlement = structuredClone(settle(l));
  fn(s);
  return s;
}

describe('die Eingangskontrolle schlägt an, wenn Daten verfälscht sind', () => {
  it('unverfälscht ist alles in Ordnung', () => {
    expect(checkSettlement(l, settle(l)).ok).toBe(true);
  });

  it('erkennt einen um einen Cent veränderten Überweisungsbetrag', () => {
    const s = corrupt((x) => {
      x.transfers[0]!.amount += 1;
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('erkennt eine fehlende Überweisung', () => {
    const s = corrupt((x) => {
      x.transfers.pop();
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('erkennt eine Überweisung an sich selbst', () => {
    const s = corrupt((x) => {
      x.transfers.push({ fromId: 'p1', toId: 'p1', amount: 5 });
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('erkennt einen erfundenen offenen Rest', () => {
    const s = corrupt((x) => {
      x.remainders.push({ personId: 'p2', amount: 3, direction: 'receives-less' });
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('erkennt einen verfälschten Saldo', () => {
    const s = corrupt((x) => {
      x.summaries[0]!.balance += 10;
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('erkennt einen negativen Überweisungsbetrag', () => {
    const s = corrupt((x) => {
      x.transfers.push({ fromId: 'p1', toId: 'p2', amount: -1 });
    });
    expect(checkSettlement(l, s).ok).toBe(false);
  });

  it('lehnt eine Abrechnung mit unbekanntem Zahler ab', () => {
    const broken = ledger(p, [entry(100, 'gibtsnicht', equalWeights(p))]);
    expect(() => settle(broken)).toThrow();
  });

  it('lehnt eine Ausgabe ohne Beteiligte ab', () => {
    const broken = ledger(p, [entry(100, 'p1', { p1: 0, p2: 0, p3: 0, p4: 0 })]);
    expect(() => settle(broken)).toThrow();
  });
});

/*
 * Die Meldungen landen wörtlich auf dem Bildschirm, wenn die Kontrolle anschlägt.
 * Es reicht deshalb nicht, dass irgendeine Regel rot wird: Die richtige muss es sein,
 * sonst sucht man den Fehler an der falschen Stelle. Jede Verfälschung hier trifft
 * möglichst nur eine Regel. Ausgangslage: Anna +650, Ben −22, Clara −550, Dora −78,
 * also Ben → Anna 22, Clara → Anna 550, Dora → Anna 78.
 */
describe('jede Regel meldet sich mit ihrer eigenen Nummer', () => {
  it('(4) vertauschte Absender bei gleicher Summe', () => {
    const s = corrupt((x) => {
      x.transfers[0]!.fromId = 'p3';
      x.transfers[1]!.fromId = 'p2';
    });
    expect(checkSettlement(l, s).problems).toEqual([
      '(4) p2: Überweisungen ergeben -550, erwartet -22.',
      '(4) p3: Überweisungen ergeben -22, erwartet -550.',
    ]);
  });

  it('(6) eine Überweisung über null Cent', () => {
    const s = corrupt((x) => {
      x.transfers.push({ fromId: 'p2', toId: 'p1', amount: 0 });
    });
    expect(checkSettlement(l, s).problems).toEqual(['(6) Überweisungsbetrag ist keine positive ganze Zahl.']);
  });

  it('(6) Bruchteile eines Cents, auch wenn die Summe stimmt', () => {
    const s = corrupt((x) => {
      x.transfers[0]!.amount = 21.5;
      x.transfers.push({ fromId: 'p2', toId: 'p1', amount: 0.5 });
    });
    expect(checkSettlement(l, s).problems).toEqual([
      '(6) Überweisungsbetrag ist keine positive ganze Zahl.',
      '(6) Überweisungsbetrag ist keine positive ganze Zahl.',
    ]);
  });

  it('(6) ein unbekannter Empfänger', () => {
    const s = corrupt((x) => {
      x.transfers[0]!.toId = 'p9';
    });
    expect(checkSettlement(l, s).problems).toEqual([
      '(6) Überweisung betrifft eine unbekannte Person.',
      '(4) p1: Überweisungen ergeben 628, erwartet 650.',
    ]);
  });

  it('(6) ein unbekannter Absender', () => {
    const s = corrupt((x) => {
      x.transfers[0]!.fromId = 'p9';
    });
    expect(checkSettlement(l, s).problems).toEqual([
      '(6) Überweisung betrifft eine unbekannte Person.',
      '(4) p2: Überweisungen ergeben 0, erwartet -22.',
    ]);
  });

  it('(6) und (3) bei einer Überweisung an sich selbst', () => {
    // Für Anna selbst hebt sie sich auf, deshalb schweigt (4). Bewegt wird trotzdem zu viel.
    const s = corrupt((x) => {
      x.transfers.push({ fromId: 'p1', toId: 'p1', amount: 5 });
    });
    expect(checkSettlement(l, s).problems).toEqual([
      '(6) Überweisung an sich selbst.',
      '(3) Überweisungen (655) + Rest (0) ≠ Gesamtschuld (650).',
    ]);
  });

  it('(3) nennt als Gesamtschuld die größere der beiden Seiten', () => {
    // 1,01 € auf drei: Schuldner 66, Gläubiger 67, ein Cent offen. Die Gesamtschuld
    // ist 67, denn 66 werden überwiesen und 1 bleibt offen.
    const q = people('Anna', 'Ben', 'Clara');
    const m = ledger(q, [entry(101, 'p1', equalWeights(q))]);
    const s: Settlement = structuredClone(settle(m));
    s.transfers.push({ fromId: 'p1', toId: 'p1', amount: 5 });
    expect(checkSettlement(m, s).problems).toEqual([
      '(6) Überweisung an sich selbst.',
      '(3) Überweisungen (71) + Rest (1) ≠ Gesamtschuld (67).',
    ]);
  });

  it('ein Anlass ohne Personen ist kein Fehler', () => {
    // So sieht jeder neue Anlass aus, bevor jemand eingetragen ist.
    const leer = ledger([], []);
    expect(checkSettlement(leer, settle(leer)).problems).toEqual([]);
  });

  it('(5) mehr offener Rest als Personen minus eins', () => {
    const rest = (amount: number) =>
      checkSettlement(
        l,
        corrupt((x) => {
          x.remainders.push({ personId: 'p1', amount, direction: 'receives-less' });
        }),
      ).problems;

    expect(rest(4)).toContain('(5) Offener Rest 4 Cent übersteigt die Grenze von 3 Cent.');
    // Drei Cent bei vier Personen sind noch erlaubt; die anderen Regeln schlagen
    // hier trotzdem an, weil der Rest erfunden ist.
    expect(rest(3).some((p) => p.startsWith('(5)'))).toBe(false);
  });

  it('(9) angezeigte Zahlen, die im Kopf nicht zum Saldo führen', () => {
    const paidPlus = (cents: number) =>
      checkSettlement(
        l,
        corrupt((x) => {
          x.summaries[0]!.paid += cents;
        }),
      ).problems;

    expect(paidPlus(2)).toEqual(['(9) p1: angezeigte Zahlen ergeben 652, der Saldo ist aber 650.']);
    // Ein Cent ist erlaubt: Anteil und Saldo werden getrennt abgeschnitten.
    expect(paidPlus(1)).toEqual([]);
  });

  it('(Zusatz) ein Saldo, der einen ganzen Cent neben dem exakten Wert liegt', () => {
    const plus = corrupt((x) => {
      x.summaries[0]!.balance = 651;
    });
    expect(checkSettlement(l, plus).problems).toContain(
      '(Zusatz) p1: gerundeter Saldo weicht um mehr als 1 Cent ab.',
    );

    const minus = corrupt((x) => {
      x.summaries[2]!.balance = -551;
    });
    expect(checkSettlement(l, minus).problems).toContain(
      '(Zusatz) p3: gerundeter Saldo weicht um mehr als 1 Cent ab.',
    );
  });
});

describe('das exakte Verfahren ist dem gierigen nie unterlegen (F14)', () => {
  it('braucht im Musterfall eine Überweisung weniger', () => {
    // Salden +4 / −1 / −3 / +2 / −2
    const q = people('A', 'B', 'C', 'D', 'E');
    const m = ledger(q, [entry(4, 'p1', { p2: 1, p3: 3 }), entry(2, 'p4', { p5: 1 })]);

    const exact = settle(m);
    const greedy = settle(m, { forceGreedy: true });

    expect(exact.method).toBe('exact-minimum');
    expect(greedy.method).toBe('greedy-fallback');
    expect(exact.transfers).toHaveLength(3);
    expect(greedy.transfers).toHaveLength(4);

    // Beide Wege müssen korrekt sein — der Rückfall darf nur mehr Überweisungen
    // erzeugen, niemals falsche Beträge.
    expect(checkSettlement(m, exact).problems).toEqual([]);
    expect(checkSettlement(m, greedy).problems).toEqual([]);
  });

  it('das gierige Verfahren liefert bei Zufallsdaten stets gültige, nie weniger Überweisungen', () => {
    const arb = fc
      .array(fc.integer({ min: -5000, max: 5000 }).filter((x) => x !== 0), { minLength: 2, maxLength: 9 })
      .map((xs) => {
        // Auf Summe null bringen, damit es eine echte Abrechnung ist.
        const sum = xs.reduce((a, b) => a + b, 0);
        return [...xs, -sum].filter((x) => x !== 0);
      })
      .filter((xs) => xs.length >= 2);

    fc.assert(
      fc.property(arb, (values) => {
        const persons = people(...values.map((_, i) => `P${i + 1}`));
        const debts: Array<[string, number]> = [];
        const credits: Array<[string, number]> = [];
        values.forEach((v, i) => {
          const id = persons[i]!.id;
          if (v < 0) debts.push([id, -v]);
          else credits.push([id, v]);
        });
        const t = greedyTransfers(debts, credits);
        const moved = t.reduce((a, x) => a + x.amount, 0);
        const owed = debts.reduce((a, [, x]) => a + x, 0);
        expect(moved).toBe(owed);
        expect(t.length).toBeLessThanOrEqual(values.length - 1);
        for (const x of t) {
          expect(x.amount).toBeGreaterThan(0);
          expect(x.fromId).not.toBe(x.toId);
        }
      }),
      { numRuns: 1500 },
    );
  });
});
