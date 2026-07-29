/**
 * QR-Code als SVG.
 *
 * Die Encoder-Bibliothek wird **erst beim Antippen geladen**. Sie ist mit Abstand
 * das größte Einzelstück des Programms, und der QR-Code ist der am seltensten
 * benutzte Weg — ihn im ersten Ladevorgang mitzuschleppen würde jeden Nutzer für
 * etwas bezahlen lassen, das die wenigsten brauchen. Bei einem Werkzeug, das an
 * der Supermarktkasse aufgemacht wird, zählt das.
 *
 * Bewusst selbst gezeichnet statt über die fertige SVG-Ausgabe der Bibliothek:
 * So bestimmen wir Farben, Rand und die Textalternative selbst. Letztere ist
 * nicht „QR-Code", sondern **der Link** — wer den Code nicht scannen kann, soll
 * die Adresse vorgelesen bekommen (F26).
 */

import { useEffect, useState } from 'preact/hooks';

interface Props {
  value: string;
  /** Kantenlänge in Pixeln. */
  size?: number;
  /** Textalternative — hier gehört der Link hinein, nicht das Wort „QR-Code". */
  label: string;
}

/** Ein einziger Pfad statt tausender Rechtecke — deutlich weniger DOM. */
function toPath(modules: boolean[][], quiet: number): string {
  let path = '';
  for (let row = 0; row < modules.length; row++) {
    const line = modules[row]!;
    for (let col = 0; col < line.length; col++) {
      if (line[col]) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return path;
}

export function QrCode({ value, size = 220, label }: Props) {
  const [modules, setModules] = useState<boolean[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setModules(null);
    setFailed(false);

    void import('qrcode-generator')
      .then(({ default: qrcode }) => {
        if (cancelled) return;
        // 0 = Version automatisch wählen. 'L' bietet die größte Kapazität und genügt,
        // weil hier keine beschädigten Aufdrucke gescannt werden, sondern Bildschirme.
        const qr = qrcode(0, 'L');
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        setModules(
          Array.from({ length: count }, (_, row) =>
            Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) return null; // Zu lang oder nicht ladbar — die Oberfläche sagt es an anderer Stelle.
  if (modules === null) {
    return <div style={`width:${size}px;height:${size}px;border-radius:10px;background:var(--panel-2)`} />;
  }

  const quiet = 2; // Ruhezone, ohne die viele Scanner nichts erkennen
  const total = modules.length + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style="display:block;border-radius:10px;background:#fff"
      shape-rendering="crispEdges"
    >
      <path d={toPath(modules, quiet)} fill="#0d1226" />
    </svg>
  );
}
