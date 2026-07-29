/**
 * Währungswahl (F16): kurze Liste plus Freifeld.
 *
 * Keine Liste mit hundertsechzig Einträgen, durch die man scrollt — aber auch
 * keine Sackgasse für die, deren Reiseziel nicht in der Kurzliste steht.
 *
 * Das Freifeld weist Währungen ohne Untereinheit ausdrücklich ab. Der Grund
 * steht in `currency.ts`: Das ganze Programm rechnet in Hundertsteln, und bei
 * Yen wären alle Beträge still um den Faktor hundert daneben. Lieber eine klare
 * Absage als eine falsche Abrechnung.
 */

import { useState } from 'preact/hooks';

import type { Translator } from '../i18n/index.js';
import { COMMON_CURRENCIES, isValidCurrencyCode } from '../core/currency.js';

const OTHER = '__other__';

interface Props {
  value: string;
  onChange: (currency: string) => void;
  t: Translator;
  id: string;
}

export function CurrencyPicker({ value, onChange, t, id }: Props) {
  const known = (COMMON_CURRENCIES as readonly string[]).includes(value);
  const [showFree, setShowFree] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function apply(): void {
    const code = draft.trim().toUpperCase();
    if (code === '') return;
    if (!isValidCurrencyCode(code)) {
      setError(t.t('currency.unsupported'));
      return;
    }
    onChange(code);
    setShowFree(false);
    setDraft('');
    setError(null);
  }

  return (
    <>
      <label class="skip" for={id}>
        {t.t('currency.label')}
      </label>
      <select
        id={id}
        value={showFree ? OTHER : value}
        onChange={(e) => {
          const next = (e.target as HTMLSelectElement).value;
          if (next === OTHER) {
            setShowFree(true);
            setError(null);
          } else {
            setShowFree(false);
            onChange(next);
          }
        }}
      >
        {/* Eine selbst eingetragene Währung muss in der Liste auftauchen,
            sonst verschwindet die eigene Wahl beim nächsten Zeichnen. */}
        {!known && <option value={value}>{value}</option>}
        {COMMON_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER}>{t.t('currency.other')}</option>
      </select>

      {showFree && (
        <span class="line">
          <input
            type="text"
            maxLength={3}
            autocomplete="off"
            style="width:6.5ch;text-transform:uppercase;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-height:44px"
            aria-label={t.t('currency.other')}
            placeholder={t.t('currency.otherPlaceholder')}
            value={draft}
            onInput={(e) => {
              setDraft((e.target as HTMLInputElement).value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
          <button type="button" onClick={apply}>
            {t.t('entry.add')}
          </button>
        </span>
      )}

      {error !== null && (
        <p class="small" style="margin:6px 0 0;color:var(--debit)" role="status">
          {error}
        </p>
      )}
    </>
  );
}
