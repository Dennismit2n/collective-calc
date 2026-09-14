import type { Messages } from './de.js';

/**
 * Polski — cztery formy liczby mnogiej (one / few / many / other),
 * tak samo jak w rosyjskim. Wyboru dokonuje `Intl.PluralRules`.
 */
export const pl: Messages = {
  'app.name': 'Collective-Calc',
  'app.tagline': 'Kto komu ile jest winien?',

  'nav.events': 'Wydarzenia',
  'nav.back': 'Wstecz',
  'settings.language': 'Język',
  'settings.theme': 'Wygląd',
  'settings.theme.system': 'Systemowy',
  'settings.theme.light': 'Jasny',
  'settings.theme.dark': 'Ciemny',
  'settings.machineTranslated': 'To tłumaczenie powstało automatycznie.',
  'settings.improveTranslation': 'Zaproponuj poprawkę',

  'event.new': 'Nowe wydarzenie',
  'event.untitled': 'Rozliczenie z dnia {date}',
  'event.rename': 'Zmień nazwę',
  'event.delete': 'Usuń wydarzenie',
  'event.deleteConfirm':
    'Na pewno usunąć to wydarzenie wraz ze wszystkimi wydatkami? Tego nie da się cofnąć.',
  'event.empty.title': 'Na razie brak wydatków',
  'event.empty.hint': 'Wpisz poniżej, kto ile zapłacił. Reszta wyliczy się sama.',
  'event.total': 'Wydatki łącznie',
  'event.count': {
    one: '{count} wydatek',
    few: '{count} wydatki',
    many: '{count} wydatków',
    other: '{count} wydatku',
  },

  'people.heading': 'Kto bierze udział?',
  'people.add': 'Dodaj osobę',
  'people.namePlaceholder': 'Imię',
  'people.hint': 'Wystarczy imię.',
  'people.cannotRemove': 'Ta osoba występuje w wydatkach — można tylko zmienić jej imię.',
  'people.you': 'Ja',
  'people.needTwo': 'Dodaj co najmniej dwie osoby, wtedy będzie co liczyć.',

  'entry.amount': 'Kwota',
  'entry.amountPlaceholder': '0,00',
  'entry.understoodAs': 'Odczytano jako {amount}',
  'entry.description': 'Za co?',
  'entry.paidBy': 'Zapłacił(a)',
  'entry.add': 'Dodaj',
  'entry.unnamed': 'Wydatek',
  'entry.recentDescriptions': 'Ostatnio używane',
  'entry.saved': '{amount} · {description} · zapłacił(a) {payer}',
  'entry.savedNoDescription': '{amount} · zapłacił(a) {payer}',
  'entry.undo': 'Cofnij',
  'entry.edit': 'Zmień',
  'entry.delete': 'Usuń',
  'entry.deleted': 'Wpis usunięty.',

  'split.change': 'Zmień podział',
  'split.equal': 'Po równo',
  'split.participants': 'Uczestnicy',
  'split.exact': 'Dokładne kwoty',
  'split.shares': 'Udziały',
  'split.percent': 'Procenty',
  'split.sumMismatch': 'Kwoty dają razem {sum}, a wydatek wynosi {total}.',
  'split.nobody': 'Musi uczestniczyć co najmniej jedna osoba.',
  'split.sharesHint': 'Kto liczy się podwójnie, dostaje 2. Kto nie brał udziału — 0.',

  'repayment.add': 'Zapisz spłatę',
  'repayment.from': 'Od kogo',
  'repayment.to': 'Komu',
  'repayment.label': 'Spłata',
  'repayment.markPaid': 'Oznacz jako zapłacone',
  'repayment.hint': 'Spłaty nie wliczają się do sumy wydatków.',

  'currency.label': 'Waluta',
  'currency.foreign': 'W innej walucie',
  'currency.rate': 'Kurs',
  'currency.converted': '{foreign} po kursie {rate} = {amount}',
  'currency.changeWarning':
    'Zmiana waluty niczego nie przelicza — zmienia tylko wyświetlany symbol.',
  'currency.other': 'Inna …',
  'currency.otherPlaceholder': 'np. RON',
  'currency.unsupported':
    'Collective-Calc liczy w setnych częściach jednostki. Waluty bez podjednostki — jak jen czy won — nie są więc obsługiwane.',

  'result.heading': 'Wynik',
  'result.columnPerson': 'Osoba',
  'result.columnPaidShare': 'Wyłożone i udział',
  'result.columnBalance': 'Saldo',
  'result.owesShort': 'ma oddać',
  'result.getsShort': 'ma otrzymać',
  'result.owes': 'Masz oddać',
  'result.gets': 'Masz otrzymać',
  'result.settled': 'Wyrównane',
  'result.personOwes': '{name} ma oddać {amount}',
  'result.personGets': '{name} ma otrzymać {amount}',
  'result.transfer': '{from} przelewa {amount} — odbiorca: {to}',
  'result.noTransfers': 'Wszystko wyrównane — nikt nikomu nic nie jest winien.',
  'result.paidAndShare': 'wyłożone {paid} · udział {share}',
  'result.repaidOut': 'oddane {amount}',
  'result.repaidIn': 'otrzymane {amount}',
  'result.exactValue': 'Dokładnie: {value}',
  'result.exactHint':
    'Pokazane udziały są zaokrąglone. Dotknij liczby, aby zobaczyć dokładną wartość.',
  'result.transferCount': {
    one: '{count} przelew',
    few: '{count} przelewy',
    many: '{count} przelewów',
    other: '{count} przelewu',
  },

  'remainder.heading': 'Zostaje nierozdzielona reszta',
  'remainder.receivesLess': '{name} otrzymuje o {amount} mniej, niż wynika z obliczeń.',
  'remainder.paysLess': '{name} płaci o {amount} mniej, niż wynika z obliczeń.',
  'remainder.explain':
    'Kwot nie zawsze da się podzielić na całe grosze. Ta reszta nie jest nikomu przypisana — dogadajcie się między sobą 😉',
  'remainder.wheel': 'Nie ma zgody? Zakręć kołem.',

  'share.result': 'Udostępnij wynik',
  'share.resultHint': 'Tylko imiona, salda i przelewy. Bez poszczególnych wydatków.',
  'share.full': 'Przekaż całe rozliczenie',
  'share.fullHint': 'Całe wydarzenie, aby kontynuować je na innym urządzeniu.',
  'share.copy': 'Kopiuj link',
  'share.copied': 'Link skopiowany.',
  'share.qr': 'Kod QR',
  'share.qrAlt': 'Kod QR z linkiem: {url}',
  'share.tooLarge': 'To rozliczenie jest za duże na link. Aby je przekazać, użyj eksportu do pliku.',
  'share.readOnlyNotice':
    'Oglądasz udostępnione rozliczenie. Zmiany tutaj nie wpływają na oryginał.',
  'share.openCopy': 'Otwórz jako własną kopię',

  'backup.heading': 'Zabezpiecz to rozliczenie',
  'backup.body':
    'Dane znajdują się tylko w tej przeglądarce. Gdy zostanie wyczyszczona, przepadną. Udostępnij link albo pobierz plik — jedno i drugie jest pełną kopią zapasową.',
  'backup.share': 'Udostępnij link',
  'backup.download': 'Pobierz plik',
  'backup.later': 'Później',
  'storage.notice': 'Te dane znajdują się tylko w tej przeglądarce.',

  'export.heading': 'Eksport',
  'export.json': 'Plik (JSON)',
  'export.jsonHint': 'Pełny, da się go wczytać z powrotem.',
  'export.csv': 'Arkusz (CSV)',
  'export.csvHint': 'Do przeliczenia w Excelu lub LibreOffice.',
  'export.print': 'Drukuj lub zapisz jako PDF',
  'import.heading': 'Wczytaj plik',
  'import.button': 'Wybierz plik',

  'error.heading': 'Tego rozliczenia nie da się teraz bezpiecznie obliczyć',
  'error.body':
    'Aby nie pokazać błędnych kwot, Collective-Calc woli nie pokazywać tutaj żadnych liczb. Twoje dane nie przepadły — możesz je pobrać.',
  'error.exportRaw': 'Pobierz surowe dane',
  'error.details': 'Co dokładnie się nie zgadza',
  'error.brokenLinkTitle': 'Nie udało się odczytać linku',
  'error.brokenLink':
    'Tego linku nie udało się odczytać. Prawdopodobnie został ucięty przy wysyłaniu — poproś o przesłanie go jeszcze raz.',
  'error.link.empty': 'W tym linku nie ma żadnego rozliczenia.',
  'error.link.notOurs': 'Ten link nie pochodzi z Collective-Calc.',
  'error.link.truncated':
    'Link jest niepełny — prawdopodobnie został ucięty przy wysyłaniu. Poproś o przesłanie go jeszcze raz.',
  'error.link.garbled':
    'Zawartość linku nie tworzy prawidłowego rozliczenia. Poproś o przesłanie go jeszcze raz.',
  'error.link.newerFormat':
    'Ten link powstał w nowszej wersji Collective-Calc. Odśwież stronę, aby pobrać aktualną wersję.',
  'error.file.notALedger': 'Ten plik nie zawiera żadnego rozliczenia.',
  'error.file.noVersion': 'Ten plik nie ma wersji formatu i nie pochodzi z Collective-Calc.',
  'error.file.newerFormat':
    'Ten plik powstał w nowszej wersji Collective-Calc. Odśwież stronę, aby pobrać aktualną wersję.',
  'error.file.incomplete': 'To rozliczenie jest niepełne.',
  'error.file.noPath': 'Dla tego formatu nie ma ścieżki aktualizacji. Zgłoś proszę ten przypadek.',

  'a11y.amountField': 'Kwota w {currency}',
  'a11y.balancePositive': 'Do otrzymania',
  'a11y.balanceNegative': 'Do oddania',
  'a11y.savedAnnouncement': 'Zapisano: {text}',
  'a11y.skipToContent': 'Przejdź do treści',
  'a11y.skipToCapture': 'Przejdź do formularza wpisu',
};
