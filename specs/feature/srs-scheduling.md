# SRS-планирование (SM-2) и классификация прогресса

Статус: baseline (отгружено) · 2026-06-11 · per-user прогресс на сервере

## Цель

Серверно-авторитетное интервальное повторение (SM-2 / Эббингауз): хранить
прогресс пользователя по каждому слову, решать когда слово «к повтору», и
отдавать клиенту готовую классификацию для дашборда и построения сессий.

## Изменения данных / API

Таблица `progress` ([`convex/schema.ts`](../../convex/schema.ts)) — одна строка на
`(userId, lessonKey, pt)`, создаётся **только на первый ответ**:

| Поле | Тип | Смысл |
|---|---|---|
| `userId`,`lessonKey`,`pt` | id/string | натуральный ключ (НЕ Convex `_id`) |
| `interval` | number | дни |
| `ef` | number | ease factor, ≥ 1.3 |
| `due` | number | ms epoch — когда повтор |
| `seen`,`correct` | number | счётчики ответов |
| `lastSeen` | number | ms epoch |
| `mcCorrect`,`typeCorrect` | optional number | этапные счётчики (старые строки = 0) |
| `lapses` | optional number | накопительные провалы (`quality 0`); старые строки = 0 |

Индексы: `by_user_lesson_pt`, `by_user`. Сопутствующие таблицы:
`userStats` (`streak`/`lastDay` + optional `bestStreak`/`startedAt`; `lastDay` —
новые значения `YYYY-MM-DD`, легаси-строки — `toDateString()`), `theorySeen`
(userId, lessonKey).

Все три новых поля (`progress.lapses`, `userStats.bestStreak`,
`userStats.startedAt`) — `v.optional`, additive, миграции не требуют: старые
строки читаются с fallback (`?? 0` / `?? null`), а `recordAnswer` бэкфилит
`userStats.bestStreak`/`startedAt` при следующем ответе (см. ниже).

API ([`convex/progress.ts`](../../convex/progress.ts)):
- `getSrsState()` — батч-query для всего дашборда; возвращает `streak`,
  `lastDay` (день последнего ответа = день стрика, `null` до первого ответа;
  сырьё для галочки «день закрыт» — `doneToday` вычисляет клиент в `adaptSrs`
  сравнением со СВОИМ `localDay()`, т.к. таймзонную истину знает только он),
  `bestStreak` (максимум стрика за всё время; fallback `bestStreak ?? streak ?? 0`
  — для строки без поля `best ≥ current`), `startedAt` (день первого ответа
  `YYYY-MM-DD`; `startedAt ?? null` — оба для экрана «Финал курса»), `cards[]`
  (каждая карточка несёт `lapses`, fallback `?? 0`), `tags[]`, `seenTheory[]`,
  `learnedPts[]`, `dueCountAll`, `lessonStats`, `topicStats`.
- `recordAnswer({ lessonKey, pt, quality: 0|1|2, mode: "mc"|"type"|"audio", clientDay? })`
  → `{ card, streak }`. Валидирует натуральный ключ: слова `(lessonKey, pt)` нет в
  контенте → `ConvexError` «unknown word» (одно indexed-чтение
  `words.by_lessonKey_pt`) — опечатка клиента не создаёт осиротевшую
  progress-строку. `clientDay` (optional string `YYYY-MM-DD`) — локальный день
  клиента для стрика; валидация — формат-regex И парсимость `Date.parse`
  («2026-13-99» проходит regex, но непарсим); отсутствует/невалиден → fallback
  на серверную UTC-дату (graceful для закэшированного старого фронта).
- `markTheorySeen({ lessonKey })` — аналогично валидирует урок по
  `lessons.by_lessonKey` → `ConvexError` «unknown lesson».
- `reclampSchedules()` — internalMutation, одноразовая миграция данных.

## Поведение

- `quality`: `0` — неверно обе попытки, `1` — верно со 2-й, `2` — верно с 1-й.
- `mode`: каким упражнением отвечали. `"mc"`/`"type"` растят соответствующий
  этапный счётчик (узнавание/воспроизведение). `"audio"` (аудио-экстра,
  тренировка слуха сверх программы) НЕ растит ни `mc`, ни `type` и НЕ штрафует
  `lapses`; `seen`/`correct`/`streak` — как обычно. SM-2 от режима НЕ зависит,
  поэтому выученное due-слово, отвеченное «ушами», нормально двигает расписание
  (ветка `dueReview`), а недоученное получает обычный фикс-шаг «завтра» (`mc`/`type`
  стоят → слово не graduating). Инвариант «событие повторения» (`graduating` |
  `dueReview`) при этом не нарушен.
- Классификация слова (тег): `new` (нет строки или `seen===0`), `due` (`due<=now`),
  `learned` (выучено и не due), `ongoing` (не выучено и не due).
- **Счётчик «липучести» `lapses`.** `recordAnswer` копит
  `lapses += (quality === 0 && mode !== "audio" ? 1 : 0)` — растёт НЕЗАВИСИМО от
  SM-2, на расписание и классификацию НЕ влияет; используется только для бейджа
  «слова-липучки» в разборе ошибок (клиентский порог `LEECH_THRESHOLD=5` в
  [`src/lib/learning.ts`](../../src/lib/learning.ts)). Промах на слух
  (`mode "audio"`) не штрафует. Возвращается в `getSrsState` (в карточках).
- **Честный `streak` по локальному дню клиента.** День = валидный `clientDay`
  (`YYYY-MM-DD`, клиент шлёт `localDay()` из [`src/lib/day.ts`](../../src/lib/day.ts) —
  `toLocaleDateString("en-CA")`), иначе серверная UTC-дата. Семантика по разнице
  дней с `lastDay`: тот же день → без изменений; ровно вчера → `streak+1`;
  пропуск ≥1 дня → сброс в `1`; `clientDay` РАНЬШЕ `lastDay` (смена пояса на
  запад) → no-op (не сбрасываем, `lastDay` остаётся поздним). Ветки «тот же день»
  (`diffDays===0`) и «день в прошлом» (`diffDays<0`) объединены в `diffDays<=0` —
  поведение то же (стрик и `lastDay` не трогаем). Раньше стрик рос на любом первом
  ответе дня и никогда не сбрасывался.
- **`bestStreak` / `startedAt` (экран «Финал курса»).** Стрик-блок сперва считает
  `streak`/`lastDay`, затем ЕДИНЫМ `patch` дописывает `bestStreak = max(prev, streak)`
  и `startedAt ??= today` (бэкфил легаси-строк без этих полей — независимо от ветки
  стрика; на первом ответе пользователя оба ставятся сразу при insert `userStats`).
  `startedAt` фиксируется один раз и не меняется; `bestStreak` переживает сбросы
  стрика.

## Ключевые решения и алгоритмы

**Интервал двигается ТОЛЬКО на «событие повторения».** Это центральное решение
(чинит баг «следующий повтор: 4131 дн»). Событие — одно из:
- `graduating` = `!wasLearned && nowLearned` (слово выучивается этим ответом);
- `dueReview` = `wasLearned && due<=now` (повтор выученного, повтор реально наступил).

На событии — классический SM-2:
```
q  = quality===2 ? 5 : quality===1 ? 3 : 1
ef = max(1.3, ef + 0.1 - (5-q)*(0.08 + (5-q)*0.02))
interval = q<2 ? 1 : interval===0 ? 1 : interval===1 ? 6 : round(interval*ef)
interval = min(interval, MAX_INTERVAL)   // потолок
due = now + interval*DAY
```
- Иначе если слово ещё не выучено (`!nowLearned`) — короткий фикс-шаг обучения:
  `due = now + DAY` (через день). Так слово классифицируется как `ongoing`, а не
  застревает на `due=0`/«срочное», и БЕЗ умножения интервала.
- Иначе при **lapse на ранней практике** (выученное, `due>now`, `quality===0`) —
  `interval = 1`, `due = now + DAY`; **`ef` не трогаем** (рационал: ef-штраф
  остаётся на due-повторах, ранний lapse только приближает повтор — «забыл
  сейчас» не должен ждать далёкого due). Это сужение интервала, анти-инфляционный
  инвариант (про умножение на `ef` вне события повторения) не нарушается.
- Иначе (ранняя практика уже выученного, ещё не `due` слова, `quality` 1/2) —
  расписание (`interval`/`ef`/`due`) **не трогаем**: повтор ещё не наступил.

**`MAX_INTERVAL = 120` дн (≈ «через 4 месяца»).** Чистый SM-2 интервал не
ограничивает, но для A0–A1 даже знакомое слово полезно показывать хотя бы раз в
~4 месяца («вечного выпуска» из ротации нет — самое «выученное» всё равно всплывёт
как `due`). Без потолка подпись «следующий повтор» уходила в годы и выглядела
сломанной.

**`cards`/`tags` возвращаются МАССИВАМИ, не Record.** `pt` содержит не-ASCII
(á, ã, ç…), а Convex запрещает не-ASCII в именах полей объектов (значения — можно).
Клиент пересобирает keyed-Record через `adaptSrs` ([`src/lib/srs.ts`](../../src/lib/srs.ts)).
**При добавлении новых map-ответов с `pt` в ключе — поступать так же.**

**`reclampSchedules` — одноразовая идемпотентная миграция.** Легаси-строки,
записанные до фикса инфляции (`interval` множился на `ef` на каждый ответ, без
потолка), несут раздутые `interval`/`due`. Текущий планировщик не переписывает
расписание не-`due` выученного слова, поэтому значения заморожены. Миграция
обрезает каждую строку под `MAX_INTERVAL`; повторный запуск — no-op. Запуск:
`npx convex run progress:reclampSchedules` (на проде — c `--prod`).

**Подписи времени** (`nextDueLabel`/`intervalLabel`, [`src/lib/srs.ts`](../../src/lib/srs.ts))
считаются на клиенте из карточки и текущего времени; большие интервалы округляются
в недели/месяцы/«примерно через год» (а не «через 455 дн»).

**Мгновенная метка в фидбэке** — клиентское ЗЕРКАЛО планировщика
(`predictCardAfterAnswer`, [`src/lib/srsPredict.ts`](../../src/lib/srsPredict.ts)):
упражнение показывает «следующий повтор» вместе с вердиктом, не дожидаясь
ответа `recordAnswer` (раньше текст «—» → «завтра» дёргался после
roundtrip'а). Сервер остаётся истиной для данных: его ответ тихо поправляет
метку при расхождении, отказ мутации — «—» + «Не удалось сохранить ответ».
Mode-параметр зеркала включает `"audio"` (`mc`/`type`-инкременты уже гейтятся
по `=== "mc"`/`"type"`, а SM-2-логика от режима не зависит — расчёт тот же).
Формулы зеркала пинятся к серверу матрицей в
[`convex/progress.test.ts`](../../convex/progress.test.ts) (вся жизнь слова
через настоящий `recordAnswer`, включая audio-шаги — изучение ушами и due-повтор
ушами) — менять планировщик и зеркало только вместе.

**Миграция формата `lastDay`.** Легаси-значения — `toDateString()`
(«Mon Jun 09 2026»), новые — `YYYY-MM-DD`; сравнение — через `Date.parse` обоих
форматов c округлением разницы до целых суток (легаси парсится в локальной
полуночи рантайма, ISO — в UTC; `Math.round` гасит сдвиг TZ). Непарсимое значение
→ ветка сброса. Перезапись новым форматом происходит при первом же сдвиге дня;
отдельной миграции данных не требуется. Однократный побочный эффект на
деплой-границе — смена БАЗИСА дня (легаси-день — UTC сервера, новый — локальный
день клиента): пользователь восточнее UTC, чей последний до-деплойный ответ
попал в первые часы после местной полуночи, при первом ответе после деплоя
получит `diff=2` → ложный сброс (западнее UTC — симметрично пропущенный `+1`);
самоизлечивается со следующим днём, кодом не чиним осознанно.

**Пороги в backend-тестах пинятся К КЛИЕНТСКИМ константам.**
[`convex/progress.test.ts`](../../convex/progress.test.ts) импортирует
`MC_TARGET`/`TYPE_TARGET` из [`src/lib/learning.ts`](../../src/lib/learning.ts) и
проверяет, что выпуск (interval 0→1) случается РОВНО на ответе, добирающем эти
значения, — рассинхрон любой из двух копий констант (клиентской или серверной в
`convex/progress.ts`) роняет тест.

## Тестирование

- Backend [`convex/progress.test.ts`](../../convex/progress.test.ts): SM-2 с `mode`,
  «событие повторения» (интервал не инфлирует за сессию, потолок `MAX_INTERVAL`),
  lapse при ранней практике (`quality=0` → interval 1/due≈завтра/ef прежний;
  1/2 — no-op), «выучено» по обоим навыкам с порогами из `src/lib/learning`
  (кросс-слойный пин), классификация `getSrsState`, валидация ключей, стрик
  (тот же день / вчера / пропуск / legacy-формат / clientDay раньше lastDay /
  невалидный — в т.ч. regex-валидный, но непарсимый — или отсутствующий
  clientDay), идемпотентность `reclampSchedules`. Новое:
  `lapses` (растёт только на `quality=0`, не на `mode "audio"`; отдаётся в
  `getSrsState`); `bestStreak` (держит максимум при сбросе стрика) и `startedAt`
  (фиксируется один раз); `mode "audio"` (не двигает `mc`/`type`/`lapses`, но
  due-повтор ушами двигает SM-2); пин-матрица зеркала `predictCardAfterAnswer`
  дополнена audio-шагами (изучение + due-повтор ушами).
  Авторизация: `t.withIdentity({ subject: ` + "`${userId}|session`" + ` })`.
- Frontend [`src/lib/srs.test.ts`](../../src/lib/srs.test.ts): `adaptSrs` (массивы→Record,
  прокидка `lapses`/`bestStreak`/`startedAt`), подписи `nextDueLabel`/`intervalLabel`
  (время — `vi.spyOn(Date, "now")`);
  [`src/lib/day.test.ts`](../../src/lib/day.test.ts): `localDay` (формат
  `YYYY-MM-DD`, нули, локальная TZ).

## Карта файлов

- [`convex/progress.ts`](../../convex/progress.ts) — `getSrsState`, `recordAnswer` (mode `mc`/`type`/`audio`, `lapses`, `bestStreak`/`startedAt`), `markTheorySeen`, `reclampSchedules`.
- [`convex/schema.ts`](../../convex/schema.ts) — таблицы `progress` (+ optional `lapses`), `userStats` (+ optional `bestStreak`/`startedAt`), `theorySeen`.
- [`src/lib/srs.ts`](../../src/lib/srs.ts) — `adaptSrs` (прокидывает `lapses ?? 0`, `bestStreak`, `startedAt`), `wKey`, подписи времени.
- [`src/lib/srsPredict.ts`](../../src/lib/srsPredict.ts) — `predictCardAfterAnswer` (зеркало планировщика, mode `mc`/`type`/`audio`), пинится матрицей в `convex/progress.test.ts`.
- [`src/lib/types.ts`](../../src/lib/types.ts) — `CardFields` (+ optional `lapses?`), `SrsState` (+ `bestStreak`/`startedAt`).
- [`src/lib/day.ts`](../../src/lib/day.ts) — `localDay()` (локальный день клиента для `clientDay`).

## Известные ограничения

- Проверка ответа — на клиенте; сервер доверяет присланным `quality`, `mode`
  (включая `"audio"`) и `clientDay` (день можно «подделать», но это личный тренажёр).
- Стрик без «заморозок»/восстановления; день перерыва обнуляет серию до 1
  (но `bestStreak` хранит исторический максимум для финала курса).
- `lapses` копится монотонно (только растёт), без «прощения» — порог
  «липучести» (`LEECH_THRESHOLD`) и сам бейдж живут на клиенте, чисто
  презентационно (на расписание/классификацию не влияют).
- Порог «выучено» (`MC_TARGET`/`TYPE_TARGET`) живёт в модели освоения —
  см. [`word-learning-model.md`](word-learning-model.md).
