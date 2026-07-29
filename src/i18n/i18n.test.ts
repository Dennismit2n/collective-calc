import { describe, expect, it } from 'vitest';

import { createTranslator, detectLanguage, resolveLanguage, SUPPORTED } from './index.js';
import { de } from './de.js';
import { en } from './en.js';

describe('Sprachtabellen', () => {
  it('Englisch deckt jeden Schlüssel des Deutschen ab', () => {
    const missing = Object.keys(de).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('enthält keine überzähligen Schlüssel', () => {
    const extra = Object.keys(en).filter((k) => !(k in de));
    expect(extra).toEqual([]);
  });

  it('Platzhalter stimmen zwischen den Sprachen überein', () => {
    const placeholders = (value: unknown): string[] => {
      const text = typeof value === 'string' ? value : Object.values(value as object).join(' ');
      return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
    };
    for (const key of Object.keys(de) as Array<keyof typeof de>) {
      expect({ key, ph: placeholders(en[key]) }).toEqual({ key, ph: placeholders(de[key]) });
    }
  });

  it('Mehrzahl-Einträge haben in beiden Sprachen dieselbe Struktur', () => {
    for (const key of Object.keys(de) as Array<keyof typeof de>) {
      expect(typeof en[key]).toBe(typeof de[key]);
    }
  });
});

describe('Sprachwahl', () => {
  it('folgt der Browsereinstellung', () => {
    expect(detectLanguage(['de-DE', 'en'])).toBe('de');
    expect(detectLanguage(['en-GB'])).toBe('en');
  });

  it('fällt auf Englisch zurück, wenn die Sprache noch nicht vorliegt', () => {
    expect(detectLanguage(['ja-JP'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
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
