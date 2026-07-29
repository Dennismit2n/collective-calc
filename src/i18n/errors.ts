/**
 * Fehlerschlüssel in Text übersetzen.
 *
 * Codec und Migration liefern nur einen Schlüssel und eine technische Notiz.
 * Der Satz, den ein Mensch liest, entsteht erst hier — sonst stünde deutscher
 * Klartext im Code, und eine englische Oberfläche zeigte eine englische
 * Überschrift mit einem deutschen Absatz darunter. Genau das war vorher der Fall
 * und wurde erst vom Browser-Test sichtbar.
 */

import { CodecError } from '../core/codec.js';
import { MigrationError } from '../core/migrate.js';
import type { MessageKey } from './de.js';
import type { Translator } from './index.js';

const LINK_KEYS: Record<string, MessageKey> = {
  empty: 'error.link.empty',
  notOurs: 'error.link.notOurs',
  truncated: 'error.link.truncated',
  garbled: 'error.link.garbled',
  newerFormat: 'error.link.newerFormat',
};

const FILE_KEYS: Record<string, MessageKey> = {
  notALedger: 'error.file.notALedger',
  noVersion: 'error.file.noVersion',
  newerFormat: 'error.file.newerFormat',
  incomplete: 'error.file.incomplete',
  noPath: 'error.file.noPath',
};

/**
 * Der Satz für den Nutzer. Unbekanntes fällt auf die technische Notiz zurück —
 * eine unübersetzte Meldung ist immer noch besser als gar keine.
 */
export function describeError(error: unknown, t: Translator): string {
  if (error instanceof CodecError) {
    const key = LINK_KEYS[error.code];
    return key ? t.t(key) : error.message;
  }
  if (error instanceof MigrationError) {
    const key = FILE_KEYS[error.code];
    return key ? t.t(key) : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
