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
