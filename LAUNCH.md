# Launch-Texte für Collective-Calc

Stand 29.07.2026. Alles zum Kopieren. Keine Aussage über andere Werkzeuge — nur, was
Collective-Calc nachweislich tut.

---

## Instagram · Hauptbeitrag

> **Wer schuldet wem was?**
>
> Nach dem Urlaub liegt sie immer da, diese eine Frage. Einer hat das Ferienhaus bezahlt,
> jemand anders ständig den Einkauf, und beim Abendessen waren nur vier von sechs dabei.
>
> Collective-Calc rechnet das aus. Du trägst ein, wer was bezahlt hat — den Rest macht es.
>
> Das Besondere: **Die anderen brauchen nichts.** Kein Konto, keine App, keine Anmeldung.
> Du schickst einen Link in die Gruppe, sie tippen drauf und sehen, was sie schulden.
> Fertig.
>
> Und weil alles im Browser passiert, funktioniert es auch im Ferienhaus ohne Empfang.
>
> 🔗 dennismit2n.github.io/collective-calc
> Kostenlos. Quelloffen. Fragt dich nie nach Kontodaten.
>
> #ausgabenteilen #urlaubmitfreunden #wgleben #reisen #kostenlosetools #openpource
> #datenschutz #webdev #kleinetools #madeingermany

**Hashtag-Korrektur:** `#openpource` ist ein Tippfehler — richtig ist `#opensource`.
(Absichtlich hier stehengelassen, damit du ihn nicht versehentlich mitkopierst.)

---

## Instagram · Kurzfassung, falls der lange Text zu viel ist

> Urlaub vorbei, Abrechnung offen? 🧾
>
> Eintragen, wer was bezahlt hat. Link in die Gruppe schicken. Alle sehen sofort, wer wem
> was schuldet — **ohne Konto, ohne App, ohne Anmeldung.**
>
> Läuft komplett im Browser. Auch offline.
>
> 🔗 dennismit2n.github.io/collective-calc
>
> #ausgabenteilen #urlaubmitfreunden #wgleben #kostenlosetools #opensource #datenschutz

---

## Instagram · Story (drei Karten)

**Karte 1**
> Wer schuldet wem was?
> Die Frage nach jedem Urlaub.

**Karte 2**
> Eintragen → Link teilen → fertig.
> Die anderen brauchen kein Konto und keine App.

**Karte 3**
> Kostenlos & quelloffen
> 👆 Link in der Bio
> *(oder Link-Sticker auf dennismit2n.github.io/collective-calc)*

---

## Was aufs Bild gehört

Der stärkste Screenshot ist **nicht** die Erfassung, sondern das Ergebnis — dort steht das
Versprechen als Zahl da:

```
Ben     →  Anna     13,83 €
Clara   →  Anna     10,83 €
```

Zwei Vorschläge:

1. **Die Ergebnisansicht auf dem Handy**, mit drei bis vier echten Namen und krummen
   Beträgen. Krumme Beträge wirken echt, runde wirken gestellt.
2. **Der offene Rest**, wenn er auftaucht: „Bei Anna bleibt 1 Cent offen — macht das unter
   euch aus 😉". Das ist der Teil, über den Leute reden, weil ihn kein anderes Werkzeug so
   löst. Er erscheint in etwa 62 % der Abrechnungen; falls nicht, einfach ein paar Beträge
   ändern, bis er da ist.

Dunkles Farbschema fotografiert sich auf Instagram besser als das helle.

---

## LinkedIn · für den Arbeitgeber-Blick

> **Collective-Calc — Gruppenausgaben teilen, ohne Server**
>
> Ein kleines Werkzeug, das eine alltägliche Frage beantwortet: Wer schuldet nach dem
> gemeinsamen Urlaub wem wie viel?
>
> Interessanter als die Funktion war für mich die Architektur. Die komplette Abrechnung
> steckt komprimiert im Fragment der URL — also hinter dem `#`, das ein Browser
> grundsätzlich nicht an einen Server schickt. Daraus folgt einiges:
>
> · Es gibt kein Backend, das ich betreiben, absichern oder bezahlen müsste.
> · Empfänger brauchen kein Konto und keine Installation — sie öffnen einen Link.
> · Ein geteilter Link funktioniert auch dann noch, wenn ich das Projekt nicht mehr
>   pflege. Es gibt keinen Dienst, der abgeschaltet werden kann.
> · Eine Urlaubswoche mit sechs Personen und vierzig Ausgaben passt in 779 Zeichen.
>
> Weil es um Geld geht, war mir die Rechnung wichtiger als alles andere. Sie läuft
> durchgehend in ganzen Cent als Ganzzahl, gerundet wird genau einmal ganz am Ende, und
> der Ausgleich sucht die beweisbar kleinste Zahl an Überweisungen. Acht Invarianten
> werden nicht nur in Tests geprüft, sondern auch zur Laufzeit — als Eingangskontrolle für
> Daten, die durch einen Messenger gereist sind.
>
> Ob diese Tests etwas taugen, misst ein Mutationstest: Er baut absichtlich Fehler in den
> Rechenkern und zählt, wie viele auffallen. 86 % insgesamt, 95 % im Ausgleichsalgorithmus.
> Der erste Lauf hat prompt zwei echte Mängel gefunden — unter anderem eine Währung in
> meiner Auswahlliste, die gar keine Untereinheit hat und alle Beträge um Faktor 100
> verschoben hätte.
>
> Quelloffen (MIT), 28 KB gepackt, zwölf Sprachen, läuft offline.
>
> → dennismit2n.github.io/collective-calc
> → github.com/Dennismit2n/collective-calc
>
> #WebDevelopment #TypeScript #OpenSource #Testing #Accessibility

---

## Mastodon / Bluesky

> Kleines Werkzeug gebaut: **Collective-Calc** rechnet aus, wer nach dem gemeinsamen
> Urlaub wem was schuldet.
>
> Die ganze Abrechnung steckt im Fragment der URL — das erreicht nie einen Server. Also
> kein Backend, kein Konto, keine App. Empfänger tippen auf einen Link und sehen ihr
> Ergebnis. Funktioniert offline.
>
> Quelloffen, 28 KB, zwölf Sprachen.
> 🔗 dennismit2n.github.io/collective-calc

---

## Für die eigene Gruppe (WhatsApp, Signal)

Der wichtigste Text von allen. Die ersten echten Nutzer kommen aus dem eigenen Umfeld,
nicht von Instagram.

> Ich hab was gebaut, weil mich das nach jedem Urlaub nervt: 🧾
> **dennismit2n.github.io/collective-calc**
>
> Du trägst ein, wer was bezahlt hat, und schickst am Ende einen Link in die Gruppe. Alle
> sehen sofort, wer wem was schuldet. Niemand muss sich irgendwo anmelden.
>
> Probiert's beim nächsten Mal aus — und sagt mir, wenn was blöd ist.

---

## Reddit — mit Vorbehalt

**Bitte vorher die Regeln des jeweiligen Subs lesen.** Viele deutsche Subs verbieten
Eigenwerbung oder verlangen eine Kennzeichnung. Ein Beitrag, der wie Werbung riecht, wird
entfernt und schadet mehr, als er bringt. Am ehesten passen `r/de`, `r/Finanzen` oder
`r/selfhosted`; bei letzterem ist der Aufhänger „kein Server nötig" der richtige.

> **Ich habe ein Werkzeug gebaut, das Gruppenausgaben ohne Server aufteilt**
>
> Nach jedem Urlaub dieselbe Diskussion, also habe ich es mir selbst gebaut.
>
> Die Besonderheit: Es gibt kein Backend. Die komplette Abrechnung steckt komprimiert im
> Fragment der URL — hinter dem `#`, das ein Browser nie an einen Server schickt. Der Link
> ist damit gleichzeitig die Daten und die Sicherung. Er funktioniert auch dann noch, wenn
> ich das Projekt irgendwann nicht mehr anfasse.
>
> Eine Urlaubswoche mit sechs Leuten und vierzig Ausgaben passt in 779 Zeichen.
>
> Gerechnet wird durchgehend in ganzen Cent, gerundet genau einmal am Ende. Der Cent, der
> nicht aufgeht, wird niemandem untergeschoben, sondern namentlich ausgewiesen.
>
> MIT-Lizenz, 28 KB, zwölf Sprachen, läuft offline.
>
> Code: github.com/Dennismit2n/collective-calc
> Live: dennismit2n.github.io/collective-calc
>
> Über Rückmeldungen freue ich mich — besonders, wenn jemand einen Rechenfehler findet.

---

## Was ich in keinen Text geschrieben habe, und warum

- **Kein Vergleich mit Splitwise, Tricount oder Splid.** Ich habe die nie geprüft. Eine
  Behauptung über fremde Werkzeuge, die sich als falsch herausstellt, kostet mehr
  Glaubwürdigkeit, als der Vergleich einbringt.
- **Kein „für immer kostenlos".** Ein Versprechen über die Zukunft, das niemand erzwingen
  kann. „Kostenlos, quelloffen" sagt dasselbe und stimmt nachprüfbar.
- **Kein „sicher" oder „verschlüsselt".** Der Link ist nicht verschlüsselt — wer ihn hat,
  sieht die Abrechnung. Das steht so in der Dokumentation und darf in der Werbung nicht
  anders klingen.
