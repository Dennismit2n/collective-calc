import { describe, expect, it } from 'vitest';

import {
  createTranslator,
  detectLanguage,
  MACHINE_TRANSLATED,
  resolveLanguage,
  SUPPORTED,
} from './index.js';
import { de } from './de.js';
import type { Messages } from './de.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { hi } from './hi.js';
// Italienisch heißt hier `italiano`, weil `it` schon Vitests Testfunktion ist.
import { it as italiano } from './it.js';
import { ja } from './ja.js';
import { ko } from './ko.js';
import { pt } from './pt.js';
import { ru } from './ru.js';
import { tr } from './tr.js';
import { zh } from './zh.js';

const ALLE: Array<[string, Messages]> = [
  ['en', en],
  ['es', es],
  ['fr', fr],
  ['it', italiano],
  ['pt', pt],
  ['tr', tr],
  ['ru', ru],
  ['hi', hi],
  ['zh', zh],
  ['ja', ja],
  ['ko', ko],
];

const SCHLUESSEL = Object.keys(de) as Array<keyof typeof de>;

/** Nur die Namen der Platzhalter, sortiert — der Text selbst darf abweichen. */
function platzhalter(value: unknown): string[] {
  const text = typeof value === 'string' ? value : Object.values(value as object).join(' ');
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
}

describe('Sprachtabellen', () => {
  it.each(ALLE)('%s deckt jeden Schlüssel des Deutschen ab', (_code, table) => {
    expect(SCHLUESSEL.filter((k) => !(k in table))).toEqual([]);
  });

  it.each(ALLE)('%s enthält keine überzähligen Schlüssel', (_code, table) => {
    expect(Object.keys(table).filter((k) => !(k in de))).toEqual([]);
  });

  it.each(ALLE)('%s verwendet dieselben Platzhalter wie das Deutsche', (_code, table) => {
    // Ein fehlender Platzhalter heißt: Der Nutzer sieht „{amount}" statt einer
    // Zahl — oder schlimmer, die Zahl fehlt ganz. Bei Geld unverzeihlich.
    const abweichungen = SCHLUESSEL.filter(
      (k) => platzhalter(table[k]).join(',') !== platzhalter(de[k]).join(','),
    );
    expect(abweichungen).toEqual([]);
  });

  it.each(ALLE)('%s hält die Struktur der Mehrzahl-Einträge ein', (code, table) => {
    for (const key of SCHLUESSEL) {
      expect({ code, key, typ: typeof table[key] }).toEqual({ code, key, typ: typeof de[key] });
    }
  });

  it.each(ALLE)('%s hat für jede Mehrzahlform der Sprache eine Variante', (code, table) => {
    // Russisch braucht vier Formen, Chinesisch eine. Fehlt eine, fällt die
    // Ausgabe auf „other" zurück — bei Russisch wäre das grammatisch falsch.
    const regeln = new Intl.PluralRules(code);
    const noetig = new Set([0, 1, 2, 3, 5, 11, 21, 100].map((n) => regeln.select(n)));
    for (const key of SCHLUESSEL) {
      const eintrag = de[key];
      if (typeof eintrag === 'string') continue;
      const vorhanden = new Set(Object.keys(table[key] as object));
      expect({ code, key, fehlend: [...noetig].filter((r) => !vorhanden.has(r)) }).toEqual({
        code,
        key,
        fehlend: [],
      });
    }
  });

  it('jede angebotene Sprache liegt auch wirklich vor', () => {
    const vorhanden = new Set(['de', ...ALLE.map(([c]) => c)]);
    expect(SUPPORTED.map((s) => s.code).filter((c) => !vorhanden.has(c))).toEqual([]);
  });

  it('genau die nicht von Hand geschriebenen Sprachen sind gekennzeichnet', () => {
    // Deutsch und Englisch sind von Hand geschrieben, alles andere nicht.
    // Kommt eine Sprache dazu und wird die Kennzeichnung vergessen, behauptet
    // die Oberfläche eine Qualität, die niemand geprüft hat.
    const erwartet = SUPPORTED.map((s) => s.code).filter((c) => c !== 'de' && c !== 'en');
    expect([...MACHINE_TRANSLATED].sort()).toEqual([...erwartet].sort());
  });
});

describe('Sprachwahl', () => {
  it('folgt der Browsereinstellung', () => {
    expect(detectLanguage(['de-DE', 'en'])).toBe('de');
    expect(detectLanguage(['en-GB'])).toBe('en');
  });

  it('erkennt jede der zwölf Sprachen an ihrem Gebietsschema', () => {
    for (const { code } of SUPPORTED) {
      expect(detectLanguage([`${code}-XX`])).toBe(code);
    }
  });

  it('fällt auf Englisch zurück, wenn die Sprache nicht dabei ist', () => {
    expect(detectLanguage(['nl-NL'])).toBe('en'); // Niederländisch fehlt bewusst
    expect(detectLanguage(['sv'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('nimmt die erste Sprache der Liste, die wir haben', () => {
    expect(detectLanguage(['nl', 'fr-BE', 'en'])).toBe('fr');
  });

  it('eine ausdrückliche Wahl schlägt die Browsereinstellung', () => {
    expect(resolveLanguage('en', ['de-DE'])).toBe('en');
    expect(resolveLanguage('auto', ['de-DE'])).toBe('de');
  });

  it('kennt die zwölf Sprachen der Startseite', () => {
    expect(SUPPORTED.map((s) => s.code)).toEqual([
      'de', 'en', 'es', 'fr', 'it', 'pt', 'tr', 'ru', 'hi', 'zh', 'ja', 'ko',
    ]);
  });
});

describe('Textausgabe', () => {
  it('setzt Platzhalter ein', () => {
    const t = createTranslator('de');
    expect(t.t('result.transfer', { from: 'Ben', amount: '43,20 €', to: 'Anna' })).toBe(
      'Ben überweist 43,20 € an Anna',
    );
  });

  it('wählt die richtige Mehrzahlform', () => {
    const de_ = createTranslator('de');
    expect(de_.t('event.count', { count: 1 })).toBe('1 Ausgabe');
    expect(de_.t('event.count', { count: 5 })).toBe('5 Ausgaben');

    const en_ = createTranslator('en');
    expect(en_.t('event.count', { count: 1 })).toBe('1 expense');
    expect(en_.t('event.count', { count: 0 })).toBe('0 expenses');
  });

  it('lässt unbekannte Platzhalter stehen, statt „undefined“ anzuzeigen', () => {
    const t = createTranslator('de');
    expect(t.t('result.transfer', { from: 'Ben' })).toContain('{amount}');
  });

  it('greift auf Deutsch zurück, wenn ein Schlüssel in der Sprache fehlt', () => {
    const t = createTranslator('en');
    expect(t.t('app.name')).toBe('Collective-Calc');
  });
});
