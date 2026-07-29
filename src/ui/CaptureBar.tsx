/**
 * Die dauerhaft sichtbare Erfassungszeile (F23).
 *
 * Der Weg vom Bezahlen zum Eintrag soll so kurz wie möglich sein: Handy raus,
 * Zahl tippen, fertig — ohne einen einzigen Navigationsschritt. Deshalb steht die
 * Zeile immer da, das Betragsfeld ist bereit, Zahler und Aufteilung sind vorbelegt,
 * die Beschreibung ist optional.
 *
 * Der Zielkonflikt dabei ist echt: Vorbelegung spart Zeit, aber ein stillschweigend
 * falscher Zahler erzeugt eine Abrechnung, die sauber aussieht und falsch ist.
 * Die Auflösung ist die Bestätigungszeile nach dem Speichern — sie zeigt jedes Mal,
 * **wer** gezahlt hat, ohne dass man es jedes Mal antippen muss.
 */

import { useEffect, useRef, useState } from 'preact/hooks';

import type { Ledger } from '../core/types.js';
import type { Translator } from '../i18n/index.js';
import { formatAmount, parseAmount } from '../core/amount.js';
import type { NewEntry } from '../app/state.js';
import { recentDescriptions } from '../app/state.js';
import type { SplitState } from './SplitEditor.js';
import { initialSplit, SplitEditor, toWeights } from './SplitEditor.js';

interface Props {
  ledger: Ledger;
  t: Translator;
  /** Wer ist "ich"? Vorbelegung des Zahlers. */
  meId: string | null;
  onAdd: (entry: NewEntry) => void;
}

export function CaptureBar({ ledger, t, meId, onAdd }: Props) {
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitState>(initialSplit);
  const [showSplit, setShowSplit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const people = ledger.people;
  const effectivePayer = payerId ?? meId ?? people[0]?.id ?? null;
  const parsed = parseAmount(amountText);

  // Verschwindet eine Person, darf kein Verweis auf sie hängen bleiben.
  useEffect(() => {
    if (payerId && !people.some((p) => p.id === payerId)) setPayerId(null);
  }, [people, payerId]);

  const canSubmit = parsed !== null && effectivePayer !== null;

  function submit(event: Event): void {
    event.preventDefault();
    if (!canSubmit || !parsed || !effectivePayer) return;

    const result = toWeights(split, people, parsed.cents, t, ledger.currency);
    if ('error' in result) {
      // Aufteilung geht nicht auf — Feld offen lassen und sagen, was fehlt,
      // statt still etwas anderes einzutragen, als der Nutzer meinte.
      setError(result.error);
      setShowSplit(true);
      return;
    }

    onAdd({
      amount: parsed.cents,
      payerId: effectivePayer,
      weights: result.weights,
      description,
      mode: split.mode,
    });

    setAmountText('');
    setDescription('');
    setSplit(initialSplit());
    setShowSplit(false);
    setError(null);
    amountRef.current?.focus();
  }

  const suggestions = recentDescriptions(ledger);
  const splitChanged = split.mode !== 'equal' || split.excluded.size > 0;

  return (
    <form class="capture" onSubmit={submit}>
      <div class="capture-inner">
        <div class="line">
          <input
            ref={amountRef}
            class="amount num"
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autocomplete="off"
            aria-label={t.t('a11y.amountField', { currency: ledger.currency })}
            placeholder={t.t('entry.amountPlaceholder')}
            value={amountText}
            onInput={(e) => setAmountText((e.target as HTMLInputElement).value)}
          />
          <input
            class="grow"
            type="text"
            autocomplete="off"
            aria-label={t.t('entry.description')}
            placeholder={t.t('entry.description')}
            value={description}
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
          />
          <button type="submit" class="primary tight" disabled={!canSubmit}>
            {t.t('entry.add')}
          </button>
        </div>

        {/* Sofortige Rückmeldung, wie die Eingabe gelesen wurde — der eigentliche
            Schutz gegen Zahlendreher und missverstandene Trennzeichen (F18).
            Teilt sich die Zeile mit dem Zugang zur Aufteilung, damit die Leiste
            auf einem Handy nicht die halbe Höhe frisst. */}
        <div class="line">
          <span class="hint num grow" aria-live="polite">
            {parsed
              ? t.t('entry.understoodAs', {
                  amount: formatAmount(parsed.cents, t.locale, ledger.currency),
                })
              : ''}
          </span>
          <button
            type="button"
            class={'link small' + (splitChanged ? ' marked' : '')}
            onClick={() => setShowSplit(!showSplit)}
            aria-expanded={showSplit}
          >
            {/* Sichtbar machen, dass eine abweichende Aufteilung eingestellt ist —
                sonst trägt jemand fünf Ausgaben mit einer alten Einstellung ein. */}
            {splitChanged ? `${t.t('split.change')} •` : t.t('split.change')}
          </button>
        </div>

        {/* Eine Zeile, die seitlich rollt statt umzubrechen — die Höhe der Leiste
            bleibt dadurch gleich, egal wie viele Personen dabei sind. */}
        <div class="line">
          <span class="small muted nowrap">{t.t('entry.paidBy')}</span>
          <div class="chips oneline" role="group" aria-label={t.t('entry.paidBy')}>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                class="chip"
                aria-pressed={p.id === effectivePayer}
                onClick={() => setPayerId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {showSplit && (
          <SplitEditor
            people={people}
            state={split}
            onChange={(next) => {
              setSplit(next);
              setError(null);
            }}
            t={t}
            currency={ledger.currency}
            amountCents={parsed?.cents ?? 0}
            error={error}
          />
        )}

        {suggestions.length > 0 && description === '' && (
          <div class="chips oneline" aria-label={t.t('entry.description')}>
            {suggestions.map((s) => (
              <button key={s} type="button" class="chip" onClick={() => setDescription(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
