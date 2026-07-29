/**
 * Die Betragseingabe ist eine der wenigen Stellen, an denen ein Nutzer echtes Geld
 * falsch eintragen kann, ohne dass irgendeine Invariante anschlägt — die Zahl ist ja
 * formal gültig, nur eben die falsche. Deshalb hier besonders dicht getestet.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { formatAmount, formatExact, formatSigned, parseAmount } from './amount.js';

describe('Betrag eingeben', () => {
  it('nimmt Komma und Punkt gleichermaßen als Dezimaltrenner', () => {
    expect(parseAmount('12,50')?.cents).toBe(1250);
    expect(parseAmount('12.50')?.cents).toBe(1250);
    expect(parseAmount('12,5')?.cents).toBe(1250);
    expect(parseAmount('12.5')?.cents).toBe(1250);
  });

  it('versteht ganze Beträge', () => {
    expect(parseAmount('12')?.cents).toBe(1200);
    expect(parseAmount('7')?.cents).toBe(700);
    expect(parseAmount('0,99')?.cents).toBe(99);
    expect(parseAmount(',99')).toBeNull(); // ohne führende Ziffer nicht eindeutig
  });

  it('versteht beide Tausenderschreibweisen', () => {
    expect(parseAmount('1.234,56')?.cents).toBe(123456);
    expect(parseAmount('1,234.56')?.cents).toBe(123456);
    expect(parseAmount('1.234.567,89')?.cents).toBe(123456789);
  });

  it('liest ein einzelnes Trennzeichen vor drei Ziffern als Tausendertrennung', () => {
    // Bei Geld gibt es keine drei Nachkommastellen — "1.234" sind 1234 Euro.
    expect(parseAmount('1.234')?.cents).toBe(123400);
    expect(parseAmount('1,234')?.cents).toBe(123400);
    expect(parseAmount('1.234')?.interpretation).toBe('grouped');
  });

  it('meldet zurück, wie die Eingabe verstanden wurde', () => {
    expect(parseAmount('12,50')?.interpretation).toBe('decimal-comma');
    expect(parseAmount('12.50')?.interpretation).toBe('decimal-dot');
    expect(parseAmount('12')?.interpretation).toBe('plain');
    expect(parseAmount('1.500')?.interpretation).toBe('grouped');
  });

  it('räumt Währungszeichen und Leerzeichen weg', () => {
    expect(parseAmount(' 12,50 € ')?.cents).toBe(1250);
    expect(parseAmount('€12.50')?.cents).toBe(1250);
    expect(parseAmount('12,50 CHF')?.cents).toBe(1250);
  });

  it('weist zurück, was kein Betrag ist', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('0,00')).toBeNull();
    expect(parseAmount('12,3456')).toBeNull(); // vier Nachkommastellen gibt es nicht
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });

  it('behandelt die gefährliche Mehrdeutigkeit bewusst und sichtbar', () => {
    // "12,345" ist echt mehrdeutig: zwölftausenddreihundertfünfundvierzig — oder
    // ein Vertipper bei 12,34? Die Regel entscheidet auf Tausendertrennung, weil
    // sie sonst mit "1.234" nicht zusammenpassen würde und weil es bei Geld keine
    // drei Nachkommastellen gibt.
    //
    // Der Schutz ist deshalb nicht die Regel, sondern die Rückmeldung: Die Eingabe
    // wird als 'grouped' gemeldet, und die Oberfläche zeigt darunter groß und
    // lesbar "12.345,00 €". Ein Vertipper fällt damit in derselben Sekunde auf.
    const parsed = parseAmount('12,345');
    expect(parsed?.cents).toBe(1_234_500);
    expect(parsed?.interpretation).toBe('grouped');
    expect(formatAmount(parsed!.cents, 'de-DE', 'EUR')).toContain('12.345,00');
  });

  it('behandelt Trennzeichen an ungewöhnlichen Stellen', () => {
    expect(parseAmount('12,')?.cents).toBe(1200); // abgebrochene Eingabe
    expect(parseAmount('12.')?.cents).toBe(1200);
    expect(parseAmount('.234')).toBeNull(); // führendes Trennzeichen ist nicht eindeutig
    expect(parseAmount('1.234.567')?.cents).toBe(123456700); // zwei Tausendertrenner
    expect(parseAmount('1,234,567')?.cents).toBe(123456700);
    // "1.234.56" ist eine krumme Schreibweise, aber die wohlwollende Lesart ist
    // eindeutig: Tausendertrennung plus zwei Nachkommastellen.
    expect(parseAmount('1.234.56')?.cents).toBe(123456);
  });

  it('unterscheidet ein und zwei Nachkommastellen', () => {
    expect(parseAmount('5,5')?.cents).toBe(550);
    expect(parseAmount('5,05')?.cents).toBe(505);
    expect(parseAmount('5,50')?.cents).toBe(550);
    expect(parseAmount('0,01')?.cents).toBe(1);
  });

  it('verkraftet große Beträge', () => {
    expect(parseAmount('999.999,99')?.cents).toBe(99999999);
    expect(parseAmount('1.000.000')?.cents).toBe(100000000);
  });

  it('erkennt jede Deutung eindeutig', () => {
    // Jede der vier Deutungen muss auch wirklich vorkommen können —
    // sonst wäre die Rückmeldung an den Nutzer teilweise toter Code.
    const deutungen = new Set(
      ['12', '12,50', '12.50', '1.500'].map((x) => parseAmount(x)?.interpretation),
    );
    expect(deutungen).toEqual(new Set(['plain', 'decimal-comma', 'decimal-dot', 'grouped']));
  });

  it('erzeugt nie einen Betrag, der nicht ganzzahlig in Cent ist', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (text) => {
        const parsed = parseAmount(text);
        if (parsed === null) return;
        expect(Number.isSafeInteger(parsed.cents)).toBe(true);
        expect(parsed.cents).toBeGreaterThan(0);
      }),
      { numRuns: 5000 },
    );
  });

  it('liest zurück, was es selbst ausgegeben hat', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99_999_999 }), (cents) => {
        for (const locale of ['de-DE', 'en-US', 'fr-FR', 'tr-TR']) {
          const text = formatAmount(cents, locale, 'EUR');
          expect(parseAmount(text)?.cents).toBe(cents);
        }
      }),
      { numRuns: 800 },
    );
  });
});

describe('Betrag anzeigen', () => {
  it('folgt der Sprache des Lesers, nicht der Währung', () => {
    expect(formatAmount(123456, 'de-DE', 'EUR')).toContain('1.234,56');
    expect(formatAmount(123456, 'en-US', 'EUR')).toContain('1,234.56');
  });

  it('zeigt Salden mit Vorzeichen und echtem Minuszeichen', () => {
    expect(formatSigned(500, 'de-DE', 'EUR')).toMatch(/^\+/);
    expect(formatSigned(-500, 'de-DE', 'EUR')).toMatch(/^−/);
    expect(formatSigned(0, 'de-DE', 'EUR')).not.toMatch(/[+−]/);
  });

  it('zeigt den ungerundeten Saldo für den antippbaren Exaktwert', () => {
    // 2000/3 Cent = 6,6666... Euro
    expect(formatExact('2000', '3', 'de-DE')).toContain('6,66');
    expect(formatExact('666', '1', 'de-DE')).toBe('6,66');
    expect(formatExact('-2000', '3', 'de-DE')).toMatch(/^−/);
  });

  it('zeigt beim Exaktwert genug Stellen, um die Rundung zu erklären', () => {
    // Der ganze Zweck des Exaktwerts ist, den fehlenden Cent sichtbar zu machen.
    // Eine Anzeige mit nur zwei Nachkommastellen täte das nicht.
    const exakt = formatExact('2000', '3', 'de-DE');
    expect(exakt).toMatch(/6,6666/);
    expect(formatExact('0', '1', 'de-DE')).toBe('0,00');
    expect(formatExact('666', '1', 'de-DE')).toBe('6,66');
    expect(formatExact('-1', '3', 'de-DE')).toMatch(/^−0,00/);
  });

  it('formatiert glatte und krumme Werte gleich', () => {
    // Der Exaktwert steht direkt neben einem Geldbetrag — „10" hier und „10,00"
    // dort wäre ein sichtbarer Bruch.
    expect(formatExact('1000', '1', 'de-DE')).toBe('10,00');
    expect(formatExact('1000', '2', 'de-DE')).toBe('5,00');
  });

  it('folgt auch beim Exaktwert der Sprache des Lesers', () => {
    expect(formatExact('2000', '3', 'en-US')).toContain('6.66');
  });
});
