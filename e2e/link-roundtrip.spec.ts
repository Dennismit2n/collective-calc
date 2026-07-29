import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Der Link-Rundweg (F21) — und nur der.
 *
 * Alles darunter prüft Annahmen über den Browser. Dieser Test prüft den Browser:
 * dass der Anker der Adresse wirklich transportiert, dass ein geteilter Link in
 * einem frischen Profil ohne jede lokale Ablage dieselben Zahlen zeigt, und dass
 * die Größengrenze in echt hält.
 *
 * Angehängt ist die automatische Barrierefreiheitsprüfung (F26). Sie findet
 * verlässlich etwa ein Drittel der Probleme — fehlende Beschriftungen, zu
 * schwache Kontraste, kaputte Verschachtelung. Das andere Zweidrittel bleibt
 * dem Durchlauf von Hand vorbehalten; das steht so im README.
 */

const PEOPLE = ['Anna', 'Ben', 'Clara'];

async function erfasse(page: import('@playwright/test').Page, betrag: string, wofuer: string) {
  await page.getByRole('textbox', { name: /^Betrag in/ }).fill(betrag);
  await page.getByRole('textbox', { name: 'Wofür?' }).fill(wofuer);
  await page.getByRole('button', { name: 'Eintragen', exact: true }).click();
}

test('eine Abrechnung überlebt den Weg durch einen geteilten Link', async ({ page, browser }) => {
  await page.goto('./');

  // Die Sprache richtet sich nach dem Leser (F18) — der Browser läuft laut
  // Konfiguration auf Deutsch, also muss die Oberfläche deutsch sein.
  await expect(page.getByText('Wer schuldet wem was?')).toBeVisible();

  /*
   * Der Sprung zur Erfassung (F26).
   *
   * Zwei Dinge auf einmal: dass die Hauptfunktion für Tastaturnutzer in zwei
   * Sprüngen erreichbar ist — sonst wären es bei vierzig Ausgaben über fünfzig —
   * und dass der Sprung **den Anker der Adresse nicht anfasst**. Ein
   * `href="#…"` tat genau das, und die App hielt den Anker prompt für einen
   * geteilten Link und zeigte den Fehlerbildschirm.
   */
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Zur Erfassung springen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: /^Betrag in/ })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('.notice.warn')).toHaveCount(0);

  // --- Gruppe anlegen ------------------------------------------------------
  for (const name of PEOPLE) {
    await page.getByPlaceholder('Vorname').fill(name);
    await page.getByRole('button', { name: 'Person hinzufügen' }).click();
  }
  for (const name of PEOPLE) {
    await expect(page.getByRole('textbox', { name, exact: true })).toBeVisible();
  }

  // --- Ausgaben erfassen ---------------------------------------------------
  await erfasse(page, '10,00', 'Einkauf');
  // Die Rückmeldung muss zeigen, wer gezahlt hat — das ist die Absicherung
  // gegen den stillschweigend falschen Zahler (F23).
  await expect(page.getByRole('status')).toContainText('gezahlt von Anna');

  await erfasse(page, '7,50', 'Kaffee');
  await erfasse(page, '101,00', 'Ferienhaus');

  // --- Ergebnis ------------------------------------------------------------
  await page.getByRole('button', { name: 'Ergebnis', exact: true }).click();
  const tabelle = page.locator('table.result tbody tr');
  await expect(tabelle).toHaveCount(3);
  const salden = await tabelle.evaluateAll((zeilen) =>
    zeilen.map((z) => (z.querySelector('td.amount') as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
  );

  /*
   * Barrierefreiheit der Ergebnisansicht — der Ansicht, die Fremde zu sehen
   * bekommen. Geprüft wird in **beiden** Farbschemata (F26): Der erste Lauf fand
   * genau hier einen zu schwachen Kontrast, den es nur im Hellmodus gab.
   */
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    const pruefung = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(pruefung.violations, `${schema}: ${JSON.stringify(pruefung.violations, null, 2)}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });

  // --- Teilen --------------------------------------------------------------
  await page.getByRole('button', { name: 'Link kopieren' }).click();
  await expect(page.getByText('Link kopiert.')).toBeVisible();

  const geteilt = await page.evaluate(() => navigator.clipboard.readText());
  expect(geteilt).toContain('#r');
  // Die Zusage aus F8: Eine Abrechnung dieser Größe passt durch jeden Messenger.
  expect(geteilt.length).toBeLessThan(2000);

  // --- In einem frischen Profil öffnen -------------------------------------
  // Eigener Kontext heißt: keine lokale Ablage, kein gemeinsamer Speicher.
  // Genau die Lage, in der die fünf anderen aus der Gruppe sind.
  const fremd = await browser.newContext();
  const fremdeSeite = await fremd.newPage();
  await fremdeSeite.goto(geteilt);

  await expect(fremdeSeite.getByText('Du siehst eine geteilte Abrechnung')).toBeVisible();
  // Keine Erfassungsmöglichkeit in einer geteilten Ansicht.
  await expect(fremdeSeite.getByRole('button', { name: 'Eintragen', exact: true })).toHaveCount(0);

  const fremdeZeilen = fremdeSeite.locator('table.result tbody tr');
  await expect(fremdeZeilen).toHaveCount(3);
  const fremdeSalden = await fremdeZeilen.evaluateAll((zeilen) =>
    zeilen.map((z) => (z.querySelector('td.amount') as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
  );

  // Der eigentliche Punkt des ganzen Tests.
  expect(fremdeSalden).toEqual(salden);

  for (const schema of ['light', 'dark'] as const) {
    await fremdeSeite.emulateMedia({ colorScheme: schema });
    const pruefung = await new AxeBuilder({ page: fremdeSeite })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(pruefung.violations, `geteilt/${schema}: ${JSON.stringify(pruefung.violations, null, 2)}`).toEqual(
      [],
    );
  }

  await fremd.close();
});

test('ein abgeschnittener Link zeigt eine Meldung und keine einzige Zahl', async ({ page }) => {
  // Der Fall, den ein Messenger produziert. Halb richtige Beträge wären
  // schlimmer als gar keine (F15).
  await page.goto('./#rVYyxCoNAEER_5Zh6DKcLBylV0qQMpFq2OIMkgm5A0O8P');

  await expect(page.getByText('Der Link ließ sich nicht lesen')).toBeVisible();
  await expect(page.locator('table.result')).toHaveCount(0);
});
