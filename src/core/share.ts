/**
 * Links bauen und ihre Größe im Griff behalten (F8, F10).
 *
 * Zwei Linkarten, bewusst getrennt:
 *  - **Ergebnis teilen** — schlank. Namen, Salden, Überweisungen, offener Rest.
 *    Keine Einzelausgaben. Wer nur das Ergebnis teilt, verteilt nicht nebenbei
 *    jede Quittung des Urlaubs an alle.
 *  - **Abrechnung übergeben** — vollständig, zum Weiterführen auf einem anderen Gerät.
 *
 * Und die Regel, die über allem steht: **Das Teilen darf nie still scheitern.**
 * Wird ein Link zu lang, sagt das Tool das und bietet einen Weg an, statt einen
 * Link zu erzeugen, der beim Empfänger abgeschnitten ankommt.
 */

import type { Ledger, Settlement } from './types.js';
import { encodeLedger, encodeResult, toResultView } from './codec.js';

/**
 * Ab hier wird es unsicher.
 *
 * Browser vertragen weit mehr, aber Messenger, Mailprogramme und Chat-Verläufe
 * brechen lange Adressen um oder schneiden sie ab. 2000 Zeichen sind der Wert, bei
 * dem in der Praxis noch nichts passiert. Gemessene Vergleichswerte stehen in
 * `codec.test.ts`: Eine Urlaubswoche mit 6 Personen und 40 Ausgaben liegt bei
 * rund 780 Zeichen, ein Ergebnis-Link selbst bei 200 Ausgaben unter 500.
 */
export const SAFE_LINK_LENGTH = 2000;

/**
 * Praktische Obergrenze für QR-Codes: Darüber wird das Muster so fein, dass
 * normale Handykameras es nicht mehr sicher lesen.
 */
export const SAFE_QR_LENGTH = 1200;

export interface ShareLink {
  url: string;
  length: number;
  /** Passt der Link durch die üblichen Messenger? */
  safe: boolean;
  /** Lässt sich daraus ein scannbarer QR-Code machen? */
  qrPossible: boolean;
}

function make(baseUrl: string, fragment: string): ShareLink {
  const url = `${baseUrl}#${fragment}`;
  return {
    url,
    length: url.length,
    safe: url.length <= SAFE_LINK_LENGTH,
    qrPossible: url.length <= SAFE_QR_LENGTH,
  };
}

/** Die Adresse ohne Anker — Grundlage für jeden geteilten Link. */
export function baseUrl(location: { origin: string; pathname: string }): string {
  return location.origin + location.pathname;
}

export async function buildResultLink(
  base: string,
  ledger: Ledger,
  settlement: Settlement,
): Promise<ShareLink> {
  return make(base, await encodeResult(toResultView(ledger, settlement)));
}

export async function buildFullLink(base: string, ledger: Ledger): Promise<ShareLink> {
  return make(base, await encodeLedger(ledger));
}

/**
 * Teilen über das System, falls vorhanden — sonst in die Zwischenablage.
 * Gibt zurück, welcher Weg genommen wurde, damit die Oberfläche die passende
 * Rückmeldung zeigen kann.
 */
export async function shareOrCopy(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      // Bricht der Nutzer das Teilen ab, ist das kein Fehler — dann passiert nichts.
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
    }
  }
  return (await copyToClipboard(url)) ? 'copied' : 'failed';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
