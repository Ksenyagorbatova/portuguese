---
name: test-policy
description: >-
  Тест-политика проекта portuguese. Применяй при реализации ЛЮБОЙ фичи, фикса
  бага, рефакторинга или иной правки кода: что покрывать тестами, каким уровнем
  (backend convex-test / frontend Vitest / Playwright CT), где лежат файлы и
  паттерны, как проверять перед коммитом и push.
---

# Тест-политика проекта

**Жёсткое правило:** каждое изменение кода — новая фича, фикс бага, рефакторинг,
изменение поведения — покрывается тестами в ТОМ ЖЕ изменении: либо новыми
тестами, либо обновлением существующих. Перед `git push` весь набор зелёный
(это форсит `.githooks/pre-push` → `npm run verify`).

## Что каким уровнем покрывать

| Меняешь… | Уровень | Куда писать |
|---|---|---|
| Convex-функцию (`convex/*.ts`: query/mutation/action, SM-2, классификация, сид) | **backend** — Vitest + `convex-test` | `convex/<name>.test.ts` |
| Чистую логику клиента (`src/lib/*`) | **frontend-unit** — Vitest + jsdom | `src/lib/<name>.test.ts` |
| React-компонент (рендер, интеракция) | **компонентное** — Playwright CT | `src/**/<Name>.ct.tsx` |

Если правка затрагивает несколько уровней (напр. новая функция + её UI) — покрыть
каждый.

## Паттерны

**Backend (`convex-test`)** — мок Convex в памяти:
```ts
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

const t = convexTest(schema, modules);
// авторизованный пользователь: getAuthUserId парсит subject как `${userId}|session`
const userId = await t.run((ctx) => ctx.db.insert("users", {}));
const as = t.withIdentity({ subject: `${userId}|session` });
await as.mutation(api.progress.recordAnswer, { lessonKey, pt, quality: 2 });
```

**Frontend-unit** — детерминизм для недетерминированного:
```ts
vi.mock("./shuffle", () => ({ shuffle: <T>(a: readonly T[]): T[] => [...a] }));
vi.spyOn(Date, "now").mockReturnValue(0); // для меток времени (nextDueLabel и т.п.)
```

**Playwright CT** — компоненты с Convex-хуками изолируй стабом через алиас в
[`playwright-ct.config.ts`](../../../playwright-ct.config.ts) (`ctViteConfig.resolve.alias`),
стабы — в [`src/test/mocks`](../../../src/test/mocks). Презентационные компоненты
(только пропсы) монтируй напрямую.

## Команды

```bash
npm run test           # Vitest: unit + backend
npm run test:backend   # только backend
npm run test:frontend  # только unit
npm run test:ct        # Playwright CT
npm run verify         # check (typecheck+lint) + все тесты — то же, что pre-push
```

## Перед коммитом/пушем

1. Новые/изменённые тесты добавлены и **зелёные**.
2. `npm run verify` проходит целиком (typecheck тестов идёт через `tsconfig.test.json`).
3. Тестовые файлы не попадают в прод-бандл/Convex-деплой (исключены по маске
   `*.test.ts`) — не переименовывай их так, чтобы маска перестала срабатывать.

Подробности по архитектуре — раздел «Тестирование» в [CLAUDE.md](../../../CLAUDE.md).
