# SRS-планирование (SM-2) и классификация прогресса

Статус: baseline (отгружено) · 2026-06-09 · per-user прогресс на сервере

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

Индексы: `by_user_lesson_pt`, `by_user_lesson`, `by_user`. Сопутствующие таблицы:
`userStats` (streak/lastDay), `theorySeen` (userId, lessonKey).

API ([`convex/progress.ts`](../../convex/progress.ts)):
- `getSrsState()` — батч-query для всего дашборда; возвращает `streak`, `cards[]`,
  `tags[]`, `seenTheory[]`, `learnedPts[]`, `dueCountAll`, `lessonStats`, `topicStats`.
- `recordAnswer({ lessonKey, pt, quality: 0|1|2, mode: "mc"|"type" })` → `{ card, streak }`.
- `markTheorySeen({ lessonKey })`.
- `reclampSchedules()` — internalMutation, одноразовая миграция данных.

## Поведение

- `quality`: `0` — неверно обе попытки, `1` — верно со 2-й, `2` — верно с 1-й.
- Классификация слова (тег): `new` (нет строки или `seen===0`), `due` (`due<=now`),
  `learned` (выучено и не due), `ongoing` (не выучено и не due).
- `streak` растёт на **первом ответе за календарный день** (`lastDay` = `toDateString`).

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
- Иначе (ранняя практика уже выученного, ещё не `due` слова) — расписание
  (`interval`/`ef`/`due`) **не трогаем**: повтор ещё не наступил.

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

## Тестирование

- Backend [`convex/progress.test.ts`](../../convex/progress.test.ts): SM-2 с `mode`,
  «событие повторения» (интервал не инфлирует за сессию, потолок `MAX_INTERVAL`),
  «выучено» по обоим навыкам, классификация `getSrsState`, streak, идемпотентность
  `reclampSchedules`. Авторизация: `t.withIdentity({ subject: ` + "`${userId}|session`" + ` })`.
- Frontend [`src/lib/srs.test.ts`](../../src/lib/srs.test.ts): `adaptSrs` (массивы→Record),
  подписи `nextDueLabel`/`intervalLabel` (время — `vi.spyOn(Date, "now")`).

## Карта файлов

- [`convex/progress.ts`](../../convex/progress.ts) — `getSrsState`, `recordAnswer`, `markTheorySeen`, `reclampSchedules`.
- [`convex/schema.ts`](../../convex/schema.ts) — таблицы `progress`, `userStats`, `theorySeen`.
- [`src/lib/srs.ts`](../../src/lib/srs.ts) — `adaptSrs`, `wKey`, подписи времени.

## Известные ограничения

- Проверка ответа — на клиенте; сервер доверяет присланным `quality` и `mode`.
- Streak растёт при первом ответе за день (без «заморозок»/восстановления).
- Порог «выучено» (`MC_TARGET`/`TYPE_TARGET`) живёт в модели освоения —
  см. [`word-learning-model.md`](word-learning-model.md).
