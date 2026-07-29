/**
 * Lokale Ablage (F9).
 *
 * Grundsätze aus dem Interview:
 *  - **Kein Speichern-Knopf.** Jede Änderung wird sofort gesichert. Ein Geldwerkzeug,
 *    in dem Daten durch Schließen des Browsers verloren gehen, ist kaputt.
 *  - **Wir löschen nie von uns aus.** Keine Verfallsdaten, keine Bereinigung.
 *  - **Der Browser ist kein sicherer Ort.** Safari räumt Skript-Speicher nach etwa
 *    sieben Tagen ohne Besuch ab. Dagegen hilft von innen nichts — deshalb ist der
 *    geteilte Link die eigentliche Sicherung, und deshalb fordert die App sie ein.
 *
 * Je Anlass ein eigener Schlüssel: Ein beschädigter Eintrag reißt dann nicht den
 * gesamten Bestand mit sich.
 */

import type { Ledger } from './types.js';
import { migrate } from './migrate.js';

const PREFIX = 'cc.v1.ledger.';
const KEY_LAST = 'cc.v1.lastOpened';
const KEY_SETTINGS = 'cc.v1.settings';
/** Merkt sich je Anlass, ob die Sicherungsaufforderung schon gezeigt wurde. */
const KEY_BACKUP_ASKED = 'cc.v1.backupAsked';

export interface Settings {
  /** 'system' folgt der Betriebssystem-Einstellung — wie auf der Startseite. */
  theme: 'system' | 'light' | 'dark';
  /** Sprachkürzel oder 'auto' für die Browsereinstellung. */
  lang: string;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', lang: 'auto' };

/** Damit die Ablage in Tests ohne Browser läuft. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

export interface LoadedLedger {
  ledger: Ledger;
}

export interface BrokenLedger {
  key: string;
  problem: string;
  /** Rohdaten, damit der Nutzer sie exportieren kann statt sie zu verlieren. */
  raw: string;
}

export interface LoadResult {
  ledgers: Ledger[];
  broken: BrokenLedger[];
}

export class Store {
  constructor(private readonly backend: KeyValueStore) {}

  /**
   * Liest alle Anlässe. Ein beschädigter Eintrag wird gemeldet, aber nicht gelöscht
   * und blockiert auch die übrigen nicht.
   */
  loadAll(): LoadResult {
    const ledgers: Ledger[] = [];
    const broken: BrokenLedger[] = [];

    for (const key of this.keys()) {
      const raw = this.backend.getItem(key);
      if (raw === null) continue;
      try {
        ledgers.push(migrate(JSON.parse(raw)));
      } catch (err) {
        broken.push({
          key,
          problem: err instanceof Error ? err.message : 'Unbekannter Fehler.',
          raw,
        });
      }
    }

    ledgers.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { ledgers, broken };
  }

  save(ledger: Ledger): void {
    this.backend.setItem(PREFIX + ledger.id, JSON.stringify(ledger));
  }

  remove(id: string): void {
    this.backend.removeItem(PREFIX + id);
    if (this.getLastOpened() === id) this.backend.removeItem(KEY_LAST);
  }

  getLastOpened(): string | null {
    return this.backend.getItem(KEY_LAST);
  }

  setLastOpened(id: string): void {
    this.backend.setItem(KEY_LAST, id);
  }

  getSettings(): Settings {
    const raw = this.backend.getItem(KEY_SETTINGS);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
        lang: typeof parsed.lang === 'string' ? parsed.lang : 'auto',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  setSettings(settings: Settings): void {
    this.backend.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }

  /** Die Sicherungsaufforderung tritt pro Anlass genau einmal auf (F9). */
  wasBackupAsked(ledgerId: string): boolean {
    return this.askedSet().has(ledgerId);
  }

  markBackupAsked(ledgerId: string): void {
    const set = this.askedSet();
    set.add(ledgerId);
    this.backend.setItem(KEY_BACKUP_ASKED, JSON.stringify([...set]));
  }

  private askedSet(): Set<string> {
    const raw = this.backend.getItem(KEY_BACKUP_ASKED);
    if (raw === null) return new Set();
    try {
      const list = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.backend.length; i++) {
      const key = this.backend.key(i);
      if (key !== null && key.startsWith(PREFIX)) out.push(key);
    }
    return out;
  }
}

/**
 * Bittet den Browser, den Speicher dauerhaft zu behalten.
 *
 * Chrome und Firefox entscheiden das anhand eigener Kriterien, Safari kennt die
 * Zusage praktisch nicht. Der Aufruf ist trotzdem richtig — er kostet nichts und
 * hilft dort, wo er greift. Verlass ist darauf nirgends; die Sicherung bleibt der Link.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Entscheidet, ob die Sicherungsaufforderung fällig ist.
 *
 * Sie tritt deutlich auf, aber genau einmal je Anlass — und erst, wenn wirklich
 * etwas zu verlieren ist. Der Abend-Fall mit zwei Ausgaben sieht sie nie (F9).
 */
export function shouldAskForBackup(opts: {
  entryCount: number;
  everShared: boolean;
  alreadyAsked: boolean;
}): boolean {
  const ENOUGH_TO_LOSE = 5;
  return !opts.alreadyAsked && !opts.everShared && opts.entryCount >= ENOUGH_TO_LOSE;
}
