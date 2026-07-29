/** Kleine Hilfen, um in Tests lesbare Abrechnungen zu bauen. Kein Auslieferungscode. */

import type { Entry, Ledger, Person, SplitMode } from './types.js';
import { LEDGER_VERSION } from './types.js';

export function people(...names: string[]): Person[] {
  return names.map((name, i) => ({ id: `p${i + 1}`, name }));
}

let counter = 0;

export function entry(
  amount: number,
  payerId: string,
  weights: Record<string, number>,
  opts: { kind?: Entry['kind']; mode?: SplitMode; description?: string } = {},
): Entry {
  counter += 1;
  return {
    id: `e${counter}`,
    kind: opts.kind ?? 'expense',
    amount,
    payerId,
    weights,
    mode: opts.mode ?? 'equal',
    description: opts.description ?? '',
    at: '2026-07-29T12:00:00.000Z',
  };
}

export function ledger(persons: Person[], entries: Entry[], currency = 'EUR'): Ledger {
  return {
    version: LEDGER_VERSION,
    id: 'test',
    title: 'Test',
    currency,
    createdAt: '2026-07-29T12:00:00.000Z',
    people: persons,
    entries,
  };
}

/** Alle gleich beteiligt. */
export function equalWeights(persons: Person[]): Record<string, number> {
  return Object.fromEntries(persons.map((p) => [p.id, 1]));
}
