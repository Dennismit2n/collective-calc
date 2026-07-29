/**
 * Zustandsverwaltung der App.
 *
 * Bewusst schlicht: ein Zustandsobjekt, ein paar Funktionen, die eine neue Fassung
 * zurückgeben, und ein Abonnement für die Oberfläche. Für eine App dieser Größe wäre
 * eine Zustandsbibliothek mehr Aufwand als Gewinn.
 *
 * Wichtig (F9): **Es gibt keinen Speichern-Knopf.** Jede Änderung landet sofort in
 * der Ablage.
 */

import type { Entry, Ledger, Person, SplitMode } from '../core/types.js';
import { LEDGER_VERSION } from '../core/types.js';
import { Store } from '../core/storage.js';
import type { Settings } from '../core/storage.js';

export interface UndoState {
  /** Was rückgängig gemacht werden kann. Verschwindet erst bei der nächsten Aktion (F26). */
  label: string;
  restore: () => void;
}

function makeId(): string {
  // Kurz, kollisionsarm genug für lokale Daten und kompakt im Link.
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Ein neuer Anlass braucht keinen Namen (F4).
 *
 * Der Titel bleibt bewusst **leer**, statt beim Anlegen einen deutschen Text
 * hineinzuschreiben. Sonst hieße eine Abrechnung nach dem Sprachwechsel weiterhin
 * „Abrechnung vom 29. Juli" — die Sprache richtet sich nach dem Leser, und ein in
 * die Daten eingebrannter Text kann das nicht mitmachen. Angezeigt wird der
 * Ersatzname erst beim Zeichnen, aus `createdAt`.
 */
export function createLedger(title = '', currency = 'EUR'): Ledger {
  return {
    version: LEDGER_VERSION,
    id: makeId(),
    title,
    currency,
    createdAt: new Date().toISOString(),
    people: [],
    entries: [],
  };
}

export function addPerson(ledger: Ledger, name: string): Ledger {
  const person: Person = { id: makeId(), name: name.trim() };
  return { ...ledger, people: [...ledger.people, person] };
}

export function renamePerson(ledger: Ledger, id: string, name: string): Ledger {
  return {
    ...ledger,
    people: ledger.people.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)),
  };
}

/** Eine Person, die in Ausgaben vorkommt, darf nicht verschwinden (F7). */
export function canRemovePerson(ledger: Ledger, id: string): boolean {
  return !ledger.entries.some((e) => e.payerId === id || (e.weights[id] ?? 0) > 0);
}

export function removePerson(ledger: Ledger, id: string): Ledger {
  if (!canRemovePerson(ledger, id)) return ledger;
  return { ...ledger, people: ledger.people.filter((p) => p.id !== id) };
}

export interface NewEntry {
  amount: number;
  payerId: string;
  weights: Record<string, number>;
  description: string;
  mode: SplitMode;
  kind?: Entry['kind'];
}

export function addEntry(ledger: Ledger, input: NewEntry): Ledger {
  const entry: Entry = {
    id: makeId(),
    kind: input.kind ?? 'expense',
    amount: input.amount,
    payerId: input.payerId,
    weights: input.weights,
    mode: input.mode,
    description: input.description.trim(),
    at: new Date().toISOString(),
  };
  return { ...ledger, entries: [...ledger.entries, entry] };
}

export function updateEntry(ledger: Ledger, id: string, patch: Partial<Entry>): Ledger {
  return {
    ...ledger,
    entries: ledger.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
}

export function removeEntry(ledger: Ledger, id: string): Ledger {
  return { ...ledger, entries: ledger.entries.filter((e) => e.id !== id) };
}

/** Die zuletzt benutzten Beschreibungen als Kurzwahl (F23). */
export function recentDescriptions(ledger: Ledger, limit = 5): string[] {
  const seen: string[] = [];
  for (let i = ledger.entries.length - 1; i >= 0; i--) {
    const d = ledger.entries[i]!.description.trim();
    if (d.length > 0 && !seen.includes(d)) seen.push(d);
    if (seen.length >= limit) break;
  }
  return seen;
}

/** Alle gleich beteiligt — die Voreinstellung. */
export function equalWeights(ledger: Ledger): Record<string, number> {
  return Object.fromEntries(ledger.people.map((p) => [p.id, 1]));
}

// ---------------------------------------------------------------------------

export interface AppState {
  ledgers: Ledger[];
  currentId: string | null;
  settings: Settings;
  /** Anlässe, die sich nicht lesen ließen — Rohdaten bleiben zum Export erhalten. */
  broken: Array<{ key: string; problem: string; raw: string }>;
  undo: UndoState | null;
  /** Wurde dieser Anlass schon geteilt? Steuert die Sicherungsaufforderung. */
  shared: Set<string>;
}

export class AppStore {
  private listeners = new Set<() => void>();
  state: AppState;

  constructor(private readonly store: Store) {
    const { ledgers, broken } = store.loadAll();

    // Beim allerersten Öffnen landet man direkt in einem leeren Anlass, nicht auf
    // einer leeren Liste (F4). Das passiert hier und nicht in einer Komponente:
    // Ein Effekt in einer Kindkomponente läuft, bevor die Hülle ihr Abonnement
    // eingerichtet hat — das Neuzeichnen bliebe aus, und der Bildschirm leer.
    if (ledgers.length === 0) {
      const first = createLedger();
      store.save(first);
      store.setLastOpened(first.id);
      ledgers.push(first);
    }

    const last = store.getLastOpened();
    this.state = {
      ledgers,
      currentId: last && ledgers.some((l) => l.id === last) ? last : (ledgers[0]?.id ?? null),
      settings: store.getSettings(),
      broken,
      undo: null,
      shared: new Set(),
    };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  get current(): Ledger | null {
    return this.state.ledgers.find((l) => l.id === this.state.currentId) ?? null;
  }

  /** Jede Änderung wird sofort gesichert — es gibt keinen Speichern-Knopf. */
  write(ledger: Ledger, undo: UndoState | null = null): void {
    this.store.save(ledger);
    this.set({
      ledgers: this.state.ledgers.map((l) => (l.id === ledger.id ? ledger : l)),
      undo,
    });
  }

  add(ledger: Ledger): void {
    this.store.save(ledger);
    this.store.setLastOpened(ledger.id);
    this.set({ ledgers: [ledger, ...this.state.ledgers], currentId: ledger.id, undo: null });
  }

  open(id: string): void {
    this.store.setLastOpened(id);
    this.set({ currentId: id, undo: null });
  }

  destroy(id: string): void {
    this.store.remove(id);
    const rest = this.state.ledgers.filter((l) => l.id !== id);
    this.set({
      ledgers: rest,
      currentId: this.state.currentId === id ? (rest[0]?.id ?? null) : this.state.currentId,
      undo: null,
    });
  }

  setSettings(settings: Settings): void {
    this.store.setSettings(settings);
    this.set({ settings });
  }

  /** Der Rückgängig-Streifen verschwindet bei der nächsten Aktion, nicht nach Zeit (F26). */
  clearUndo(): void {
    if (this.state.undo) this.set({ undo: null });
  }

  markShared(id: string): void {
    const shared = new Set(this.state.shared);
    shared.add(id);
    this.set({ shared });
  }

  wasBackupAsked(id: string): boolean {
    return this.store.wasBackupAsked(id);
  }

  markBackupAsked(id: string): void {
    this.store.markBackupAsked(id);
    this.emit();
  }
}
