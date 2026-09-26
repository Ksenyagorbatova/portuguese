# Отключение Dependabot

Ветка: `chore/disable-dependabot` · PR: — · Дата: 2026-09-26 · Статус: готово

## Цель

Отключить Dependabot: он больше не открывает PR с апдейтами зависимостей
(npm и GitHub Actions). Открытые Dependabot-PR (#47, #54–#56, #58–#62) закрыты
вместе с их ветками — вне диффа, через `gh pr close --delete-branch`.

## Изменения данных / API

Нет (ни схемы, ни API, ни кода приложения). Удалён конфиг Dependabot.

## Поведение (для пользователя)

- **Version updates выключены:** без `.github/dependabot.yml` GitHub не
  планирует прогоны ни для npm, ни для github-actions. Конфиг читается из
  default-ветки — эффект наступает после мёржа в `main`.
- **Security updates не остаются лазейкой:** Dependabot alerts в репозитории
  выключены (API на 2026-09-26: «Dependabot alerts are disabled for this
  repository»), а security updates без алертов не работают. Других источников
  Dependabot-PR нет.
- npm-зависимости и SHA-пины `uses:` в `.github/workflows` (`# vX` в
  комментарии) теперь обновляются только вручную.

## Ключевые решения

- **Файл удалён целиком**, а не заглушён `open-pull-requests-limit: 0`:
  заглушка нужна, только чтобы сохранить security updates с настройками из
  конфига, а они здесь выключены вместе с алертами.
- Pinning шрифта логотипа и `opentype.js` сохраняется: точные версии без `^`
  в `package.json`, страж — `favicon-outline.test.ts` («pins the font and the
  outliner to exact versions»). Раньше Dependabot вдобавок исключал их из
  апдейтов через `ignore` — без Dependabot это не нужно; отсылка к нему
  убрана из шапки `scripts/favicon-outline.mjs`.
- Исторические спеки веток (`quality-infra.md`, `dependabot-cooldown.md`,
  `ios-capacitor-app.md`) не правятся — они фиксируют состояние на момент
  своего мёржа; актуальное состояние Dependabot — эта спека.

## Тестирование

Не покрывается тестами: декларативный конфиг GitHub-сервиса, исполняется
самим GitHub и в наш тестовый стек (Vitest / convex-test / Playwright CT) не
попадает — прецедент [`quality-infra.md`](quality-infra.md) и
[`dependabot-cooldown.md`](dependabot-cooldown.md). Правка в
`favicon-outline.mjs` — только комментарий. `npm run verify` и
`npm run build` прогнаны как общий гейт ветки.

## Карта файлов

Удалено:
- `.github/dependabot.yml` — weekly npm (cooldown 7/14 дней, `ignore` шрифта
  логотипа и `opentype.js`) и github-actions (cooldown 7 дней), лимит 5 PR
  на экосистему.

Изменено:
- `scripts/favicon-outline.mjs` — из шапки убрана отсылка к Dependabot.

Добавлено:
- `specs/chore/disable-dependabot.md` — эта спека.

## Известные ограничения / дальнейшие шаги

- **До мёржа** Dependabot работает по старому конфигу: закрытие PR лишь
  «игнорирует» конкретную версию, и ближайший недельный прогон может открыть
  PR на другие зависимости (лимит 5 теперь свободен). Такие PR просто
  закрыть; после мёржа прогонов больше не будет.
- Автоматических сигналов об уязвимых или устаревших зависимостях больше нет.
  Замена — ручной `npm audit` / `npm outdated`, либо вернуть Dependabot
  alerts (Settings → Advanced Security, нужны admin-права на репозиторий).
- Вернуть version updates — восстановить `.github/dependabot.yml` из истории
  (`git log --diff-filter=D -- .github/dependabot.yml` → `git show <sha>^:.github/dependabot.yml`).
