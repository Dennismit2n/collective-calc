// Aus 'vitest/config', nicht aus 'vite': Nur diese Fassung kennt den
// `test`-Abschnitt. Mit der Vite-eigenen blieben die Testeinstellungen
// ungeprüft — ein Tippfehler dort wäre stillschweigend wirkungslos geblieben.
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // Auf GitHub Pages liegt das Tool unter /collective-calc/, nicht im Wurzelverzeichnis.
  base: '/collective-calc/',
  server: { port: 8618 },
  preview: { port: 8618 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
