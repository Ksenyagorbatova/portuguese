---
name: context7-first
description: >-
  Применяй ПЕРЕД тем как писать или править код, использующий API внешней
  библиотеки/фреймворка/CLI — Convex (функции, схема, валидаторы v.*), React 19,
  Vite 8, @convex-dev/auth, Vitest 4, convex-test, Playwright CT, oxlint, jose.
  Тяни актуальную версионно-точную документацию через MCP-сервер context7 и следуй
  ей — стек на «передовых» версиях, формы API/конфигов разошлись с памятью модели.
  НЕ нужно для чистой логики src/lib без внешнего API и для контент-данных content.ts.
---

# context7 first — версионно-точные доки перед кодом

## Зачем

Это **обязательное правило проекта** ([CLAUDE.md → context7](../../../CLAUDE.md),
[AGENTS.md](../../../AGENTS.md)), а не пожелание. Стек стоит на свежих мажорах, где
формы API, имена опций и конфиги заметно отличаются от того, что «помнит» модель:

| Библиотека | Мажор (сверь точную версию в [`package.json`](../../../package.json)) |
|---|---|
| `convex` | 1.x — функции, `defineSchema`, валидаторы `v.*`, индексы, `internal*` |
| `@convex-dev/auth` + `@auth/core` | 0.0.x / 0.37 — провайдер Password, `createAccount`, env-ключи |
| `react` / `react-dom` | **19.x** — хуки, Suspense, новые правила |
| `vite` + `@vitejs/plugin-react` | **8.x** / 6.x — `vite.config`, base path, dev/prod |
| `vitest` + `convex-test` | **4.x** / 0.0.x — конфиг проектов, edge-runtime, API |
| `@playwright/experimental-ct-react` | 1.x — `playwright-ct.config`, фикстуры, алиасы |
| `oxlint`, `typescript`, `jose` | 1.x / **6.x** / 6.x — конфиг линтера, типы, ключи JWT |

Память для этих форм ненадёжна → не угадывай, подтяни и сверь.

## Когда применять

ПЕРЕД написанием/правкой кода, который зовёт API любой из библиотек выше: новая
Convex-функция или изменение схемы/валидаторов, React-хук или паттерн рендера,
правка `vite.config`/`vitest.config`/`playwright-ct.config`, настройка
auth-провайдера, генерация ключей `jose`, конфиг `oxlint`. Если сомневаешься,
актуальна ли форма API — это сигнал применить.

## Когда НЕ нужно

- Чистая логика `src/lib` без внешнего API (`queue.ts`, `learning.ts`, `text.ts`,
  `shuffle.ts`, `wrongOptions.ts`) — обычный TS/JS.
- Контент-**данные** в `content.ts` — это строки, не API (→ [`../content-authoring/SKILL.md`](../content-authoring/SKILL.md)).
- Проза: доки, спеки, скиллы, коммиты.

## Как (двухшаговый паттерн)

1. **`resolve-library-id`** — имя библиотеки → канонический context7-ID. Не
   хардкодь ID по памяти (они меняются) — резолви каждый раз.
2. **`query-docs` / `get-library-docs`** — этот ID + **узкий** запрос (конкретный
   API/опция/конфиг, а не «вся библиотека»), держась мажорной версии из
   [`package.json`](../../../package.json).
3. Реализуй по найденному, под актуальную версию. Затем — обычные гейты
   (тесты по [`../test-policy/SKILL.md`](../test-policy/SKILL.md), для Convex —
   готчи [`../convex-conventions/SKILL.md`](../convex-conventions/SKILL.md)).

## Связь

Доменные скиллы уже отсылают сюда — `convex-conventions` («context7 first» для
серверного API), любые правки UI/тестов/конфигов. Это общий механизм «сначала
доки, потом код» для всего стека.
