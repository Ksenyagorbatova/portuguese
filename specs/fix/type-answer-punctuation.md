# fix/type-answer-punctuation — пунктуация необязательна в ручном вводе

- **Ветка:** `fix/type-answer-punctuation` · PR: — · **Дата:** 2026-06-10 · **Статус:** готово

## Цель

Подтверждённый ревью баг: `variantsMatch` (проверка ответа в TypeExercise)
сравнивал ввод с эталоном строгим равенством после `normStr`, а `normStr`
СОХРАНЯЕТ пунктуацию `.!?,`. В контенте есть слова-фразы с пунктуацией
(«Como se chama?», «Prazer!», «Estou bem.», «Chamo-me...», «Mais devagar,
por favor.» и т.д.) — ввод `como se chama` без `?` давал две «неудачи» →
`quality 0` → штраф SM-2 за фактически верный ответ. При этом `sentenceMatch`
для кросс-предложений пунктуацию срезает — расхождение было непреднамеренным.
Подсказка под полем обещала только «акценты необязательны».

## Изменения данных / API

Нет. Контент (`convex/content.ts`), схема, Convex-функции и сигнатура
`variantsMatch(input, correctPt): boolean` не менялись.

## Поведение (для пользователя)

В упражнении «Напишите по-португальски»:

- Пунктуация `.!?,` и многоточия (`...`, `…`) необязательны с ОБЕИХ сторон:
  `como se chama` засчитывается для «Como se chama?», `chamo-me` — для
  «Chamo-me...», `mais devagar por favor` — для «Mais devagar, por favor.».
  Ввод С пунктуацией принимается как раньше.
- Для слов-лейблов с вариантами («um / uma») принимается и каждый вариант
  («um», «uma»), и весь лейбл целиком («um / uma», «um/uma» — пробелы вокруг
  `/` не важны). Перестановка вариантов («uma / um») НЕ принимается.
- Сохранено: акценто-нечувствительность (`ate logo` = «até logo»), значимый
  дефис («bem vindo» ≠ «bem-vindo», но `pode ajudar-me` = «Pode ajudar-me?»),
  цифры и слэш в ответе.
- Подсказка теперь честная: «Акценты и пунктуация необязательны — «ate logo» =
  «até logo»».

## Ключевые решения и алгоритмы

- Фикс локализован в `variantsMatch` (`src/lib/text.ts`): новая внутренняя
  `normAnswer` = `normStr` → срез `[.!?,]` (глобально; покрывает и `...`) →
  канонизация пробелов вокруг `/` → схлопывание пробелов → trim. Символ `…`
  срезает уже `normStr` (он вне allowed-класса). `normStr` НЕ менялся —
  его существующее поведение (и тест «keeps dot») сохранено.
- Сравнение: сначала полный нормализованный лейбл (`inp === normAnswer(correctPt)`)
  — кейс «um / uma», затем, как раньше, каждый вариант из `split("/")`.
- `sentenceMatch` не тронут (работал верно). `finish()`/мутации/pending в
  `TypeExercise.tsx` не тронуты (их параллельно правит другая ветка) — изменена
  ТОЛЬКО строка hint.
- Обновлена baseline-спека `specs/feature/training-ui-and-shell.md` (описание
  сверки TypeExercise).

## Тестирование

`src/lib/text.test.ts`, по политике «сначала красный тест, потом фикс»
(до фикса падали ровно 5 новых тестов, после — все зелёные):

- Буквальные пунктуированные `pt` из `convex/content.ts` (все 15 слов уроков:
  «Como se chama?», «Prazer!», «Como está?», «Estou bem.», «Não percebo.»,
  «Pode repetir?», «Não falo bem português.», «Preciso de ajuda.»,
  «Quanto custa?», «De onde é?», «Chamo-me...», «Como se diz...?»,
  «Mais devagar, por favor.», «A conta, por favor.», «Pode ajudar-me?»)
  плюс «Onde é...?» из теории — принимаются без пунктуации.
- Ввод С пунктуацией по-прежнему принимается; дефис значим; акценты/цифры;
  пустой ввод и `"?"` не проходят; чужой ответ не засчитывается.
- Полный лейбл: «um / uma», «um/uma», «dois / duas», «obrigado / obrigada»;
  отдельные варианты работают; «uma / um» отклоняется.
- Существующие тесты `deaccent`/`normStr`/`variantsMatch`/`sentenceMatch`
  не менялись и зелёные. CT-тестов, завязанных на текст hint, нет.

Прогон: `npm run verify` (typecheck + lint + unit + backend + Playwright CT)
и `npm run build` — зелёные.

## Карта файлов

- **Изменено:** `src/lib/text.ts` (фикс `variantsMatch`, новая `normAnswer`),
  `src/lib/text.test.ts` (новые тесты), `src/components/exercises/TypeExercise.tsx`
  (только строка hint), `specs/feature/training-ui-and-shell.md` (описание сверки).
- **Добавлено:** `specs/fix/type-answer-punctuation.md` (эта спека).

## Известные ограничения / дальнейшие шаги

- Слова, отличающиеся ТОЛЬКО пунктуацией, стали бы неразличимы в Type-вводе —
  в текущем контенте таких пар нет (проверено grep'ом по `content.ts`).
- Прошлый штраф SM-2 за «неверные» ответы из-за пунктуации задним числом не
  компенсируется — карточки выправятся обычными повторениями.
