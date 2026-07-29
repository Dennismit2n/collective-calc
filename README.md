# Collective-Calc

**Wer schuldet wem was?** — Gruppenausgaben teilen, ohne Konto, ohne App, ohne Server.

Eine Gruppe gibt gemeinsam Geld aus: Urlaub, Ferienhaus, Junggesellenabschied, Festival,
Restaurantabend. Collective-Calc rechnet aus, wer wem wie viel schuldet, und schickt das
Ergebnis als Link an alle — die brauchen weder ein Konto noch eine Installation, um es zu sehen.

> Status: in Arbeit. Noch nicht veröffentlicht.

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

Die Messungen laufen als Test mit (`src/core/measurements.test.ts`), damit sie nicht
irgendwann still nicht mehr stimmen.

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver auf Port 8618
npm test           # Testsuite
npm run typecheck  # TypeScript ohne Ausgabe
npm run build      # Auslieferungsstand nach dist/
```

## Was bewusst nicht getestet wird

Es gibt **keine Komponententests der Oberfläche**. Bei einer App dieser Größe würden sie
überwiegend das Framework prüfen, bei jeder Gestaltungsänderung brechen und mehr kosten, als
sie einbringen. Stattdessen: erschöpfende Tests des Rechenkerns, Rundwegtests für Link und
Export, ein Mutationstest, der misst ob die Tests überhaupt etwas merken, und **genau ein**
Browser-Test für den Link-Rundweg. Ein einzelner Browser-Test wird gepflegt; zwanzig werden
irgendwann ignoriert, und ein ignoriertes rotes Prüfergebnis ist schlechter als keins.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
