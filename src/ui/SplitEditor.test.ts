/**
 * Die Aufteilungsarten sind alle dieselbe Rechnung mit anderer Eingabemaske.
 * Getestet wird deshalb vor allem, dass die Umrechnung in Gewichte stimmt — und
 * dass „genau" auch genau heißt.
 */

import { describe, expect, it } from 'vitest';

import { initialSplit, toWeights } from './SplitEditor.js';
import type { SplitState } from './SplitEditor.js';
import { createTranslator } from '../i18n/index.js';
import { settle } from '../core/settle.js';
import { entry, ledger, people } from '../core/testing.js';

const t = createTranslator('de');
const p = people('Anna', 'Ben', 'Clara');

function state(patch: Partial<SplitState>): SplitState {
  return { ...initialSplit(), ...patch };
}

describe('alle gleich', () => {
  it('gibt jedem das Gewicht 1', () => {
    const r = toWeights(state({ mode: 'equal' }), p, 1000, t, 'EUR');
    expect(r).toEqual({ weights: { p1: 1, p2: 1, p3: 1 } });
  });

  it('setzt Abwesende auf 0', () => {
    const r = toWeights(state({ mode: 'equal', excluded: new Set(['p2']) }), p, 1000, t, 'EUR');
    expect(r).toEqual({ weights: { p1: 1, p2: 0, p3: 1 } });
  });

  it('verweigert eine Ausgabe, an der niemand beteiligt ist', () => {
    const r = toWeights(state({ mode: 'equal', excluded: new Set(['p1', 'p2', 'p3']) }), p, 1000, t, 'EUR');
    expect(r).toHaveProperty('error');
  });
});

describe('Anteile', () => {
  it('nimmt ganze und halbe Anteile', () => {
    const r = toWeights(state({ mode: 'shares', values: { p1: '2', p2: '1', p3: '1,5' } }), p, 1000, t, 'EUR');
    // Intern verzehnfacht, damit alles ganzzahlig bleibt.
    expect(r).toEqual({ weights: { p1: 20, p2: 10, p3: 15 } });
  });

  it('ein Anteil von 0 heißt: nicht dabei', () => {
    const r = toWeights(state({ mode: 'shares', values: { p1: '1', p2: '0', p3: '1' } }), p, 1000, t, 'EUR');
    expect(r).toEqual({ weights: { p1: 10, p2: 0, p3: 10 } });
  });

  it('das Paar-Beispiel geht auf', () => {
    // Ferienhaus 300 €, ein Paar zahlt doppelt: 2 + 1 = 3 Anteile.
    const r = toWeights(state({ mode: 'shares', values: { p1: '2', p2: '1', p3: '0' } }), p, 30000, t, 'EUR');
    if ('error' in r) throw new Error(r.error);
    const l = ledger(p, [entry(30000, 'p1', r.weights, { mode: 'shares' })]);
    const s = settle(l);
    expect(s.summaries.map((x) => x.balance)).toEqual([10000, -10000, 0]);
  });
});

describe('Prozent', () => {
  it('verlangt, dass die Summe 100 ergibt', () => {
    const zuWenig = toWeights(state({ mode: 'percent', values: { p1: '50', p2: '30', p3: '10' } }), p, 1000, t, 'EUR');
    expect(zuWenig).toHaveProperty('error');
    expect((zuWenig as { error: string }).error).toContain('90');
  });

  it('nimmt Nachkommastellen', () => {
    const r = toWeights(
      state({ mode: 'percent', values: { p1: '33,33', p2: '33,33', p3: '33,34' } }),
      p,
      1000,
      t,
      'EUR',
    );
    expect(r).toEqual({ weights: { p1: 3333, p2: 3333, p3: 3334 } });
  });
});

describe('genaue Beträge', () => {
  it('das Gewicht ist der Betrag selbst', () => {
    const r = toWeights(
      state({ mode: 'exact', values: { p1: '5,00', p2: '3,00', p3: '2,00' } }),
      p,
      1000,
      t,
      'EUR',
    );
    expect(r).toEqual({ weights: { p1: 500, p2: 300, p3: 200 } });
  });

  it('„genau" heißt genau — eine Abweichung wird abgelehnt', () => {
    const r = toWeights(
      state({ mode: 'exact', values: { p1: '5,00', p2: '3,00', p3: '1,99' } }),
      p,
      1000,
      t,
      'EUR',
    );
    expect(r).toHaveProperty('error');
    expect((r as { error: string }).error).toContain('9,99');
    expect((r as { error: string }).error).toContain('10,00');
  });

  it('der Restaurantfall rechnet sich korrekt durch', () => {
    // Anna legt 30 € aus. Jeder weiß, was sein Essen gekostet hat.
    const r = toWeights(
      state({ mode: 'exact', values: { p1: '12,00', p2: '10,50', p3: '7,50' } }),
      p,
      3000,
      t,
      'EUR',
    );
    if ('error' in r) throw new Error(r.error);
    const l = ledger(p, [entry(3000, 'p1', r.weights, { mode: 'exact' })]);
    const s = settle(l);
    expect(s.summaries.map((x) => x.balance)).toEqual([1800, -1050, -750]);
    expect(s.remainders).toEqual([]);
    expect(s.transfers).toHaveLength(2);
  });

  it('akzeptiert Komma und Punkt gleichermaßen', () => {
    const mitKomma = toWeights(state({ mode: 'exact', values: { p1: '5,00', p2: '5,00' } }), p.slice(0, 2), 1000, t, 'EUR');
    const mitPunkt = toWeights(state({ mode: 'exact', values: { p1: '5.00', p2: '5.00' } }), p.slice(0, 2), 1000, t, 'EUR');
    expect(mitKomma).toEqual(mitPunkt);
  });
});
