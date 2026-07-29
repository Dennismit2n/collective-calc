/*
 * Erzeugt die Vorschaubilder aus tools/promo.html.
 *
 *   node tools/make-promo.mjs
 *
 * Playwright ist ohnehin für den Browser-Test da, also braucht es dafür keine
 * weitere Abhängigkeit. Die Bilder werden eingecheckt — sie müssen beim
 * Ausliefern vorliegen —, aber sie sind aus der Vorlage reproduzierbar. Ändert
 * sich Farbe, Name oder Untertitel, läuft das hier einmal neu.
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stat } from 'node:fs/promises';

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, '..');

const FORMATE = [
  { id: 'og', datei: 'public/og.png', breite: 1200, hoehe: 630, zweck: 'Vorschaukarte in Messengern' },
  { id: 'ig', datei: 'public/instagram.png', breite: 1080, hoehe: 1080, zweck: 'Instagram, quadratisch' },
];

const browser = await chromium.launch();
/*
 * Einfache Pixeldichte.
 *
 * 1200×630 ist die Norm für Vorschaukarten und 1080×1080 die native Größe bei
 * Instagram — beide werden nirgends vergrößert dargestellt. Mit doppelter
 * Dichte wurde die Datei 580 KB groß, ohne dass es jemand sieht. Bei einem
 * Werkzeug, das mit 28 KB wirbt, wäre das ein schlechter Witz.
 */
const seite = await browser.newPage({ deviceScaleFactor: 1 });
await seite.goto('file://' + resolve(wurzel, 'tools/promo.html').replace(/\\/g, '/'));

for (const f of FORMATE) {
  const ziel = resolve(wurzel, f.datei);
  await seite.locator(`#${f.id}`).screenshot({ path: ziel });
  const { size } = await stat(ziel);
  console.log(`${f.datei.padEnd(22)} ${f.breite}×${f.hoehe}  ${(size / 1024).toFixed(0)} KB  — ${f.zweck}`);
}

await browser.close();
