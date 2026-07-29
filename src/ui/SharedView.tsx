/**
 * Was jemand sieht, der einen geteilten Link öffnet.
 *
 * Das ist die wichtigste Ansicht des ganzen Werkzeugs: Sie wird von Leuten
 * gesehen, die Collective-Calc nie selbst geöffnet haben und kein Konto anlegen
 * mussten. Genau hier liegt der Unterschied zur Konkurrenz — und genau hier
 * entscheidet sich, ob jemand der Abrechnung glaubt.
 *
 * Deshalb (F10): Ein Ergebnis-Link enthält keine Rohdaten und ist damit von
 * Natur aus nur lesbar. Ein Übergabe-Link trägt den ganzen Anlass; ihn zu
 * bearbeiten ist ein **bewusster** Schritt mit klarer Ansage, dass daraus eine
 * getrennte Kopie wird.
 */

import type { ResultView } from '../core/codec.js';
import type { Ledger, Settlement } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import { formatAmount, formatSigned } from '../core/amount.js';
import { ResultScreen } from './ResultScreen.js';

const WHEEL_URL = 'https://dennismit2n.github.io/dreh-das-rad/';

export function SharedResult({ result, t }: { result: ResultView; t: Translator }) {
  const money = (c: number): string => formatAmount(c, t.locale, result.currency);
  const name = (i: number): string => result.names[i] ?? '?';

  return (
    <>
      <h1>{result.title}</h1>
      <p class="notice small">{t.t('share.readOnlyNotice')}</p>

      <section class="card" aria-labelledby="shared-balances">
        <h2 id="shared-balances">{t.t('result.heading')}</h2>
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
            {result.summaries.map((s, i) => {
              const zero = s.balance === 0;
              const positive = s.balance > 0;
              return (
                <tr key={i}>
                  <th scope="row" style="font-weight:600">
                    {name(i)}
                  </th>
                  {/* Die zwei Zusatzzahlen aus F10 — damit jeder seinen Saldo im Kopf
                      nachrechnen kann, statt ihn glauben zu müssen. */}
                  <td class="small muted num">
                    {t.t('result.paidAndShare', { paid: money(s.paid), share: money(s.share) })}
                  </td>
                  <td class={'amount num ' + (zero ? 'muted' : positive ? 'credit' : 'debit')}>
                    <span class="small" style="font-weight:400">
                      {zero ? t.t('result.settled') : positive ? t.t('result.getsShort') : t.t('result.owesShort')}{' '}
                    </span>
                    {zero ? '' : formatSigned(s.balance, t.locale, result.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section class="card" aria-labelledby="shared-transfers">
        <h2 id="shared-transfers">{t.t('result.transferCount', { count: result.transfers.length })}</h2>
        {result.transfers.length === 0 ? (
          <p class="muted">{t.t('result.noTransfers')}</p>
        ) : (
          <ol class="transfers">
            {result.transfers.map((tr, i) => (
              <li key={i}>
                <span style="font-weight:600">{name(tr.from)}</span>
                <span class="arrow" aria-hidden="true">
                  →
                </span>
                <span style="font-weight:600">{name(tr.to)}</span>
                <span class="spacer" />
                <span class="num" style="font-weight:650">
                  {money(tr.amount)}
                </span>
                <span class="skip">
                  {t.t('result.transfer', {
                    from: name(tr.from),
                    amount: money(tr.amount),
                    to: name(tr.to),
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.remainders.length > 0 && (
        <section class="notice" aria-labelledby="shared-remainder">
          <h2 id="shared-remainder" style="margin-bottom:6px">
            {t.t('remainder.heading')}
          </h2>
          <ul style="margin:0 0 8px;padding-left:18px">
            {result.remainders.map((r, i) => (
              <li key={i} class="num">
                {r.direction === 'receives-less'
                  ? t.t('remainder.receivesLess', { name: name(r.person), amount: money(r.amount) })
                  : t.t('remainder.paysLess', { name: name(r.person), amount: money(r.amount) })}
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
        {t.t('event.total')}: {money(result.totalExpenses)}
      </p>
    </>
  );
}

export function SharedLedger({
  ledger,
  settlement,
  t,
  onAdopt,
}: {
  ledger: Ledger;
  settlement: Settlement;
  t: Translator;
  onAdopt: () => void;
}) {
  return (
    <>
      <h1>{ledger.title}</h1>
      <p class="notice small">{t.t('share.readOnlyNotice')}</p>
      <ResultScreen ledger={ledger} settlement={settlement} t={t} />
      <button type="button" class="primary no-print" style="width:100%;margin-top:12px" onClick={onAdopt}>
        {t.t('share.openCopy')}
      </button>
    </>
  );
}
