/**
 * Formatmigration.
 *
 * Das ist die eine Anleihe aus "wartbar über Jahre", die wir in F1 bewusst
 * mitgenommen haben: Ab Tag eins trägt jede gespeicherte Abrechnung eine
 * Formatversion, und beim Einlesen läuft sie durch diese Kette. Nachrüsten ließe
 * sich das nicht — wer erst in Monat drei versioniert, hat die Daten der ersten
 * Nutzer bereits verloren.
 *
 * Solange es nur Version 1 gibt, ist die Kette leer. Der Wert liegt darin, dass die
 * Stelle existiert und dass unversionierte Daten gar nicht erst angenommen werden.
 */

import type { Ledger } from './types.js';
import { LEDGER_VERSION } from './types.js';

export class MigrationError extends Error {}

/** Eine Migration hebt Daten von `from` auf `from + 1`. */
interface Step {
  from: number;
  apply: (data: Record<string, unknown>) => Record<string, unknown>;
}

const STEPS: Step[] = [
  // Beispiel für später:
  // { from: 1, apply: (d) => ({ ...d, version: 2, currency: d.currency ?? 'EUR' }) },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Hebt beliebige gespeicherte Daten auf die aktuelle Formatversion.
 * Wirft, wenn das nicht möglich ist — lieber eine klare Meldung als halb gelesene Daten.
 */
export function migrate(raw: unknown): Ledger {
  if (!isRecord(raw)) {
    throw new MigrationError('Diese Datei enthält keine Abrechnung.');
  }

  const version = raw['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(
      'Diese Datei trägt keine Formatversion und stammt nicht aus Collective-Calc.',
    );
  }

  if (version > LEDGER_VERSION) {
    throw new MigrationError(
      `Diese Datei wurde mit einer neueren Fassung von Collective-Calc erstellt (Format ${version}). ` +
        'Lade die Seite neu, um die aktuelle Fassung zu bekommen.',
    );
  }

  let data = raw;
  let current = version;
  while (current < LEDGER_VERSION) {
    const step = STEPS.find((s) => s.from === current);
    if (!step) {
      throw new MigrationError(
        `Für Format ${current} gibt es keinen Übergang auf ${current + 1}. Bitte melde diesen Fall.`,
      );
    }
    data = step.apply(data);
    current += 1;
  }

  return assertLedgerShape(data);
}

/**
 * Letzte Formprüfung, bevor die Daten den Rechenkern erreichen.
 * Die inhaltliche Prüfung — gültige Zahler, Gewichte, Beträge — macht danach
 * `validateLedger` in `balances.ts`.
 */
export function assertLedgerShape(data: Record<string, unknown>): Ledger {
  const required = ['id', 'title', 'currency', 'createdAt'] as const;
  for (const key of required) {
    if (typeof data[key] !== 'string') {
      throw new MigrationError(`Die Abrechnung ist unvollständig (Feld "${key}" fehlt).`);
    }
  }
  if (!Array.isArray(data['people']) || !Array.isArray(data['entries'])) {
    throw new MigrationError('Die Abrechnung ist unvollständig (Personen oder Ausgaben fehlen).');
  }
  return data as unknown as Ledger;
}
