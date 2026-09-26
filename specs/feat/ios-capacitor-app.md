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
  и [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx); рубильник
  `assertSignUpAllowed` (код `REGISTRATION_DISABLED`) остаётся — откат одним флагом.
  Новые коды `ConvexError` провайдера Password: `ACCOUNT_EXISTS` (signUp на занятый
  email — до проверки пароля), `INVALID_EMAIL` (не похоже на email); клиент
  переводит коды в тексты (решение 9). Сигнатуры функций не меняются.
- **Хранилище токенов Convex Auth:** `ConvexAuthProvider storage={pickTokenStorage()}`
  ([`src/lib/authStorage.ts`](../../src/lib/authStorage.ts)): в нативной оболочке —
  адаптер над `@capacitor/preferences` (`getItem` → `value ?? null`), если плагин
  есть в нативной сборке (`hasNativePlugin("Preferences")`); в вебе — `undefined` →
  прежний localStorage.
- **Зависимости:** `@capacitor/core`, `@capacitor/ios` 8.5.2, `@capacitor/preferences`
  8.0.1, `@capacitor/haptics` 8.0.2, `@capacitor/splash-screen` 8.0.2,
  `@capacitor/keyboard` 8.0.5; dev — `@capacitor/cli` 8.5.2 и `playwright-core`
  (версия раннера CT — тот же Chromium; для `render-assets.mjs`). Без
  `@capacitor/status-bar` (решение 19) и без `@capacitor/assets` (решение 18).
- **Сборка:** [`vite.config.ts`](../../vite.config.ts): режимы `ios*` →
  `build.outDir = "dist-ios"`; `base` для них `/` (Pages-сборка — `/portuguese/`,
  как раньше). `ios` берёт `VITE_CONVEX_URL` из `.env.local` (dev-деплой),
  `ios-release` — прод-URL из коммитнутого `.env.ios-release` (не секрет — он же
  в бандле сайта; `release.sh` ещё и экспортирует его в окружение сборки). Секреты
  Apple — в `.env.ios-release.local` (gitignored по маске `.env.*.local`), образец —
  `.env.ios-release.example`.
- **npm-скрипты:** `ios:build` (`vite build --mode ios && cap sync ios`), `ios:sim`
  (`ios:build` + [`scripts/ios/run-sim.sh`](../../scripts/ios/run-sim.sh): xcodebuild
  под симулятор без подписи → install → launch; решение 24), `ios:open` (`cap open ios`),
  `ios:assets` ([`render-assets.mjs`](../../scripts/ios/render-assets.mjs)),
  `ios:release` ([`release.sh`](../../scripts/ios/release.sh): прод-бандл + archive +
  upload; `--check` — только проверка настройки).
- **Прод-URL Convex** (публичен — в бандле сайта): `https://harmless-seahorse-836.convex.cloud`.
- **Info.plist:** `CFBundleDisplayName = Português`; только Portrait (ключ `~ipad`
  удалён); `ITSAppUsesNonExemptEncryption = NO`; `NSAppTransportSecurity.
  NSAllowsLocalNetworking = YES`; `CFBundleDevelopmentRegion = ru` +
  `CFBundleLocalizations = [ru]`. В pbxproj `TARGETED_DEVICE_FAMILY = 1`.
  `CAPACITOR_DEBUG` (инспектор WebView, подробный лог) — только Debug
  (`debug.xcconfig`), в Release выключен. `IPHONEOS_DEPLOYMENT_TARGET = 16.4`
  (решение 1); манифест приватности `PrivacyInfo.xcprivacy` в ресурсах App
  (решение 23).
- **Нативный код:** в [`SceneDelegate.swift`](../../ios/App/App/SceneDelegate.swift)
  корневой контроллер — `MainViewController` (подкласс `CAPBridgeViewController`,
  штатный способ Capacitor): фон WebView — цвет `PageBackground` из каталога
  ассетов (решение 21).
- **Конфиги качества:** `.oxlintrc.json` ignorePatterns += `/ios` (от корня —
  `scripts/ios` линтуется), `dist-ios`;
  `.gitignore` += `dist-ios` (внутри `ios/` — `.gitignore` шаблона: `App/App/public`,
  `App/App/capacitor.config.json`, `DerivedData`, `xcuserdata`…);
  `tsconfig.node.json` include += `capacitor.config.ts`.
- **CI:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) += job
  `ios-build` (решение 25): `npm ci` → `npm run ios:build` с
  `VITE_CONVEX_URL=https://ci-placeholder.convex.cloud` → `xcodebuild … -sdk
  iphonesimulator -destination 'generic/platform=iOS Simulator'
  -packageAuthorizationProvider netrc ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build`.

## Поведение (для пользователя)

- На iPhone: иконка «Português» (флаг Португалии + «pt», как фавикон сайта),
  сплэш — логотип на фоне темы (светлый/тёмный по ОС), затем кросс-фейд прямо в
  экран входа/дашборд — без промежуточного спиннера «Загрузка…», без адресной
  строки и белого кадра.
- **Вход сохраняется между запусками** и не стирается политикой WebKit (токен в
  Preferences/UserDefaults, не в localStorage WKWebView); переживает и обновление
  приложения. Выход удаляет ключи.
- **Регистрация доступна** (и на сайте): «Нет аккаунта? Зарегистрироваться» →
  форма «Регистрация» → аккаунт создаётся (email нормализуется, пароль ≥ 8) и
  сразу впускает. Занятый email → «Аккаунт с таким email уже есть — войдите.»
  (без входа, даже с верным паролем); опечатка в адресе → «Проверьте email…».
  Поле email без автокапитализации/автокоррекции.
- **Хаптика на iPhone** впервые работает (Taptic Engine): лёгкий impact на верный,
  системный «error» на промах/ретрай; mute глушит её, как и раньше.
- **Статус-бар** следует теме приложения: светлый текст на тёмной, тёмный на
  светлой, в т.ч. при явном выборе, противоречащем ОС; на «system» — за ОС вживую.
  Контент не заезжает под «остров»/часы и home indicator (safe-area), при
  прокрутке под статус-баром — непрозрачная подложка цвета страницы.
- **Клавиатура ужимает экран**: поле ответа и «Проверить», RetryBox «Не совсем!»,
  баннер ошибки и низ формы входа — над клавиатурой или докручиваются к ней
  (iPhone 17 Pro и SE). Поле ответа без автокоррекции и автокапитализации;
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
   **Минимальная iOS — 16.4** (шаблон — 15.0): Vite 8 собирает бандл под
   `baseline-widely-available` (Safari 16.4+), CSS использует `:has()` — на более
   старой iOS бандл мог бы не выполниться. Отсекает только iPhone, застрявшие на
   iOS 15 (6s/7/SE 1-го поколения). `cap sync` выводит из таргета платформу
   SPM-пакета (`.iOS(.v16)`). Симуляторы проекта — 17.4 и 26.5.
2. **Локальный бандл, а не `server.url` на GitHub Pages.** Обёртка-«окно на сайт»
   дешевле, но App Store её заворачивает по 4.2, и старт зависит от Pages.
   Цена — **замороженный клиент**: сборка в TestFlight живёт до 90 дней, а
   прод-Convex деплоится на каждый мёрж, поэтому правки API Convex — только
   аддитивные (новые аргументы `v.optional`, поля ответов не удалять и не
   переименовывать); правило — в CLAUDE.md.
3. **`appId = io.github.ksenyagorbatova.portuguese`, `appName = Português`.** Bundle ID
   можно сменить до ПЕРВОЙ загрузки в App Store Connect (`capacitor.config.ts` +
   `PRODUCT_BUNDLE_IDENTIFIER` в pbxproj), после неё он закреплён за записью.
4. **iPhone-only, портрет** — меньше матрица проверок; тренажёр — телефонный формат.
5. **Токены Convex Auth — в `@capacitor/preferences`** через проп `storage`
   (штатный путь провайдера для нативных оболочек): UserDefaults переживают всё,
   кроме удаления приложения. `pickTokenStorage()` решает по
   `hasNativePlugin("Preferences")`: нативная сборка без плагина (не прогнали
   `cap sync`) остаётся на localStorage, а не застревает в AuthLoading на
   реджекте `Preferences.get`.
6. **Нативные плагины — за существующими модулями, не по компонентам:**
   [`native.ts`](../../src/lib/native.ts) — единственная точка `isNative()` (+
   `hasNativePlugin`, `hideNativeSplash`); [`haptics.ts`](../../src/lib/haptics.ts) —
   один helper: mute глушит всё, в нативе `Haptics.impact({ style: Light })` /
   `Haptics.notification({ type: Error })`, в вебе `navigator.vibrate`, отказ
   плагина гасится; [`useTheme.ts`](../../src/lib/useTheme.ts) — статус-бар
   (решение 19); [`TypeExercise.tsx`](../../src/components/exercises/TypeExercise.tsx) —
   `autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done"`
   (полезны и в мобильном браузере). Без `lang="pt-PT"` на поле: раскладку iOS он
   не переключает, а доступное имя поля — русский плейсхолдер, который VoiceOver
   прочёл бы португальским голосом. `capacitor.config.ts`: `ios.contentInset =
   "never"`, Keyboard — решение 22, SplashScreen — решение 20.
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
   **signUp на занятый email не проверяет пароль:** штатный путь Password для
   существующего аккаунта (`createAccountFromCredentials`) сверяет пароль и при
   совпадении впускает — без rate limit пути signIn, т.е. signUp был бы оракулом
   подбора пароля. Обёртка `rejectSignUpForExistingAccounts` подменяет
   `provider.options.authorize` (там живёт настоящий authorize: `@convex-dev/auth`
   0.0.93 мерджит `options` в провайдер при материализации): для `signUp` —
   рубильник, валидация email, `retrieveAccount` без секрета и
   `ConvexError("ACCOUNT_EXISTS")`, затем исходный authorize. Смена формы
   провайдера роняет модуль при загрузке, а не молча снимает защиту. Коды
   `ConvexError` доходят до прод-клиента (обычный `Error` — только «Server
   Error»), поэтому UI различает «аккаунт есть» / «опечатка в email» /
   «регистрация закрыта» / общий сбой. Переключатель «Нет аккаунта?» —
   `<button type="button">` (раньше `<div>` — недоступен с клавиатуры).
10. **Release без fastlane:** [`release.sh`](../../scripts/ios/release.sh) читает
    `.env.ios-release.local` построчно `KEY=VALUE` — НЕ исполняет его как shell
    (плейсхолдер `<you>` или пробел в пути ломали `source`); кавычки снимаются,
    `~/` раскрывается, CRLF не мешает. Валидация до сборки (нет файла/ключа/.p8,
    Team ID и Key ID не `[A-Z0-9]{10}`, Issuer ID не из UUID-символов, прод-URL не
    `https://*.convex.cloud` → инструкция и exit 2; `--check` — только проверка).
    Прод-URL — из коммитнутого `.env.ios-release`, экспортируется в окружение
    сборки (сильнее любых `.env`-файлов); после `vite build --mode ios-release` —
    проверка, что в бандле прод-URL и нет dev-URL → `cap sync` → `xcodebuild
    archive` (`generic/platform=iOS`, `-allowProvisioningUpdates` + ключ API,
    `DEVELOPMENT_TEAM`, automatic signing) → `-exportArchive` с
    [`ExportOptions.plist`](../../scripts/ios/ExportOptions.plist)
    (`app-store-connect`, `destination = upload`, `manageAppVersionAndBuildNumber`).
11. **Команда подписи:** на машине `Apple Development … (2GJM94F693)` и
    `Developer ID Application … (G2AA82378K)`; Developer ID — только у платной
    программы → в примере env `IOS_TEAM_ID=G2AA82378K`, при провале provisioning
    скрипт подсказывает вторую. Автоподпись архива берёт development-профиль, а
    Apple выдаёт его только команде хотя бы с одним зарегистрированным
    устройством — это шаг хендоффа (вместе с явной регистрацией App ID: форма New
    App в App Store Connect предлагает только уже заведённые Bundle ID).
    Симуляторной сборке команда не нужна.
12. **Ничего не покидает машину без владельца:** ни push, ни PR, ни загрузки, ни
    archive/provisioning. Внешние взаимодействия сессии — только dev-деплой Convex
    (`npx convex dev` + `seed:seedContent` на `fast-hound-404`), npm registry, context7.
13. **Иконки/сплэш — из `public/favicon.svg`, цвета фона — из `--page`**
    (единые источники дизайна) — решения 18 и 21.
14. **CLI-сборка — с `-packageAuthorizationProvider netrc`.** Иначе перед
    скачиванием бинарных артефактов `capacitor-swift-pm` (Capacitor/Cordova
    .xcframework.zip из GitHub Releases) SwiftPM ищет учётку github.com в связке
    ключей: модальный запрос Keychain в неинтерактивном запуске некому
    подтвердить, сборка висит на «Resolve Package Graph». Флаг — в `run-sim.sh`,
    `release.sh`, CI.
15. **Safe-area — в CSS.** С `contentInset: "never"` WebView начинается под
    статус-баром, поэтому `.m-app` отступает на `env(safe-area-inset-top)` в обоих
    правилах (базовое и ≤480px), «чистое поле» сессии — ещё и на
    `env(safe-area-inset-bottom)`; иначе шапка и бренд входа уходят под Dynamic
    Island.
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
    `AppIcon-512@2x.png` 1024² full-bleed (углы скругляет iOS) и сплэш 2732² на
    фоне `--page` обеих тем (appearance `dark`), логотип по центру; тем же
    `--page` пишет `PageBackground.colorset` (решение 21). Цвета читает
    [`page-colors.mjs`](../../scripts/ios/page-colors.mjs) из `src/index.css`
    (`:root` / `[data-theme="dark"]`), страж рассинхрона — `page-colors.test.ts`
    (закоммиченный colorset = текущий `--page`).
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
20. **Сплэш снимает первый настоящий экран; таймер — страховка.** Нативный сплэш
    держится, пока не отрисован экран, который пользователь и должен увидеть:
    `<HideNativeSplash />` рендерят `SignIn`, `Shell` с загруженными курсом и SRS и
    fallback `ErrorBoundary` — но не спиннер `Splash` (иначе старт «логотип →
    «Загрузка…» → главный»). `hideNativeSplash()` зовёт `SplashScreen.hide()`
    (дефолтный fade 200 мс) после `window load` + двух кадров: первый кадр WebKit
    ждёт render-blocking CSS Google Fonts. В конфиге — только `launchShowDuration:
    3000`: авто-скрытие, если такой экран не отрисовался (медленная сеть — тогда
    виден веб-спиннер); с `0` плагин сплэш не показывает вовсе и между LaunchScreen
    и первой отрисовкой мелькает WebView. `launchFadeOutDuration` iOS-плагин не
    читает, `launchAutoHide: true` — дефолт.
21. **Фон WebView до первой отрисовки — `PageBackground`** (`MainViewController`):
    цвет каталога ассетов со светлым и тёмным вариантом (= `--page`, решение 18)
    вместо белого `systemBackground`. Прозрачность не трогаем: Capacitor сам держит
    WebView прозрачным на время первой загрузки (сквозь него и виден этот фон) и
    потом восстанавливает прежнее `isOpaque` (`WebViewDelegationHandler`), а
    `isOpaque = false` в `capacitorDidLoad` он бы сохранил и «восстановил» —
    WebView остался бы прозрачным навсегда.
22. **Клавиатура: `resize: native` + `autoBackdropColor: "dom"`.** Плагин снимает
    собственные keyboard-обсерверы WKWebView; в режиме `body` он задаёт `<body>`
    inline-`height`, который наш `body { min-height: 100vh }` перебивает — низ
    формы (баннер ошибки + переключатель входа) оставался под клавиатурой без
    прокрутки. В `native` ужимается сам WebView: вьюпорт = видимая часть, `100vh`
    следует за ним, всё докручивается, `safe-area-inset-bottom` над клавиатурой = 0.
    Подложка за клавиатурой — фон `body` (`--page` текущей темы), а не чёрное окно.
    Раскладка: `type=email` — ASCII-клавиатура, обычное поле — последняя
    использованная (у русскоязычного — кириллица, переключить глобусом один раз);
    из веба её не навязать.
23. **Манифест приватности** [`PrivacyInfo.xcprivacy`](../../ios/App/App/PrivacyInfo.xcprivacy)
    в ресурсах App: `NSPrivacyAccessedAPICategoryUserDefaults` с причиной `CA92.1`
    (Preferences — required-reason API; без декларации App Store Connect
    отвечает ITMS-91053), `NSPrivacyTracking = false`, собираемые данные — email
    и взаимодействие с продуктом (прогресс), связаны с пользователем, цель App
    Functionality, без трекинга. Манифест самого Capacitor идёт в его фреймворке.
    Анкету App Privacy в App Store Connect владелец заполняет тем же.
24. **`run-sim.sh`:** Bundle ID — из собранного `Info.plist` (источник —
    `capacitor.config.ts` → проект), `simctl bootstatus -b` (сам грузит
    выключенный симулятор), DerivedData — вне дерева исходников, но свой на
    checkout/worktree: `~/Library/Developer/Xcode/DerivedData/portuguese-ios-<хеш
    пути>` (переопределяется `IOS_DERIVED_DATA`).
25. **CI `ios-build`:** `macos-latest`, самый свежий СТАБИЛЬНЫЙ Xcode 26.x образа
    (beta/RC отброшены), пакеты резолвит сам `xcodebuild build`, `ARCHS=arm64` —
    один срез симулятора.

## Тестирование

**Автотесты** (по [`test-policy`](../../.claude/skills/test-policy/SKILL.md)), все в
тех же коммитах, что и код; итог — Vitest 27 файлов / 290 тестов (backend +
frontend), Playwright CT 155:

- backend [`convex/auth.test.ts`](../../convex/auth.test.ts) — «registration
  enabled»: флаг `true`; `signUp` создаёт ровно `users` + `authAccounts` (секрет —
  хеш), выпускает токены; нормализация email; повторный `signUp` (другой регистр) →
  `ACCOUNT_EXISTS` без дубля и без смены пароля; `signUp` на существующий email
  даже с верным паролем → `ACCOUNT_EXISTS` и ноль сессий; мусорный email →
  `INVALID_EMAIL` без строк; рубильник `assertSignUpAllowed`; `signIn`
  зарегистрированными кредами, неверный пароль → `InvalidSecret`; пароль < 8 —
  отказ до записи строк.
- unit: [`authStorage.test.ts`](../../src/lib/authStorage.test.ts) (get/set/remove,
  `value ?? null`, `pickTokenStorage`: веб, натив с плагином, натив без плагина →
  localStorage); [`native.test.ts`](../../src/lib/native.test.ts) (`isNative`,
  `hasNativePlugin`, `hideNativeSplash`: после load + 2 кадров, дефолтный fade,
  ожидание `load`, no-op в вебе, отказ плагина);
  [`HideNativeSplash.screens.test.tsx`](../../src/components/HideNativeSplash.screens.test.tsx)
  (сплэш снимают Shell только с данными, SignIn и fallback ошибки; спиннер и
  здоровый ErrorBoundary — нет); [`haptics.test.ts`](../../src/lib/haptics.test.ts) (+натив:
  impact/notification, mute, отказ плагина; веб не зовёт плагин);
  [`useTheme.test.ts`](../../src/lib/useTheme.test.ts) (+статус-бар: веб не зовёт,
  натив DARK/LIGHT, живая смена ОС, отказ плагина); [`speech.test.ts`](../../src/lib/speech.test.ts)
  (+диагностика `[speech]`, поведение speak не меняется);
  [`HideNativeSplash.test.tsx`](../../src/components/HideNativeSplash.test.tsx);
  [`scripts/ios/png.test.ts`](../../scripts/ios/png.test.ts) (все 5 фильтров,
  RGB без альфы, отказ на полупрозрачном пикселе);
  [`page-colors.test.ts`](../../scripts/ios/page-colors.test.ts) (`--page` обеих тем
  из `index.css`, громкий отказ без него, colorset с тёмным вариантом, страж
  рассинхрона закоммиченного colorset);
  [`release.test.ts`](../../scripts/ios/release.test.ts) (`release.sh --check` в
  копии репозитория: нет файла → хендофф; образец как есть и `<you>` — разбор без
  исполнения; все недостающие ключи; кривые Team ID (в т.ч. `; touch pwned` — ничего
  не выполняется), Key ID, Issuer ID; прод-URL не `*.convex.cloud` / нет файла;
  кавычки, пробелы, CRLF, `~/` → exit 0, прод-URL из `.env.ios-release`).
- CT: [`SignIn.ct.tsx`](../../src/components/SignIn.ct.tsx) (переключатель ↔ форма
  регистрации, `autocomplete`, атрибуты email; переключатель — `button`, работает
  с клавиатуры; рубильник прячет его; коды ошибок → тексты, прочий сбой — общий
  текст); [`SafeArea.ct.tsx`](../../src/components/SafeArea.ct.tsx)
  (safe-area в правилах `.m-app` и подложка статус-бара — по CSSOM, т.к. в
  десктопном Chromium инсеты 0); [`TypeExercise.ct.tsx`](../../src/components/exercises/TypeExercise.ct.tsx)
  (атрибуты поля ответа, без `lang`).
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

**TestFlight** (≈15 минут веб-интерфейсов Apple с 2FA, потом одна команда):

1. developer.apple.com → Certificates, Identifiers & Profiles:
   **Identifiers** → «+» → App IDs → App → Bundle ID (Explicit)
   `io.github.ksenyagorbatova.portuguese` (форма New App в шаге 2 предлагает только
   заведённые Bundle ID); **Devices** — если у команды нет ни одного устройства,
   добавить свой iPhone (UDID): автоподпись архива берёт development-профиль, а без
   устройств Apple его не выдаёт.
2. App Store Connect → Apps → «+» → New App: iOS, «Português», primary language
   Russian, Bundle ID из шага 1, SKU любой. Там же — анкета App Privacy (как в
   `PrivacyInfo.xcprivacy`: email и прогресс для работы приложения, без трекинга).
3. App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → ключ с ролью **App Manager**; `.p8` (скачивается один раз) — в
   `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, записать Key ID и Issuer ID.
4. `cp .env.ios-release.example .env.ios-release.local` и заполнить (`IOS_TEAM_ID`,
   `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`; прод-URL уже в `.env.ios-release`);
   `sh scripts/ios/release.sh --check` — проверка без сборки.
5. `npm run ios:release` → сборка в TestFlight через 5–15 минут обработки.
6. TestFlight → Internal Testing (участники команды, без ревью) или External
   (публичная ссылка; первая сборка версии проходит Beta App Review) → тестеры.
7. Сборка живёт 90 дней — повторять шаг 5 раз в квартал или на релиз кода
   (build number Xcode поднимает сам), либо Xcode Cloud на push в `main`.

## Карта файлов

**Добавлено:**
- `capacitor.config.ts`; `ios/` — Xcode-проект шаблона Capacitor 8.5 (SPM:
  `App/CapApp-SPM/Package.swift` генерит `cap sync`, `Package.resolved`), правки:
  `App/App/Info.plist`, `App/App/PrivacyInfo.xcprivacy`, `App/App/SceneDelegate.swift`
  (+`MainViewController`), `App/App/Assets.xcassets` (иконка, сплэш light/dark,
  `PageBackground.colorset`), `project.pbxproj` (`TARGETED_DEVICE_FAMILY = 1`,
  deployment target 16.4, манифест приватности в ресурсах);
- `scripts/ios/run-sim.sh`, `release.sh` + `release.test.ts`, `ExportOptions.plist`,
  `render-assets.mjs`, `png.mjs` + `png.d.mts` + `png.test.ts`, `page-colors.mjs` +
  `page-colors.d.mts` + `page-colors.test.ts`; `.env.ios-release` (прод-URL),
  `.env.ios-release.example`;
- `src/lib/native.ts`, `src/lib/authStorage.ts`, `src/components/HideNativeSplash.tsx`
  (+ `HideNativeSplash.test.tsx`, `HideNativeSplash.screens.test.tsx`, тесты модулей),
  `src/components/SafeArea.ct.tsx`;
- `specs/feat/ios-capacitor-app.md` (эта спека), `.runbook.md`, `.pr.md`.

**Изменено:**
- `convex/auth.ts`, `convex/auth.test.ts`, `convex/seed.ts` (комментарий),
  `src/components/SignIn.tsx` + `.ct.tsx`, `src/test/mocks/convexAuthReact.ts`,
  `playwright/index.tsx` (сброс `__signInError`);
- `src/main.tsx` (storage), `src/components/Shell.tsx` и `ErrorBoundary.tsx`
  (`HideNativeSplash`), `src/lib/haptics.ts`, `useTheme.ts`, `speech.ts` (+ тесты),
  `src/components/exercises/TypeExercise.tsx` (+ct), `src/index.css` (safe-area,
  подложка статус-бара, `button.m-switch`);
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
- **Удаление аккаунта из приложения** (App Store Review Guideline 5.1.1(v) — для
  приложений с регистрацией) не реализовано: нужно до внешнего тестирования
  TestFlight / публикации в App Store (Internal Testing — без ревью).
- Замороженный клиент TestFlight против автодеплоя Convex: правки API — только
  аддитивные (решение 2, CLAUDE.md); проверки версии клиента нет.
- Сплэш и нативный фон — по теме ОС, не по выбору в приложении (выбор живёт в
  `localStorage` WebView): при явной теме против ОС сплэш — цвета ОС, затем
  кросс-фейд в тему приложения.
- Беззвучный режим (переключатель на корпусе) и озвучка Web Speech в WKWebView —
  проверить на устройстве (в симуляторе переключателя нет).
- Иконку рендерит Chromium шрифтом, доступным на машине (Bricolage Grotesque не
  установлен → `system-ui`): перерисовка `npm run ios:assets` на другой машине
  может чуть изменить глиф «pt» — перерисовывать там же или перевести текст
  фавикона в контуры.
- Автоподпись архива требует у команды хотя бы одно устройство (хендофф, шаг 1).
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
