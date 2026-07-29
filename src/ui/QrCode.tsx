/**
 * QR-Code als SVG.
 *
 * Bewusst selbst gezeichnet statt über die fertige SVG-Ausgabe der Bibliothek:
 * So bestimmen wir Farben, Rand und die Textalternative selbst. Letztere ist
 * nicht „QR-Code", sondern **der Link** — wer den Code nicht scannen kann, soll
 * die Adresse vorgelesen bekommen (F26).
 */

import qrcode from 'qrcode-generator';

interface Props {
  value: string;
  /** Kantenlänge in Pixeln. */
  size?: number;
  /** Textalternative — hier gehört der Link hinein, nicht das Wort „QR-Code". */
  label: string;
}

export function QrCode({ value, size = 220, label }: Props) {
  let modules: boolean[][];
  try {
    // 0 = Version automatisch wählen. 'L' bietet die größte Kapazität und genügt,
    // weil hier keine beschädigten Aufdrucke gescannt werden, sondern Bildschirme.
    const qr = qrcode(0, 'L');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    modules = Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
    );
  } catch {
    return null; // Zu lang für einen QR-Code — die Oberfläche sagt das an anderer Stelle.
  }

  const count = modules.length;
  const quiet = 2; // Ruhezone, ohne die viele Scanner nichts erkennen
  const total = count + quiet * 2;

  // Ein einziger Pfad statt tausender Rechtecke — deutlich weniger DOM.
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (modules[row]![col]) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }

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
      <path d={path} fill="#0d1226" />
    </svg>
  );
}
