import { render } from 'preact';

import './styles.css';
import { App } from './app/App.js';
import { Store } from './core/storage.js';
import { AppStore } from './app/state.js';
import { requestPersistentStorage } from './core/storage.js';

const root = document.getElementById('app');
if (!root) throw new Error('Kein Wurzelelement gefunden.');

const store = new AppStore(new Store(window.localStorage));

// Höflich um dauerhaften Speicher bitten (F9). Schlägt es fehl, ist das kein Fehler —
// die eigentliche Sicherung ist ohnehin der geteilte Link.
void requestPersistentStorage();

render(<App store={store} />, root);

/*
 * Service Worker nur im Auslieferungsstand (F22).
 *
 * Im Entwicklungsbetrieb würde er dem Nachladen von Änderungen in die Quere kommen
 * und Fehler vortäuschen, die es gar nicht gibt.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });
}
