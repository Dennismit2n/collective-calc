/**
 * Export als Datei (F11): JSON und CSV. Das PDF entsteht über den Druckdialog
 * des Browsers und braucht deshalb keinen Code — nur ein Druck-Stylesheet.
 */

import type { Ledger, Settlement } from './types.js';
import { LEDGER_VERSION } from './types.js';

/** Vollständig und wieder einlesbar. Formatversion und Datum stehen im Kopf. */
export function toJson(ledger: Ledger): string {
  return JSON.stringify(
    {
      app: 'collective-calc',
      format: LEDGER_VERSION,
      exportedAt: new Date().toISOString(),
      ...ledger,
    },
    null,
    2,
  );
}

/**
 * Welches Trennzeichen eine Tabellenkalkulation erwartet, hängt an der Sprache:
 * Wo das Komma der Dezimaltrenner ist, muss die Spalte mit Semikolon getrennt
 * werden — sonst landet alles in einer einzigen Zelle.
 */
export function separatorFor(locale: string): ';' | ',' {
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal');
  return decimal?.value === ',' ? ';' : ',';
}

function escapeCell(value: string, separator: string): string {
  if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Eine Zeile je Eintrag, eine Spalte je Person mit deren Anteil.
 * Beträge werden in der Sprache des Lesers geschrieben, damit die Tabelle sie
 * als Zahl erkennt und nicht als Text.
 */
export function toCsv(ledger: Ledger, settlement: Settlement, locale: string): string {
  const sep = separatorFor(locale);
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const money = (cents: number): string => number.format(cents / 100);

  const header = [
    'Datum',
    'Beschreibung',
    'Art',
    `Betrag (${ledger.currency})`,
    'Gezahlt von',
    ...ledger.people.map((p) => `Anteil ${p.name}`),
  ];

  const rows = ledger.entries.map((e) => {
    const total = Object.values(e.weights).reduce((a, w) => a + w, 0);
    const payer = ledger.people.find((p) => p.id === e.payerId)?.name ?? '?';
    const shares = ledger.people.map((p) => {
      const w = e.weights[p.id] ?? 0;
      if (w === 0 || total === 0) return money(0);
      // Für die Tabelle wird je Zeile gerundet — das ist eine Übersicht, keine
      // Abrechnung. Die verbindlichen Zahlen stehen in der Ergebnisansicht,
      // wo genau einmal am Ende gerundet wird (F13).
      return money(Math.round((e.amount * w) / total));
    });
    return [
      e.at.slice(0, 10),
      e.description,
      e.kind === 'repayment' ? 'Rückzahlung' : 'Ausgabe',
      money(e.amount),
      payer,
      ...shares,
    ];
  });

  const summary = [
    [],
    ['Ergebnis'],
    ['Person', 'Ausgelegt', 'Anteil', 'Saldo'],
    ...settlement.summaries.map((s) => [
      ledger.people.find((p) => p.id === s.personId)?.name ?? '?',
      money(s.paid),
      money(s.share),
      money(s.balance),
    ]),
    [],
    ['Überweisungen'],
    ['Von', 'An', 'Betrag'],
    ...settlement.transfers.map((tr) => [
      ledger.people.find((p) => p.id === tr.fromId)?.name ?? '?',
      ledger.people.find((p) => p.id === tr.toId)?.name ?? '?',
      money(tr.amount),
    ]),
    ...(settlement.remainders.length > 0
      ? [
          [],
          ['Offen geblieben'],
          ...settlement.remainders.map((r) => [
            ledger.people.find((p) => p.id === r.personId)?.name ?? '?',
            money(r.amount),
            r.direction === 'receives-less' ? 'bekommt weniger' : 'zahlt weniger',
          ]),
        ]
      : []),
  ];

  const lines = [header, ...rows, ...summary].map((cells) =>
    cells.map((c) => escapeCell(String(c), sep)).join(sep),
  );

  // Byte-Reihenfolge-Marke voran, sonst zeigt Excel Umlaute falsch an.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Löst einen Download aus, ohne die Seite zu verlassen. */
export function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Etwas Luft lassen, damit der Download wirklich gestartet ist.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ein Dateiname, der auf jedem Betriebssystem funktioniert. */
export function safeFileName(title: string, extension: string): string {
  const cleaned = title
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const stem = cleaned === '' ? 'collective-calc' : cleaned;
  return `${stem}.${extension}`;
}
