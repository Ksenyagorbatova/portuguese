# Тема: тройной переключатель и системный режим

Статус: baseline (отгружено) · 2026-06-09

## Цель

Светлая / тёмная / системная тема одним циклическим переключателем в хедере. В
режиме «системная» тема следует ОС и реагирует на её смену вживую. До первой
отрисовки — без вспышки чужой темы.

## Изменения данных / API

Чисто клиентская логика. Выбор хранится в `localStorage["theme"]` как
`ThemeChoice = "light" | "dark" | "system"` (дефолт `system`). Активная тёмная
палитра включается атрибутом `data-theme="dark"` на `<html>`.

## Поведение

- Порядок клика: `light → dark → system → light` (`ORDER` в
  [`src/lib/useTheme.ts`](../../src/lib/useTheme.ts)).
- Иконки/подписи в хедере: `sun` / `moon` / `contrast` — «Тема: светлая / тёмная / системная».
- В режиме `system` тема = текущее `prefers-color-scheme`; смена темы ОС применяется
  без перезагрузки. Явный выбор (`light`/`dark`) системное предпочтение игнорирует.

## Ключевые решения и алгоритмы

**Resolved-тема — производная, не хранится.** `resolved = choice==="system" ?
(systemDark ? "dark":"light") : choice` считается **на каждом рендере**, без
синхронизирующего `setState`-в-эффекте. `systemDark` обновляется только в коллбэке
подписки `matchMedia('change')` (внешняя система), начальное значение — из ленивого
`useState`. Эффекты лишь (а) пишут `choice` в `localStorage` и (б) ставят/снимают
`data-theme` на `<html>`.

**Anti-flash до первой отрисовки** — inline-скрипт в
[`index.html`](../../index.html): явные `light`/`dark` уважает, иначе резолвит по ОС
и ставит `data-theme` ещё до рендера React. Плюс два `<meta name="theme-color">`
под светлую/тёмную схему.

## Тестирование

- [`src/lib/useTheme.test.ts`](../../src/lib/useTheme.test.ts): `nextThemeChoice`
  (цикл), `resolveTheme` (явный выбор vs система), персист в `localStorage`.

## Карта файлов

- [`src/lib/useTheme.ts`](../../src/lib/useTheme.ts) — `useTheme`, `nextThemeChoice`, `resolveTheme`.
- [`index.html`](../../index.html) — anti-flash inline-скрипт, `theme-color`.
- [`src/components/Header.tsx`](../../src/components/Header.tsx) — кнопка переключателя (иконки/подписи).
- [`src/App.tsx`](../../src/App.tsx) — прокидывает `choice`/`cycle` в `Shell`/`Header`.

## Известные ограничения

- Палитра завязана на `data-theme="dark"` на `<html>`; новые цветовые токены —
  добавлять в обе ветки (см. `src/index.css`).
