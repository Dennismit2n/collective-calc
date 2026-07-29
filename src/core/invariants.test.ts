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
