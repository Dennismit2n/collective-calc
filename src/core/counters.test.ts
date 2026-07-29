import { describe, expect, it } from 'vitest';

import { countersForNewEntry } from './counters.js';
import type { Entry, Ledger } from './types.js';
import { LEDGER_VERSION } from './types.js';

function ledgerMit(zeiten: string[], arten: Array<Entry['kind']> = []): Ledger {
  return {
    version: LEDGER_VERSION,
    id: 'z',
    title: '',
    currency: 'EUR',
    createdAt: '2026-08-01T09:00:00.000Z',
    people: [
      { id: 'p1', name: 'Anna' },
      { id: 'p2', name: 'Ben' },
    ],
    entries: zeiten.map((at, i) => ({
      id: `e${i}`,
      kind: arten[i] ?? 'expense',
      amount: 1000,
      payerId: 'p1',
      weights: { p1: 1, p2: 1 },
      mode: 'equal',
      description: '',
      at,
    })),
  };
}

describe('Zähler', () => {
  it('die erste Ausgabe eines Anlasses zählt', () => {
    const vorher = ledgerMit([]);
    const nachher = ledgerMit(['2026-08-01T10:00:00.000Z']);
    expect(countersForNewEntry(vorher, nachher)).toEqual(['erste-ausgabe']);
  });

  it('weitere Ausgaben am selben Tag zählen nicht', () => {
    const vorher = ledgerMit(['2026-08-01T10:00:00.000Z']);
    const nachher = ledgerMit(['2026-08-01T10:00:00.000Z', '2026-08-01T18:00:00.000Z']);
    expect(countersForNewEntry(vorher, nachher)).toEqual([]);
  });

  it('die erste Ausgabe an einem zweiten Kalendertag zählt als mehrtägig', () => {
    const vorher = ledgerMit(['2026-08-01T10:00:00.000Z']);
    const nachher = ledgerMit(['2026-08-01T10:00:00.000Z', '2026-08-02T09:00:00.000Z']);
    expect(countersForNewEntry(vorher, nachher)).toEqual(['mehrtaegig']);
  });

  it('mehrtägig zählt je Anlass nur einmal', () => {
    const vorher = ledgerMit(['2026-08-01T10:00:00.000Z', '2026-08-02T09:00:00.000Z']);
    const nachher = ledgerMit([
      '2026-08-01T10:00:00.000Z',
      '2026-08-02T09:00:00.000Z',
      '2026-08-03T09:00:00.000Z',
    ]);
    expect(countersForNewEntry(vorher, nachher)).toEqual([]);
  });

  it('Rückzahlungen lösen keine Zähler aus', () => {
    // Sonst würde ein Abhaken am Folgetag als „mehrtägige Nutzung" gelten,
    // obwohl niemand unterwegs etwas erfasst hat.
    const vorher = ledgerMit(['2026-08-01T10:00:00.000Z']);
    const nachher = ledgerMit(
      ['2026-08-01T10:00:00.000Z', '2026-08-05T09:00:00.000Z'],
      ['expense', 'repayment'],
    );
    expect(countersForNewEntry(vorher, nachher)).toEqual([]);
  });

  it('ein Anlass, der am selben Tag beginnt und endet, bleibt einmalig', () => {
    let l = ledgerMit([]);
    const zaehler: string[] = [];
    for (const at of ['T08', 'T12', 'T20'].map((h) => `2026-08-01${h.replace('T', 'T')}:00:00.000Z`)) {
      const naechster = ledgerMit([...l.entries.map((e) => e.at), at]);
      zaehler.push(...countersForNewEntry(l, naechster));
      l = naechster;
    }
    expect(zaehler).toEqual(['erste-ausgabe']);
  });
});
