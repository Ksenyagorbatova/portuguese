---
name: convex-conventions
description: >-
  Применяй при написании или правке Convex-функций (query/mutation/action/internal)
  и их convex-test тестов в convex/ — новый endpoint, изменение
  getSrsState/recordAnswer/сида, серверная авторизация. Несёт серверные готчи
  проекта: запрет не-ASCII в именах полей Convex (pt → массивы + adaptSrs),
  натуральные ключи vs _id, getAuthUserId, internal-функции и многослойные гейты,
  паттерн convex-test (modules glob, withIdentity). Для контент-ДАННЫХ в content.ts
  — content-authoring; для логики SM-2/порогов/очереди — srs-invariants.
---

# Convex — конвенции серверных функций

## context7 first

Convex быстро движется — перед написанием функции/конфига резолвни `convex` в
**context7** и сверь актуальную форму API ([CLAUDE.md → context7](../../../CLAUDE.md)).
Не полагайся на память.

## Натуральные ключи, не `_id`

Контент и прогресс адресуются **натуральными ключами** — `topicKey`, `lessonKey`,
`pt`, `sentenceKey` — а НЕ Convex `_id`. Ре-сид контента пересоздаёт документы (новые
`_id`), поэтому per-user `progress` ссылается на `(userId, lessonKey, pt)`. Схема и
индексы — [`convex/schema.ts`](../../../convex/schema.ts). Новые связи между
контентом и пользователем строй так же — через натуральный ключ.

## ⚠️ Готч: не-ASCII в именах полей Convex запрещён

`pt` содержит диакритику (`á ã ç õ…`). Convex **запрещает не-ASCII в именах полей**
объектов (в значениях — можно). Поэтому query НЕ должен возвращать `Record`, ключ
которого содержит `pt`. Отдавай **массивами** объектов `{ lessonKey, pt, ...поля }`,
а keyed-`Record` пересобирай на клиенте (в JS ограничений на имена ключей нет).

Образец — `getSrsState` ([`convex/progress.ts`](../../../convex/progress.ts)) отдаёт
`cards[]`/`tags[]` массивами, клиент собирает Record через `adaptSrs`
([`src/lib/srs.ts`](../../../src/lib/srs.ts)). **Любой новый map-ответ с `pt` (или
другой не-ASCII строкой) в ключе — оформляй так же.**

## Авторизация

`const userId = await getAuthUserId(ctx)`:
- в **query** — `if (!userId) return null` (UI разведёт незалогиненного);
- в **mutation/action** — `if (!userId) throw new Error("Not authenticated")`.

В тестах identity задаётся как `subject: \`${userId}|session\`` (формат, который
парсит `getAuthUserId`).

## Public vs internal, гейты опасных операций

- `query`/`mutation`/`action` — публичные (доступны клиенту).
- `internalQuery`/`internalMutation`/`internalAction` — для сида, миграций,
  серверных шагов; вызываются через `internal.*`, не из клиента.
- Опасные операции защищай **многослойно**. Образец — `seed:seedLocal`
  ([`convex/seed.ts`](../../../convex/seed.ts)): отказывает, если `CONVEX_CLOUD_URL`
  не localhost ИЛИ нет `ALLOW_DEV_SEED=1`. `CONVEX_CLOUD_URL` — backend-owned
  переменная, её нельзя подделать из скрипта.
- Env читай через `globalThis.process` (не голый `process`) — чтобы файл тайпчекался
  и под фронтовым tsconfig (он подтягивает `_generated/api.d.ts`, где нет node-типов).

## Серверная авторитетность

SM-2 (`recordAnswer`) считается на сервере, но проверка ответа — на клиенте (сервер
доверяет присланным `quality`/`mode`). Любая правка планировщика/классификации —
через guard-скилл [`../srs-invariants/SKILL.md`](../srs-invariants/SKILL.md)
(несущие инварианты легко тихо сломать).

## Тесты (convex-test, обязательно)

Backend-уровень тест-политики ([`../test-policy/SKILL.md`](../test-policy/SKILL.md)).
Паттерн (см. [`convex/seed.test.ts`](../../../convex/seed.test.ts),
[`convex/progress.test.ts`](../../../convex/progress.test.ts)):

```ts
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
// грузим все Convex-модули, КРОМЕ самих тестов:
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

const t = convexTest(schema, modules);
const userId = await t.run((ctx) => ctx.db.insert("users", {}));
const as = t.withIdentity({ subject: `${userId}|session` });
await as.mutation(api.progress.recordAnswer, { lessonKey, pt, quality: 2, mode: "type" });

// env-гейты: vi.stubEnv(...) + afterEach(() => vi.unstubAllEnvs())
```

## Кодоген

`npx convex dev` (отдельный терминал) держит `convex/_generated` в синхроне со схемой
и функциями. `api`/`internal` импортируй из `./_generated/api`. Тесты исключены из
бандла по маске `*.test.ts` — не переименовывай их так, чтобы маска перестала
срабатывать.

## Карта

- [`convex/progress.ts`](../../../convex/progress.ts) — `getSrsState`/`recordAnswer` (образец массивов-вместо-Record, авторизации).
- [`convex/seed.ts`](../../../convex/seed.ts) — internal + многослойные гейты.
- [`convex/schema.ts`](../../../convex/schema.ts) — натуральные ключи и индексы.
- [`src/lib/srs.ts`](../../../src/lib/srs.ts) — `adaptSrs` (клиентская пересборка Record).
