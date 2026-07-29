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
  removeEntry,
  removePerson,
  renamePerson,
} from './state.js';
import type { Ledger, Settlement } from '../core/types.js';
import { settle } from '../core/settle.js';
import { checkSettlement } from '../core/invariants.js';
import { formatAmount } from '../core/amount.js';
import { createTranslator, resolveLanguage, SUPPORTED } from '../i18n/index.js';
import { CaptureBar } from '../ui/CaptureBar.js';
import { ResultScreen } from '../ui/ResultScreen.js';

type View = 'event' | 'result' | 'list';

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
        {ledger === null ? (
          <p class="muted">…</p>
        ) : view === 'result' ? (
          <ResultView ledger={ledger} t={t} onBack={() => setView('event')} />
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
      {ledger !== null && view === 'event' && (
        <div class="bottom" ref={bottomRef}>
          {store.state.undo && (
            <div class="toast" role="status">
              <span class="grow">{store.state.undo.label}</span>
              <button type="button" onClick={() => store.state.undo?.restore()}>
                {t.t('entry.undo')}
              </button>
            </div>
          )}
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

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
      <p class="small muted num">
        {t.t('event.count', { count: expenses.length })}
        {expenses.length > 0 ? ` · ${t.t('event.total')} ${money(total)}` : ''}
      </p>

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
  onBack,
}: {
  ledger: Ledger;
  t: ReturnType<typeof createTranslator>;
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
        <ResultScreen ledger={ledger} settlement={settlement} t={t} />
      )}
    </>
  );
}
