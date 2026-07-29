/**
 * Die Anlassliste (F4).
 *
 * Das Datenmodell ist eine Sammlung von Anlässen mit eigenen IDs — die Oberfläche
 * zeigt aber beim Öffnen sofort den zuletzt benutzten. Diese Liste ist der
 * Nebenraum, nicht der Einstieg: Wer den Grillabend in zwanzig Sekunden abrechnen
 * will, soll nicht erst eine Auswahl treffen müssen.
 */

import type { Ledger } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import { formatAmount } from '../core/amount.js';

interface Props {
  ledgers: Ledger[];
  currentId: string | null;
  t: Translator;
  displayTitle: (ledger: Ledger) => string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  /** Anlässe, die sich nicht lesen ließen — Rohdaten bleiben erhalten (F15). */
  broken: Array<{ key: string; problem: string; raw: string }>;
  onExportBroken: (raw: string, key: string) => void;
}

export function EventList({
  ledgers,
  currentId,
  t,
  displayTitle,
  onOpen,
  onCreate,
  onDelete,
  onBack,
  broken,
  onExportBroken,
}: Props) {
  return (
    <>
      <button type="button" class="ghost" onClick={onBack}>
        ← {t.t('nav.back')}
      </button>
      <h1>{t.t('nav.events')}</h1>

      <button type="button" class="primary" style="width:100%;margin-bottom:12px" onClick={onCreate}>
        {t.t('event.new')}
      </button>

      <ul class="entries card" style="padding:4px 16px">
        {ledgers.map((l) => {
          const expenses = l.entries.filter((e) => e.kind === 'expense');
          const total = expenses.reduce((a, e) => a + e.amount, 0);
          const date = new Intl.DateTimeFormat(t.locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).format(new Date(l.createdAt));
          return (
            <li key={l.id}>
              <span class="entry-main">
                <button
                  type="button"
                  class="link"
                  style="color:inherit;text-decoration:none;font:inherit;text-align:left;display:block;width:100%"
                  aria-current={l.id === currentId ? 'true' : undefined}
                  onClick={() => onOpen(l.id)}
                >
                  <span class="entry-desc" style={l.id === currentId ? 'font-weight:700' : 'font-weight:600'}>
                    {displayTitle(l)}
                  </span>
                  <span class="entry-meta">
                    {date} · {t.t('event.count', { count: expenses.length })}
                    {expenses.length > 0 ? ` · ${formatAmount(total, t.locale, l.currency)}` : ''}
                  </span>
                </button>
              </span>
              <button
                type="button"
                class="link"
                aria-label={`${displayTitle(l)} — ${t.t('event.delete')}`}
                onClick={() => {
                  // Der einzige Ort, der ausdrücklich nachfragt: Hier ist auf einen
                  // Schlag alles weg, und ein Rückgängig-Streifen wäre dafür zu wenig (F7).
                  if (window.confirm(t.t('event.deleteConfirm'))) onDelete(l.id);
                }}
              >
                {t.t('event.delete')}
              </button>
            </li>
          );
        })}
      </ul>

      {broken.length > 0 && (
        <section class="notice warn">
          <h2 class="plain">{t.t('error.heading')}</h2>
          <p>{t.t('error.body')}</p>
          <ul>
            {broken.map((b) => (
              <li key={b.key} class="small">
                {b.problem}{' '}
                <button type="button" class="link" onClick={() => onExportBroken(b.raw, b.key)}>
                  {t.t('error.exportRaw')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
