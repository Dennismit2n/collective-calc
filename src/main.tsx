import { render } from 'preact';

import './styles.css';
import { App } from './app/App.js';
import { Store } from './core/storage.js';
import { AppStore } from './app/state.js';
import { requestPersistentStorage } from './core/storage.js';
import { countPageview } from './core/counters.js';

const root = document.getElementById('app');
if (!root) throw new Error('Kein Wurzelelement gefunden.');

const store = new AppStore(new Store(window.localStorage));

// Höflich um dauerhaften Speicher bitten (F9). Schlägt es fehl, ist das kein Fehler —
// die eigentliche Sicherung ist ohnehin der geteilte Link.
void requestPersistentStorage();

render(<App store={store} />, root);

/*
 * Zählung (F27). Wir lösen den Seitenaufruf selbst aus, damit hier ausdrücklich
 * steht, was gesendet wird. Der Anker der Adresse — die vollständige Abrechnung —
 * bleibt dabei außen vor. Das Skript lädt asynchron; ist es noch nicht da, warten
 * wir kurz und geben danach auf.
 */
{
  const viaLink = window.location.hash.length > 1;
  let versuche = 0;
  const senden = (): void => {
    if (window.goatcounter) {
      countPageview(viaLink);
    } else if (versuche++ < 20) {
      window.setTimeout(senden, 250);
    }
  };
  window.setTimeout(senden, 0);
}

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
