# iOS-приложение на Capacitor (TestFlight) + включение регистрации

Ветка: `feat/ios-capacitor-app` · PR: не открыт (открывает владелец, тело —
[`ios-capacitor-app.pr.md`](ios-capacitor-app.pr.md)) · дата: 2026-09-26 ·
статус: **реализовано локально** — коммиты в ветке, смоук в симуляторе пройден,
push / PR / TestFlight не выполнялись (решение 12).

> **Режим «всё локально».** Владелец проверяет результат ДО того, как что-либо уйдёт
> с машины: сессия НЕ делала `git push`, НЕ открывала PR, НЕ загружала сборку в
> TestFlight и НЕ регистрировала App ID у Apple. Итог — локальная ветка с
> коммитами, симуляторная сборка и описание PR файлом.

Парный документ — [`ios-capacitor-app.runbook.md`](ios-capacitor-app.runbook.md):
протокол автономной работы (фазы, цикл «собрать → проверить в симуляторе →
починить», диагностика) и раздел «Что отличилось от плана».

## Цель

1. **Нативная iOS-обёртка** существующего SPA (React 19 + Vite 8 + Convex) на
   Capacitor 8: устанавливаемое приложение с иконкой, сплэшем, без браузерной
   обвязки, с сохранением входа между запусками, хаптикой и статус-баром под тему.
   Раздача — через **TestFlight** (у владельца платный Apple Developer Program),
   запуск загрузки — владельцем после ревью. App Store — не в этом объёме.
2. **Включить публичную регистрацию** (`SIGNUP_ENABLED` → `true` на сервере и
   клиенте). Решение владельца от 2026-09-26: без регистрации тестеры не заведут
   аккаунт с телефона, а будущая публикация в App Store потребует demo-доступ.
3. Веб-версия на GitHub Pages **не меняет поведения**, кроме включённой регистрации
   (safe-area-инсеты в браузере равны 0, нативные ветки закрыты `isNative()`).
   Контент по-прежнему живёт в Convex и не требует пересборки приложения.

## Объём

**Сделано:** iOS-проект `ios/` (Capacitor 8.5, SPM), Vite-режимы `ios`/`ios-release`
(`dist-ios`, base `/`), нативные адаптации (хранилище токенов, хаптика, статус-бар,
сплэш без белого кадра, иконки, клавиатура/поле ввода, safe-area, ATS для
локального Convex, портрет, iPhone-only, локаль `ru`), диагностика озвучки,
регистрация с тестами, CI-job `ios-build`, release-скрипты (archive → upload через
`xcodebuild`, без fastlane), документация (CLAUDE.md, README, скилл `browser-smoke`,
baseline-спеки auth/theme/training-ui), смоук в симуляторе по матрице ниже, тело PR
файлом.

**Вне объёма:** Android, офлайн-режим, пуш-уведомления, публикация в App Store
(метаданные, скриншоты, ревью), распознавание речи, PWA, self-hosted шрифты.

## Изменения данных / API

- **Схема Convex не меняется.** Серверные функции — без изменений сигнатур.
- **Регистрация:** `SIGNUP_ENABLED = true` в [`convex/auth.ts`](../../convex/auth.ts)
  и [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx). Константа
  `REGISTRATION_DISABLED` и ветка в `profile()` остаются (откат — одним флагом).
- **Хранилище токенов Convex Auth:** `ConvexAuthProvider storage={pickTokenStorage()}`
  ([`src/lib/authStorage.ts`](../../src/lib/authStorage.ts)): в нативной оболочке —
  адаптер над `@capacitor/preferences` (`getItem` → `value ?? null`), в вебе —
  `undefined` → прежний localStorage.
- **Зависимости:** `@capacitor/core`, `@capacitor/ios` 8.5.2, `@capacitor/preferences`
  8.0.1, `@capacitor/haptics` 8.0.2, `@capacitor/splash-screen` 8.0.2,
  `@capacitor/keyboard` 8.0.5; dev — `@capacitor/cli` 8.5.2. Без
  `@capacitor/status-bar` (решение 19) и без `@capacitor/assets` (решение 18).
- **Сборка:** [`vite.config.ts`](../../vite.config.ts): режимы `ios*` →
  `build.outDir = "dist-ios"`; `base` для них `/` (Pages-сборка — `/portuguese/`,
  как раньше). `ios` берёт `VITE_CONVEX_URL` из `.env.local` (dev-деплой),
  `ios-release` — из `.env.ios-release.local` (прод, gitignored по маске
  `.env.*.local`); пример — `.env.ios-release.example`.
- **npm-скрипты:** `ios:build` (`vite build --mode ios && cap sync ios`), `ios:sim`
  (`ios:build` + [`scripts/ios/run-sim.sh`](../../scripts/ios/run-sim.sh): xcodebuild
  под симулятор без подписи → install → launch), `ios:open` (`cap open ios`),
  `ios:assets` ([`render-assets.mjs`](../../scripts/ios/render-assets.mjs)),
  `ios:release` ([`release.sh`](../../scripts/ios/release.sh): прод-бандл + archive +
  upload).
- **Прод-URL Convex** (публичен — в бандле сайта): `https://harmless-seahorse-836.convex.cloud`.
- **Info.plist:** `CFBundleDisplayName = Português`; только Portrait (ключ `~ipad`
  удалён); `ITSAppUsesNonExemptEncryption = NO`; `NSAppTransportSecurity.
  NSAllowsLocalNetworking = YES`; `CFBundleDevelopmentRegion = ru` +
  `CFBundleLocalizations = [ru]`. В pbxproj `TARGETED_DEVICE_FAMILY = 1`.
  `CAPACITOR_DEBUG` (инспектор WebView, подробный лог) — только Debug
  (`debug.xcconfig`), в Release выключен.
- **Нативный код:** в [`SceneDelegate.swift`](../../ios/App/App/SceneDelegate.swift)
  корневой контроллер — `MainViewController` (подкласс `CAPBridgeViewController`,
  штатный способ Capacitor): фон WebView — цвет страницы по теме ОС (решение 21).
- **Конфиги качества:** `.oxlintrc.json` ignorePatterns += `ios`, `dist-ios`;
  `.gitignore` += `dist-ios` (внутри `ios/` — `.gitignore` шаблона: `App/App/public`,
  `App/App/capacitor.config.json`, `DerivedData`, `xcuserdata`…);
  `tsconfig.node.json` include += `capacitor.config.ts`.
- **CI:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) += job
  `ios-build` (`macos-latest`, самый свежий Xcode 26.x образа): `npm ci` →
  `npm run ios:build` с `VITE_CONVEX_URL=https://ci-placeholder.convex.cloud` →
  `xcodebuild -resolvePackageDependencies` → `xcodebuild … -sdk iphonesimulator
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`,
  везде `-packageAuthorizationProvider netrc`.

## Поведение (для пользователя)

- На iPhone: иконка «Português» (флаг Португалии + «pt», как фавикон сайта),
  сплэш — логотип на фоне темы (светлый/тёмный по ОС), затем кросс-фейд прямо в
  экран входа/дашборд. Никакой адресной строки, никакого белого кадра.
- **Вход сохраняется между запусками** и не стирается политикой WebKit (токен в
  Preferences/UserDefaults, не в localStorage WKWebView); переживает и обновление
  приложения. Выход удаляет ключи.
- **Регистрация доступна** (и на сайте): «Нет аккаунта? Зарегистрироваться» →
  форма «Регистрация» → аккаунт создаётся (email нормализуется, пароль ≥ 8) и
  сразу впускает. Поле email без автокапитализации/автокоррекции.
- **Хаптика на iPhone** впервые работает (Taptic Engine): лёгкий impact на верный,
  системный «error» на промах/ретрай; mute глушит её, как и раньше.
- **Статус-бар** следует теме приложения: светлый текст на тёмной, тёмный на
  светлой, в т.ч. при явном выборе, противоречащем ОС; на «system» — за ОС вживую.
  Контент не заезжает под «остров»/часы и home indicator (safe-area), при
  прокрутке под статус-баром — непрозрачная подложка цвета страницы.
- **Ввод ответа** («Напишите по-португальски»): поле и «Проверить» остаются над
  клавиатурой (iPhone 17 Pro и SE); без автокоррекции и автокапитализации;
  клавиша ввода — «done», отвечает как Enter.
- **Озвучка** — Web Speech API в WKWebView, голос pt-PT «Joana» (в русской
  локали — «Жуана»): авто-озвучка после ответа, 🔊 вручную, аудио-карточки.
- **Ориентация** — только портрет; iPad запускает iPhone-версию в совместимости.
- **Сеть:** как у сайта — без сети холодный старт висит на загрузке; разрыв
  посреди сессии переживается баннером и очередью мутаций Convex.
- **Контент** (темы/слова/предложения) обновляется без новой сборки — он в БД.

## Ключевые решения и алгоритмы

1. **Capacitor 8.5, iOS-платформа через SPM** (`npx cap add ios --packagemanager SPM`):
   без Ruby/CocoaPods; `Package.resolved` закоммичен (capacitor-swift-pm 8.5.2).
   Deployment target — iOS 15.0 (шаблон), симуляторы проекта — 17.4 и 26.5.
   Fallback CocoaPods не понадобился (см. решение 14).
2. **Локальный бандл, а не `server.url` на GitHub Pages.** Обёртка-«окно на сайт»
   дешевле, но App Store её заворачивает по 4.2, и старт зависит от Pages.
   Серверные правки держим additive: старый клиент на телефоне переживает свежий бэкенд.
3. **`appId = io.github.ksenyagorbatova.portuguese`, `appName = Português`.** Bundle ID
   можно сменить до ПЕРВОЙ загрузки в App Store Connect (`capacitor.config.ts` +
   `PRODUCT_BUNDLE_IDENTIFIER` в pbxproj), после неё он закреплён за записью.
4. **iPhone-only, портрет** — меньше матрица проверок; тренажёр — телефонный формат.
5. **Токены Convex Auth — в `@capacitor/preferences`** через проп `storage`
   (штатный путь провайдера для нативных оболочек): UserDefaults переживают всё,
   кроме удаления приложения. `pickTokenStorage()` решает по `isNative()`.
6. **Нативные плагины — за существующими модулями, не по компонентам:**
   [`native.ts`](../../src/lib/native.ts) — единственная точка `isNative()` (+
   `hideNativeSplash`); [`haptics.ts`](../../src/lib/haptics.ts) —
   `Haptics.impact({ style: Light })` / `Haptics.notification({ type: Error })`
   в нативе, `navigator.vibrate` в вебе, mute глушит обе ветки, отказ плагина
   гасится; [`useTheme.ts`](../../src/lib/useTheme.ts) — статус-бар (решение 19);
   [`TypeExercise.tsx`](../../src/components/exercises/TypeExercise.tsx) — атрибуты
   `autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done"
   lang="pt-PT"` (полезны и в мобильном браузере). `capacitor.config.ts`:
   `ios.contentInset = "never"`, `Keyboard.resize = KeyboardResize.Body`,
   SplashScreen — решение 20.
7. **Озвучка: Web Speech API, без плагина TTS.** Capacitor выставляет
   `mediaTypesRequiringUserActionForPlayback = []`, авто-озвучка без жеста работает.
   Диагностика в [`speech.ts`](../../src/lib/speech.ts): `console.debug("[speech]
   voices=N pt=<name|none>")` при прогреве и на `voiceschanged`, `[speech]
   start|end|error` на событиях utterance. В симуляторе: iOS 26.5 — `voices=68
   pt=Жуана (pt-PT)`, iOS 17.4 — `voices=111`, `start/end` после ответов →
   fallback на `@capacitor-community/text-to-speech` не понадобился.
8. **ATS: `NSAllowsLocalNetworking = YES`** — Debug-сборка в worktree ходит в
   локальный Convex `http://127.0.0.1:3210`; безвреден в release (прод — https/wss).
9. **Регистрация — оба флага, тесты перевёрнуты, а не удалены** (см. «Тестирование»).
   Сообщение UI на ошибку регистрации («Возможно, аккаунт с таким email уже есть»)
   покрывает и повтор email, и закрытый флаг (откат).
10. **Release без fastlane:** [`release.sh`](../../scripts/ios/release.sh) —
    проверка `.env.ios-release.local` (нет файла/переменной/.p8/не https-URL → печать
    инструкции и exit 2) → `vite build --mode ios-release` с прод-URL из env
    (env процесса сильнее `.env.local`) + проверка, что в бандле прод-URL и нет
    dev-URL → `cap sync` → `xcodebuild archive` (`generic/platform=iOS`,
    `-allowProvisioningUpdates` + ключ API, `DEVELOPMENT_TEAM`, automatic signing) →
    `-exportArchive` с [`ExportOptions.plist`](../../scripts/ios/ExportOptions.plist)
    (`app-store-connect`, `destination = upload`, `manageAppVersionAndBuildNumber`).
11. **Команда подписи:** на машине `Apple Development … (2GJM94F693)` и
    `Developer ID Application … (G2AA82378K)`; Developer ID — только у платной
    программы → в примере env `IOS_TEAM_ID=G2AA82378K`, при провале provisioning
    скрипт подсказывает вторую. Симуляторной сборке команда не нужна.
12. **Ничего не покидает машину без владельца:** ни push, ни PR, ни загрузки, ни
    archive/provisioning. Внешние взаимодействия сессии — только dev-деплой Convex
    (`npx convex dev` + `seed:seedContent` на `fast-hound-404`), npm registry, context7.
13. **Иконки/сплэш — из `public/favicon.svg`** (единый источник дизайна) — решение 18.
14. **CLI-сборка — с `-packageAuthorizationProvider netrc`.** Первый резолв SPM висел
    бесконечно на «Resolve Package Graph»: перед скачиванием бинарных артефактов
    `capacitor-swift-pm` (Capacitor/Cordova.xcframework.zip из GitHub Releases)
    SwiftPM ищет учётку github.com в связке ключей → модальный запрос Keychain,
    который в неинтерактивном запуске некому подтвердить (curl/nscurl те же URL
    качали за секунду). С `netrc` — 2 с. Флаг — в `run-sim.sh`, `release.sh`, CI.
15. **Safe-area — правка CSS (была только нижняя).** С `contentInset: "never"`
    WebView начинается под статус-баром: шапка/бренд входа уезжали под Dynamic
    Island (скриншот первого запуска). `.m-app` — `env(safe-area-inset-top)` в обоих
    правилах (базовое и ≤480px), «чистое поле» сессии — `+ env(safe-area-inset-bottom)`.
16. **Локализация бандла — `ru`** (`CFBundleDevelopmentRegion`, `CFBundleLocalizations`):
    системные строки UIKit/WebKit (меню «Вставить», панели) по-русски, в App Store
    Connect язык «Русский». `navigator.language` в коде не используется.
17. **Лог JS-консоли — `simctl launch --console-pty`, не `log stream`.** Capacitor
    печатает `console.*` через `CAPLog` = `Swift.print` (stdout), в unified log он не
    попадает; без TTY stdout буферизуется.
18. **Без `@capacitor/assets`:** 3.0.5 тянет `@capacitor/cli@5` и `sharp@0.32`
    (нативный бинарь) в devDependencies всех CI-джобов ради разовой генерации.
    [`render-assets.mjs`](../../scripts/ios/render-assets.mjs) (`npm run ios:assets`)
    рендерит фавикон Chromium'ом playwright-core прямо в `Assets.xcassets`:
    `AppIcon-512@2x.png` 1024² full-bleed (углы скругляет iOS) и сплэш 2732² —
    светлый `#f4f3ef` + тёмный `#16150f` (appearance `dark`), логотип по центру.
    Скриншот Chromium содержит альфа-канал → свой кодек
    [`png.mjs`](../../scripts/ios/png.mjs) (все 5 фильтров строк → RGB, colour
    type 2); `sips -g hasAlpha` → `no`. Правки фавикона, ломающие замены
    (`width/height`, `rx`), роняют скрипт, а не дают тихо старый дизайн.
19. **Статус-бар — `SystemBars` из `@capacitor/core` (Capacitor 8), без
    `@capacitor/status-bar`.** Плагин status-bar на `viewDidAppear` сам ставит стиль
    из своего конфига (гонка с JS) и дублирует управление `bridge.statusBarStyle`.
    `SystemBars.setStyle({ style: resolved === "dark" ? Dark : Light })` в эффекте
    `useTheme` (Dark = светлый текст) — один источник. Плюс `body::before` —
    непрозрачная подложка высотой `safe-area-inset-top` цвета `--page` (z 40, ниже
    модалки, `pointer-events: none`): при прокрутке контент уходил под часы.
20. **Сплэш прячет JS после первой отрисовки, таймер — страховка.** С
    `launchShowDuration: 0` плагин сплэш не показывает вовсе, и после LaunchScreen
    был виден белый WebView ~0,7 с (видео холодного старта). Теперь
    `launchAutoHide: true, launchShowDuration: 3000, launchFadeOutDuration: 200`, а
    `HideNativeSplash` (сосед `ErrorBoundary` в [`main.tsx`](../../src/main.tsx) —
    уйдёт и при ошибке рендера) зовёт `SplashScreen.hide({ fadeOutDuration: 200 })`
    после `window load` + двух кадров: первый кадр WebKit ждёт render-blocking CSS
    Google Fonts.
21. **Фон WebView = цвет страницы по теме ОС** (`MainViewController`): динамический
    `UIColor` #f4f3ef/#16150f и `isOpaque = false` вместо белого `systemBackground` —
    никакого белого кадра ни в светлой, ни в тёмной теме.
22. **Клавиатура: `Keyboard.resize = body` достаточно** — перебирать `native`/`ionic`
    не понадобилось. iOS даёт полю `type=email` ASCII-клавиатуру, а обычному
    текстовому — последнюю раскладку (у русскоязычного — кириллицу): для ответа по-
    португальски пользователь один раз переключает раскладку глобусом, iOS её
    запоминает. Полю нельзя навязать раскладку из веба (см. ограничения).

## Тестирование

**Автотесты** (по [`test-policy`](../../.claude/skills/test-policy/SKILL.md)), все в
тех же коммитах, что и код; итог — Vitest 24 файла / 259 тестов, Playwright CT 149:

- backend [`convex/auth.test.ts`](../../convex/auth.test.ts) — «registration
  enabled»: флаг `true`; `signUp` создаёт ровно `users` + `authAccounts` (секрет —
  хеш), выпускает токены; нормализация email; повторный `signUp` (другой регистр) →
  `already exists` без дубля и без смены пароля; `signIn` зарегистрированными
  кредами, неверный пароль → `InvalidSecret`; пароль < 8 — отказ до записи строк.
- unit: [`authStorage.test.ts`](../../src/lib/authStorage.test.ts) (get/set/remove,
  `value ?? null`, `pickTokenStorage` веб/натив); [`native.test.ts`](../../src/lib/native.test.ts)
  (`isNative`, `hideNativeSplash`: после load + 2 кадров, ожидание `load`, no-op в
  вебе, отказ плагина); [`haptics.test.ts`](../../src/lib/haptics.test.ts) (+натив:
  impact/notification, mute, отказ плагина; веб не зовёт плагин);
  [`useTheme.test.ts`](../../src/lib/useTheme.test.ts) (+статус-бар: веб не зовёт,
  натив DARK/LIGHT, живая смена ОС, отказ плагина); [`speech.test.ts`](../../src/lib/speech.test.ts)
  (+диагностика `[speech]`, поведение speak не меняется);
  [`HideNativeSplash.test.tsx`](../../src/components/HideNativeSplash.test.tsx);
  [`scripts/ios/png.test.ts`](../../scripts/ios/png.test.ts) (все 5 фильтров,
  RGB без альфы, отказ на полупрозрачном пикселе).
- CT: [`SignIn.ct.tsx`](../../src/components/SignIn.ct.tsx) (переключатель ↔ форма
  регистрации, `autocomplete`, атрибуты email); [`SafeArea.ct.tsx`](../../src/components/SafeArea.ct.tsx)
  (safe-area в правилах `.m-app` и подложка статус-бара — по CSSOM, т.к. в
  десктопном Chromium инсеты 0); [`TypeExercise.ct.tsx`](../../src/components/exercises/TypeExercise.ct.tsx)
  (атрибуты поля ответа).
- `npm run build` (Pages): `dist/` с base `/portuguese/`, `404.html == index.html`.

**Смоук в симуляторе** — протокол в раннбуке, доказательства (скриншоты, видео
холодного старта, логи консоли без строк с токенами) в
`~/Library/Logs/portuguese-ios/smoke-2026-09-26/` (`p1/`, `p2/` — iPhone 17 Pro
iOS 26.5, `se/` — iPhone SE 3rd iOS 17.4; `prev/` — уменьшенные копии). Оба прохода
на 17 Pro — с чистой установки, без правок кода между ними; сборка = коммит `fdd6ec1`
(Ф5 нативный код не трогала).

| # | Шаг | 17 Pro, проход 1 | 17 Pro, проход 2 | SE |
|---|---|---|---|---|
| 1 | Холодный запуск: сплэш → вход, без белого экрана | ✅ `p1/coldstart/f-24…f-29` | ✅ `p2/coldstart/f-24…f-29` | ✅ `se/coldstart/f-18…f-22` |
| 2 | Регистрация нового email → дашборд | ✅ `p1/02a…02g` | ✅ `p2/02a…02g` | — |
| 3 | Kill → запуск: сразу дашборд | ✅ `p1/03` | ✅ `p2/03` | — |
| 4 | Темы → урок → теория, flip, «Начать практику» → `1/N` | ✅ `p1/04a…05a` | ✅ `p2/04a…05a` | ✅ `se/04a…05a` |
| 5 | MC: «Верно!» + «следующий повтор» + «Дальше»; `[speech] start` | ✅ `p1/05b` | ✅ `p2/05b` | ✅ `se/12a` |
| 6 | Type: клавиатура, поле видно, без автокоррекции, Done/«Проверить» | ✅ `p1/05o, 06a, 06b` (Done) | ✅ `p2/05l, 06a, 06b` («Проверить») | ✅ `se/06b, 06c` |
| 7 | Выход из сессии (X) → дашборд, ScoreRow | ✅ `p1/07a` | ✅ `p2/07a` | — |
| 8 | Предложения: плитки и cloze | ✅ `p1/08c, 08h, 08k, 08m` | ✅ `p2/08b, 08d, 08h` | — |
| 9 | Тема light → dark → system, рестарт, тема ОС | ✅ `p1/09a…09e` | ✅ `p2/09a…09e` | — |
| 10 | Mute: авто-озвучка и хаптика молчат, ручной 🔊 звучит | ✅ `p1/10a, 10b` + лог | ✅ `p2/10a…10c` + лог | — |
| 11 | Выход из аккаунта → вход тем же email | ✅ `p1/11a…11c` | ✅ `p2/11a…11c` | — |
| 12 | Малый экран: «Дальше» без прокрутки, safe-area | — | — | ✅ `se/12a`: низ «Дальше» 604 < 667, `scrollHeight == clientHeight` |
| 13 | Лог: нет `Unhandled`/`TypeError`/`Failed to load`/ошибок Convex/Auth | ✅ 0 | ✅ 0 | ✅ 0 |

Шум симулятора в логе (не ошибки приложения): `NSMapGet … map table argument is
NULL`, `DiskCookieStorage changing policy`, `UIAccessibilityLoaderWebShared is
implemented in both`, `Lexicon creation for ru failed`.

Промежуточные контрольные точки фаз (скриншоты `f2-first/`, `f3-*/`, `f5/`):
первый запуск (дефект «шапка под островом» → починен), вход после kill (ключи
`CapacitorStorage.__convexAuth*` в UserDefaults), `Haptics impact/notification` в
логе, статус-бар в 4 состояниях, клавиатура, `[speech] start/end`, иконка на
домашнем экране, видео холодного старта light/dark (дефект «белый кадр» → починен),
сборка с чистого клона (`npm ci` + `npm run ios:sim`).

## Критерии приёмки (Definition of Done)

- [x] `ios/` в репозитории, `npm run ios:build` и `npm run ios:sim` работают с чистого
      клона (после `npm ci`) — проверено локальным клоном; CI-job `ios-build`
      проверен той же командой локально (на GitHub не запускался — push не делался).
- [x] Матрица смоука выполнена по критерию стабильности (2 чистых прохода подряд на
      17 Pro без правок кода + SE), скриншоты сохранены и перечислены.
- [x] Каждая фаза закрыта контрольной точкой (тесты + симулятор + журнал).
- [x] Регистрация включена и покрыта тестами; `npm run verify` и `npm run build` зелёные.
- [x] Гейты: спека актуализирована, `/code-review` прогнан и находки разобраны,
      `verify`/`build` на финальном коммите — в теле PR.
- [x] Документация: CLAUDE.md, README (iOS/TestFlight), скилл `browser-smoke`,
      baseline `auth-and-signup-gate.md` (+ `theme-system-mode.md`, `training-ui-and-shell.md`).
- [x] Ветка закоммичена, `git status` чистый; push и PR **не выполнялись**; тело PR —
      [`ios-capacitor-app.pr.md`](ios-capacitor-app.pr.md).
- [x] Release-скрипты написаны и проверены (`bash -n`, `plutil -lint`, сухие прогоны
      веток валидации); загрузка в TestFlight **не выполнялась** — хендофф ниже.

## Хендофф человеку

**Шаг 0 — ревью и отправка в GitHub (сессия этого не делала):**
`git checkout feat/ios-capacitor-app`, `git log --oneline main..HEAD`,
`git diff main...HEAD`, `npx convex dev` (dev-функции с включённой регистрацией) и
`npm run ios:sim` — пройтись по приложению в симуляторе (можно зарегистрировать свой
тестовый email). Затем `git push -u origin feat/ios-capacitor-app` (pre-push прогонит
spec-гейт и `verify`) и
`gh pr create --base main --title "feat: iOS-приложение на Capacitor + включение регистрации" --body-file specs/feat/ios-capacitor-app.pr.md`;
CI прогонит и `ios-build`. После мёржа регистрация откроется и на проде (сайт).

**TestFlight** (≈10 минут веб-интерфейсов Apple с 2FA, потом одна команда):

1. App Store Connect → Apps → «+» → New App: iOS, «Português», primary language
   Russian, Bundle ID `io.github.ksenyagorbatova.portuguese`, SKU любой. (App ID
   создастся сам при первом archive с ключом API — или заранее в developer.apple.com
   → Identifiers.)
2. App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → ключ с ролью **App Manager**; `.p8` (скачивается один раз) — в
   `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, записать Key ID и Issuer ID.
3. `cp .env.ios-release.example .env.ios-release.local` и заполнить (`IOS_TEAM_ID`,
   `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`; `VITE_CONVEX_URL` уже прод).
4. `npm run ios:release` → сборка в TestFlight через 5–15 минут обработки.
5. TestFlight → Internal Testing (участники команды, без ревью) или External
   (публичная ссылка; первая сборка версии проходит Beta App Review) → тестеры.
6. Сборка живёт 90 дней — повторять шаг 4 раз в квартал или на релиз кода
   (build number Xcode поднимает сам), либо Xcode Cloud на push в `main`.

## Карта файлов

**Добавлено:**
- `capacitor.config.ts`; `ios/` — Xcode-проект шаблона Capacitor 8.5 (SPM:
  `App/CapApp-SPM/Package.swift` генерит `cap sync`, `Package.resolved`), правки:
  `App/App/Info.plist`, `App/App/SceneDelegate.swift` (+`MainViewController`),
  `App/App/Assets.xcassets` (иконка, сплэш light/dark), `project.pbxproj`
  (`TARGETED_DEVICE_FAMILY = 1`);
- `scripts/ios/run-sim.sh`, `release.sh`, `ExportOptions.plist`, `render-assets.mjs`,
  `png.mjs` + `png.d.mts` + `png.test.ts`; `.env.ios-release.example`;
- `src/lib/native.ts`, `src/lib/authStorage.ts`, `src/components/HideNativeSplash.tsx`
  (+ тесты), `src/components/SafeArea.ct.tsx`;
- `specs/feat/ios-capacitor-app.md` (эта спека), `.runbook.md`, `.pr.md`.

**Изменено:**
- `convex/auth.ts`, `convex/auth.test.ts`, `convex/seed.ts` (комментарий),
  `src/components/SignIn.tsx` + `.ct.tsx`;
- `src/main.tsx` (storage, `HideNativeSplash`), `src/lib/haptics.ts`, `useTheme.ts`,
  `speech.ts` (+ тесты), `src/components/exercises/TypeExercise.tsx` (+ct),
  `src/index.css` (safe-area, подложка статус-бара);
- `vite.config.ts`, `package.json`/`package-lock.json`, `tsconfig.node.json`,
  `.oxlintrc.json`, `.gitignore`, `.github/workflows/ci.yml`, `scripts/wt-setup.mjs`
  (комментарий);
- `CLAUDE.md`, `README.md`, `.claude/skills/browser-smoke/SKILL.md`,
  `specs/feature/auth-and-signup-gate.md`, `theme-system-mode.md`,
  `training-ui-and-shell.md`.

## Известные ограничения / дальнейшие шаги

- Push, PR и загрузка в TestFlight — только владельцем (решение 12); CI-job
  `ios-build` на GitHub ещё не запускался (локальный эквивалент зелёный). Если
  образ `macos-latest` окажется без Xcode 26 — сменить `runs-on` на `macos-26`.
- Bundle ID закрепляется первой загрузкой — менять до неё.
- Раскладка клавиатуры для ответа — последняя использованная (у русскоязычного —
  кириллица): первое переключение на латиницу — вручную; из веба не навязать.
- Первый запуск после установки: iOS показывает чёрный кадр, пока создаёт снимок
  LaunchScreen (системное поведение, дальше — сплэш).
- Шрифты (Bricolage Grotesque, Manrope) — с Google Fonts: без сети — системные.
  Self-host через `@fontsource` — кандидат (не блокер: без сети приложение и так не
  работает).
- Регистрация без подтверждения email, капчи и rate limit — приемлемо для круга
  тестеров; перед публичным запуском — доработать (Password `verify`).
- Хаптика не проверяема в симуляторе на ощупь — проверено вызовами в логе и тестами.
- `@capacitor/cli` тянет `xcode → uuid` (npm audit: moderate) — dev-инструмент, в
  бандл не попадает.
- Android — отдельная задача (PWA/APK). Пуши и офлайн не планируются.
