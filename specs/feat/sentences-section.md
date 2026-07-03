# Раздел «Построение предложений» в темах (пилот)

Ветка: `feat/sentences-section` · PR: (готовится) · 2026-07-03 · Статус: пилот (2 темы)

## Цель

По фидбэку пользователя: заучивать слова циклами скучно, хочется раньше применять
их в предложениях. Раньше предложения (`crossSentences`) были вшиты в словарную
сессию и открывались поздно (гейт ≥80% темы + все `required` выучены) — их почти не
видно. Задача — вынести практику предложений в **отдельный, всегда доступный раздел
темы** «Часть N — Построение предложений» с двумя типами заданий (сборка из слов и
выбор пропущенного слова), не требующими знать слова наизусть.

Это **пилот механики** на двух темах (Приветствия, Местоимения). Наполнение
остальных тем контентом — отдельным PR (B2).

## Изменения данных / API

Типы ([`src/lib/types.ts`](../../src/lib/types.ts), [`convex/content.ts`](../../convex/content.ts)):
- `TopicSentenceView` / `TopicSentence` — `{ sentenceKey?, topicKey, words[], answer, ru, blank }`.
  `blank` — целевое слово темы (чистое, без хвостовой пунктуации), одно из `words`.
- `TopicView.sentences: TopicSentenceView[]` — предложения раздела темы.
- `SessionItem` += `{ kind:"build" }` и `{ kind:"cloze" }` (оба несут `TopicSentenceView`).
- `SessionOrigin` += `{ topicKey, kind:"sentences" }`.

Контент: экспорт `TOPIC_SENTENCES` в [`content.ts`](../../convex/content.ts) — пилот
15 предложений (greetings 7, pronouns 8). Append-only, ключ `ts_NNNN` из индекса.

Схема/сид ([`convex/schema.ts`](../../convex/schema.ts), [`seed.ts`](../../convex/seed.ts)):
таблица `topicSentences` (индекс `by_sentenceKey`), идемпотентный upsert + prune —
зеркало `crossSentences`. `getCourse` ([`courseQueries.ts`](../../convex/courseQueries.ts))
группирует предложения по `topicKey` и кладёт в `topic.sentences`.

## Поведение (для пользователя)

- В теме, у которой есть предложения, под частями появляется строка **«Часть N —
  Построение предложений»** (N = число уроков + 1). Всегда доступна, без теории.
- Клик → сессия только из предложений темы: каждое случайно как **сборка** (собрать
  фразу из банка слов, `SentenceBuilder`) или **выбор пропущенного слова**
  (`ClozeExercise` — MC по 4 варианта). ru-перевод показан как опора.
- Предложения **не двигают** прогресс SRS (как и раньше `SentenceBuilder`) — влияют
  только на счёт сессии; финал раздела — обычная «Сессия завершена» без шага вперёд.
- **Словарные сессии уроков теперь чистое заучивание** — предложения из них убраны.
- Старые `crossSentences` остаются, но показываются только во вкладке «Повторение».

## Ключевые решения и алгоритмы

- **Одно предложение → оба упражнения.** Экономит контент: пишем предложение +
  помечаем `blank` (слово темы); движок ([`buildSentenceQueue`](../../src/lib/queue.ts))
  случайно (`rnd<0.5`) делает cloze либо build.
- **Дистракторы cloze — другие `blank`-слова той же темы** (`ClozeExercise` +
  `pool` из `Session`). Однотипны цели; уникальность `blank` по норме гарантирует,
  что дистрактор не совпадёт с ответом (тест `content.test.ts`).
- **Нормализация cloze** (`ClozeExercise`, зеркалит `content.test`): токен в `words`
  может нести пунктуацию (`"Olá!"`), а `blank`/варианты чистые (`"Olá"`) — сравнение
  без регистра/диакритики/хвостовой пунктуации (`deaccent` + strip `[.!?,]`).
- **Гейта доступности нет** — раздел открыт с начала темы. Механика узнавания
  (банк слов / выбор варианта) не требует знать слова наизусть.
- **Прогресс раздела не персистится (MVP)** и НЕ влияет на «выученность» темы и
  финал курса (`allLearned` остаётся по словам, `Shell.courseCompleteOf`/`headingOf`/
  `nextStepOf` отдают null/«session» для origin `sentences`).
- **Предложения убраны из `buildLessonQueue`** (был параметр `course` — удалён);
  `eligibleSentences` лишился тематического фильтра `forTopicKey` (его передавала
  только словарная сессия) и работает лишь для `buildReviewQueue`.

## Тестирование

- [`convex/content.test.ts`](../../convex/content.test.ts): инварианты `TOPIC_SENTENCES`
  — `answer===words.join(" ")`, `topicKey` существует, `blank` ∈ `words`
  (нормализованно), `blank`-слова темы уникальны по норме, у темы с предложениями их ≥4.
- [`convex/courseQueries.test.ts`](../../convex/courseQueries.test.ts): `getCourse`
  прикрепляет `sentences` к темам (своей темы, с `blank`).
- [`convex/seed.test.ts`](../../convex/seed.test.ts): счётчики/prune включают
  `topicSentences` (ghost-строка прунится).
- [`src/lib/queue.test.ts`](../../src/lib/queue.test.ts): `buildSentenceQueue`
  (микс build/cloze, cap SESSION_SIZE, пустая тема); регресс — `buildLessonQueue`
  предложений НЕ содержит; гейт cross перенесён на `buildReviewQueue`.
- [`src/components/exercises/ClozeExercise.ct.tsx`](../../src/components/exercises/ClozeExercise.ct.tsx):
  рендер пропуска/вариантов, верный выбор, retry, исчерпание попыток.
- [`src/components/TopicsTab.ct.tsx`](../../src/components/TopicsTab.ct.tsx): строка
  раздела появляется при наличии предложений и открывает его; отсутствует без них.

## Карта файлов

Изменено: `src/lib/types.ts`, `src/lib/queue.ts`, `convex/content.ts`,
`convex/schema.ts`, `convex/seed.ts`, `convex/courseQueries.ts`,
`src/components/Session.tsx`, `src/components/Shell.tsx`,
`src/components/TopicsTab.tsx`, `src/components/exercises/SentenceBuilder.tsx`,
`src/index.css` (`.m-cloze-gap`), тесты (queue/wrongOptions/content/courseQueries/
seed/TopicsTab.ct/ReviewTab.ct/Session.ct/McExercise.ct).

Добавлено: `src/components/exercises/ClozeExercise.tsx` (+ `.ct.tsx`).

## Известные ограничения / дальнейшие шаги

- **Контент — только пилот (2 темы).** PR B2 — предложения для остальных 18 тем
  (append в `TOPIC_SENTENCES`, ≥4 на тему, по тем же инвариантам).
- **Прогресс раздела не сохраняется** между сессиями (нет метки «пройдено N») —
  осознанный MVP; персистентный трекер — отдельной задачей.
- **Старые 49 `crossSentences`** живут только в «Повторении»; их разбор по темам
  (или перевод в `TOPIC_SENTENCES`) — в бэклоге, не блокирует.
