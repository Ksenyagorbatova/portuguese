# Spec-воркфлоу + ретро-спеки + чистка CLAUDE.md + code-review gate

Ветка: `chore/spec-workflow` · PR: (TBD) · 2026-06-09 · Статус: готово к ревью

## Цель

Внедрить дисциплину спецификаций на задачу-ветку (как в проекте wershina2, но под
инфраструктуру portuguese), задокументировать уже существующий функционал
baseline-спеками, разгрузить раздутый CLAUDE.md и зафиксировать pre-push
code-review gate.

## Изменения данных / API

Нет. Только инфраструктура разработки/документация — `src/` и `convex/` не
затронуты (поэтому тесты приложения без изменений).

## Поведение

- **Скилл `/spec`** ([`.claude/skills/spec/SKILL.md`](../../.claude/skills/spec/SKILL.md)):
  создаёт/обновляет `specs/<branch>.md` из полного диффа `main...HEAD`. Русский,
  ветки `feat/fix/chore/...`.
- **Spec-гейт в pre-push** ([`.githooks/pre-push`](../../.githooks/pre-push)): если
  ветка трогает код (`^(src|convex)/`), но `specs/<branch>.md` не создан/не обновлён
  — push блокируется. Плюс печатается напоминание про `/code-review`. Затем — как
  раньше, `npm run verify`. Обход: `git push --no-verify`.
- **Baseline-спеки** на существующий функционал в `specs/feature/` (см. карту файлов).
- **CLAUDE.md** урезан: глубокая архитектура вынесена в спеки, остался обзор +
  ссылки; добавлены разделы «Specs» и «Code-review gate» в рабочий процесс.

## Ключевые решения и алгоритмы

- **Гейт встроен в существующий `.githooks/pre-push`**, без Husky: у portuguese
  уже `core.hooksPath=.githooks` (эквивалент Husky без зависимости). Порядок:
  spec-гейт (может заблокировать) → reminder → `npm run verify`. Гейт делает
  `exit 1` только при отсутствии спеки; во всех «гейт не нужен» случаях
  проваливается дальше в `verify` (а не `exit 0`), чтобы проверки всегда шли.
- **Маска `^(src|convex)/`** (в portuguese нет `src-tauri/`).
- **Baseline-спеки в `specs/feature/`** — особый случай «спека на отгруженное»;
  гейт проверяет только `specs/<текущая-ветка>.md`, поэтому им не мешает.
- **CLAUDE.md остаётся полезным самостоятельно** (он грузится каждую сессию, спеки —
  нет): несущие правила и указатели на спеки сохранены, в спеки ушёл длинный
  разбор «почему/история бага».

## Тестирование

Кода нет — юнит/бэкенд/CT не добавляются. Проверка вручную:
- `npm run verify` зелёный (typecheck+lint+тесты+CT не сломаны докуме­нтальной правкой).
- Поведение гейта: ветка с правкой `src/` без спеки → push блокируется; со спекой →
  проходит; ветка только-docs (как эта) → гейт пропускает, `verify` идёт.

## Карта файлов

Добавлено:
- `.claude/skills/spec/SKILL.md` — скилл `/spec`.
- `specs/feature/{srs-scheduling, word-learning-model, session-queue-and-rotation,
  content-and-seed, theme-system-mode, auth-and-signup-gate, training-ui-and-shell}.md`
  — baseline-спеки.
- `specs/chore/spec-workflow.md` — эта спека.

Изменено:
- `.githooks/pre-push` — добавлен spec-гейт + code-review reminder.
- `CLAUDE.md` — урезана архитектура (→ спеки), добавлены «Specs» и «Code-review gate».

## Известные ограничения

- Гейт — на pre-push (локально), не в CI; обходится `--no-verify` (by design).
- Code-review gate — напоминание, не enforcement: hook не может запустить skill.
- Baseline-спеки документируют состояние на 2026-06-09; держать в синхроне при
  правках соответствующих подсистем.
