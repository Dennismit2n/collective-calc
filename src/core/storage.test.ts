import { describe, expect, it } from 'vitest';

import { MemoryStore, Store, shouldAskForBackup } from './storage.js';
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

  it('weist eine neuere Formatversion mit verständlicher Meldung ab', () => {
    expect(() => migrate({ version: 99, id: 'a', title: 'b', currency: 'EUR', createdAt: 'c', people: [], entries: [] })).toThrow(
      /neueren Fassung/,
    );
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
