# Тема: тройной переключатель и системный режим

Статус: baseline (отгружено) · 2026-06-10 · обновлено 2026-09-26 (статус-бар iOS)

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
`useState`. Эффекты лишь (а) пишут `choice` в `localStorage` и (б) применяют
resolved-тему: ставят/снимают `data-theme` на `<html>` и пишут её цвет в оба
`<meta name="theme-color">`.

**theme-color следует за темой приложения.** Эффект применения темы пишет
resolved-цвет (`#f4f3ef` / `#16150f`, синхронно с `--page` в `src/index.css`) в
ОБА media-метатега — браузерный хром совпадает с темой приложения и при явном
выборе, противоречащем ОС (статические значения из `index.html` действуют только
до первого рендера React).

**Статус-бар iOS следует за темой приложения** (iOS-оболочка Capacitor, с
2026-09-26): в том же эффекте при `isNative()` —
`SystemBars.setStyle({ style: resolved === "dark" ? SystemBarsStyle.Dark :
SystemBarsStyle.Light })` (`@capacitor/core`; `Dark` = СВЕТЛЫЙ текст для тёмного
фона). Явная светлая тема на тёмной ОС иначе оставляла бы белые часы на светлой
странице. Отказ плагина гасится. Фон WebView до первой отрисовки — цвет
`PageBackground` из каталога ассетов по теме ОС (`MainViewController` в
`ios/App/App/SceneDelegate.swift`); colorset и фон сплэша генерирует
`npm run ios:assets` из `--page` в `src/index.css`
([`scripts/ios/page-colors.mjs`](../../scripts/ios/page-colors.mjs)), рассинхрон
правки `--page` и закоммиченного colorset ловит `page-colors.test.ts`. Сплэш и
нативный фон следуют теме ОС, а не выбору в приложении (выбор живёт в
`localStorage` WebView, натив о нём не знает): при явной теме против ОС сплэш —
цвета темы ОС, затем кросс-фейд в тему приложения.

**Anti-flash до первой отрисовки** — inline-скрипт в
[`index.html`](../../index.html): явные `light`/`dark` уважает, иначе резолвит по ОС
и ставит `data-theme` ещё до рендера React. Плюс два `<meta name="theme-color">`
под светлую/тёмную схему (после маунта их содержимым управляет `useTheme`).

## Тестирование

- [`src/lib/useTheme.test.ts`](../../src/lib/useTheme.test.ts): `nextThemeChoice`
  (цикл), хук `useTheme` (явный выбор vs система, живая смена темы ОС, персист в
  `localStorage`, синк обоих `theme-color`-метатегов); статус-бар: в вебе
  `SystemBars` не зовётся, в нативе DARK/LIGHT по resolved-теме (в т.ч. на живую
  смену темы ОС), отказ плагина не роняет хук.

## Карта файлов

- [`src/lib/useTheme.ts`](../../src/lib/useTheme.ts) — `useTheme`, `nextThemeChoice`, `THEME_COLOR`.
- [`index.html`](../../index.html) — anti-flash inline-скрипт, `theme-color`.
- [`src/components/Header.tsx`](../../src/components/Header.tsx) — кнопка переключателя (иконки/подписи).
- [`src/App.tsx`](../../src/App.tsx) — прокидывает `choice`/`cycle` в `Shell`/`Header`.
- iOS: [`scripts/ios/page-colors.mjs`](../../scripts/ios/page-colors.mjs) (+test) →
  `ios/App/App/Assets.xcassets/PageBackground.colorset`, `SceneDelegate.swift`.

## Известные ограничения

- Палитра завязана на `data-theme="dark"` на `<html>`; новые цветовые токены —
  добавлять в обе ветки (см. `src/index.css`).
