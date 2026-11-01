/**
 * Die Eingangskontrolle vor dem Rechnen.
 *
 * Kaputte Daten kommen nicht aus diesem Programm, sondern von außen: ein im
 * Messenger abgeschnittener Link, eine von Hand bearbeitete Datei. Die Meldungen
 * landen wörtlich auf dem Bildschirm. Deshalb prüft jeder Test hier, dass genau
 * der eine Fehler gemeldet wird, der eingebaut ist, und kein anderer.
 */

import { describe, expect, it } from 'vitest';

import { LedgerError, computeBalances, validateLedger } from './balances.js';
import { ZERO } from './rational.js';
import { entry, equalWeights, ledger, people } from './testing.js';
import type { Entry } from './types.js';

const p = people('Anna', 'Ben', 'Clara');

/** Eine Ausgabe mit fester Kennung, damit die Meldung vorhersagbar ist. */
function e(fields: Partial<Entry>): Entry {
  return { ...entry(300, 'p1', equalWeights(p)), id: 'e', ...fields };
}

describe('validateLedger meldet genau den eingebauten Fehler', () => {
  it('nichts bei sauberen Daten', () => {
    expect(validateLedger(ledger(p, [e({})]))).toEqual([]);
  });

  it('doppelte Personen', () => {
    expect(validateLedger(ledger([...p, { id: 'p1', name: 'Anna 2' }], []))).toEqual([
      'Doppelte Personen-IDs.',
    ]);
  });

  it('doppelte Einträge', () => {
    expect(validateLedger(ledger(p, [e({}), e({})]))).toEqual(['Eintrag e: ID kommt doppelt vor.']);
  });

  it('Bruchteile eines Cents', () => {
    expect(validateLedger(ledger(p, [e({ amount: 12.5 })]))).toEqual([
      'Eintrag e: Betrag ist keine ganze Zahl.',
    ]);
  });

  it('ein Betrag von null', () => {
    expect(validateLedger(ledger(p, [e({ amount: 0 })]))).toEqual([
      'Eintrag e: Betrag muss größer als 0 sein.',
    ]);
  });

  it('ein unbekannter Zahler', () => {
    expect(validateLedger(ledger(p, [e({ payerId: 'p9' })]))).toEqual([
      'Eintrag e: Zahler ist keine bekannte Person.',
    ]);
  });

  it('ein Gewicht für eine unbekannte Person', () => {
    expect(validateLedger(ledger(p, [e({ weights: { p1: 1, p9: 1 } })]))).toEqual([
      'Eintrag e: Gewicht für unbekannte Person p9.',
    ]);
  });

  it('ein Gewicht, das keine ganze Zahl ist', () => {
    expect(validateLedger(ledger(p, [e({ weights: { p1: 1, p2: 0.5 } })]))).toEqual([
      'Eintrag e: Gewicht ist keine ganze Zahl.',
    ]);
  });

  it('ein negatives Gewicht', () => {
    expect(validateLedger(ledger(p, [e({ weights: { p1: 2, p2: -1 } })]))).toEqual([
      'Eintrag e: Negatives Gewicht.',
    ]);
  });

  it('kein einziges Gewicht über null', () => {
    expect(validateLedger(ledger(p, [e({ weights: { p1: 0, p2: 0 } })]))).toEqual([
      'Eintrag e: Kein Gewicht größer als 0, Betrag unverteilbar.',
    ]);
  });

  it('eine Rückzahlung an zwei Personen', () => {
    expect(validateLedger(ledger(p, [e({ kind: 'repayment', weights: { p2: 1, p3: 1 } })]))).toEqual([
      'Eintrag e: Eine Rückzahlung braucht genau einen Begünstigten.',
    ]);
  });
});

describe('computeBalances', () => {
  it('bricht mit allen Meldungen auf einmal ab, eine pro Zeile', () => {
    const kaputt = ledger(p, [e({ amount: 0, payerId: 'p9' })]);
    expect(() => computeBalances(kaputt)).toThrow(LedgerError);
    expect(() => computeBalances(kaputt)).toThrow(
      'Abrechnung nicht berechenbar:\n' +
        '- Eintrag e: Betrag muss größer als 0 sein.\n' +
        '- Eintrag e: Zahler ist keine bekannte Person.',
    );
  });

  it('führt auch Personen, die nirgends vorkommen, mit null', () => {
    const r = computeBalances(ledger(p, [entry(300, 'p1', { p1: 1, p2: 1 })]));
    expect(r.balance.get('p3')).toEqual(ZERO);
    expect(r.share.get('p3')).toEqual(ZERO);
    expect(r.paid.get('p3')).toBe(0);
    expect(r.repaidOut.get('p3')).toBe(0);
    expect(r.repaidIn.get('p3')).toBe(0);
  });
});
