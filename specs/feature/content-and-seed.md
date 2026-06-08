# Контент курса и идемпотентный сид

Статус: baseline (отгружено) · 2026-06-09 · источник правды в коде

## Цель

Темы / уроки / слова / теория / кросс-предложения — единый источник правды в
[`convex/content.ts`](../../convex/content.ts), заливается в таблицы Convex
идемпотентным сидом так, чтобы пере-сидинг на каждый деплой не плодил дублей и не
ломал накопленный прогресс пользователей.

## Изменения данных / API

Типы контента ([`content.ts`](../../convex/content.ts)):
`Word { pt, ru, note? }`, `Theory { intro, tip, sections[] }`,
`Lesson { id, label, theory, words[] }`, `Topic { label, icon, lessons[] }`,
`CrossSentence { words, answer, ru, required }`. Экспортируются `TOPICS`
(`Record<string, Topic>`) и `CROSS_SENTENCES`.

Таблицы (`topics`/`lessons`/`words`/`crossSentences`) — см.
[`convex/schema.ts`](../../convex/schema.ts), у каждой натуральный ключ и поле `order`.

API:
- `seed:seedContent` ([`convex/seed.ts`](../../convex/seed.ts)) — internalMutation, идемпотентный upsert.
- `getCourse` ([`convex/courseQueries.ts`](../../convex/courseQueries.ts)) — всё дерево курса.

## Поведение

- Добавить/изменить контент: правишь `content.ts` → PR → после мёржа CI пере-сидит БД.
- Локально: `npx convex run seed:seedContent`. На проде: `… --prod` (нужен `CONVEX_DEPLOY_KEY`).
- `getCourse` отдаёт дерево, отсортированное по `order` (~13 тем / ~20 уроков /
  ~200 слов / ~25 предложений ≈ 260 документов — без пагинации; одинаково для всех,
  тянется один раз и кешируется).

## Ключевые решения и алгоритмы

**Upsert по натуральным ключам.** Сид матчит существующую строку по ключу
(`topicKey` / `lessonKey=lesson.id` / `(lessonKey, pt)` / `sentenceKey`) и
`patch`-ит её, иначе `insert`. Поэтому повторный запуск безопасен: новое
вставляется, изменённое правится на месте, дублей нет.

**`order` захватывается из порядка итерации** (порядок ключей `TOPICS`, порядок
массивов lessons/words) — чтобы `getCourse` восстановил исходный порядок.

**`sentenceKey = cs_NNNN` из индекса массива** (`padStart(4,"0")`).

**Правила стабильности (иначе осиротеет прогресс):**
- Не менять существующие `lesson.id` (`lessonKey`) и `word.pt` — прогресс завязан
  на `(lessonKey, pt)` (см. [`srs-scheduling.md`](srs-scheduling.md)).
- `CROSS_SENTENCES` — только **дописывать в конец** (ключ берётся из индекса;
  вставка в середину сдвинет ключи у всех последующих).

**`note: undefined`** на re-seed: Convex трактует это как «поле отсутствует» при
insert, а `patch({ note: undefined })` чистит устаревшую заметку.

## Тестирование

- [`convex/seed.test.ts`](../../convex/seed.test.ts): идемпотентность (повторный
  `seedContent` не плодит дубли), корректность upsert.
- [`convex/courseQueries.test.ts`](../../convex/courseQueries.test.ts): форма и
  порядок дерева `getCourse`.

## Карта файлов

- [`convex/content.ts`](../../convex/content.ts) — `TOPICS`, `CROSS_SENTENCES`, типы (источник правды).
- [`convex/seed.ts`](../../convex/seed.ts) — `seedContent` (идемпотентный upsert).
- [`convex/courseQueries.ts`](../../convex/courseQueries.ts) — `getCourse`.
- [`convex/schema.ts`](../../convex/schema.ts) — таблицы контента.

## Известные ограничения

- Изменения контента катятся только через PR → мёрж → CI-сид (нет «горячей» правки).
- Переименование `lessonKey`/`pt` или вставка предложения в середину — ломает ключи;
  делать нельзя (только переезд с миграцией прогресса).
