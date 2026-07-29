/**
 * Zählen (F27).
 *
 * Vier Zähler, mehr nicht. Die Entscheidung, ob etwas zählenswert ist, fällt
 * **auf dem Gerät** — gesendet wird nur ein nackter Name. Keine Beträge, keine
 * Namen, keine Kennung, kein Anlassinhalt. Das ist bei einem Werkzeug, dessen
 * Verkaufsargument Datensparsamkeit ist, keine Kür.
 *
 * Was gezählt wird, steht offen im README. Stille Messung wäre bei diesem
 * Versprechen ein Selbsttor.
 *
 * Die Leitkennzahl ist `mehrtaegig`: Sie unterscheidet „ausprobiert" von „im
 * Urlaub tatsächlich benutzt". Wer neugierig zwei Beispielausgaben eintippt,
 * erzeugt Aufrufe, eine Erfassung und vielleicht sogar einen geteilten Link —
 * aber er kommt am nächsten Tag nicht wieder.
 */

import type { Ledger } from './types.js';

export type CounterName =
  /** In einem Anlass wurde zum ersten Mal eine Ausgabe erfasst. */
  | 'erste-ausgabe'
  /** Ein Link wurde geteilt oder kopiert. */
  | 'geteilt'
  /** Ein geteilter Link wurde geöffnet. */
  | 'ergebnis-geoeffnet'
  /** Ein Anlass hat an einem späteren Kalendertag eine weitere Ausgabe bekommen. */
  | 'mehrtaegig';

interface GoatCounter {
  count(options: { path: string; title: string; event: boolean }): void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

/**
 * Sendet einen Zähler, wenn das Zählwerkzeug erreichbar ist.
 *
 * Fehlt es — offline, blockiert, Skript nicht geladen —, passiert schlicht
 * nichts. Zählung darf die Benutzung nie stören.
 */
export function count(name: CounterName): void {
  try {
    window.goatcounter?.count({ path: `e/${name}`, title: name, event: true });
  } catch {
    // Zählen ist kein Zweck des Programms. Es darf nie etwas kaputtmachen.
  }
}

/**
 * Der eine Seitenaufruf, den wir selbst auslösen.
 *
 * Die automatische Zählung ist abgeschaltet, damit hier **ausdrücklich** steht,
 * was das Gerät verlässt: ein fester Pfad, sonst nichts. Kein Anker — dort steht
 * bei diesem Werkzeug die vollständige Abrechnung mit Namen und Beträgen. Keine
 * Abfrageparameter, auch wenn wir keine benutzen.
 *
 * Ob jemand über einen geteilten Link kam, wird als eigener Zähler gemeldet und
 * nicht über den Pfad — so bleibt selbst die Unterscheidung inhaltslos.
 */
export function countPageview(viaSharedLink: boolean): void {
  try {
    window.goatcounter?.count({ path: '/', title: 'Collective-Calc', event: false });
    if (viaSharedLink) count('ergebnis-geoeffnet');
  } catch {
    /* siehe oben */
  }
}

/** Kalendertag einer Zeitangabe, in der Zeitzone des Geräts. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Welche Zähler löst das Hinzufügen einer Ausgabe aus?
 *
 * Reine Funktion, damit sie prüfbar ist: `vorher` ist der Anlass ohne den neuen
 * Eintrag, `nachher` mit ihm.
 */
export function countersForNewEntry(vorher: Ledger, nachher: Ledger): CounterName[] {
  const out: CounterName[] = [];
  const alt = vorher.entries.filter((e) => e.kind === 'expense');
  const neu = nachher.entries.filter((e) => e.kind === 'expense');
  if (neu.length === 0) return out;

  if (alt.length === 0) out.push('erste-ausgabe');

  // Mehrtägig heißt: Es gibt jetzt Ausgaben an mindestens zwei Kalendertagen,
  // vorher noch nicht. Der Zähler läuft dadurch je Anlass genau einmal.
  const tageAlt = new Set(alt.map((e) => dayOf(e.at)));
  const tageNeu = new Set(neu.map((e) => dayOf(e.at)));
  if (tageAlt.size < 2 && tageNeu.size >= 2) out.push('mehrtaegig');

  return out;
}
