import { describe, expect, it } from 'vitest';

import { MemoryStore, Store, THEMES, shouldAskForBackup, toTheme } from './storage.js';
import { migrate, MigrationError } from './migrate.js';
import { entry, equalWeights, ledger, people } from './testing.js';
import { LEDGER_VERSION } from './types.js';

function makeStore(): Store {
  return new Store(new MemoryStore());
}

describe('Ablage', () => {
  it('speichert und liest eine Abrechnung verlustfrei', () => {
    const s = makeStore();
    const p = people('Anna', 'Ben');
    const l = ledger(p, [entry(1234, 'p1', equalWeights(p))]);
    l.id = 'urlaub';
    s.save(l);

    const { ledgers, broken } = s.loadAll();
    expect(broken).toEqual([]);
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0]).toEqual(l);
  });

  it('ein beschädigter Eintrag reißt die übrigen nicht mit', () => {
    const backend = new MemoryStore();
    const s = new Store(backend);
    const p = people('Anna', 'Ben');
    const good = ledger(p, [entry(500, 'p1', equalWeights(p))]);
    good.id = 'gut';
    s.save(good);
    backend.setItem('cc.v1.ledger.kaputt', '{ das ist kein JSON');

    const result = s.loadAll();
    expect(result.ledgers.map((l) => l.id)).toEqual(['gut']);
    expect(result.broken).toHaveLength(1);
    // Die Rohdaten bleiben erhalten, damit der Nutzer sie exportieren kann.
    expect(result.broken[0]!.raw).toContain('das ist kein JSON');
  });

  it('löscht nichts von sich aus', () => {
    const backend = new MemoryStore();
    const s = new Store(backend);
    const p = people('Anna');
    const l = ledger(p, []);
    l.id = 'alt';
    l.createdAt = '2019-01-01T00:00:00.000Z';
    s.save(l);
    s.loadAll();
    s.loadAll();
    expect(backend.getItem('cc.v1.ledger.alt')).not.toBeNull();
  });

  it('merkt sich den zuletzt geöffneten Anlass und vergisst ihn beim Löschen', () => {
    const s = makeStore();
    const p = people('Anna');
    const l = ledger(p, []);
    l.id = 'x';
    s.save(l);
    s.setLastOpened('x');
    expect(s.getLastOpened()).toBe('x');
    s.remove('x');
    expect(s.getLastOpened()).toBeNull();
  });

  it('liefert brauchbare Einstellungen, auch wenn sie beschädigt sind', () => {
    const backend = new MemoryStore();
    const s = new Store(backend);
    expect(s.getSettings()).toEqual({ theme: 'system', lang: 'auto' });

    backend.setItem('cc.v1.settings', '{"theme":"pink","lang":42}');
    expect(s.getSettings()).toEqual({ theme: 'system', lang: 'auto' });

    s.setSettings({ theme: 'dark', lang: 'tr' });
    expect(s.getSettings()).toEqual({ theme: 'dark', lang: 'tr' });
  });

  it('teilt die Darstellung mit allen Werkzeugen der Werkstatt (werkstatt.darstellung, roh)', () => {
    const backend = new MemoryStore();
    const s = new Store(backend);
    // eine Wahl in einem anderen Werkzeug geht vor dem eigenen Rückfall
    backend.setItem('cc.v1.settings', '{"theme":"light","lang":"de"}');
    backend.setItem('werkstatt.darstellung', 'hc-dark');
    expect(s.getSettings()).toEqual({ theme: 'hc-dark', lang: 'de' });
    // Werte anderer Werkzeuge zählen als ihre Familie, Unbekanntes als System
    backend.setItem('werkstatt.darstellung', 'soft-dark');
    expect(s.getSettings().theme).toBe('dark');
    backend.setItem('werkstatt.darstellung', 'pink');
    expect(s.getSettings().theme).toBe('system');
    // eine eigene Wahl landet roh im gemeinsamen Schlüssel
    s.setSettings({ theme: 'cvd-light', lang: 'de' });
    expect(backend.getItem('werkstatt.darstellung')).toBe('cvd-light');
    expect(s.getSettings()).toEqual({ theme: 'cvd-light', lang: 'de' });
    // ein Sprachwechsel überschreibt keine Darstellung, die ein anderes Werkzeug inzwischen gewählt hat
    backend.setItem('werkstatt.darstellung', 'invert');
    s.setSettings({ theme: 'invert', lang: 'fr' });
    expect(backend.getItem('werkstatt.darstellung')).toBe('invert');
    expect(s.getSettings()).toEqual({ theme: 'invert', lang: 'fr' });
    // ohne gemeinsamen Schlüssel gilt das eigene Thema
    backend.removeItem('werkstatt.darstellung');
    expect(s.getSettings().theme).toBe('invert');
    // und ein bloßer Sprachwechsel schreibt gar nichts in den gemeinsamen Schlüssel
    s.setSettings({ theme: 'invert', lang: 'nl' });
    expect(backend.getItem('werkstatt.darstellung')).toBeNull();
    expect(s.getSettings()).toEqual({ theme: 'invert', lang: 'nl' });
  });

  it('toTheme kennt die acht Darstellungen und ordnet Fremdes zu', () => {
    for (const t of THEMES) expect(toTheme(t)).toBe(t);
    expect(toTheme('soft-dark')).toBe('dark');
    expect(toTheme('extra-light')).toBe('light');
    expect(toTheme('Dunkel')).toBe('system');
    expect(toTheme(null)).toBe('system');
    expect(toTheme(3)).toBe('system');
  });

  it('fragt pro Anlass nur einmal nach der Sicherung', () => {
    const s = makeStore();
    expect(s.wasBackupAsked('a')).toBe(false);
    s.markBackupAsked('a');
    expect(s.wasBackupAsked('a')).toBe(true);
    expect(s.wasBackupAsked('b')).toBe(false);
  });
});

describe('Sicherungsaufforderung', () => {
  it('bleibt beim Abend-Fall vollständig aus', () => {
    expect(shouldAskForBackup({ entryCount: 2, everShared: false, alreadyAsked: false })).toBe(false);
  });

  it('kommt bei einer Urlaubsabrechnung', () => {
    expect(shouldAskForBackup({ entryCount: 12, everShared: false, alreadyAsked: false })).toBe(true);
  });

  it('bleibt aus, wenn schon geteilt wurde — der Link ist die Sicherung', () => {
    expect(shouldAskForBackup({ entryCount: 40, everShared: true, alreadyAsked: false })).toBe(false);
  });

  it('wiederholt sich nicht', () => {
    expect(shouldAskForBackup({ entryCount: 40, everShared: false, alreadyAsked: true })).toBe(false);
  });
});

describe('Formatmigration', () => {
  it('nimmt die aktuelle Version an', () => {
    const p = people('Anna');
    const l = ledger(p, []);
    expect(migrate(JSON.parse(JSON.stringify(l))).version).toBe(LEDGER_VERSION);
  });

  it('weist Daten ohne Formatversion ab', () => {
    expect(() => migrate({ title: 'ohne Version' })).toThrow(MigrationError);
  });

  it('weist eine neuere Formatversion mit eindeutigem Grund ab', () => {
    // Geprüft wird der Schlüssel, nicht der Satz: Der Text steht in der
    // Sprachtabelle und darf sich ändern, ohne Tests zu brechen.
    expect(() =>
      migrate({ version: 99, id: 'a', title: 'b', currency: 'EUR', createdAt: 'c', people: [], entries: [] }),
    ).toThrow(expect.objectContaining({ code: 'newerFormat' }));
  });

  it('nennt für jeden Fehlschlag einen Grund', () => {
    const faelle: Array<[unknown, string]> = [
      ['nur ein Text', 'notALedger'],
      [{ titel: 'ohne Version' }, 'noVersion'],
      [{ version: 1, id: 'a' }, 'incomplete'],
    ];
    for (const [eingabe, code] of faelle) {
      expect(() => migrate(eingabe)).toThrow(expect.objectContaining({ code }));
    }
  });

  it('weist unvollständige Abrechnungen ab', () => {
    expect(() => migrate({ version: 1, id: 'a' })).toThrow(MigrationError);
  });

  it('weist etwas ab, das gar keine Abrechnung ist', () => {
    expect(() => migrate('nur ein Text')).toThrow(MigrationError);
    expect(() => migrate([1, 2, 3])).toThrow(MigrationError);
    expect(() => migrate(null)).toThrow(MigrationError);
  });
});
