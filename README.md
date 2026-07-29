# Collective-Calc

**Wer schuldet wem was?** — Gruppenausgaben teilen, ohne Konto, ohne App, ohne Server.

Eine Gruppe gibt gemeinsam Geld aus: Urlaub, Ferienhaus, Junggesellenabschied, Festival,
Restaurantabend. Collective-Calc rechnet aus, wer wem wie viel schuldet, und schickt das
Ergebnis als Link an alle — die brauchen weder ein Konto noch eine Installation, um es zu sehen.

**→ [dennismit2n.github.io/collective-calc](https://dennismit2n.github.io/collective-calc/)**

## Was dieses Tool anders macht

- **Kein Konto, keine App.** Die Mitreisenden öffnen einen Link. Das war's.
- **Kein Server.** Die Abrechnung steckt komprimiert hinter dem `#` im Link und erreicht
  deshalb technisch nie einen Server — weder GitHub noch die Vorschau-Roboter der Messenger.
- **Fragt nie nach Kontodaten.** Kein IBAN-Feld, kein PayPal, kein Überweisungs-QR.
- **Läuft offline.** Im Ferienhaus ohne Empfang, in der Berghütte, im Ausland ohne Roaming.
- **Selbsttragende Links.** Ein geteilter Link funktioniert auch dann noch, wenn dieses
  Projekt längst nicht mehr gepflegt wird. Es gibt keinen Dienst, der abgeschaltet werden kann.

## Die Rechnung

Der Kern des Werkzeugs ist die Frage, ob die Beträge stimmen. Dafür gilt:

**Es wird ausschließlich in ganzen Cent gerechnet, als Ganzzahl.** Fließkommazahlen kommen
nirgends vor — mit ihnen ergibt `0.1 + 0.2` nicht `0.3`, und damit wäre keine Zusage über
Cent-Genauigkeit haltbar.

**Gerundet wird genau einmal, ganz am Ende.** Bis dahin bleibt jeder Anteil ein exakter Bruch
(`src/core/rational.ts`, auf BigInt-Basis). Der Unterschied ist messbar: Wer bei jeder Ausgabe
rundet, sammelt bei 40 Ausgaben und 6 Personen rund einen Euro Rundungsrest an. Wer einmal am
Ende rundet, bleibt bei wenigen Cent.

**Der Rest-Cent wird niemandem untergeschoben.** Alle Salden werden zur Null hin abgeschnitten,
niemand schuldet oder bekommt dadurch mehr als rechnerisch zusteht. Was dann nicht aufgeht,
wird namentlich ausgewiesen — „Bei Anna bleibt 1 Cent offen" — statt still bei jemandem zu landen.

**Ausgeglichen wird mit der kleinstmöglichen Zahl an Überweisungen.** Dafür wird die Gruppe in
Teilmengen zerlegt, die für sich genommen auf null aufgehen; jede solche Teilmenge spart eine
Überweisung. Ab 16 Personen mit offenem Saldo fällt das Verfahren automatisch auf den gierigen
Ansatz zurück (größter Schuldner an größten Gläubiger), der höchstens eine Überweisung mehr
braucht und immer korrekte Beträge liefert.

### Die Invarianten

Jede berechnete Abrechnung muss diese Bedingungen erfüllen:

1. Die Anteile einer Ausgabe ergeben zusammen exakt den Ausgabebetrag.
2. Die Summe aller Salden ist exakt null.
3. Überweisungen plus ausgewiesener Rest ergeben exakt die Gesamtschuld.
4. Für jede Person gilt: eingehend minus ausgehend entspricht ihrem Saldo.
5. Der offen bleibende Rest ist insgesamt kleiner als die Personenzahl.
6. Keine Überweisung an sich selbst, kein Betrag kleiner oder gleich null.
7. Gleiche Eingabe ergibt immer dasselbe Ergebnis.
8. Exportieren und wieder einlesen ist verlustfrei. Dasselbe für Link kodieren und dekodieren.

Diese Bedingungen werden an zwei Stellen geprüft: in der Testsuite gegen tausende zufällig
erzeugte Abrechnungen, und **zur Laufzeit als Eingangskontrolle für fremde Daten**. Letzteres
ist ausdrücklich kein Misstrauen gegen die eigene Rechnung, sondern der Schutz gegen einen im
Messenger abgeschnittenen Link, eine von Hand editierte Datei oder eine fehlgeschlagene
Formatmigration — Fehlerquellen, die außerhalb dieses Programms liegen und die keine Testsuite
abdecken kann. Schlägt die Kontrolle an, zeigt das Tool **keine Zahlen**, sondern eine Meldung
und bietet den Export der Rohdaten an. Halb richtige Beträge wären schlimmer als gar keine.

### Gemessen, nicht geschätzt

| Messung | Ergebnis |
|---|---|
| Offener Rest bei 6 Personen / 40 Ausgaben (2.000 Durchläufe) | in 62,5 % der Fälle, ⌀ 0,76 Cent, max. 3 Cent |
| Exakter Ausgleich, 16 Personen, Zufallsdaten | 0,9 ms |
| Exakter Ausgleich, 16 Personen, ungünstigster Fall | 5,5 ms |
| Linklänge Urlaubswoche (6 Personen, 40 Ausgaben) | 779 Zeichen vollständig · 284 Zeichen als Ergebnis |
| Linklänge Großgruppe (15 Personen, 200 Ausgaben) | 3.238 Zeichen vollständig · 492 Zeichen als Ergebnis |

Die Messungen laufen als Test mit (`src/core/measurements.test.ts`, `src/core/codec.test.ts`),
damit sie nicht irgendwann still nicht mehr stimmen.

### Haben die Tests Zähne?

Eine grüne Testsuite beweist nur, dass sie gelaufen ist. Deshalb läuft ein **Mutationstest**
über die Geldlogik: Er baut absichtlich kleine Fehler ein — aus einem Plus wird ein Minus, aus
„größer" wird „größer gleich" — und misst, wie viele davon die Tests bemerken.

```bash
npm run test:mutation
```

| Datei | erkannt |
|---|---|
| `settle.ts` — Rundung, offener Rest, Ausgleich | **95,2 %** |
| `rational.ts` — exakte Bruchrechnung | 93,1 % |
| `invariants.ts` | 85,9 % |
| `balances.ts` | 85,7 % |
| `amount.ts` — Betragseingabe | 75,7 % |
| `currency.ts` — Umrechnung | 70,9 % |
| **gesamt** | **86,4 %** |

Der erste Lauf lag bei 82,5 % und hat zwei echte Mängel aufgedeckt: eine Handvoll
Bruchrechnungs-Funktionen, die nie jemand aufrief und die deshalb gelöscht wurden statt
nachträglich getestet zu werden — und die Erkenntnis, dass die Kurzliste der Währungen den
ungarischen Forint enthielt, der keine Untereinheit hat. Jeder Betrag wäre dort um den Faktor
hundert daneben gewesen. Ein Test prüft die Liste jetzt gegen dieselbe Regel wie das Freifeld.

Die verbleibenden überlebenden Mutanten sind zu einem guten Teil gleichwertig: Änderungen, die
sich am beobachtbaren Verhalten nicht auswirken, etwa doppelte Absicherungen, bei denen der
zweite Wächter greift, wenn man den ersten entfernt. Sie ließen sich nur mit Tests „töten", die
allein dafür geschrieben wären — und solche Tests messen dann sich selbst statt der Software.

## Barrierefreiheit

Zielmarke ist **WCAG 2.1 Stufe AA**. Was dafür getan wurde, und was nicht:

**Automatisch geprüft** — axe läuft im Browser-Test über die Ergebnisansicht und die
geteilte Ansicht, in hellem *und* dunklem Farbschema. Keine Verstöße gegen A und AA.
Diese Prüfung findet erfahrungsgemäß etwa ein Drittel der Probleme.

**Von Hand geprüft** (Stand 29.07.2026, Chromium unter Windows 11):

- Vollständiger Durchlauf mit der Tastatur. Ergebnis: Die Erfassungszeile stand an
  Position 20 der Reihenfolge — bei vierzig Ausgaben wären es über fünfzig Sprünge
  bis zur Hauptfunktion gewesen. Ein zweiter Sprunganker „Zur Erfassung springen"
  wurde ergänzt und ist per Browser-Test abgesichert.
- Sichtbare Fokusumrandung an allen Bedienelementen, geprüft.
- Antippbare Flächen mindestens 44 Pixel.

**Was in der Gestaltung festliegt:**

- Farbe trägt Bedeutung, steht aber **nie allein**: Guthaben und Schuld sind zusätzlich
  durch Vorzeichen und Wort unterschieden. Das Rot-Grün-Paar kommt nirgends vor.
- Zahlen stehen in gleicher Ziffernbreite, damit sich Beträge in Spalten vergleichen lassen.
- Die Sprachkennung der Seite wird beim Umschalten mitgeführt, damit Vorleseprogramme
  richtig aussprechen.
- Der Rückgängig-Streifen verschwindet **nicht nach Zeit**, sondern erst bei der nächsten
  Handlung. Ein Zeitfenster hätte ausgerechnet die Nutzer benachteiligt, die es am
  dringendsten brauchen.
- Die Textalternative eines QR-Codes ist der Link selbst, nicht das Wort „QR-Code".

**Was offen ist:** Ein Durchlauf mit einem echten Vorleseprogramm (NVDA, VoiceOver) steht
aus. Die Auszeichnung ist darauf ausgelegt — Meldebereiche für die Bestätigungszeile,
echte Tabellenauszeichnung mit Kopfzellen im Ergebnis —, aber geprüft ist sie nur über
den Barrierefreiheitsbaum, nicht durch Hören.

## Woran gemessen wird, ob das Tool benutzt wird

Festgelegt am **29.07.2026**, vor der Veröffentlichung. Nachträglich gesetzte Ziele werden
immer erreicht, deshalb steht die Messlatte hier und nicht später.

| Kennzahl | Untergrenze |
|---|---|
| Besucher, die mindestens eine Ausgabe erfassen | 20 % |
| davon: teilen einen Link | 10 % |
| Öffnungen je geteiltem Ergebnis-Link | über 1,5 |
| **mehrtägige Anlässe im dritten Monat** | **mindestens einer pro Woche** |

Die letzte Zeile entscheidet. Wird sie erreicht, benutzen echte Gruppen das Werkzeug im
Alltag. Wird sie verfehlt, während die oberen drei stimmen, ist ein gutes Werkzeug
entstanden, das Leute ausprobieren und nicht behalten — dann liegt die Antwort nicht in
mehr Funktionen, sondern in der Frage, warum sie am zweiten Tag nicht wiederkommen.

Die Zahlen sind Schätzungen, keine Vergleichswerte aus dem Markt.

## Entwicklung

```bash
npm install
npm run dev            # Entwicklungsserver auf Port 8618
npm test               # Einheitentests
npm run test:e2e       # Browser-Test samt Barrierefreiheitsprüfung
npm run test:mutation  # misst, ob die Tests etwas merken (~2 Minuten)
npm run typecheck      # TypeScript ohne Ausgabe
npm run build          # Auslieferungsstand nach dist/
```

Typecheck, Einheitentests und Browser-Test laufen bei jedem Push über GitHub Actions, und
**die Auslieferung hängt daran**: Was die Geldlogik nicht besteht, geht nicht live. Der
Mutationstest läuft wöchentlich und auf Zuruf — er ist eine Messung, kein Wächter.

## Was gezählt wird

Die Zählung läuft über [GoatCounter](https://www.goatcounter.com/) — ohne Kekse, ohne
Kennung, ohne Wiedererkennung über Besuche hinweg.

**Gesendet wird:** ein Seitenaufruf mit dem festen Pfad `/`, und vier benannte Zähler:

| Zähler | wann |
|---|---|
| `erste-ausgabe` | in einem Anlass wurde zum ersten Mal etwas erfasst |
| `geteilt` | ein Link wurde geteilt oder kopiert |
| `ergebnis-geoeffnet` | ein geteilter Link wurde geöffnet |
| `mehrtaegig` | ein Anlass hat an einem **späteren Kalendertag** eine weitere Ausgabe bekommen |

**Nicht gesendet wird:** Beträge, Namen, Beschreibungen, Währungen, Personenzahl, die
Kennung eines Anlasses — und vor allem nicht der Anker der Adresse, in dem bei diesem
Werkzeug die vollständige Abrechnung steckt. Die automatische Zählung des Skripts ist
deshalb abgeschaltet; der eine Aufruf wird von Hand mit einem festen Pfad ausgelöst.

Die Entscheidung, ob etwas zählenswert ist, fällt **auf dem Gerät**. Ob ein Anlass
mehrtägig ist, weiß nur der Browser des Nutzers; nach draußen geht ein Zähler ohne Inhalt.

`mehrtaegig` ist die Leitkennzahl. Sie unterscheidet „ausprobiert" von „im Urlaub
tatsächlich benutzt": Wer neugierig zwei Beispielausgaben eintippt, erzeugt Aufrufe, eine
Erfassung und vielleicht sogar einen geteilten Link — aber er kommt am nächsten Tag nicht
wieder. Rückzahlungen zählen bewusst nicht mit, sonst würde ein Abhaken am Folgetag als
mehrtägige Nutzung durchgehen, obwohl niemand unterwegs etwas erfasst hat.

## Was bewusst nicht getestet wird

Es gibt **keine Komponententests der Oberfläche**. Bei einer App dieser Größe würden sie
überwiegend das Framework prüfen, bei jeder Gestaltungsänderung brechen und mehr kosten, als
sie einbringen. Stattdessen: erschöpfende Tests des Rechenkerns, Rundwegtests für Link und
Export, ein Mutationstest, der misst ob die Tests überhaupt etwas merken, und **genau ein**
Browser-Test für den Link-Rundweg. Ein einzelner Browser-Test wird gepflegt; zwanzig werden
irgendwann ignoriert, und ein ignoriertes rotes Prüfergebnis ist schlechter als keins.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
