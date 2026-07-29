/**
 * Aufteilung einstellen (F5).
 *
 * Hier zahlt sich die Entscheidung aus, intern **nur Gewichte** zu kennen: Alle
 * vier Arten sind dieselbe Rechnung mit anderer Eingabemaske.
 *
 *   alle gleich    → jeder 1, wer nicht dabei war 0
 *   Anteile        → die Anteilszahl
 *   Prozent        → der Prozentwert
 *   genaue Beträge → der Betrag selbst, in Cent
 *
 * Es gibt deshalb genau eine Rechen- und Rundungsstelle im ganzen Programm, und
 * die ist erschöpfend getestet.
 *
 * Zwei Arten brauchen trotzdem eine Prüfung, weil der Nutzer sich verrechnen kann:
 * Prozente müssen 100 ergeben, genaue Beträge müssen den Ausgabebetrag treffen.
 * Sonst hieße „genau" eben nicht genau.
 */

import type { Person, SplitMode } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import { formatAmount, parseAmount } from '../core/amount.js';

export interface SplitState {
  mode: SplitMode;
  /** Rohtext je Person, wie eingetippt — erst beim Übernehmen zu Gewichten verrechnet. */
  values: Record<string, string>;
  /** Nur für „alle gleich": wer ist nicht dabei. */
  excluded: Set<string>;
}

export function initialSplit(): SplitState {
  return { mode: 'equal', values: {}, excluded: new Set() };
}

/**
 * Rechnet den Eingabezustand in Gewichte um.
 * Gibt eine Fehlermeldung zurück, wenn die Eingabe nicht aufgeht.
 */
export function toWeights(
  state: SplitState,
  people: Person[],
  amountCents: number,
  t: Translator,
  currency: string,
): { weights: Record<string, number> } | { error: string } {
  const weights: Record<string, number> = {};

  if (state.mode === 'equal') {
    for (const p of people) weights[p.id] = state.excluded.has(p.id) ? 0 : 1;
    if (people.every((p) => state.excluded.has(p.id))) return { error: t.t('split.nobody') };
    return { weights };
  }

  if (state.mode === 'shares') {
    let any = false;
    for (const p of people) {
      const raw = (state.values[p.id] ?? '').trim();
      const n = raw === '' ? 0 : Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return { error: t.t('split.nobody') };
      // Anteile dürfen halbe sein („zählt anderthalb"), intern wird verzehnfacht,
      // damit alles ganzzahlig bleibt.
      weights[p.id] = Math.round(n * 10);
      if (weights[p.id]! > 0) any = true;
    }
    if (!any) return { error: t.t('split.nobody') };
    return { weights };
  }

  if (state.mode === 'percent') {
    let sum = 0;
    for (const p of people) {
      const raw = (state.values[p.id] ?? '').trim();
      const n = raw === '' ? 0 : Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return { error: t.t('split.nobody') };
      weights[p.id] = Math.round(n * 100); // Hundertstel Prozent, damit 33,33 % geht
      sum += weights[p.id]!;
    }
    if (sum === 0) return { error: t.t('split.nobody') };
    if (sum !== 10_000) {
      return {
        error: t.t('split.sumMismatch', {
          sum: `${(sum / 100).toLocaleString(t.locale, { maximumFractionDigits: 2 })} %`,
          total: '100 %',
        }),
      };
    }
    return { weights };
  }

  // Genaue Beträge: Das Gewicht ist der Betrag selbst. Die Summe muss exakt
  // den Ausgabebetrag ergeben — sonst wäre „genau" eine Behauptung.
  let sum = 0;
  for (const p of people) {
    const raw = (state.values[p.id] ?? '').trim();
    const parsed = raw === '' ? null : parseAmount(raw);
    const cents = parsed?.cents ?? 0;
    weights[p.id] = cents;
    sum += cents;
  }
  if (sum === 0) return { error: t.t('split.nobody') };
  if (sum !== amountCents) {
    return {
      error: t.t('split.sumMismatch', {
        sum: formatAmount(sum, t.locale, currency),
        total: formatAmount(amountCents, t.locale, currency),
      }),
    };
  }
  return { weights };
}

interface Props {
  people: Person[];
  state: SplitState;
  onChange: (next: SplitState) => void;
  t: Translator;
  currency: string;
  /** Der eingetippte Ausgabebetrag — nötig für die Prüfung der genauen Beträge. */
  amountCents: number;
  error: string | null;
}

const MODES: Array<{ mode: SplitMode; key: 'split.equal' | 'split.shares' | 'split.percent' | 'split.exact' }> = [
  { mode: 'equal', key: 'split.equal' },
  { mode: 'shares', key: 'split.shares' },
  { mode: 'exact', key: 'split.exact' },
  { mode: 'percent', key: 'split.percent' },
];

export function SplitEditor({ people, state, onChange, t, currency, amountCents, error }: Props) {
  const setValue = (id: string, value: string): void =>
    onChange({ ...state, values: { ...state.values, [id]: value } });

  return (
    <div class="split-editor">
      <div class="chips oneline" role="group" aria-label={t.t('split.change')}>
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            class="chip"
            aria-pressed={state.mode === m.mode}
            onClick={() => onChange({ ...state, mode: m.mode })}
          >
            {t.t(m.key)}
          </button>
        ))}
      </div>

      {state.mode === 'equal' ? (
        <div class="line" style="margin-top:8px">
          <span class="small muted nowrap">{t.t('split.participants')}</span>
          <div class="chips oneline" role="group" aria-label={t.t('split.participants')}>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                class={'chip' + (state.excluded.has(p.id) ? ' off' : '')}
                aria-pressed={!state.excluded.has(p.id)}
                onClick={() => {
                  const excluded = new Set(state.excluded);
                  if (excluded.has(p.id)) excluded.delete(p.id);
                  else excluded.add(p.id);
                  onChange({ ...state, excluded });
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div class="person-values">
            {people.map((p) => (
              <label key={p.id} class="person-value">
                <span class="small muted">{p.name}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autocomplete="off"
                  class="num"
                  /* Ohne eigenen Namen hört ein Vorleseprogramm bei allen drei
                     Feldern nur den Platzhalter „0,00" — und weiß nicht, wessen
                     Betrag es gerade eintippt. */
                  aria-label={`${p.name} — ${t.t(
                    state.mode === 'shares'
                      ? 'split.shares'
                      : state.mode === 'percent'
                        ? 'split.percent'
                        : 'split.exact',
                  )}`}
                  value={state.values[p.id] ?? ''}
                  placeholder={state.mode === 'percent' ? '%' : state.mode === 'shares' ? '1' : '0,00'}
                  onInput={(e) => setValue(p.id, (e.target as HTMLInputElement).value)}
                />
              </label>
            ))}
          </div>
          {state.mode === 'shares' && (
            <p class="small muted" style="margin:6px 0 0">
              {t.t('split.sharesHint')}
            </p>
          )}
        </>
      )}

      {error !== null && (
        <p class="small" style="margin:8px 0 0;color:var(--debit)" role="status">
          {error}
        </p>
      )}
      {state.mode === 'exact' && amountCents > 0 && (
        <p class="small muted num" style="margin:6px 0 0">
          {formatAmount(amountCents, t.locale, currency)}
        </p>
      )}
    </div>
  );
}
