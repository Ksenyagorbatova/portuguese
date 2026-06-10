# Очередь сессии и внутрисессионная ротация

Статус: baseline (отгружено) · 2026-06-09 · клиентская (недетерминированная) половина

## Цель

Собрать стартовый набор карточек для тренировки и **внутри сессии** доводить
каждое не выученное слово до «выучено», перемешивая слова так, чтобы показывался
весь урок, а не тесный цикл первых нескольких слов.

## Изменения данных / API

Чисто клиентская логика — серверных изменений нет. `getSrsState` (см.
[`srs-scheduling.md`](srs-scheduling.md)) отдаёт классификацию (`tags`), а клиент
делает shuffle/slice/вставку предложений ([`src/lib/queue.ts`](../../src/lib/queue.ts))
и ротацию ([`src/components/Session.tsx`](../../src/components/Session.tsx)).
Недетерминированное держим ВНЕ Convex-queries.

## Поведение

**Стартовая очередь:**
- `buildLessonQueue` — урок берёт в набор **ВСЕ** слова темы (не срез): `due`-слова
  вперёд (самые срочные), остальные — вперемешку; вставляется ≤2 кросс-предложения.
- `buildReviewQueue` — слова из уроков, чья теория просмотрена: `due` (≤15),
  `ongoing` (≤8), `learned` (≤3), все перемешаны; фолбэк — 10 случайных; вставляется
  ≤3 предложения.
- `queueCounts` → счётчики чипов `{ due, nw, rv, cr }` (срочные · новые · повторения · сочетания).

**Кросс-предложения** (`eligibleSentences`) появляются, только когда (а) все
`required`-слова выучены И (б) каждое `required`-слово приходит хотя бы из одной
темы, выученной на **≥80%** (`SENTENCE_TOPIC_THRESHOLD = 0.8`). Так сочетания
всплывают, когда тема почти освоена, — не раньше. Для слова с единственной темой
это прежнее правило «тема ≥80%»; для дублей `pt` в нескольких темах (farmácia,
olho, cabelo…) достаточно ЛЮБОЙ готовой темы — `wordTopicMap` отдаёт
`Map<pt, Set<topicKey>>`, иначе добавление дубля молча переносило бы гейт на
последнюю по порядку тему.

**Ротация** (`Session.tsx`): не выученное слово возвращается в очередь в **СЛУЧАЙНУЮ**
позицию задней части. Строка прогресса показывает **позицию** (`idx+1/items.length`),
знаменатель растёт с переспросами — это НЕ доля освоения.

## Ключевые решения и алгоритмы

Константы ([`src/lib/learning.ts`](../../src/lib/learning.ts)):
```
REQUEUE_GAP          = 3    // мин. зазор между повторами слова
SESSION_REQUEUE_CAP  = 12   // предохранитель: макс. показов слова за сессию
```

**`requeuePosition(idx, length, rnd)` — случайная позиция, не фиксированная.**
`lo = min(idx+REQUEUE_GAP, length)`, далее случайно `lo..length`. Это ключевое:
фиксированная вставка ровно на `idx+REQUEUE_GAP` образует тесный цикл из первых
`REQUEUE_GAP` слов — остальные слова урока не показываются, пока те не выучены.
Случайная позиция до конца перемешивает ВСЕ слова сессии.

**`shouldRequeue(card, shown) = !isWordLearned(card) && shown < SESSION_REQUEUE_CAP`.**
Внутрисессионное состояние слова — `WordProgress { mc, type, shown }`,
инициализируется счётчиками с сервера (`mcCorrect`/`typeCorrect`), `shown=0`.
Очередь от `queue.ts` — лишь СТАРТОВЫЙ набор; ротация доводит до `learned`.
Предложения (`kind:"sentence"`) не переспрашиваются.

## Тестирование

- [`src/lib/queue.test.ts`](../../src/lib/queue.test.ts): гейт `eligibleSentences`
  (порог темы + required), построение очередей. Shuffle мокается
  (`vi.mock("./shuffle")`) ради детерминизма.
- [`src/lib/learning.test.ts`](../../src/lib/learning.test.ts): `requeuePosition`/
  `shouldRequeue` через инжектируемый `rnd`.
- [`src/components/Session.ct.tsx`](../../src/components/Session.ct.tsx): поведение сессии (Playwright CT).

## Карта файлов

- [`src/lib/queue.ts`](../../src/lib/queue.ts) — `buildLessonQueue`, `buildReviewQueue`,
  `eligibleSentences`, `queueCounts`.
- [`src/components/Session.tsx`](../../src/components/Session.tsx) — ротация, рабочая очередь, строка прогресса.
- [`src/lib/learning.ts`](../../src/lib/learning.ts) — `REQUEUE_GAP`, `SESSION_REQUEUE_CAP`, `requeuePosition`, `shouldRequeue`.
- [`src/lib/shuffle.ts`](../../src/lib/shuffle.ts) — перемешивание (мокается в тестах).

## Известные ограничения

- Очередь строится на клиенте — на разных устройствах порядок разный (by design).
- `SESSION_REQUEUE_CAP` ограничивает добор: при упорных ошибках слово может не
  «выучиться» за одну сессию и вернётся в следующую (как `ongoing`).
