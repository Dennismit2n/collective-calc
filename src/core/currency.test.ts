import { describe, expect, it } from 'vitest';

import { COMMON_CURRENCIES, convert, decimalsFor, isValidCurrencyCode } from './currency.js';
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

  it('rundet zum nächsten Cent, nicht immer ab oder immer auf', () => {
    // Die Richtung ist bei Geld nicht gleichgültig: Immer abrunden würde den
    // Auslegenden systematisch benachteiligen, immer aufrunden die Gruppe.
    expect(convert(100, '1.004')?.cents).toBe(100); // 100,4 → ab
    expect(convert(100, '1.006')?.cents).toBe(101); // 100,6 → auf
    expect(convert(999, '1.037')?.cents).toBe(1036);
  });

  it('liegt nie mehr als einen Cent neben dem rechnerischen Produkt', () => {
    // Die Umrechnung ist die einzige Stelle im Programm, an der mit
    // Fließkommazahlen gerechnet wird — der Kurs *ist* eine Dezimalzahl.
    // Genau auf der Kante ist die Richtung deshalb nicht vorhersagbar:
    // 100 × 1,005 ergibt in Fließkomma 100,49999999999999.
    // Zusicherbar ist nur die Schranke, und die wird hier geprüft.
    for (const [betrag, kurs] of [
      [100, '1.005'],
      [4000, '1.05'],
      [1, '0.995'],
      [123456, '0.8371'],
    ] as Array<[number, string]>) {
      const result = convert(betrag, kurs);
      if (!result) throw new Error(`Umrechnung fehlgeschlagen: ${betrag} × ${kurs}`);
      expect(Math.abs(result.cents - betrag * Number(kurs))).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('verkraftet Leerzeichen um den Kurs', () => {
    expect(convert(4000, '  1,05  ')?.cents).toBe(4200);
    expect(convert(4000, '   ')).toBeNull();
  });

  it('weist Kurse ab, die zu einem unbrauchbaren Betrag führen', () => {
    expect(convert(1, '0.0001')).toBeNull(); // ergäbe 0 Cent
    expect(convert(1_000_000_000, '1e12')).toBeNull(); // jenseits sicherer Ganzzahlen
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
  it('erkennt gültige Codes, unabhängig von Groß- und Kleinschreibung', () => {
    expect(isValidCurrencyCode('EUR')).toBe(true);
    expect(isValidCurrencyCode('chf')).toBe(true);
    expect(isValidCurrencyCode('Ron')).toBe(true);
  });

  it('weist ab, was von der Form her keine Währung ist', () => {
    expect(isValidCurrencyCode('EU')).toBe(false);
    expect(isValidCurrencyCode('EURO')).toBe(false);
    expect(isValidCurrencyCode('12A')).toBe(false);
    expect(isValidCurrencyCode('')).toBe(false);
    expect(isValidCurrencyCode('EU R')).toBe(false);
  });

  it('weist Währungen ohne Untereinheit ab, statt falsch zu rechnen', () => {
    // Das Programm rechnet durchgehend in Hundertsteln. Bei Yen oder Won wären
    // alle Beträge still um den Faktor hundert daneben — der teuerste Fehler,
    // den dieses Werkzeug machen könnte.
    expect(isValidCurrencyCode('JPY')).toBe(false);
    expect(isValidCurrencyCode('KRW')).toBe(false);
    expect(isValidCurrencyCode('ISK')).toBe(false);
  });

  it('alle Währungen der Kurzliste sind zulässig', () => {
    for (const code of COMMON_CURRENCIES) {
      expect({ code, gueltig: isValidCurrencyCode(code) }).toEqual({ code, gueltig: true });
    }
  });

  it('kennt die Zahl der Nachkommastellen', () => {
    expect(decimalsFor('EUR')).toBe(2);
    expect(decimalsFor('JPY')).toBe(0);
    // Unbekanntes fällt auf die übliche Annahme zurück.
    expect(decimalsFor('nicht-echt')).toBe(2);
  });
});
