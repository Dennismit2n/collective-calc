/**
 * Sprachauswahl und Textausgabe.
 *
 * Entscheidungen aus F18 und F25:
 *  - Die **Sprache richtet sich nach dem Leser**, die **Währung nach dem Anlass**.
 *    Ein geteilter Link transportiert keine Sprache mit: Wer einen Euro-Anlass mit
 *    englischer Oberfläche öffnet, sieht englische Texte und trotzdem Euro-Beträge.
 *  - Zwölf Sprachen wie auf der Startseite. Deutsch und Englisch sind von Hand
 *    geschrieben; die übrigen zehn nicht und tragen deshalb einen Hinweis.
 *
 * **Nur Deutsch und Englisch stecken im ersten Ladevorgang.** Die übrigen zehn
 * werden bei Bedarf nachgeladen. Alle zwölf mitzuliefern kostete 24 KB gepackt —
 * fast eine Verdopplung, für Texte, die elf von zwölf Lesern nie zu Gesicht
 * bekommen. Bei einem Werkzeug, das an der Supermarktkasse aufgemacht wird,
 * zählt das.
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

/** Von Hand geschrieben und deshalb immer dabei. */
const EAGER: Partial<Record<LanguageCode, Messages>> = { de, en };

/** Wird erst geholt, wenn jemand die Sprache wirklich benutzt. */
const LAZY: Record<string, () => Promise<Messages>> = {
  es: async () => (await import('./es.js')).es,
  fr: async () => (await import('./fr.js')).fr,
  it: async () => (await import('./it.js')).it,
  pt: async () => (await import('./pt.js')).pt,
  tr: async () => (await import('./tr.js')).tr,
  ru: async () => (await import('./ru.js')).ru,
  hi: async () => (await import('./hi.js')).hi,
  zh: async () => (await import('./zh.js')).zh,
  ja: async () => (await import('./ja.js')).ja,
  ko: async () => (await import('./ko.js')).ko,
};

const CACHE = new Map<LanguageCode, Messages>(Object.entries(EAGER) as Array<[LanguageCode, Messages]>);

/**
 * Sorgt dafür, dass eine Sprache vorliegt.
 *
 * Vor dem ersten Zeichnen aufgerufen, damit niemand kurz Englisch aufblitzen
 * sieht, bevor seine Sprache da ist.
 */
export async function ensureLanguage(lang: LanguageCode): Promise<void> {
  if (CACHE.has(lang)) return;
  const load = LAZY[lang];
  if (!load) return;
  try {
    CACHE.set(lang, await load());
  } catch {
    // Kein Netz und noch nicht im Zwischenspeicher: Dann bleibt es beim
    // Rückfall. Eine fehlende Übersetzung darf die Benutzung nicht verhindern.
  }
}

/**
 * Sprachen, deren Texte nicht von einem Muttersprachler gegengelesen wurden.
 *
 * Sie tragen in der Oberfläche einen Hinweis samt Verbesserungslink (F25).
 * Die geldkritischen Beschriftungen sind überall zusätzlich rückübersetzt
 * geprüft worden; welche das sind, steht in `de.ts` mit ⚠️ markiert.
 * Ein Test hält diese Menge und die Sprachliste zusammen.
 */
export const MACHINE_TRANSLATED: ReadonlySet<string> = new Set<string>(Object.keys(LAZY));

/** Wohin Verbesserungsvorschläge gehen. */
export const TRANSLATION_ISSUE_URL =
  'https://github.com/Dennismit2n/collective-calc/issues/new?title=%C3%9Cbersetzung';

export const FALLBACK: LanguageCode = 'en';

/** Wählt aus der Browsereinstellung die beste angebotene Sprache. */
export function detectLanguage(preferred: readonly string[]): LanguageCode {
  for (const raw of preferred) {
    const base = raw.toLowerCase().split('-')[0];
    const hit = SUPPORTED.find((s) => s.code === base);
    if (hit) return hit.code;
  }
  return FALLBACK;
}

export function resolveLanguage(setting: string, browser: readonly string[]): LanguageCode {
  if (setting !== 'auto') {
    const hit = SUPPORTED.find((s) => s.code === setting);
    if (hit) return hit.code;
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
  // Noch nicht geladen? Dann vorübergehend Englisch — `ensureLanguage` holt die
  // richtige Tabelle nach und die Oberfläche zeichnet neu.
  const table = CACHE.get(lang) ?? CACHE.get(FALLBACK) ?? REFERENCE;
  const geladen = CACHE.has(lang);
  const plurals = new Intl.PluralRules(lang);

  return {
    lang,
    locale: lang,
    isMachineTranslated: geladen && MACHINE_TRANSLATED.has(lang),
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
