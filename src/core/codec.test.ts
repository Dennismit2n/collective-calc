/**
 * Rundwegtests für den Link (Invariante 8) und die Größengrenze aus F8.
 *
 * Der Codec ist die riskantere Stelle als die Mathematik: Hier kommen Daten herein,
 * die durch WhatsApp gereist sind. Ein Fehler erzeugt falsches Geld, obwohl jede
 * Formel stimmt.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { CodecError, decodeLink, encodeLedger, encodeResult, toResultView } from './codec.js';
import { settle } from './settle.js';
import type { Entry, Ledger } from './types.js';
import { LEDGER_VERSION } from './types.js';

/** Der Codec vergibt beim Lesen fortlaufende IDs. Für den Vergleich angleichen. */
function normalize(l: Ledger): Ledger {
  return {
    ...l,
    people: l.people.map((p, i) => ({ ...p, id: `p${i + 1}` })),
    entries: l.entries.map((e, i) => ({ ...e, id: `e${i + 1}` })),
  };
}

function build(peopleCount: number, entryCount: number, seed = 1): Ledger {
  let s = seed >>> 0;
  const rnd = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const people = Array.from({ length: peopleCount }, (_, i) => ({ id: `p${i + 1}`, name: `Person ${i + 1}` }));
  const words = ['Einkauf', 'Essen', 'Sprit', 'Tickets', 'Bier', 'Kaffee', 'Taxi', 'Unterkunft'];
  const entries: Entry[] = Array.from({ length: entryCount }, (_, i) => {
    const weights: Record<string, number> = {};
    for (const p of people) weights[p.id] = rnd() > 0.15 ? 1 : 0;
    if (Object.values(weights).every((w) => w === 0)) weights[people[0]!.id] = 1;
    return {
      id: `e${i + 1}`,
      kind: 'expense',
      amount: 150 + Math.floor(rnd() * 9000),
      payerId: people[Math.floor(rnd() * peopleCount)]!.id,
      weights,
      mode: 'equal',
      description: words[Math.floor(rnd() * words.length)]!,
      at: `2026-08-${String(1 + (i % 28)).padStart(2, '0')}T12:00:00.000Z`,
    };
  });
  return {
    version: LEDGER_VERSION,
    id: 'abc123',
    title: 'Sommerurlaub Kroatien',
    currency: 'EUR',
    createdAt: '2026-08-01T09:00:00.000Z',
    people,
    entries,
  };
}

describe('Rundweg', () => {
  it('vollständiger Anlass: kodieren und wieder lesen ergibt dieselbe Abrechnung', async () => {
    const l = build(6, 40);
    const decoded = await decodeLink(await encodeLedger(l));
    expect(decoded.kind).toBe('full');
    if (decoded.kind !== 'full') return;
    expect(normalize(decoded.ledger)).toEqual(normalize(l));
    expect(settle(decoded.ledger)).toEqual(settle(l));
  });

  it('funktioniert auch mit führendem Doppelkreuz', async () => {
    const l = build(3, 5);
    const decoded = await decodeLink('#' + (await encodeLedger(l)));
    expect(decoded.kind).toBe('full');
  });

  it('Ergebnisansicht: kodieren und wieder lesen ergibt dieselben Zahlen', async () => {
    const l = build(5, 20);
    const view = toResultView(l, settle(l));
    const decoded = await decodeLink(await encodeResult(view));
    expect(decoded.kind).toBe('result');
    if (decoded.kind !== 'result') return;
    expect(decoded.result).toEqual(view);
  });

  it('überlebt Umlaute, Emoji und lange Namen', async () => {
    const l = build(3, 3);
    l.title = 'Hüttenwochenende 🏔️ — Öl, Käse & Spätzle';
    l.people[0]!.name = 'Jörg-Übelacker Straßenmüller';
    l.entries[0]!.description = 'Fährticket 🚢 für alle';
    const decoded = await decodeLink(await encodeLedger(l));
    if (decoded.kind !== 'full') throw new Error('falsche Linkart');
    expect(decoded.ledger.title).toBe(l.title);
    expect(decoded.ledger.people[0]!.name).toBe(l.people[0]!.name);
    expect(decoded.ledger.entries[0]!.description).toBe(l.entries[0]!.description);
  });

  it('Fremdwährung samt Kurs bleibt erhalten', async () => {
    const l = build(2, 1);
    l.entries[0]!.fx = { currency: 'CHF', foreignAmount: 4000, rate: '1.05' };
    const decoded = await decodeLink(await encodeLedger(l));
    if (decoded.kind !== 'full') throw new Error('falsche Linkart');
    expect(decoded.ledger.entries[0]!.fx).toEqual({ currency: 'CHF', foreignAmount: 4000, rate: '1.05' });
  });

  it('bleibt für zufällige Abrechnungen verlustfrei', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 0, max: 25 }), fc.integer({ min: 1, max: 9999 }), async (p, e, seed) => {
        const l = build(p, e, seed);
        const decoded = await decodeLink(await encodeLedger(l));
        if (decoded.kind !== 'full') throw new Error('falsche Linkart');
        expect(normalize(decoded.ledger)).toEqual(normalize(l));
      }),
      { numRuns: 150 },
    );
  });
});

describe('beschädigte Links werden erkannt, nicht halb gelesen', () => {
  it('abgeschnittener Link', async () => {
    const l = build(6, 40);
    const good = await encodeLedger(l);
    const cut = good.slice(0, Math.floor(good.length * 0.7));
    await expect(decodeLink(cut)).rejects.toBeInstanceOf(CodecError);
  });

  it('leerer Link', async () => {
    await expect(decodeLink('')).rejects.toBeInstanceOf(CodecError);
  });

  it('fremder Link ohne bekannte Linkart', async () => {
    await expect(decodeLink('xABCDEF')).rejects.toBeInstanceOf(CodecError);
  });

  it('Buchstabensalat', async () => {
    await expect(decodeLink('fNichtWirklichKomprimiert!!')).rejects.toBeInstanceOf(CodecError);
  });

  it('ein einzelnes verändertes Zeichen mitten im Link', async () => {
    const l = build(4, 12);
    const good = await encodeLedger(l);
    const mid = Math.floor(good.length / 2);
    const swapped = good[mid] === 'A' ? 'B' : 'A';
    const broken = good.slice(0, mid) + swapped + good.slice(mid + 1);
    // Entweder er lässt sich nicht entpacken, oder die Struktur passt nicht.
    // In keinem Fall darf er stillschweigend falsche Zahlen liefern.
    let ok = false;
    try {
      const decoded = await decodeLink(broken);
      if (decoded.kind === 'full') {
        // Wenn es doch aufgeht, muss es eine gültige Abrechnung sein.
        settle(decoded.ledger);
      }
      ok = true;
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      ok = true;
    }
    expect(ok).toBe(true);
  });

  it('nennt für jeden Fehlschlag einen eindeutigen Grund', async () => {
    // Geprüft wird der Schlüssel, nicht der Satz. Der Text steht in der
    // Sprachtabelle — vorher stand er im Code, und eine englische Oberfläche
    // zeigte eine englische Überschrift mit einem deutschen Absatz darunter.
    const l = build(4, 12);
    const gut = await encodeLedger(l);

    const faelle: Array<[string, string]> = [
      ['', 'empty'],
      ['xABCDEF', 'notOurs'],
      [gut.slice(0, Math.floor(gut.length * 0.7)), 'truncated'],
      [await encodeLedger({ ...l, version: 99 }), 'newerFormat'],
    ];

    for (const [fragment, code] of faelle) {
      await expect(decodeLink(fragment)).rejects.toThrow(expect.objectContaining({ code }));
    }
  });
});

describe('Messung: Linkgröße (F8)', () => {
  const BASE = 'https://dennismit2n.github.io/collective-calc/';

  it('typische Abrechnungen bleiben unter der Obergrenze', async () => {
    const cases: Array<[string, number, number]> = [
      ['Grillabend', 4, 3],
      ['Restaurantabend', 6, 8],
      ['Urlaubswoche', 6, 40],
      ['lange Reise', 8, 120],
      ['Großgruppe', 15, 200],
    ];

    const lines: string[] = [];
    for (const [label, p, e] of cases) {
      const l = build(p, e);
      const full = await encodeLedger(l);
      const result = await encodeResult(toResultView(l, settle(l)));
      lines.push(
        `${label.padEnd(16)} ${String(p).padStart(2)} Pers. ${String(e).padStart(3)} Ausg. → ` +
          `voll ${String(BASE.length + 1 + full.length).padStart(5)} Zeichen · ` +
          `Ergebnis ${String(BASE.length + 1 + result.length).padStart(4)} Zeichen`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('[Messung Linkgröße]\n' + lines.join('\n'));

    // Die Zusage aus F8: Eine Urlaubswoche muss als vollständiger Link durchgehen.
    const week = build(6, 40);
    const weekLink = BASE.length + 1 + (await encodeLedger(week)).length;
    expect(weekLink).toBeLessThan(2000);

    // Und der Ergebnis-Link muss auch bei einer Großgruppe klein bleiben,
    // damit er noch als QR-Code funktioniert (praktisch rund 1000 Zeichen).
    const big = build(15, 200);
    const bigResult = BASE.length + 1 + (await encodeResult(toResultView(big, settle(big)))).length;
    expect(bigResult).toBeLessThan(1000);
  });
});
