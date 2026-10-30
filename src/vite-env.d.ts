/// <reference types="vite/client" />

interface Window {
  /** beforeinstallprompt-Ereignis, aufgehoben vom Skript im Kopf von index.html. */
  deferredInstall?: (Event & { prompt(): Promise<unknown> }) | null;
  /** Ruft das Skript im Kopf, sobald das Ereignis da ist. */
  onInstallReady?: () => void;
}
