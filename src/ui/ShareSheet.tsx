/**
 * Teilen und Exportieren (F10, F11).
 *
 * Zwei ausdrücklich getrennte Linkarten, damit der Nutzer entscheidet, wie viel
 * sein Gerät verlässt — nicht eine Größengrenze. Und: **Das Teilen scheitert nie
 * still.** Wird ein Link zu lang für die üblichen Messenger, steht das da, samt
 * Ausweichweg.
 */

import { useEffect, useState } from 'preact/hooks';

import type { Ledger, Settlement } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import type { ShareLink } from '../core/share.js';
import { baseUrl, buildFullLink, buildResultLink, copyToClipboard, shareOrCopy } from '../core/share.js';
import { downloadFile, safeFileName, toCsv, toJson } from '../core/exportFile.js';
import { QrCode } from './QrCode.js';

type Which = 'result' | 'full';

interface Props {
  ledger: Ledger;
  settlement: Settlement;
  t: Translator;
  title: string;
  onShared: () => void;
}

export function ShareSheet({ ledger, settlement, t, title, onShared }: Props) {
  const [which, setWhich] = useState<Which>('result');
  const [link, setLink] = useState<ShareLink | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const base = baseUrl(window.location);
    const build = which === 'result' ? buildResultLink(base, ledger, settlement) : buildFullLink(base, ledger);
    void build.then((result) => {
      if (!cancelled) setLink(result);
    });
    return () => {
      cancelled = true;
    };
  }, [which, ledger, settlement]);

  async function doShare(): Promise<void> {
    if (!link) return;
    const outcome = await shareOrCopy(link.url, title);
    if (outcome !== 'failed') {
      onShared();
      setMessage(outcome === 'copied' ? t.t('share.copied') : '');
    }
  }

  return (
    <section class="card no-print" aria-labelledby="share-heading">
      <h2 id="share-heading">{t.t('share.result')}</h2>

      <div class="row" role="group" aria-label={t.t('share.result')}>
        <button
          type="button"
          class="chip"
          aria-pressed={which === 'result'}
          onClick={() => {
            setWhich('result');
            setShowQr(false);
          }}
        >
          {t.t('share.result')}
        </button>
        <button
          type="button"
          class="chip"
          aria-pressed={which === 'full'}
          onClick={() => {
            setWhich('full');
            setShowQr(false);
          }}
        >
          {t.t('share.full')}
        </button>
      </div>

      <p class="small muted" style="margin:8px 0">
        {which === 'result' ? t.t('share.resultHint') : t.t('share.fullHint')}
      </p>

      {link !== null && !link.safe && (
        <p class="notice warn small" role="status">
          {t.t('share.tooLarge')}
        </p>
      )}

      <div class="row">
        <button type="button" class="primary" disabled={link === null} onClick={() => void doShare()}>
          {t.t('backup.share')}
        </button>
        <button
          type="button"
          disabled={link === null}
          onClick={() => {
            if (!link) return;
            void copyToClipboard(link.url).then((ok) => {
              if (ok) {
                onShared();
                setMessage(t.t('share.copied'));
              }
            });
          }}
        >
          {t.t('share.copy')}
        </button>
        <button
          type="button"
          disabled={link === null || !link.qrPossible}
          aria-expanded={showQr}
          onClick={() => setShowQr(!showQr)}
        >
          {t.t('share.qr')}
        </button>
      </div>

      <p class="hint" role="status" aria-live="polite">
        {message}
      </p>

      {showQr && link !== null && link.qrPossible && (
        <div style="margin:10px 0">
          <QrCode value={link.url} label={t.t('share.qrAlt', { url: link.url })} />
        </div>
      )}

      <h2 style="margin-top:18px">{t.t('export.heading')}</h2>
      <div class="row">
        <button
          type="button"
          onClick={() => downloadFile(safeFileName(title, 'json'), toJson(ledger), 'application/json')}
        >
          {t.t('export.json')}
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(safeFileName(title, 'csv'), toCsv(ledger, settlement, t.locale), 'text/csv')
          }
        >
          {t.t('export.csv')}
        </button>
        <button type="button" onClick={() => window.print()}>
          {t.t('export.print')}
        </button>
      </div>
      <p class="small muted" style="margin:8px 0 0">
        {t.t('export.jsonHint')} · {t.t('export.csvHint')}
      </p>
    </section>
  );
}
