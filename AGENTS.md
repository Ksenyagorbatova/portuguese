# AGENTS.md

Инструкции для ИИ-агентов в этом репозитории. **Полный гайд — в
[CLAUDE.md](CLAUDE.md)** (источник правды); этот файл — короткая выжимка для
агентов, которые читают `AGENTS.md`. Архитектура подсистем детально — в
[`specs/`](specs/) (baseline-спеки в [`specs/feature/`](specs/feature/)).

Проект: тренажёр европейского португальского (A0–A1), React 19 + TypeScript + Vite
(GitHub Pages) · Convex (БД + функции + `@convex-dev/auth`) · Node 24.

## Несокращаемые правила

1. **context7 first.** Перед тем как писать код или предлагать фикс — тяни
   актуальную документацию через MCP-сервер `context7` (Convex, React 19, Vite 8,
   `@convex-dev/auth`, Vitest, Playwright) и следуй ей. Стек быстро движется — не
   полагайся на память для API/конфигов.
2. **Ветка на задачу.** Никогда не коммить/пушить в `main` напрямую — только через
   Pull Request. Имя ветки по сути: `feat/…`, `fix/…`, `chore/…`.
3. **Тесты обязательны** в том же изменении: backend (Vitest + convex-test,
   `convex/*.test.ts`) / frontend-unit (Vitest + jsdom, `src/**/*.test.ts`) /
   компонентное (Playwright CT, `src/**/*.ct.tsx`). См. раздел «Тестирование» в
   CLAUDE.md и скилл `.claude/skills/test-policy`.
4. **Спека на задачу** `specs/<branch>.md` (что и зачем сделано) — пиши/обновляй в
   том же PR. Pre-push гейт (`.githooks/pre-push`) блокирует push кода без неё.
5. **Code-review перед push:** разбери дифф ветки, найди и почини реальные баги (с
   тестом, воспроизводящим баг), и только потом пушь.
6. **Перед каждым push всё зелёное:** `npm run verify` (typecheck + lint + unit +
   backend + Playwright CT; форсит pre-push) и `npm run build`.

## Команды

```bash
npm run dev        # Vite dev-сервер (localhost:5173)
npm run verify     # typecheck + lint (oxlint) + тесты + CT — то же, что pre-push
npm run build      # прод-сборка
npx convex dev     # бэкенд Convex + кодоген (отдельный терминал)
npm run wt:setup   # настроить git-worktree (параллельная разработка) — см. CLAUDE.md
```

Дальнейшее (архитектура SRS/очереди/тем, контент-сид, деплой, worktree) — в
[CLAUDE.md](CLAUDE.md) и [`specs/`](specs/).
