import { describe, expect, it } from 'vitest';

import { convert, decimalsFor, isValidCurrencyCode } from './currency.js';
import { settle } from './settle.js';
import { entry, equalWeights, ledger, people } from './testing.js';

describe('Umrechnung', () => {
  it('rechnet mit einem Kurs in der Richtung, in der man ihn nachschlägt', () => {
    // "1 CHF sind 1,05 Euro" → 40,00 CHF werden 42,00 €
    expect(convert(4000, '1.05')).toEqual({ cents: 4200, rate: 1.05 });
  });

  it('nimmt Komma und Punkt gleichermaßen', () => {
    expect(convert(4000, '1,05')).toEqual(convert(4000, '1.05'));
  });

  it('rundet auf ganze Cent', () => {
    // 999 * 1.037 = 1036,0... → 1036
    expect(convert(999, '1.037')?.cents).toBe(1036);
  });

  it('weist unbrauchbare Kurse ab', () => {
    expect(convert(1000, '')).toBeNull();
    expect(convert(1000, '0')).toBeNull();
    expect(convert(1000, '-1')).toBeNull();
    expect(convert(1000, 'abc')).toBeNull();
  });

  it('der umgerechnete Betrag ist ganzzahlig und rechnet sich sauber weiter', () => {
    const converted = convert(4000, '1.05');
    if (!converted) throw new Error('Umrechnung fehlgeschlagen');
    const p = people('Anna', 'Ben', 'Clara');
    const l = ledger(p, [entry(converted.cents, 'p1', equalWeights(p))]);
    const s = settle(l);
    expect(s.totalExpenses).toBe(4200);
    // 4200 / 3 = 1400 glatt, also kein offener Rest.
    expect(s.summaries.map((x) => x.balance)).toEqual([2800, -1400, -1400]);
    expect(s.remainders).toEqual([]);
  });
});

describe('Währungscodes', () => {
  it('erkennt gültige Codes', () => {
    expect(isValidCurrencyCode('EUR')).toBe(true);
    expect(isValidCurrencyCode('chf')).toBe(true);
  });

  it('weist Unsinn ab', () => {
    expect(isValidCurrencyCode('EU')).toBe(false);
    expect(isValidCurrencyCode('EURO')).toBe(false);
    expect(isValidCurrencyCode('12A')).toBe(false);
  });

  it('kennt Währungen ohne Nachkommastellen', () => {
    expect(decimalsFor('EUR')).toBe(2);
    expect(decimalsFor('JPY')).toBe(0);
  });
});
