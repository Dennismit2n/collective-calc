import { describe, expect, it } from 'vitest';

import { safeFileName, separatorFor, toCsv, toJson } from './exportFile.js';
import { migrate } from './migrate.js';
import { settle } from './settle.js';
import { entry, equalWeights, ledger, people } from './testing.js';

const p = people('Anna', 'Ben', 'Clara');
const l = ledger(p, [
  entry(1000, 'p1', equalWeights(p), { description: 'Einkauf' }),
  entry(450, 'p2', { p1: 1, p2: 1 }, { description: 'Kaffee; mit Kuchen' }),
  entry(200, 'p3', { p1: 1 }, { kind: 'repayment', description: '' }),
]);

describe('JSON-Export', () => {
  it('lässt sich wieder einlesen', () => {
    const parsed = migrate(JSON.parse(toJson(l)));
    expect(parsed.entries).toHaveLength(3);
    expect(settle(parsed).summaries).toEqual(settle(l).summaries);
  });

  it('trägt Formatversion und Erzeugungsdatum im Kopf', () => {
    const raw = JSON.parse(toJson(l)) as Record<string, unknown>;
    expect(raw['app']).toBe('collective-calc');
    expect(raw['format']).toBe(1);
    expect(typeof raw['exportedAt']).toBe('string');
  });
});

describe('CSV-Export', () => {
  it('wählt das Trennzeichen passend zur Sprache', () => {
    // Wo das Komma der Dezimaltrenner ist, muss das Semikolon trennen.
    expect(separatorFor('de-DE')).toBe(';');
    expect(separatorFor('fr-FR')).toBe(';');
    expect(separatorFor('en-US')).toBe(',');
  });

  it('schreibt eine Spalte je Person', () => {
    const csv = toCsv(l, settle(l), 'de-DE');
    const header = csv.split('\r\n')[0]!;
    expect(header).toContain('Anteil Anna');
    expect(header).toContain('Anteil Ben');
    expect(header).toContain('Anteil Clara');
  });

  it('schützt Felder, die das Trennzeichen enthalten', () => {
    const csv = toCsv(l, settle(l), 'de-DE');
    // "Kaffee; mit Kuchen" enthält das Semikolon und muss in Anführungszeichen stehen.
    expect(csv).toContain('"Kaffee; mit Kuchen"');
    // Und darf die Spaltenzahl nicht sprengen.
    const lines = csv.split('\r\n').filter((x) => x.length > 0);
    const columns = (line: string): number => {
      let count = 1;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ';' && !inQuotes) count += 1;
      }
      return count;
    };
    expect(columns(lines[1]!)).toBe(columns(lines[0]!));
    expect(columns(lines[2]!)).toBe(columns(lines[0]!));
  });

  it('beginnt mit der Byte-Reihenfolge-Marke, damit Excel Umlaute richtig zeigt', () => {
    expect(toCsv(l, settle(l), 'de-DE').charCodeAt(0)).toBe(0xfeff);
  });

  it('unterscheidet Ausgaben von Rückzahlungen', () => {
    const csv = toCsv(l, settle(l), 'de-DE');
    expect(csv).toContain('Rückzahlung');
    expect(csv).toContain('Ausgabe');
  });

  it('enthält Ergebnis und Überweisungen', () => {
    const csv = toCsv(l, settle(l), 'de-DE');
    expect(csv).toContain('Ergebnis');
    expect(csv).toContain('Überweisungen');
  });
});

describe('Dateinamen', () => {
  it('räumt weg, was Dateisysteme nicht mögen', () => {
    expect(safeFileName('Urlaub 2026: Kroatien/Split', 'json')).toBe('Urlaub-2026-KroatienSplit.json');
    expect(safeFileName('   ', 'csv')).toBe('collective-calc.csv');
    expect(safeFileName('Hüttenwochenende 🏔️', 'json')).toMatch(/^H.*ttenwochenende.*\.json$/);
  });

  it('bleibt kurz genug', () => {
    expect(safeFileName('x'.repeat(300), 'json').length).toBeLessThanOrEqual(65);
  });
});
