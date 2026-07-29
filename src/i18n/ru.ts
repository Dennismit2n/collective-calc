import type { Messages } from './de.js';

/**
 * Русский — единственный язык здесь с четырьмя формами множественного числа
 * (one / few / many / other). Выбор делает `Intl.PluralRules`.
 */
export const ru: Messages = {
  'app.name': 'Collective-Calc',
  'app.tagline': 'Кто кому сколько должен?',

  'nav.events': 'События',
  'nav.back': 'Назад',
  'settings.language': 'Язык',
  'settings.theme': 'Оформление',
  'settings.theme.system': 'Системное',
  'settings.theme.light': 'Светлое',
  'settings.theme.dark': 'Тёмное',
  'settings.machineTranslated': 'Этот перевод сделан автоматически.',
  'settings.improveTranslation': 'Предложить улучшение',

  'event.new': 'Новое событие',
  'event.untitled': 'Расчёт от {date}',
  'event.rename': 'Переименовать',
  'event.delete': 'Удалить событие',
  'event.deleteConfirm': 'Удалить это событие со всеми расходами? Это нельзя отменить.',
  'event.empty.title': 'Расходов пока нет',
  'event.empty.hint': 'Впиши ниже, кто и сколько заплатил. Остальное посчитается само.',
  'event.total': 'Расходы всего',
  'event.count': {
    one: '{count} расход',
    few: '{count} расхода',
    many: '{count} расходов',
    other: '{count} расхода',
  },

  'people.heading': 'Кто участвует?',
  'people.add': 'Добавить человека',
  'people.namePlaceholder': 'Имя',
  'people.hint': 'Достаточно имени.',
  'people.cannotRemove': 'Этот человек есть в расходах — его можно только переименовать.',
  'people.you': 'Я',
  'people.needTwo': 'Добавь хотя бы двоих, тогда можно будет считать.',

  'entry.amount': 'Сумма',
  'entry.amountPlaceholder': '0,00',
  'entry.understoodAs': 'Понято как {amount}',
  'entry.description': 'За что?',
  'entry.paidBy': 'Заплатил',
  'entry.add': 'Добавить',
  'entry.unnamed': 'Расход',
  'entry.recentDescriptions': 'Недавние',
  'entry.saved': '{amount} · {description} · заплатил {payer}',
  'entry.savedNoDescription': '{amount} · заплатил {payer}',
  'entry.undo': 'Отменить',
  'entry.edit': 'Изменить',
  'entry.delete': 'Удалить',
  'entry.deleted': 'Запись удалена.',

  'split.change': 'Изменить деление',
  'split.equal': 'Поровну',
  'split.participants': 'Участвовал',
  'split.exact': 'Точные суммы',
  'split.shares': 'Доли',
  'split.percent': 'Проценты',
  'split.sumMismatch': 'Суммы дают в итоге {sum}, а расход — {total}.',
  'split.nobody': 'Должен участвовать хотя бы один человек.',
  'split.sharesHint': 'Кто считается вдвойне — ставит 2. Кто не участвовал — 0.',

  'repayment.add': 'Записать возврат',
  'repayment.from': 'От кого',
  'repayment.to': 'Кому',
  'repayment.label': 'Возврат',
  'repayment.markPaid': 'Отметить как оплаченное',
  'repayment.hint': 'Возвраты не входят в общую сумму расходов.',

  'currency.label': 'Валюта',
  'currency.foreign': 'В другой валюте',
  'currency.rate': 'Курс',
  'currency.converted': '{foreign} по курсу {rate} = {amount}',
  'currency.changeWarning':
    'Смена валюты ничего не пересчитывает — меняется только показанный знак.',
  'currency.other': 'Другая …',
  'currency.otherPlaceholder': 'напр. RON',
  'currency.unsupported':
    'Collective-Calc считает в сотых долях. Поэтому валюты без разменной единицы — иена или вона — невозможны.',

  'result.heading': 'Итог',
  'result.columnPerson': 'Человек',
  'result.columnPaidShare': 'Заплачено и доля',
  'result.columnBalance': 'Баланс',
  'result.owesShort': 'должен',
  'result.getsShort': 'получает',
  'result.owes': 'Ты должен',
  'result.gets': 'Ты получаешь',
  'result.settled': 'Всё сошлось',
  'result.personOwes': '{name} должен {amount}',
  'result.personGets': '{name} получает {amount}',
  'result.transfer': '{from} переводит {amount} — {to}',
  'result.noTransfers': 'Всё сошлось — никто никому ничего не должен.',
  'result.paidAndShare': 'заплачено {paid} · доля {share}',
  'result.repaidOut': 'возвращено {amount}',
  'result.repaidIn': 'получено {amount}',
  'result.exactValue': 'Точно: {value}',
  'result.exactHint': 'Показанные доли округлены. Нажми на число, чтобы увидеть точное значение.',
  'result.transferCount': {
    one: '{count} перевод',
    few: '{count} перевода',
    many: '{count} переводов',
    other: '{count} перевода',
  },

  'remainder.heading': 'Остаётся неразделённый остаток',
  'remainder.receivesLess': 'У {name} остаётся неполученным {amount}.',
  'remainder.paysLess': '{name} платит на {amount} меньше, чем выходит по расчёту.',
  'remainder.explain':
    'Суммы не всегда делятся на целые копейки. Этот остаток никому не приписывается — разберитесь между собой 😉',
  'remainder.wheel': 'Не договорились? Крути колесо.',

  'share.result': 'Поделиться итогом',
  'share.resultHint': 'Только имена, балансы и переводы. Отдельных расходов нет.',
  'share.full': 'Передать расчёт',
  'share.fullHint': 'Событие целиком, чтобы продолжить на другом устройстве.',
  'share.copy': 'Скопировать ссылку',
  'share.copied': 'Ссылка скопирована.',
  'share.qr': 'QR-код',
  'share.qrAlt': 'QR-код со ссылкой: {url}',
  'share.tooLarge':
    'Этот расчёт слишком велик для ссылки. Чтобы передать его, воспользуйся выгрузкой в файл.',
  'share.readOnlyNotice':
    'Ты смотришь общий расчёт. Изменения здесь не влияют на оригинал.',
  'share.openCopy': 'Открыть как свою копию',

  'backup.heading': 'Сохрани этот расчёт',
  'backup.body':
    'Данные лежат только в этом браузере. Если его очистят, они пропадут. Поделись ссылкой или скачай файл — и то и другое является полной копией.',
  'backup.share': 'Поделиться ссылкой',
  'backup.download': 'Скачать файл',
  'backup.later': 'Позже',
  'storage.notice': 'Эти данные лежат только в этом браузере.',

  'export.heading': 'Выгрузка',
  'export.json': 'Файл (JSON)',
  'export.jsonHint': 'Полный, читается обратно.',
  'export.csv': 'Таблица (CSV)',
  'export.csvHint': 'Чтобы пересчитать в Excel или LibreOffice.',
  'export.print': 'Печать или сохранение в PDF',
  'import.heading': 'Прочитать файл',
  'import.button': 'Выбрать файл',

  'error.heading': 'Сейчас этот расчёт нельзя выполнить надёжно',
  'error.body':
    'Чтобы не показать неверные суммы, Collective-Calc предпочитает не показывать чисел вовсе. Твои данные не пропали — их можно скачать.',
  'error.exportRaw': 'Скачать исходные данные',
  'error.details': 'Что именно не так',
  'error.brokenLinkTitle': 'Ссылку не удалось прочитать',
  'error.brokenLink':
    'Эту ссылку не удалось прочитать. Скорее всего, её обрезали при отправке — попроси прислать заново.',
  'error.link.empty': 'В этой ссылке нет расчёта.',
  'error.link.notOurs': 'Эта ссылка не от Collective-Calc.',
  'error.link.truncated':
    'Ссылка неполная — скорее всего, её обрезали при отправке. Попроси прислать заново.',
  'error.link.garbled': 'Содержимое ссылки не образует правильного расчёта. Попроси прислать заново.',
  'error.link.newerFormat':
    'Эта ссылка создана более новой версией Collective-Calc. Перезагрузи страницу, чтобы получить текущую версию.',
  'error.file.notALedger': 'В этом файле нет расчёта.',
  'error.file.noVersion': 'У этого файла нет версии формата, и он не из Collective-Calc.',
  'error.file.newerFormat':
    'Этот файл создан более новой версией Collective-Calc. Перезагрузи страницу, чтобы получить текущую версию.',
  'error.file.incomplete': 'Этот расчёт неполный.',
  'error.file.noPath': 'Для этого формата нет перехода. Пожалуйста, сообщи об этом случае.',

  'a11y.amountField': 'Сумма в {currency}',
  'a11y.balancePositive': 'К получению',
  'a11y.balanceNegative': 'Долг',
  'a11y.savedAnnouncement': 'Сохранено: {text}',
  'a11y.skipToContent': 'Перейти к содержимому',
  'a11y.skipToCapture': 'Перейти к вводу',
};
