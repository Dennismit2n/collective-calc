/**
 * Deutsch — die Referenzsprache.
 *
 * Alle anderen Sprachen leiten ihre Schlüssel von hier ab; fehlt dort etwas,
 * meckert der Compiler. Texte stehen **nie** im Code (F18), damit Übersetzen
 * später keine Suche durch Komponenten bedeutet.
 *
 * Mit ⚠️ markierte Einträge sind **geldkritisch**: Eine schiefe Übersetzung führt
 * hier nicht zu einem Schönheitsfehler, sondern zu einer falschen Eingabe. Diese
 * Texte werden vor der Veröffentlichung gegengelesen und rückübersetzt.
 */

export const de = {
  'app.name': 'Collective-Calc',
  'app.tagline': 'Wer schuldet wem was?',

  // --- Kopfzeile und Einstellungen ---
  'nav.events': 'Anlässe',
  'nav.back': 'Zurück',
  'settings.language': 'Sprache',
  'settings.theme': 'Darstellung',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Hell',
  'settings.theme.dark': 'Dunkel',

  // --- Anlässe ---
  'event.new': 'Neuer Anlass',
  'event.untitled': 'Abrechnung vom {date}',
  'event.rename': 'Umbenennen',
  'event.delete': 'Anlass löschen',
  'event.deleteConfirm':
    'Diesen Anlass mit allen Ausgaben wirklich löschen? Das lässt sich nicht rückgängig machen.',
  'event.empty.title': 'Noch keine Ausgabe',
  'event.empty.hint': 'Trag unten ein, was jemand bezahlt hat. Der Rest ergibt sich.',
  'event.total': 'Ausgaben insgesamt',
  'event.count': { one: '{count} Ausgabe', other: '{count} Ausgaben' },

  // --- Personen ---
  'people.heading': 'Wer ist dabei?',
  'people.add': 'Person hinzufügen',
  'people.namePlaceholder': 'Vorname',
  'people.hint': 'Vornamen genügen.',
  'people.cannotRemove': 'Diese Person kommt in Ausgaben vor und kann nur umbenannt werden.',
  'people.you': 'Ich',
  'people.needTwo': 'Trag mindestens zwei Personen ein, dann kann gerechnet werden.',

  // --- Erfassung ⚠️ ---
  'entry.amount': 'Betrag', // ⚠️
  'entry.amountPlaceholder': '0,00',
  'entry.understoodAs': 'Verstanden als {amount}', // ⚠️
  'entry.description': 'Wofür?',
  'entry.paidBy': 'Gezahlt von', // ⚠️
  'entry.add': 'Eintragen',
  'entry.unnamed': 'Ausgabe', // Ersatzname, wenn keine Beschreibung eingetragen wurde
  'entry.saved': '{amount} · {description} · gezahlt von {payer}', // ⚠️
  'entry.savedNoDescription': '{amount} · gezahlt von {payer}', // ⚠️
  'entry.undo': 'Rückgängig',
  'entry.edit': 'Ändern',
  'entry.delete': 'Löschen',
  'entry.deleted': 'Eintrag gelöscht.',

  // --- Aufteilung ⚠️ ---
  'split.change': 'Aufteilung ändern',
  'split.equal': 'Alle gleich', // ⚠️
  'split.participants': 'War dabei', // ⚠️
  'split.exact': 'Genaue Beträge', // ⚠️
  'split.shares': 'Anteile', // ⚠️
  'split.percent': 'Prozent', // ⚠️
  'split.sumMismatch': 'Die Beträge ergeben zusammen {sum}, die Ausgabe ist aber {total}.', // ⚠️
  'split.nobody': 'Mindestens eine Person muss beteiligt sein.',
  'split.sharesHint': 'Wer doppelt zählt, bekommt eine 2. Wer nicht dabei war, eine 0.',

  // --- Rückzahlungen ⚠️ ---
  'repayment.add': 'Rückzahlung eintragen', // ⚠️
  'repayment.from': 'Von', // ⚠️
  'repayment.to': 'An', // ⚠️
  'repayment.label': 'Rückzahlung', // ⚠️
  'repayment.markPaid': 'Als bezahlt eintragen', // ⚠️
  'repayment.hint': 'Rückzahlungen zählen nicht in die Gesamtausgaben.',

  // --- Währung ---
  'currency.label': 'Währung',
  'currency.foreign': 'In anderer Währung',
  'currency.rate': 'Kurs',
  'currency.converted': '{foreign} zum Kurs {rate} = {amount}', // ⚠️
  'currency.changeWarning':
    'Ein Wechsel rechnet nichts um — er ändert nur das angezeigte Währungszeichen.',

  // --- Ergebnis ⚠️ ---
  'result.heading': 'Ergebnis',
  'result.columnPerson': 'Person',
  'result.columnPaidShare': 'Ausgelegt und Anteil',
  'result.columnBalance': 'Saldo',
  // In der Tabelle geht es um Dritte, nicht um den Leser — deshalb "schuldet",
  // nicht "du schuldest". ⚠️
  'result.owesShort': 'schuldet', // ⚠️
  'result.getsShort': 'bekommt', // ⚠️
  'result.owes': 'Du schuldest', // ⚠️
  'result.gets': 'Du bekommst', // ⚠️
  'result.settled': 'Ausgeglichen',
  'result.personOwes': '{name} schuldet {amount}', // ⚠️
  'result.personGets': '{name} bekommt {amount}', // ⚠️
  'result.transfer': '{from} überweist {amount} an {to}', // ⚠️
  'result.noTransfers': 'Alles ausgeglichen — niemand schuldet jemandem etwas.',
  'result.paidAndShare': 'ausgelegt {paid} · Anteil {share}', // ⚠️
  'result.exactValue': 'Genau: {value}',
  'result.exactHint': 'Angezeigte Anteile sind gerundet. Tippe eine Zahl an für den genauen Wert.',
  'result.transferCount': { one: '{count} Überweisung', other: '{count} Überweisungen' },

  // --- Offener Rest ⚠️ ---
  'remainder.heading': 'Ein Rest bleibt offen',
  'remainder.receivesLess': 'Bei {name} bleibt {amount} offen.', // ⚠️
  'remainder.paysLess': '{name} zahlt {amount} weniger, als rechnerisch anfällt.', // ⚠️
  'remainder.explain':
    'Beträge lassen sich nicht immer auf ganze Cent aufteilen. Dieser Rest wird niemandem zugeschlagen — macht das unter euch aus 😉',
  'remainder.wheel': 'Keine Einigung? Dreh das Rad.',

  // --- Teilen ---
  'share.result': 'Ergebnis teilen',
  'share.resultHint': 'Nur Namen, Salden und Überweisungen. Keine Einzelausgaben.',
  'share.full': 'Abrechnung übergeben',
  'share.fullHint': 'Der vollständige Anlass zum Weiterführen auf einem anderen Gerät.',
  'share.copy': 'Link kopieren',
  'share.copied': 'Link kopiert.',
  'share.qr': 'QR-Code',
  'share.qrAlt': 'QR-Code mit dem Link: {url}',
  'share.tooLarge':
    'Diese Abrechnung ist zu groß für einen Link. Nutze den Datei-Export, um sie zu übergeben.',
  'share.readOnlyNotice':
    'Du siehst eine geteilte Abrechnung. Änderungen hier wirken sich nicht auf das Original aus.',
  'share.openCopy': 'Als eigene Kopie öffnen',

  // --- Sicherung ---
  'backup.heading': 'Sichere diese Abrechnung',
  'backup.body':
    'Die Daten liegen nur in diesem Browser. Wird er aufgeräumt, sind sie weg. Teile den Link oder lade eine Datei herunter — beides ist eine vollständige Sicherung.',
  'backup.share': 'Link teilen',
  'backup.download': 'Datei herunterladen',
  'backup.later': 'Später',
  'storage.notice': 'Diese Daten liegen nur in diesem Browser.',

  // --- Export ---
  'export.heading': 'Exportieren',
  'export.json': 'Datei (JSON)',
  'export.jsonHint': 'Vollständig und wieder einlesbar.',
  'export.csv': 'Tabelle (CSV)',
  'export.csvHint': 'Zum Nachrechnen in Excel oder LibreOffice.',
  'export.print': 'Drucken oder als PDF sichern',
  'import.heading': 'Datei einlesen',
  'import.button': 'Datei wählen',

  // --- Fehler ---
  'error.heading': 'Diese Abrechnung lässt sich gerade nicht sicher berechnen',
  'error.body':
    'Damit keine falschen Beträge angezeigt werden, zeigt Collective-Calc hier lieber gar keine Zahlen. Deine Daten sind nicht verloren — du kannst sie herunterladen.',
  'error.exportRaw': 'Rohdaten herunterladen',
  'error.details': 'Was genau nicht stimmt',
  'error.brokenLinkTitle': 'Der Link ließ sich nicht lesen',
  'error.brokenLink':
    'Dieser Link ließ sich nicht lesen. Vermutlich wurde er beim Verschicken abgeschnitten — lass ihn dir noch einmal schicken.',

  // --- Barrierefreiheit ---
  'a11y.amountField': 'Betrag in {currency}',
  'a11y.balancePositive': 'Guthaben',
  'a11y.balanceNegative': 'Schuld',
  'a11y.savedAnnouncement': 'Gespeichert: {text}',
  'a11y.skipToContent': 'Zum Inhalt springen',
} as const;

export type MessageKey = keyof typeof de;
export type Messages = Record<MessageKey, string | Partial<Record<Intl.LDMLPluralRule, string>>>;
