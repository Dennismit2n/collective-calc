/**
 * Exakte Bruchrechnung auf BigInt-Basis.
 *
 * Warum: Collective-Calc rundet laut Entscheidung F13 **genau einmal** — ganz am Ende,
 * bei den Salden. Bis dahin muss jeder Zwischenwert exakt bleiben, auch wenn ein Betrag
 * durch drei geteilt wird. Fließkommazahlen scheiden dafür aus (0.1 + 0.2 !== 0.3),
 * und Ganzzahl-Cent allein reichen nicht, weil ein Anteil eben kein ganzer Cent ist.
 *
 * Alle Werte in diesem Modul sind in **Cent** gedacht, nicht in Euro.
 */

/** Ein gekürzter Bruch. Nenner immer > 0, Vorzeichen steckt im Zähler. */
export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Erzeugt einen gekürzten Bruch. */
export function rat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error('rational: Nenner darf nicht 0 sein');
  let nn = n;
  let dd = d;
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  if (nn === 0n) return ZERO;
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
}

export const ZERO: Rat = { n: 0n, d: 1n };

export function fromInt(v: number | bigint): Rat {
  return { n: BigInt(v), d: 1n };
}

export function add(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function isZero(a: Rat): boolean {
  return a.n === 0n;
}

/** -1 wenn a < b, 0 bei Gleichheit, 1 wenn a > b */
export function cmp(a: Rat, b: Rat): -1 | 0 | 1 {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l === r ? 0 : l < r ? -1 : 1;
}

function abs(a: Rat): Rat {
  return a.n < 0n ? { n: -a.n, d: a.d } : a;
}

/**
 * Abschneiden **zur Null hin**: 3.9 -> 3, -3.9 -> -3.
 *
 * Genau diese Richtung ist gewollt (F12): Niemand soll durch Rundung mehr schulden
 * oder mehr bekommen, als ihm rechnerisch zusteht. Was dabei liegen bleibt, wird
 * später offen ausgewiesen statt jemandem untergeschoben.
 */
export function truncToward0(a: Rat): bigint {
  return a.n / a.d; // BigInt-Division schneidet bereits zur Null hin ab
}

/**
 * Der abgeschnittene Rest als nicht-negativer Bruch: |a| - |trunc(a)|.
 * Immer in [0, 1).
 */
export function truncatedPart(a: Rat): Rat {
  const t = truncToward0(a);
  return abs(sub(a, { n: t, d: 1n }));
}

/*
 * Bewusst nicht vorhanden: mul, div, neg, sign, eq, toNumber, toString.
 *
 * Die hatte ich zunächst mitgeschrieben, weil sie zu einer Bruchrechnung
 * „dazugehören". Der Mutationstest hat gezeigt, dass sie kein Test je erreicht —
 * schlicht weil sie niemand aufruft. Ungenutzter Code in einem Werkzeug, dessen
 * Verkaufsargument Schlankheit ist, gehört gelöscht und nicht nachträglich
 * getestet. Wer sie später braucht, schreibt sie mitsamt Test wieder hin.
 */
