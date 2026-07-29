/**
 * Der Link-Codec.
 *
 * Die gesamte Abrechnung steckt komprimiert **hinter dem `#`** einer Adresse. Alles
 * hinter dem Doppelkreuz wird vom Browser nie an einen Server geschickt — nicht an
 * GitHub, nicht an die Vorschau-Roboter der Messenger. Das ist der Grund, warum
 * Collective-Calc ohne Backend auskommt und trotzdem teilen kann (F8).
 *
 * Zwei Linkarten (F10):
 *  - `f` — "Abrechnung übergeben": der vollständige Anlass, bearbeitbar.
 *  - `r` — "Ergebnis teilen": nur Namen, Salden, Überweisungen und offener Rest.
 *          Deutlich kleiner und deutlich sparsamer mit Daten.
 *
 * Format: `<art><base64url(deflate-raw(json))>`
 *
 * Warum eine Stellungs-Codierung statt lesbarem JSON: Objektschlüssel wie
 * `"description"` würden bei 40 Ausgaben vierzigmal im Link stehen. Die Kompression
 * fängt viel davon ab, aber gar nicht erst hineinzuschreiben ist billiger.
 *
 * **Diese Datei ist die Eingangstür für fremde Daten.** Sie darf nichts annehmen und
 * muss jeden Fehler als klare Meldung zurückgeben, statt halb gelesene Daten
 * weiterzureichen — ein Link kann im Messenger abgeschnitten worden sein.
 */

import type { Entry, Ledger, SplitMode } from './types.js';
import { LEDGER_VERSION } from './types.js';

/**
 * Warum ein Link nicht gelesen werden konnte.
 *
 * Bewusst ein Schlüssel und keine fertige Meldung: Texte gehören in die
 * Sprachtabelle (F18), nicht in den Code. Vorher stand hier deutscher Klartext —
 * eine englische Oberfläche zeigte dadurch eine englische Überschrift mit einem
 * deutschen Absatz darunter.
 */
export type CodecErrorCode =
  /** Gar nichts hinter dem Doppelkreuz. */
  | 'empty'
  /** Kein Collective-Calc-Link. */
  | 'notOurs'
  /** Ließ sich nicht entpacken — fast immer: unterwegs abgeschnitten. */
  | 'truncated'
  /** Entpackt, aber der Inhalt ergibt keine Abrechnung. */
  | 'garbled'
  /** Von einer neueren Fassung erzeugt. */
  | 'newerFormat';

export class CodecError extends Error {
  constructor(
    readonly code: CodecErrorCode,
    /** Nur für Tests und Fehlerberichte — angezeigt wird der übersetzte Text. */
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'CodecError';
  }
}

const MODES: SplitMode[] = ['equal', 'shares', 'percent', 'exact'];

// ---------------------------------------------------------------------------
// Byte-Ebene
// ---------------------------------------------------------------------------

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  let binary: string;
  try {
    binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  } catch {
    throw new CodecError('garbled', 'Der Link enthält ungültige Zeichen.');
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Vollständiger Anlass
// ---------------------------------------------------------------------------

/** Stellungs-Codierung eines Anlasses. Personen werden zu Indizes. */
function packLedger(ledger: Ledger): unknown[] {
  const index = new Map(ledger.people.map((p, i) => [p.id, i]));
  const n = ledger.people.length;

  const entries = ledger.entries.map((e) => {
    const weights = ledger.people.map((p) => e.weights[p.id] ?? 0);
    // Häufigster Fall: alle sind zu gleichen Teilen dabei. Dann genügt eine 0.
    const allEqual = weights.every((w) => w === 1);
    const packed: unknown[] = [
      e.kind === 'repayment' ? 1 : 0,
      e.amount,
      index.get(e.payerId) ?? 0,
      allEqual ? 0 : weights,
      MODES.indexOf(e.mode),
      e.description,
      e.at,
    ];
    if (e.fx) packed.push([e.fx.currency, e.fx.foreignAmount, e.fx.rate]);
    return packed;
  });

  return [
    ledger.version,
    ledger.id,
    ledger.title,
    ledger.currency,
    ledger.createdAt,
    ledger.people.map((p) => p.name),
    entries,
    n,
  ];
}

function expectArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new CodecError('garbled', `${what} fehlt.`, what);
  return value;
}

function expectNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CodecError('garbled', `${what} ist keine Zahl.`, what);
  }
  return value;
}

function expectString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new CodecError('garbled', `${what} fehlt.`, what);
  return value;
}

function unpackLedger(raw: unknown): Ledger {
  const a = expectArray(raw, 'Abrechnung');
  const version = expectNumber(a[0], 'Formatversion');
  if (version > LEDGER_VERSION) {
    throw new CodecError('newerFormat', `Format ${version} ist neuer als ${LEDGER_VERSION}.`);
  }

  const names = expectArray(a[5], 'Personen').map((x, i) => expectString(x, `Name ${i + 1}`));
  const people = names.map((name, i) => ({ id: `p${i + 1}`, name }));

  const entries: Entry[] = expectArray(a[6], 'Ausgaben').map((item, i) => {
    const e = expectArray(item, `Ausgabe ${i + 1}`);
    const rawWeights = e[3];
    let weights: Record<string, number>;
    if (rawWeights === 0) {
      weights = Object.fromEntries(people.map((p) => [p.id, 1]));
    } else {
      const list = expectArray(rawWeights, `Aufteilung der Ausgabe ${i + 1}`);
      if (list.length !== people.length) {
        throw new CodecError('garbled', `Aufteilung der Ausgabe ${i + 1} passt nicht zur Gruppe.`);
      }
      weights = Object.fromEntries(
        people.map((p, idx) => [p.id, expectNumber(list[idx], `Gewicht ${idx + 1}`)]),
      );
    }

    const payerIdx = expectNumber(e[2], `Zahler der Ausgabe ${i + 1}`);
    const payer = people[payerIdx];
    if (!payer) throw new CodecError('garbled', `Zahler der Ausgabe ${i + 1} unbekannt.`);

    const modeIdx = expectNumber(e[4], `Aufteilungsart der Ausgabe ${i + 1}`);
    const entry: Entry = {
      id: `e${i + 1}`,
      kind: e[0] === 1 ? 'repayment' : 'expense',
      amount: expectNumber(e[1], `Betrag der Ausgabe ${i + 1}`),
      payerId: payer.id,
      weights,
      mode: MODES[modeIdx] ?? 'equal',
      description: expectString(e[5], `Beschreibung der Ausgabe ${i + 1}`),
      at: expectString(e[6], `Datum der Ausgabe ${i + 1}`),
    };

    const fx = e[7];
    if (Array.isArray(fx)) {
      entry.fx = {
        currency: expectString(fx[0], 'Fremdwährung'),
        foreignAmount: expectNumber(fx[1], 'Fremdbetrag'),
        rate: expectString(fx[2], 'Wechselkurs'),
      };
    }
    return entry;
  });

  return {
    version: LEDGER_VERSION,
    id: expectString(a[1], 'Kennung'),
    title: expectString(a[2], 'Titel'),
    currency: expectString(a[3], 'Währung'),
    createdAt: expectString(a[4], 'Erstellungsdatum'),
    people,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Öffentliche Schnittstelle
// ---------------------------------------------------------------------------

export type LinkKind = 'full' | 'result';

/**
 * Die schlanke Ergebnisansicht (F10).
 *
 * Enthält bewusst **keine** Einzelausgaben — wer nur das Ergebnis teilt, verteilt nicht
 * nebenbei jede Quittung des Urlaubs an alle. Die beiden Zusatzzahlen je Person
 * (`paid` und `share`) sind trotzdem dabei, damit jeder seinen Saldo im Kopf nachprüfen
 * kann, statt ihn glauben zu müssen.
 */
export interface ResultView {
  title: string;
  currency: string;
  names: string[];
  summaries: Array<{ paid: number; share: number; repaidOut: number; repaidIn: number; balance: number }>;
  transfers: Array<{ from: number; to: number; amount: number }>;
  remainders: Array<{ person: number; amount: number; direction: 'receives-less' | 'pays-less' }>;
  totalExpenses: number;
}

/** Baut den Teil hinter dem `#` — ohne führendes Doppelkreuz. */
export async function encodeLedger(ledger: Ledger): Promise<string> {
  const json = JSON.stringify(packLedger(ledger));
  const packed = await deflate(new TextEncoder().encode(json));
  return 'f' + toBase64Url(packed);
}

export async function encodeResult(view: ResultView): Promise<string> {
  const packed = [
    LEDGER_VERSION,
    view.title,
    view.currency,
    view.names,
    view.summaries.map((s) => [s.paid, s.share, s.balance, s.repaidOut, s.repaidIn]),
    view.transfers.map((t) => [t.from, t.to, t.amount]),
    view.remainders.map((r) => [r.person, r.amount, r.direction === 'receives-less' ? 0 : 1]),
    view.totalExpenses,
  ];
  const bytes = await deflate(new TextEncoder().encode(JSON.stringify(packed)));
  return 'r' + toBase64Url(bytes);
}

function unpackResult(raw: unknown): ResultView {
  const a = expectArray(raw, 'Ergebnis');
  const version = expectNumber(a[0], 'Formatversion');
  if (version > LEDGER_VERSION) {
    throw new CodecError('newerFormat', `Format ${version} ist neuer als ${LEDGER_VERSION}.`);
  }
  const names = expectArray(a[3], 'Personen').map((x, i) => expectString(x, `Name ${i + 1}`));

  const summaries = expectArray(a[4], 'Salden').map((item, i) => {
    const s = expectArray(item, `Saldo ${i + 1}`);
    return {
      paid: expectNumber(s[0], `Auslage ${i + 1}`),
      share: expectNumber(s[1], `Anteil ${i + 1}`),
      balance: expectNumber(s[2], `Saldo ${i + 1}`),
      // Rückzahlungen kamen mit Format 1 dazu; fehlen sie, sind sie null.
      repaidOut: typeof s[3] === 'number' ? s[3] : 0,
      repaidIn: typeof s[4] === 'number' ? s[4] : 0,
    };
  });
  if (summaries.length !== names.length) {
    throw new CodecError('garbled', 'Salden passen nicht zur Personenliste.');
  }

  const inRange = (i: number): number => {
    if (!Number.isInteger(i) || i < 0 || i >= names.length) {
      throw new CodecError('garbled', 'Verweis auf eine unbekannte Person.');
    }
    return i;
  };

  const transfers = expectArray(a[5], 'Überweisungen').map((item, i) => {
    const t = expectArray(item, `Überweisung ${i + 1}`);
    return {
      from: inRange(expectNumber(t[0], `Absender ${i + 1}`)),
      to: inRange(expectNumber(t[1], `Empfänger ${i + 1}`)),
      amount: expectNumber(t[2], `Betrag ${i + 1}`),
    };
  });

  const remainders = expectArray(a[6], 'Restbeträge').map((item, i) => {
    const r = expectArray(item, `Restbetrag ${i + 1}`);
    return {
      person: inRange(expectNumber(r[0], `Person ${i + 1}`)),
      amount: expectNumber(r[1], `Restbetrag ${i + 1}`),
      direction: (r[2] === 1 ? 'pays-less' : 'receives-less') as 'receives-less' | 'pays-less',
    };
  });

  return {
    title: expectString(a[1], 'Titel'),
    currency: expectString(a[2], 'Währung'),
    names,
    summaries,
    transfers,
    remainders,
    totalExpenses: expectNumber(a[7], 'Gesamtausgaben'),
  };
}

export type DecodedLink =
  | { kind: 'full'; ledger: Ledger }
  | { kind: 'result'; result: ResultView };

export async function decodeLink(fragment: string): Promise<DecodedLink> {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (text.length === 0) throw new CodecError('empty', 'Der Link enthält keine Abrechnung.');

  const kindChar = text[0];
  const payload = text.slice(1);
  if (kindChar !== 'f' && kindChar !== 'r') {
    throw new CodecError('notOurs', 'Der Link gehört nicht zu Collective-Calc.');
  }

  let json: string;
  try {
    json = new TextDecoder().decode(await inflate(fromBase64Url(payload)));
  } catch (err) {
    if (err instanceof CodecError) throw err;
    throw new CodecError('truncated', 'Der komprimierte Inhalt liess sich nicht entpacken.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new CodecError('garbled', 'Der Inhalt ist kein gültiges JSON.');
  }

  if (kindChar === 'f') return { kind: 'full', ledger: unpackLedger(raw) };
  return { kind: 'result', result: unpackResult(raw) };
}

/** Baut aus einer gerechneten Abrechnung die schlanke Ergebnisansicht. */
export function toResultView(ledger: Ledger, settlement: import('./types.js').Settlement): ResultView {
  const index = new Map(ledger.people.map((p, i) => [p.id, i]));
  const at = (id: string): number => index.get(id) ?? 0;
  return {
    title: ledger.title,
    currency: ledger.currency,
    names: ledger.people.map((p) => p.name),
    summaries: settlement.summaries.map((s) => ({
      paid: s.paid,
      share: s.share,
      repaidOut: s.repaidOut,
      repaidIn: s.repaidIn,
      balance: s.balance,
    })),
    transfers: settlement.transfers.map((t) => ({ from: at(t.fromId), to: at(t.toId), amount: t.amount })),
    remainders: settlement.remainders.map((r) => ({
      person: at(r.personId),
      amount: r.amount,
      direction: r.direction,
    })),
    totalExpenses: settlement.totalExpenses,
  };
}

/** Wie lang wird die fertige Adresse? Grundlage für die Größengrenze aus F8. */
export function linkLength(baseUrl: string, fragment: string): number {
  return baseUrl.length + 1 + fragment.length;
}
