/**
 * Die Bruchrechnung für sich.
 *
 * Bisher wurde sie nur über `settle` mitgeprüft, und dort fiel vieles nicht auf:
 * Der Mutationstest zeigte, dass man `cmp` komplett leeren konnte, ohne dass ein
 * Test rot wurde. `cmp` entscheidet aber, wer den Rest-Cent trägt (F12). Diese
 * Datei prüft jede Funktion direkt, mit Werten, die sich im Kopf nachrechnen lassen.
 */

import { describe, expect, it } from 'vitest';

import { ZERO, add, cmp, fromInt, isZero, rat, sub, truncToward0, truncatedPart } from './rational.js';

describe('rat', () => {
  it('kürzt den Bruch', () => {
    expect(rat(6n, 4n)).toEqual({ n: 3n, d: 2n });
  });

  it('kürzt auch bei negativem Zähler, das Vorzeichen bleibt im Zähler', () => {
    expect(rat(-6n, 4n)).toEqual({ n: -3n, d: 2n });
  });

  it('holt das Vorzeichen aus dem Nenner in den Zähler', () => {
    expect(rat(1n, -2n)).toEqual({ n: -1n, d: 2n });
    expect(rat(-3n, -6n)).toEqual({ n: 1n, d: 2n });
  });

  it('macht aus null immer 0/1', () => {
    expect(rat(0n, 5n)).toEqual(ZERO);
    expect(rat(0n, -5n)).toEqual(ZERO);
  });

  it('nimmt 1 als Nenner, wenn keiner angegeben ist', () => {
    expect(rat(7n)).toEqual({ n: 7n, d: 1n });
  });

  it('lehnt den Nenner null ab', () => {
    expect(() => rat(1n, 0n)).toThrow('Nenner darf nicht 0 sein');
  });
});

describe('fromInt', () => {
  it('nimmt Zahlen und BigInt gleichermaßen', () => {
    expect(fromInt(-42)).toEqual({ n: -42n, d: 1n });
    expect(fromInt(42n)).toEqual({ n: 42n, d: 1n });
  });
});

describe('add und sub', () => {
  it('rechnen exakt, wo Fließkomma danebenläge', () => {
    // 1/3 + 1/6 = 1/2
    expect(add(rat(1n, 3n), rat(1n, 6n))).toEqual({ n: 1n, d: 2n });
    // 1/3 − 1/2 = −1/6
    expect(sub(rat(1n, 3n), rat(1n, 2n))).toEqual({ n: -1n, d: 6n });
  });

  it('dreimal ein Drittel ergibt genau eins', () => {
    const third = rat(1n, 3n);
    expect(add(add(third, third), third)).toEqual({ n: 1n, d: 1n });
  });

  it('a − a ist null', () => {
    const x = rat(-7n, 9n);
    expect(sub(x, x)).toEqual(ZERO);
  });
});

describe('isZero', () => {
  it('erkennt null und nur null', () => {
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(sub(rat(2n, 3n), rat(4n, 6n)))).toBe(true);
    expect(isZero(rat(1n, 1_000_000n))).toBe(false);
    expect(isZero(rat(-1n, 3n))).toBe(false);
  });
});

describe('cmp', () => {
  it('vergleicht über Kreuz, nicht über Zähler allein', () => {
    // 2/3 > 1/2, obwohl der Zähler 2 gegen 1 und der Nenner 3 gegen 2 steht.
    expect(cmp(rat(2n, 3n), rat(1n, 2n))).toBe(1);
    expect(cmp(rat(1n, 2n), rat(2n, 3n))).toBe(-1);
  });

  it('meldet Gleichheit auch bei ungekürzten Brüchen', () => {
    expect(cmp({ n: 2n, d: 4n }, { n: 1n, d: 2n })).toBe(0);
    expect(cmp(ZERO, ZERO)).toBe(0);
  });

  it('ordnet negative Werte richtig ein', () => {
    expect(cmp(rat(-1n, 3n), rat(-1n, 2n))).toBe(1);
    expect(cmp(rat(-1n, 2n), ZERO)).toBe(-1);
    expect(cmp(ZERO, rat(-1n, 2n))).toBe(1);
  });
});

describe('truncToward0', () => {
  it('schneidet zur Null hin ab, in beide Richtungen', () => {
    expect(truncToward0(rat(39n, 10n))).toBe(3n);
    expect(truncToward0(rat(-39n, 10n))).toBe(-3n);
    expect(truncToward0(rat(2n, 3n))).toBe(0n);
    expect(truncToward0(rat(-2n, 3n))).toBe(0n);
    expect(truncToward0(fromInt(5))).toBe(5n);
  });
});

describe('truncatedPart', () => {
  it('liefert den abgeschnittenen Rest, immer nicht negativ', () => {
    expect(truncatedPart(rat(39n, 10n))).toEqual({ n: 9n, d: 10n });
    expect(truncatedPart(rat(-39n, 10n))).toEqual({ n: 9n, d: 10n });
    expect(truncatedPart(rat(-2n, 3n))).toEqual({ n: 2n, d: 3n });
  });

  it('ist bei ganzen Zahlen null', () => {
    expect(truncatedPart(fromInt(5))).toEqual(ZERO);
    expect(truncatedPart(fromInt(-5))).toEqual(ZERO);
    expect(truncatedPart(ZERO)).toEqual(ZERO);
  });
});
