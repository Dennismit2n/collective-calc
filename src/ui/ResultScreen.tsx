/**
 * Die Ergebnisansicht.
 *
 * Nachvollziehbarkeit entsteht am Saldo, nicht an der Überweisung (F14): Wer
 * „du bist mit 43,20 € im Minus" liest und darunter „überweise 43,20 € an Ben",
 * versteht das auch dann, wenn Ben gar nicht der ist, für den er mitbezahlt hat.
 * Deshalb steht die Saldo-Tabelle **vor** der Überweisungsliste.
 *
 * Farbe trägt Bedeutung, aber nie allein (F26): Grün und Bernstein stehen immer
 * zusammen mit Vorzeichen und Wort.
 */

import { useState } from 'preact/hooks';

import type { Ledger, Settlement } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import { formatAmount, formatExact, formatSigned } from '../core/amount.js';
import { summaryText } from './summaryText.js';

const WHEEL_URL = 'https://dennismit2n.github.io/dreh-das-rad/';

interface Props {
  ledger: Ledger;
  settlement: Settlement;
  t: Translator;
  /**
   * Trägt eine Überweisung als geleistet ein (F6).
   *
   * Die Beschriftung lautet bewusst **„als bezahlt eintragen"** und nicht
   * „erledigt": Da nur der Kassenwart schreibt, kann die App gar nicht wissen,
   * ob überwiesen wurde. Der Haken protokolliert eine Handlung des Kassenwarts —
   * er behauptet nichts über die Welt.
   *
   * Fehlt die Funktion (etwa in einer geteilten Ansicht), erscheint kein Knopf.
   */
  onMarkPaid?: (fromId: string, toId: string, amount: number) => void;
}

export function ResultScreen({ ledger, settlement, t, onMarkPaid }: Props) {
  const [exactFor, setExactFor] = useState<string | null>(null);
  const nameOf = (id: string): string => ledger.people.find((p) => p.id === id)?.name ?? '?';
  const money = (c: number): string => formatAmount(c, t.locale, ledger.currency);

  return (
    <>
      <section class="card" aria-labelledby="balances-heading">
        <h2 id="balances-heading">{t.t('result.heading')}</h2>

        <table class="result">
          <thead>
            <tr>
              <th scope="col">{t.t('result.columnPerson')}</th>
              <th scope="col">{t.t('result.columnPaidShare')}</th>
              <th scope="col" style="text-align:right">
                {t.t('result.columnBalance')}
              </th>
            </tr>
          </thead>
          <tbody>
            {settlement.summaries.map((s) => {
              const positive = s.balance > 0;
              const zero = s.balance === 0;
              return (
                <tr key={s.personId}>
                  <th scope="row" style="font-weight:600">
                    {nameOf(s.personId)}
                  </th>
                  <td class="small muted num">{summaryText(s, t, money)}</td>
                  <td class={'amount num ' + (zero ? 'muted' : positive ? 'credit' : 'debit')}>
                    <button
                      type="button"
                      class="link"
                      style="color:inherit;text-decoration:none;font:inherit"
                      onClick={() => setExactFor(exactFor === s.personId ? null : s.personId)}
                      aria-expanded={exactFor === s.personId}
                      /* Ohne eigenen Namen hörte ein Vorleseprogramm hier nur „+6,66 €"
                         — ohne Person, ohne Richtung, ohne Zweck des Knopfes. */
                      aria-label={
                        zero
                          ? `${nameOf(s.personId)}: ${t.t('result.settled')}`
                          : t.t(positive ? 'result.personGets' : 'result.personOwes', {
                              name: nameOf(s.personId),
                              amount: money(Math.abs(s.balance)),
                            })
                      }
                    >
                      <span class="small" style="font-weight:400">
                        {zero
                          ? t.t('result.settled')
                          : positive
                            ? t.t('result.getsShort')
                            : t.t('result.owesShort')}{' '}
                      </span>
                      {zero ? '' : formatSigned(s.balance, t.locale, ledger.currency)}
                    </button>
                    {exactFor === s.personId && (
                      <div class="small muted num" style="font-weight:400">
                        {t.t('result.exactValue', {
                          value: formatExact(s.exactBalance.n, s.exactBalance.d, t.locale),
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="small muted" style="margin:10px 0 0">
          {t.t('result.exactHint')}
        </p>
      </section>

      <section class="card" aria-labelledby="transfers-heading">
        <h2 id="transfers-heading">
          {t.t('result.transferCount', { count: settlement.transfers.length })}
        </h2>
        {settlement.transfers.length === 0 ? (
          <p class="muted">{t.t('result.noTransfers')}</p>
        ) : (
          <ol class="transfers">
            {settlement.transfers.map((tr, i) => (
              <li key={i}>
                <span style="font-weight:600">{nameOf(tr.fromId)}</span>
                <span class="arrow" aria-hidden="true">
                  →
                </span>
                <span style="font-weight:600">{nameOf(tr.toId)}</span>
                <span class="spacer" />
                <span class="num" style="font-weight:650">
                  {money(tr.amount)}
                </span>
                <span class="skip">
                  {t.t('result.transfer', {
                    from: nameOf(tr.fromId),
                    amount: money(tr.amount),
                    to: nameOf(tr.toId),
                  })}
                </span>
                {onMarkPaid && (
                  <button
                    type="button"
                    class="link small no-print"
                    aria-label={`${t.t('result.transfer', {
                      from: nameOf(tr.fromId),
                      amount: money(tr.amount),
                      to: nameOf(tr.toId),
                    })} — ${t.t('repayment.markPaid')}`}
                    onClick={() => onMarkPaid(tr.fromId, tr.toId, tr.amount)}
                  >
                    {t.t('repayment.markPaid')}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {onMarkPaid && settlement.transfers.length > 0 && (
          <p class="small muted" style="margin:10px 0 0">
            {t.t('repayment.hint')}
          </p>
        )}
      </section>

      {/* Der offene Rest (F12): wird niemandem untergeschoben, sondern benannt. */}
      {settlement.remainders.length > 0 && (
        <section class="notice" aria-labelledby="remainder-heading">
          <h2 id="remainder-heading" style="margin-bottom:6px">
            {t.t('remainder.heading')}
          </h2>
          <ul style="margin:0 0 8px;padding-left:18px">
            {settlement.remainders.map((r) => (
              <li key={r.personId} class="num">
                {r.direction === 'receives-less'
                  ? t.t('remainder.receivesLess', { name: nameOf(r.personId), amount: money(r.amount) })
                  : t.t('remainder.paysLess', { name: nameOf(r.personId), amount: money(r.amount) })}
              </li>
            ))}
          </ul>
          <p style="margin:0">{t.t('remainder.explain')}</p>
          <p style="margin:6px 0 0" class="small">
            <a href={WHEEL_URL} target="_blank" rel="noopener">
              {t.t('remainder.wheel')}
            </a>
          </p>
        </section>
      )}

      <p class="small muted num">
        {t.t('event.total')}: {money(settlement.totalExpenses)} ·{' '}
        {t.t('event.count', { count: ledger.entries.filter((e) => e.kind === 'expense').length })}
      </p>
    </>
  );
}
