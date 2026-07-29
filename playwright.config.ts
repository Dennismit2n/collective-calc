import { defineConfig, devices } from '@playwright/test';

/**
 * Genau **ein** Browser-Test (F21).
 *
 * Er deckt das ab, was keine Einheitenprüfung abdecken kann: dass der Anker der
 * Adresse wirklich ankommt, dass der geteilte Link in einem frischen Browser
 * dieselben Zahlen zeigt, und dass die fertige Seite keine groben
 * Barrierefreiheitsfehler hat.
 *
 * Warum nur einer: Ein einzelner Browser-Test wird gepflegt. Zwanzig werden
 * irgendwann ignoriert — und ein ignoriertes rotes Ergebnis ist schlechter als
 * gar keins, weil es auch die echten Fehlschläge unsichtbar macht.
 *
 * Geprüft wird der **gebaute** Stand, nicht der Entwicklungsserver: Nur so ist
 * auch die Bündelung mit im Test.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:8620/collective-calc/',
    trace: 'retain-on-failure',
    /*
     * Deutsch — und das ist Teil des Tests.
     *
     * Der erste Lauf schlug fehl, weil Playwright standardmäßig englisch startet
     * und die App daraufhin korrekt Englisch anzeigte. Genau so soll es sein
     * (F18: die Sprache richtet sich nach dem Leser). Mit gesetztem Gebietsschema
     * prüft der Test die Spracherkennung gleich mit.
     */
    locale: 'de-DE',
    // Der Test liest den kopierten Link aus der Zwischenablage zurück — das ist
    // der Weg, den ein Nutzer ohne System-Teilen-Menü auch geht.
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 8620 --strictPort',
    url: 'http://localhost:8620/collective-calc/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
