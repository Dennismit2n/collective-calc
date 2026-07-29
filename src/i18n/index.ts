/**
 * Sprachauswahl und Textausgabe.
 *
 * Entscheidungen aus F18 und F25:
 *  - Die **Sprache richtet sich nach dem Leser**, die **Währung nach dem Anlass**.
 *    Ein geteilter Link transportiert keine Sprache mit: Wer einen Euro-Anlass mit
 *    englischer Oberfläche öffnet, sieht englische Texte und trotzdem Euro-Beträge.
 *  - Zwölf Sprachen wie auf der Startseite. Deutsch und Englisch sind von Hand
 *    geschrieben; die übrigen kommen in der zweiten Bauphase dazu und werden dort,
 *    wo Geld dranhängt, rückübersetzt geprüft — der Rest wird als maschinell
 *    gekennzeichnet.
 */

import { de } from './de.js';
import type { MessageKey, Messages } from './de.js';
import { en } from './en.js';

export type { MessageKey } from './de.js';

/** Reihenfolge wie im Auswahlfeld der Startseite. */
export const SUPPORTED = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
] as const;

export type LanguageCode = (typeof SUPPORTED)[number]['code'];

/** Welche Sprachen wirklich vorliegen. Wächst in der zweiten Bauphase. */
const TABLES: Partial<Record<LanguageCode, Messages>> = {
  de,
  en,
};

/**
 * Sprachen, deren Texte maschinell erstellt und nicht von einem Muttersprachler
 * gegengelesen wurden. Sie tragen in der Oberfläche einen Hinweis samt
 * Verbesserungslink (F25).
 */
export const MACHINE_TRANSLATED: ReadonlySet<string> = new Set<string>([]);

export const FALLBACK: LanguageCode = 'en';

/** Wählt aus der Browsereinstellung die beste vorhandene Sprache. */
export function detectLanguage(preferred: readonly string[]): LanguageCode {
  for (const raw of preferred) {
    const base = raw.toLowerCase().split('-')[0];
    const hit = SUPPORTED.find((s) => s.code === base);
    if (hit && TABLES[hit.code]) return hit.code;
  }
  return FALLBACK;
}

export function resolveLanguage(setting: string, browser: readonly string[]): LanguageCode {
  if (setting !== 'auto') {
    const hit = SUPPORTED.find((s) => s.code === setting);
    if (hit && TABLES[hit.code]) return hit.code;
  }
  return detectLanguage(browser);
}

export interface Translator {
  readonly lang: LanguageCode;
  /** Für `Intl`-Aufrufe und das `lang`-Attribut der Seite. */
  readonly locale: string;
  readonly isMachineTranslated: boolean;
  t(key: MessageKey, params?: Record<string, string | number>): string;
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Deutsch als Rückfallebene, ohne die engen Literaltypen der Tabelle. */
const REFERENCE: Messages = de;

export function createTranslator(lang: LanguageCode): Translator {
  const table = TABLES[lang] ?? TABLES[FALLBACK] ?? REFERENCE;
  const plurals = new Intl.PluralRules(lang);

  return {
    lang,
    locale: lang,
    isMachineTranslated: MACHINE_TRANSLATED.has(lang),
    t(key, params = {}) {
      const entry = table[key] ?? REFERENCE[key];
      if (typeof entry === 'string') return fill(entry, params);

      // Mehrzahlformen: Russisch kennt vier, Chinesisch und Japanisch nur eine.
      // `Intl.PluralRules` trifft die Auswahl, die Tabelle liefert die Varianten.
      const count = Number(params['count'] ?? 0);
      const rule = plurals.select(count);
      const variant = entry[rule] ?? entry.other ?? Object.values(entry)[0] ?? String(key);
      return fill(variant, params);
    },
  };
}
