/**
 * Die App-Hülle: Kopfzeile, Ansichtswechsel, Personen, Ausgabenliste.
 *
 * Wichtig für das Wegkonzept: **Die interne Navigation benutzt den Anker der Adresse
 * nicht.** Dort steckt die Abrechnung (F8), also darf sie nichts anderes tragen.
 * Zwischen Erfassung, Ergebnis und Anlassliste wird über den Zustand gewechselt.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import type { AppStore } from './state.js';
import {
  addEntry,
  addPerson,
  canRemovePerson,
  createLedger,
  removeEntry,
  removePerson,
  renamePerson,
} from './state.js';
import { EventList } from '../ui/EventList.js';
import type { Ledger, Settlement } from '../core/types.js';
import { settle } from '../core/settle.js';
import { checkSettlement } from '../core/invariants.js';
import { formatAmount } from '../core/amount.js';
import { createTranslator, resolveLanguage, SUPPORTED } from '../i18n/index.js';
import { CaptureBar } from '../ui/CaptureBar.js';
import { ResultScreen } from '../ui/ResultScreen.js';
import { ShareSheet } from '../ui/ShareSheet.js';
import { SharedLedger, SharedResult } from '../ui/SharedView.js';
import type { DecodedLink } from '../core/codec.js';
import { CodecError, decodeLink } from '../core/codec.js';
import { shouldAskForBackup } from '../core/storage.js';
import { downloadFile, safeFileName, toJson } from '../core/exportFile.js';
import { CurrencyPicker } from '../ui/CurrencyPicker.js';

type View = 'event' | 'result' | 'list';

/** Was beim Öffnen im Anker der Adresse stand — ein geteilter Link, oder nichts. */
type Incoming =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ok'; link: DecodedLink }
  | { status: 'error'; message: string };

/** Erzwingt ein Neuzeichnen, wenn sich der Zustand ändert. */
function useStore(store: AppStore): void {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);
}

export function App({ store }: { store: AppStore }) {
  useStore(store);
  const [view, setView] = useState<View>('event');
  const [newName, setNewName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [incoming, setIncoming] = useState<Incoming>(() =>
    window.location.hash.length > 1 ? { status: 'loading' } : { status: 'none' },
  );

  /*
   * Auf Ankerwechsel horchen.
   *
   * Ein Wechsel des Ankers lädt die Seite **nicht** neu. Wer also einen geteilten
   * Link in eine bereits geöffnete Fassung einfügt — oder ihn anklickt, während
   * der Browser schon einen Tab damit offen hat —, bekäme sonst schlicht nichts
   * zu sehen. Das ist ein realistischer Weg, keine Ausnahme.
   */
  useEffect(() => {
    const onHashChange = (): void => {
      setIncoming(window.location.hash.length > 1 ? { status: 'loading' } : { status: 'none' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Einen geteilten Link lesen. Das Entpacken ist asynchron, deshalb erst hier.
  useEffect(() => {
    if (incoming.status !== 'loading') return;
    let cancelled = false;
    void decodeLink(window.location.hash).then(
      (link) => {
        if (!cancelled) setIncoming({ status: 'ok', link });
      },
      (err: unknown) => {
        if (cancelled) return;
        setIncoming({
          status: 'error',
          message: err instanceof CodecError ? err.message : String(err),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [incoming.status]);

  const settings = store.state.settings;
  const lang = resolveLanguage(settings.lang, navigator.languages ?? [navigator.language]);
  const t = useMemo(() => createTranslator(lang), [lang]);

  // Sprache und Farbschema am Wurzelelement führen — Grundlage dafür, dass
  // Vorleseprogramme richtig aussprechen (F18/F26).
  useEffect(() => {
    document.documentElement.lang = lang;
    if (settings.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', settings.theme);
  }, [lang, settings.theme]);

  const ledger = store.current;

  /*
   * Die Leiste am unteren Rand ist nicht gleich hoch: Rückgängig-Streifen,
   * Aufteilungs-Chips und Beschreibungsvorschläge kommen und gehen. Eine feste
   * Zahl im Stylesheet trifft das nie — und wenn sie zu klein ist, verdeckt die
   * Leiste den Ergebnis-Knopf. Also wird die Höhe gemessen und als Abstand
   * unter den Inhalt gelegt.
   */
  useEffect(() => {
    const root = document.documentElement;
    const el = bottomRef.current;
    if (!el) {
      root.style.setProperty('--bottom-h', '0px');
      return;
    }
    const apply = (): void => root.style.setProperty('--bottom-h', `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, ledger?.id, store.state.undo, ledger?.people.length]);

  return (
    <div class="app">
      <a class="skip" href="#main">
        {t.t('a11y.skipToContent')}
      </a>

      <header class="top">
        <div class="brand">
          <span class="dot" aria-hidden="true" />
          <span>
            {t.t('app.name')}
            <small>{t.t('app.tagline')}</small>
          </span>
        </div>
        <span class="spacer" />

        {incoming.status === 'none' && (
          <button
            type="button"
            class="ghost"
            aria-current={view === 'list' ? 'page' : undefined}
            onClick={() => {
              store.clearUndo();
              setView(view === 'list' ? 'event' : 'list');
            }}
          >
            {t.t('nav.events')}
          </button>
        )}

        <label class="skip" for="theme">
          {t.t('settings.theme')}
        </label>
        <select
          id="theme"
          value={settings.theme}
          onChange={(e) =>
            store.setSettings({
              ...settings,
              theme: (e.target as HTMLSelectElement).value as typeof settings.theme,
            })
          }
        >
          <option value="system">{t.t('settings.theme.system')}</option>
          <option value="light">{t.t('settings.theme.light')}</option>
          <option value="dark">{t.t('settings.theme.dark')}</option>
        </select>

        <label class="skip" for="lang">
          {t.t('settings.language')}
        </label>
        <select
          id="lang"
          value={settings.lang}
          onChange={(e) =>
            store.setSettings({ ...settings, lang: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="auto">{t.t('settings.language')}</option>
          {SUPPORTED.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </header>

      <main id="main">
        {incoming.status === 'loading' ? (
          <p class="muted">…</p>
        ) : incoming.status === 'error' ? (
          <section class="notice warn">
            <h2 class="plain">{t.t('error.brokenLinkTitle')}</h2>
            <p>{incoming.message}</p>
            <button type="button" onClick={() => leaveSharedLink(setIncoming)}>
              {t.t('nav.back')}
            </button>
          </section>
        ) : incoming.status === 'ok' ? (
          <IncomingLink
            link={incoming.link}
            t={t}
            onAdopt={(adopted) => {
              store.add(adopted);
              leaveSharedLink(setIncoming);
              setView('event');
            }}
            onLeave={() => leaveSharedLink(setIncoming)}
          />
        ) : view === 'list' ? (
          <EventList
            ledgers={store.state.ledgers}
            currentId={store.state.currentId}
            t={t}
            displayTitle={(l) => displayTitle(l, t)}
            broken={store.state.broken}
            onOpen={(id) => {
              store.open(id);
              setView('event');
            }}
            onCreate={() => {
              store.add(createLedger());
              setView('event');
            }}
            onDelete={(id) => store.destroy(id)}
            onBack={() => setView('event')}
            onExportBroken={(raw, key) => downloadFile(`${key}.json`, raw, 'application/json')}
          />
        ) : ledger === null ? (
          <p class="muted">…</p>
        ) : view === 'result' ? (
          <ResultView ledger={ledger} t={t} store={store} onBack={() => setView('event')} />
        ) : (
          <EventView
            store={store}
            ledger={ledger}
            t={t}
            newName={newName}
            setNewName={setNewName}
            onShowResult={() => {
              // Der Rückgängig-Streifen verschwindet bei der nächsten Aktion (F26) —
              // ein Ansichtswechsel ist eine.
              store.clearUndo();
              setView('result');
            }}
          />
        )}
      </main>

      {/* Rückgängig-Streifen und Erfassungszeile teilen sich einen festen Bereich am
          unteren Rand. Vorher schwebte der Streifen frei über dem Inhalt und verdeckte
          dabei ausgerechnet den Ergebnis-Knopf. */}
      {/* Die Leiste erscheint auch ohne Erfassungszeile, sobald es etwas
          rückgängig zu machen gibt — sonst hätte eine im Ergebnis eingetragene
          Rückzahlung keinen Rückweg. */}
      {ledger !== null && incoming.status === 'none' && (view === 'event' || store.state.undo !== null) && (
        <div class="bottom" ref={bottomRef}>
          {store.state.undo && (
            <div class="toast" role="status">
              <span class="grow">{store.state.undo.label}</span>
              <button type="button" onClick={() => store.state.undo?.restore()}>
                {t.t('entry.undo')}
              </button>
            </div>
          )}
          {view === 'event' && (
          <CaptureBar
            ledger={ledger}
            t={t}
            meId={ledger.people[0]?.id ?? null}
            onAdd={(entry) => {
              store.clearUndo();
              const before = ledger;
              const next = addEntry(ledger, entry);
              const created = next.entries[next.entries.length - 1]!;
              const payer = ledger.people.find((p) => p.id === entry.payerId)?.name ?? '';
              const amount = formatAmount(entry.amount, t.locale, ledger.currency);
              store.write(next, {
                label: t.t(entry.description ? 'entry.saved' : 'entry.savedNoDescription', {
                  amount,
                  description: entry.description,
                  payer,
                }),
                restore: () => store.write(removeEntry(store.current ?? before, created.id)),
              });
            }}
          />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Zurück aus einer geteilten Ansicht in die eigene App.
 *
 * Der Anker wird dabei geleert, ohne einen Eintrag in der Rückwärts-Geschichte
 * anzulegen — sonst landet man beim Zurück-Knopf des Browsers wieder in derselben
 * geteilten Abrechnung und kommt nicht heraus.
 */
function leaveSharedLink(setIncoming: (value: Incoming) => void): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
  setIncoming({ status: 'none' });
}

function IncomingLink({
  link,
  t,
  onAdopt,
  onLeave,
}: {
  link: DecodedLink;
  t: ReturnType<typeof createTranslator>;
  onAdopt: (ledger: Ledger) => void;
  onLeave: () => void;
}) {
  if (link.kind === 'result') {
    return (
      <>
        <SharedResult result={link.result} t={t} />
        <button type="button" class="ghost no-print" style="margin-top:12px" onClick={onLeave}>
          {t.t('nav.back')}
        </button>
      </>
    );
  }

  let settlement: Settlement | null = null;
  let problems: string[] = [];
  try {
    settlement = settle(link.ledger);
    problems = checkSettlement(link.ledger, settlement).problems;
  } catch (err) {
    problems = [err instanceof Error ? err.message : String(err)];
  }

  if (settlement === null || problems.length > 0) {
    return (
      <section class="notice warn">
        <h2 style="margin-bottom:6px">{t.t('error.heading')}</h2>
        <p>{t.t('error.body')}</p>
        <details>
          <summary>{t.t('error.details')}</summary>
          <ul>
            {problems.map((p, i) => (
              <li key={i} class="small">
                {p}
              </li>
            ))}
          </ul>
        </details>
      </section>
    );
  }

  return (
    <SharedLedger
      ledger={link.ledger}
      settlement={settlement}
      t={t}
      onAdopt={() => onAdopt({ ...link.ledger, id: `${link.ledger.id}-kopie` })}
    />
  );
}

/**
 * Der anzuzeigende Name eines Anlasses.
 *
 * Ist keiner vergeben, wird er aus dem Datum gebildet — **beim Zeichnen**, nicht
 * beim Anlegen. Nur so wechselt er die Sprache mit, wenn der Leser sie umstellt.
 */
function displayTitle(ledger: Ledger, t: ReturnType<typeof createTranslator>): string {
  if (ledger.title.trim() !== '') return ledger.title;
  const date = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long' }).format(
    new Date(ledger.createdAt),
  );
  return t.t('event.untitled', { date });
}

interface EventViewProps {
  store: AppStore;
  ledger: Ledger;
  t: ReturnType<typeof createTranslator>;
  newName: string;
  setNewName: (v: string) => void;
  onShowResult: () => void;
}

function EventView({ store, ledger, t, newName, setNewName, onShowResult }: EventViewProps) {
  const money = (c: number): string => formatAmount(c, t.locale, ledger.currency);
  const expenses = ledger.entries.filter((e) => e.kind === 'expense');
  const total = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <>
      <h1>
        <input
          type="text"
          value={ledger.title}
          placeholder={displayTitle(ledger, t)}
          aria-label={t.t('event.rename')}
          style="font:inherit;background:transparent;border:none;padding:0;width:100%;color:inherit"
          onInput={(e) => {
            store.clearUndo();
            store.write({ ...ledger, title: (e.target as HTMLInputElement).value });
          }}
        />
      </h1>
      <div class="line" style="margin-bottom:4px">
        <span class="small muted num grow">
          {t.t('event.count', { count: expenses.length })}
          {expenses.length > 0 ? ` · ${t.t('event.total')} ${money(total)}` : ''}
        </span>
        <CurrencyPicker
          id="currency"
          value={ledger.currency}
          t={t}
          onChange={(currency) => {
            store.clearUndo();
            store.write({ ...ledger, currency });
          }}
        />
      </div>
      {/* Ein Wechsel rechnet nichts um. Das muss dastehen, statt still zu passieren (F16). */}
      {ledger.entries.length > 0 && (
        <p class="small muted" style="margin:0 0 8px">
          {t.t('currency.changeWarning')}
        </p>
      )}

      <section class="card" aria-labelledby="people-heading">
        <h2 id="people-heading">{t.t('people.heading')}</h2>
        <div class="chips">
          {ledger.people.map((p) => (
            <span key={p.id} class="chip" style="cursor:default">
              <input
                type="text"
                value={p.name}
                aria-label={p.name}
                style="background:transparent;border:none;width:7ch;padding:0"
                onChange={(e) => {
                  store.clearUndo();
                  store.write(renamePerson(ledger, p.id, (e.target as HTMLInputElement).value));
                }}
              />
              {canRemovePerson(ledger, p.id) && (
                <button
                  type="button"
                  class="link"
                  aria-label={`${p.name} — ${t.t('entry.delete')}`}
                  onClick={() => {
                    store.clearUndo();
                    store.write(removePerson(ledger, p.id));
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>

        <form
          class="row"
          style="margin-top:10px"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim() === '') return;
            store.clearUndo();
            store.write(addPerson(ledger, newName));
            setNewName('');
          }}
        >
          <input
            type="text"
            style="flex:1;min-width:120px;background:var(--bg);border:1px solid var(--border);border-radius:11px;padding:11px 12px;min-height:44px"
            placeholder={t.t('people.namePlaceholder')}
            aria-label={t.t('people.add')}
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
          />
          <button type="submit">{t.t('people.add')}</button>
        </form>
        <p class="small muted" style="margin:8px 0 0">
          {t.t('people.hint')}
        </p>
      </section>

      {/*
       * Die Sicherungsaufforderung (F9).
       *
       * Sie tritt deutlich auf, aber **genau einmal je Anlass** — erst wenn wirklich
       * etwas zu verlieren ist und nur solange nie geteilt wurde. Der Abend-Fall mit
       * zwei Ausgaben sieht sie nie. Von innen heraus kann die App nichts gegen das
       * Aufräumen des Browsers tun; der einzige echte Schutz ist, dass die Daten
       * woanders liegen.
       */}
      {shouldAskForBackup({
        entryCount: ledger.entries.length,
        everShared: store.state.shared.has(ledger.id),
        alreadyAsked: store.wasBackupAsked(ledger.id),
      }) && (
        <section class="notice" aria-labelledby="backup-heading">
          <h2 id="backup-heading" class="plain">
            {t.t('backup.heading')}
          </h2>
          <p style="margin:0 0 10px">{t.t('backup.body')}</p>
          <div class="row">
            <button
              type="button"
              class="primary"
              onClick={() => {
                store.markBackupAsked(ledger.id);
                onShowResult();
              }}
            >
              {t.t('backup.share')}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadFile(
                  safeFileName(displayTitle(ledger, t), 'json'),
                  toJson(ledger),
                  'application/json',
                );
                store.markBackupAsked(ledger.id);
              }}
            >
              {t.t('backup.download')}
            </button>
            <button type="button" class="ghost" onClick={() => store.markBackupAsked(ledger.id)}>
              {t.t('backup.later')}
            </button>
          </div>
        </section>
      )}

      {ledger.people.length < 2 && <p class="notice">{t.t('people.needTwo')}</p>}

      <section class="card" aria-labelledby="entries-heading">
        <h2 id="entries-heading">{t.t('event.count', { count: expenses.length })}</h2>
        {ledger.entries.length === 0 ? (
          <>
            <p style="margin:0">{t.t('event.empty.title')}</p>
            <p class="muted small" style="margin:4px 0 0">
              {t.t('event.empty.hint')}
            </p>
          </>
        ) : (
          <ul class="entries">
            {[...ledger.entries].reverse().map((e) => {
              const payer = ledger.people.find((p) => p.id === e.payerId)?.name ?? '?';
              const involved = ledger.people.filter((p) => (e.weights[p.id] ?? 0) > 0).length;
              // Ohne Beschreibung darf eine Ausgabe nicht „Rückzahlung" heißen —
              // weder sichtbar noch für Vorleseprogramme.
              const label =
                e.description || (e.kind === 'repayment' ? t.t('repayment.label') : t.t('entry.unnamed'));
              return (
                <li key={e.id} class={e.kind === 'repayment' ? 'repay' : undefined}>
                  <span class="entry-main">
                    <span class="entry-desc">
                      {e.description || (e.kind === 'repayment' ? t.t('repayment.label') : '—')}
                    </span>
                    <span class="entry-meta">
                      {t.t('entry.paidBy')} {payer} · {involved}/{ledger.people.length}
                      {/* Der Kurs gehört sichtbar an die Ausgabe — sonst steht da
                          nach drei Tagen eine Zahl, deren Herkunft niemand kennt. */}
                      {e.fx && (
                        <>
                          {' · '}
                          {t.t('currency.converted', {
                            foreign: formatAmount(e.fx.foreignAmount, t.locale, e.fx.currency),
                            rate: e.fx.rate,
                            amount: formatAmount(e.amount, t.locale, ledger.currency),
                          })}
                        </>
                      )}
                    </span>
                  </span>
                  <span class="entry-amount num">{money(e.amount)}</span>
                  <button
                    type="button"
                    class="link"
                    aria-label={`${label} ${money(e.amount)} — ${t.t('entry.delete')}`}
                    onClick={() => {
                      store.clearUndo();
                      const removed = e;
                      store.write(removeEntry(ledger, e.id), {
                        label: t.t('entry.deleted'),
                        restore: () => {
                          const now = store.current;
                          if (!now) return;
                          store.write({ ...now, entries: [...now.entries, removed] });
                        },
                      });
                    }}
                  >
                    {t.t('entry.delete')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" class="primary" style="width:100%" onClick={onShowResult} disabled={ledger.people.length < 2}>
        {t.t('result.heading')}
      </button>
    </>
  );
}

function ResultView({
  ledger,
  t,
  store,
  onBack,
}: {
  ledger: Ledger;
  t: ReturnType<typeof createTranslator>;
  store: AppStore;
  onBack: () => void;
}) {
  // Die Laufzeitprüfung aus F15: Schlägt eine Invariante an, werden **keine Zahlen**
  // gezeigt. Halb richtige Beträge wären schlimmer als gar keine.
  let settlement: Settlement | null = null;
  let problems: string[] = [];
  try {
    settlement = settle(ledger);
    problems = checkSettlement(ledger, settlement).problems;
  } catch (err) {
    problems = [err instanceof Error ? err.message : String(err)];
  }

  return (
    <>
      <button type="button" class="ghost no-print" onClick={onBack}>
        ← {t.t('nav.back')}
      </button>
      <h1>{displayTitle(ledger, t)}</h1>

      {settlement === null || problems.length > 0 ? (
        <section class="notice warn">
          <h2 style="margin-bottom:6px">{t.t('error.heading')}</h2>
          <p>{t.t('error.body')}</p>
          <details>
            <summary>{t.t('error.details')}</summary>
            <ul>
              {problems.map((p, i) => (
                <li key={i} class="small">
                  {p}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <>
          <ResultScreen
            ledger={ledger}
            settlement={settlement}
            t={t}
            onMarkPaid={(fromId, toId, amount) => {
              store.clearUndo();
              const next = addEntry(ledger, {
                amount,
                payerId: fromId,
                weights: { [toId]: 1 },
                description: '',
                mode: 'exact',
                kind: 'repayment',
              });
              const created = next.entries[next.entries.length - 1]!;
              store.write(next, {
                label: t.t('result.transfer', {
                  from: ledger.people.find((p) => p.id === fromId)?.name ?? '?',
                  amount: formatAmount(amount, t.locale, ledger.currency),
                  to: ledger.people.find((p) => p.id === toId)?.name ?? '?',
                }),
                restore: () => store.write(removeEntry(store.current ?? ledger, created.id)),
              });
            }}
          />
          <ShareSheet
            ledger={ledger}
            settlement={settlement}
            t={t}
            title={displayTitle(ledger, t)}
            onShared={() => store.markShared(ledger.id)}
          />
        </>
      )}
    </>
  );
}
