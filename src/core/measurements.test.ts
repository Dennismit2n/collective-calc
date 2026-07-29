/**
 * Messungen statt Schätzungen.
 *
 * Zwei Zahlen aus dem Interview waren geschätzt und gehören nachgemessen —
 * und zwar als Test, damit sie nicht irgendwann still nicht mehr stimmen:
 *  - Wie oft bleibt überhaupt ein Cent offen, und wie groß wird er?
 *  - Ab welcher Gruppengröße wird das exakte Ausgleichsverfahren spürbar langsam?
 */

import { describe, expect, it } from 'vitest';

import { settle, MAX_EXACT_PARTICIPANTS } from './settle.js';
import { checkSettlement } from './invariants.js';
import type { Entry, Ledger } from './types.js';
import { LEDGER_VERSION } from './types.js';

/** Deterministischer Zufall, damit die Messung reproduzierbar bleibt. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function realisticLedger(rng: () => number, peopleCount: number, entryCount: number): Ledger {
  const persons = Array.from({ length: peopleCount }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
  const entries: Entry[] = [];
  for (let i = 0; i < entryCount; i++) {
    // Beträge wie im echten Leben: meist zweistellige Euro-Beträge mit krummen Cent.
    const amount = 150 + Math.floor(rng() * 9000);
    const payer = persons[Math.floor(rng() * peopleCount)]!;
    const weights: Record<string, number> = {};
    let any = false;
    for (const p of persons) {
      // Meistens sind alle dabei, gelegentlich fehlt jemand.
      const inIt = rng() > 0.15;
      weights[p.id] = inIt ? 1 : 0;
      if (inIt) any = true;
    }
    if (!any) weights[persons[0]!.id] = 1;
    entries.push({
      id: `e${i}`,
      kind: 'expense',
      amount,
      payerId: payer.id,
      weights,
      mode: 'equal',
      description: '',
      at: '2026-07-29T12:00:00.000Z',
    });
  }
  return {
    version: LEDGER_VERSION,
    id: 'measure',
    title: 'Messung',
    currency: 'EUR',
    createdAt: '2026-07-29T12:00:00.000Z',
    people: persons,
    entries,
  };
}

describe('Messung: offener Rest', () => {
  it('bleibt bei einer typischen Urlaubsabrechnung unter der Personenzahl', () => {
    const rng = makeRng(20260729);
    let withRemainder = 0;
    let maxOpen = 0;
    let sumOpen = 0;
    const runs = 2000;

    for (let i = 0; i < runs; i++) {
      const l = realisticLedger(rng, 6, 40);
      const s = settle(l);
      expect(checkSettlement(l, s).ok).toBe(true);
      const open = s.remainders.reduce((a, r) => a + r.amount, 0);
      if (open > 0) withRemainder += 1;
      if (open > maxOpen) maxOpen = open;
      sumOpen += open;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[Messung] 6 Personen / 40 Ausgaben, ${runs} Abrechnungen: ` +
        `in ${((withRemainder / runs) * 100).toFixed(1)} % bleibt ein Rest offen · ` +
        `Durchschnitt ${(sumOpen / runs).toFixed(2)} Cent · Maximum ${maxOpen} Cent`,
    );

    // Die im Interview zugesagte Schranke: höchstens (Personenzahl − 1) Cent.
    expect(maxOpen).toBeLessThanOrEqual(5);
  });
});

describe('Messung: exaktes Ausgleichsverfahren', () => {
  it(`bleibt bei ${MAX_EXACT_PARTICIPANTS} offenen Salden im Millisekundenbereich`, () => {
    // Schlimmster Fall: möglichst viele Personen mit offenem Saldo.
    const rng = makeRng(4711);
    const l = realisticLedger(rng, MAX_EXACT_PARTICIPANTS, 60);
    const s0 = settle(l);
    const active = s0.summaries.filter((x) => x.balance !== 0).length;

    const t0 = performance.now();
    const s = settle(l);
    const ms = performance.now() - t0;

    // eslint-disable-next-line no-console
    console.log(
      `[Messung] ${active} offene Salden · Verfahren "${s.method}" · ` +
        `${s.transfers.length} Überweisungen · ${ms.toFixed(1)} ms`,
    );

    expect(checkSettlement(l, s).ok).toBe(true);
    // Obergrenze bewusst großzügig: Der Test soll Ausreißer melden, nicht flackern.
    expect(ms).toBeLessThan(2000);
  });

  it('hält auch den ungünstigsten Fall aus', () => {
    // Zufällige Salden sind für dieses Verfahren zu freundlich: Es gibt dort kaum
    // nullsummige Teilmengen, also bricht die Suche früh ab. Der teure Fall ist
    // eine Gruppe, in der sehr viele Teilmengen aufgehen — etwa lauter gleich große
    // Beträge, die sich paarweise ausgleichen. Dann muss wirklich alles durchsucht werden.
    const n = MAX_EXACT_PARTICIPANTS;
    const persons = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
    const entries: Entry[] = [];
    for (let i = 0; i < n; i += 2) {
      // p(i+1) legt 100 Cent aus, p(i+2) ist alleiniger Nutznießer → +100 / −100.
      entries.push({
        id: `w${i}`,
        kind: 'expense',
        amount: 100,
        payerId: persons[i]!.id,
        weights: { [persons[i + 1]!.id]: 1 },
        mode: 'exact',
        description: '',
        at: '2026-07-29T12:00:00.000Z',
      });
    }
    const l: Ledger = {
      version: LEDGER_VERSION,
      id: 'worst',
      title: 'Ungünstigster Fall',
      currency: 'EUR',
      createdAt: '2026-07-29T12:00:00.000Z',
      people: persons,
      entries,
    };

    const t0 = performance.now();
    const s = settle(l);
    const ms = performance.now() - t0;

    // eslint-disable-next-line no-console
    console.log(
      `[Messung] ungünstigster Fall bei ${n} Personen · "${s.method}" · ` +
        `${s.transfers.length} Überweisungen · ${ms.toFixed(1)} ms`,
    );

    expect(checkSettlement(l, s).ok).toBe(true);
    // n/2 unabhängige Paare → n/2 Gruppen → n − n/2 Überweisungen.
    expect(s.transfers).toHaveLength(n / 2);
    expect(ms).toBeLessThan(2000);
  });
});
