# iOS-приложение на Capacitor (TestFlight) + включение регистрации

Ветка: `feat/ios-capacitor-app` · PR: откроется из этой ветки · дата: 2026-09-26 ·
статус: **план для автономной сессии** (по завершении работы сессия актуализирует
эту спеку через `/spec`: статусы, фактическая карта файлов, итог code-review).

> **Режим «всё локально».** Владелец проверяет результат ДО того, как что-либо уйдёт
> с машины: сессия НЕ делает `git push`, НЕ открывает PR, НЕ загружает сборку в
> TestFlight и НЕ регистрирует App ID у Apple. Итог работы — локальная ветка с
> коммитами, симуляторная сборка и готовое описание PR в файле (решение 12).

Парный документ — [`ios-capacitor-app.runbook.md`](ios-capacitor-app.runbook.md):
протокол автономной работы (фазы, цикл «собрать → проверить в симуляторе →
починить», критерии выхода, диагностика). Спека отвечает на «что и почему»,
раннбук — на «как и в каком порядке».

## Цель

1. **Нативная iOS-обёртка** существующего SPA (React 19 + Vite 8 + Convex) на
   Capacitor 8: устанавливаемое приложение с иконкой, сплэшем, без браузерной
   обвязки, с сохранением входа между запусками, хаптикой и статус-баром под тему.
   Раздача — через **TestFlight** (у владельца платный Apple Developer Program),
   запуск загрузки — владельцем после ревью. App Store — не в этом объёме.
2. **Включить публичную регистрацию** (`SIGNUP_ENABLED` → `true` на сервере и
   клиенте). Решение владельца от 2026-09-26: без регистрации тестеры не заведут
   аккаунт с телефона, а будущая публикация в App Store потребует demo-доступ.
3. Веб-версия на GitHub Pages **не меняет поведения**, кроме включённой регистрации.
   Контент по-прежнему живёт в Convex и не требует пересборки приложения.

## Объём

**В объёме:** iOS-проект `ios/` (Capacitor 8, SPM), Vite-режимы `ios`/`ios-release`
(`dist-ios`, base `/`), нативные адаптации (хранилище токенов, хаптика, статус-бар,
сплэш/иконки, клавиатура, ATS для локального Convex, портретная ориентация,
iPhone-only), диагностика озвучки, включение регистрации с тестами, CI-job
`ios-build` (компиляция под симулятор), release-скрипты (archive → export →
upload в App Store Connect через `xcodebuild`, без fastlane), документация
(CLAUDE.md, README, скилл `browser-smoke`, baseline-спека авторизации), смоук в
симуляторе по матрице ниже, локальная ветка с коммитами + описание PR файлом
`specs/feat/ios-capacitor-app.pr.md` (сам PR открывает владелец).

**Вне объёма:** Android, офлайн-режим, пуш-уведомления, публикация в App Store
(метаданные, скриншоты, ревью), распознавание речи, PWA, self-hosted шрифты
(опционально, если останется время — см. «дальнейшие шаги»).

## Изменения данных / API

- **Схема Convex не меняется.** Серверные функции — без изменений сигнатур.
- **Регистрация:** `SIGNUP_ENABLED = true` в [`convex/auth.ts`](../../convex/auth.ts)
  и [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx). Константа
  `REGISTRATION_DISABLED` и ветка в `profile()` остаются (мгновенный откат флагом).
- **Хранилище токенов Convex Auth:** `ConvexAuthProvider` получает проп `storage`
  ([`TokenStorage`](../../node_modules/@convex-dev/auth/dist/react/index.d.ts) —
  `getItem/setItem/removeItem`, допускает Promise) с адаптером над
  `@capacitor/preferences` — **только когда `Capacitor.isNativePlatform()`**; в
  вебе проп `undefined` → прежний localStorage.
- **Сборка:** [`vite.config.ts`](../../vite.config.ts): режимы `ios` и `ios-release`
  → `build.outDir = "dist-ios"`; `base` для них уже `/` (условие
  `mode === "production"` даёт `/portuguese/` только Pages-сборке). Env-файлы Vite:
  `ios` подхватывает `.env.local` (dev-деплой Convex), `ios-release` —
  `.env.ios-release.local` (прод-URL, см. ниже; gitignored по маске `.env.*.local`),
  трекается пример `.env.ios-release.example`.
- **Прод-URL Convex** (публичен — лежит в клиентском бандле сайта):
  `https://harmless-seahorse-836.convex.cloud`. Dev-деплой основного checkout — из
  `.env.local` (`fast-hound-404`); worktree — локальный деплой `wt:setup`.
- **npm-скрипты** (package.json): `ios:build` (`vite build --mode ios && cap sync ios`),
  `ios:release` (`vite build --mode ios-release && cap sync ios && sh scripts/ios/release.sh`),
  `ios:sim` (сборка под симулятор + install + launch через `xcrun`, CLI-дублёр
  MCP-инструментов симулятора), `ios:assets` (рендер PNG из `public/favicon.svg` +
  `capacitor-assets generate --ios`), `ios:open` (`cap open ios`).
- **Info.plist:** `CFBundleDisplayName = Português`; `UISupportedInterfaceOrientations`
  — только Portrait; `ITSAppUsesNonExemptEncryption = NO` (без вопроса про экспорт
  криптографии при загрузке); `NSAppTransportSecurity.NSAllowsLocalNetworking = YES`
  (Debug-сборка в worktree ходит в `http://127.0.0.1:3210`); `TARGETED_DEVICE_FAMILY = 1`
  (iPhone-only) в настройках таргета.
- **Конфиги качества:** `.oxlintrc.json` ignorePatterns += `ios`, `dist-ios`;
  `.gitignore` += `dist-ios` (внутри `ios/` — `.gitignore` из шаблона Capacitor:
  `App/public`, `App/App/capacitor.config.json`, `xcuserdata`, `build`);
  `tsconfig.node.json` include += `capacitor.config.ts`.
- **CI:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) += job
  `ios-build` на `macos-latest` (репо публичный — минуты бесплатны): `npm ci` →
  `VITE_CONVEX_URL=https://ci-placeholder.convex.cloud npm run ios:build` →
  `xcodebuild … -sdk iphonesimulator -destination 'generic/platform=iOS Simulator'
  CODE_SIGNING_ALLOWED=NO build`.

## Поведение (для пользователя)

- На iPhone: иконка «Português» (флаг + «pt», как фавикон сайта), сплэш в цвет фона
  темы, запуск сразу в приложение (Splash → SignIn/Shell). Никакой адресной строки.
- **Вход сохраняется между запусками** и не стирается политикой Safari (токен в
  Preferences, не в localStorage WKWebView).
- **Регистрация доступна:** на экране входа появляется переключатель «Нет аккаунта?
  Зарегистрироваться»; форма регистрации создаёт аккаунт (email нормализуется,
  пароль ≥ 8) и сразу впускает. То же — на сайте.
- **Хаптика на iPhone** впервые работает (нативный плагин): короткий «да»,
  дабл-бамп «не то»; уважает mute как и раньше.
- **Статус-бар** следует теме: светлый текст на тёмной, тёмный на светлой;
  переключение темы в шапке меняет его сразу. `viewport-fit=cover` и safe-area
  отступы уже есть — контент не заезжает под «остров»/индикатор.
- **Клавиатура:** поле ввода в упражнении «Напишите по-португальски» остаётся
  видимым при открытой клавиатуре; у поля выключены автокоррекция и автокапитализация
  (иначе iOS «исправляет» португальские слова), клавиша ввода подписана «Done»
  (`enterKeyHint="done"`) и отвечает как Enter (существующая keyup-логика).
- **Озвучка** — как в вебе (Web Speech API, pt-PT голос iOS). Если в WKWebView
  португальского голоса не окажется (гейт `canSpeakPortuguese()` ложен) —
  подключается нативный TTS-плагин (см. решение 7), аудио-карточки не исчезают.
- **Ориентация** — только портрет; iPad запускает iPhone-версию в совместимости.
- **Сеть:** холодный старт без сети показывает штатный Splash/ошибку загрузки (как
  и сайт — офлайна нет); разрыв посреди сессии переживается баннером
  `OfflineBanner` и очередью мутаций Convex (без изменений).
- **Контент** (темы/слова/предложения) обновляется без новой сборки — он в БД.

## Ключевые решения и алгоритмы

1. **Capacitor 8 (latest 8.5.x), iOS-платформа через SPM**
   (`npx cap add ios --packagemanager SPM`): без Ruby/CocoaPods в цикле, официально
   поддерживается. **Fallback:** если SPM-проект не собирается `xcodebuild` после
   двух честных попыток разобраться — пересоздать платформу через CocoaPods
   (`pod` установлен: `/opt/homebrew/bin/pod`), решение зафиксировать здесь.
   Deployment target — из шаблона Capacitor 8 (iOS 15.0); Capacitor 9 поднимет до
   16.0, оба симулятора проекта (iOS 17.4 и 26.5) выше.
2. **Локальный бандл, а не `server.url` на GitHub Pages.** Обёртка-«окно на сайт»
   дешевле на полдня, но App Store её заворачивает по 4.2, и старт зависит от Pages.
   Локальный бандл честнее и не требует пересборки на контентные правки (контент в
   Convex). Правки серверных функций держим additive (уже практика проекта: старый
   клиент на телефоне переживает свежий бэкенд).
3. **`appId = io.github.ksenyagorbatova.portuguese`, `appName = Português`.**
   Bundle ID можно сменить до ПЕРВОЙ загрузки в App Store Connect — после него он
   закрепляется за записью приложения. Владелец правит `capacitor.config.ts`, если
   хочет другой.
4. **iPhone-only, портрет.** Уменьшает матрицу проверок и требования к скриншотам;
   тренажёр — телефонный формат. iPad — режим совместимости.
5. **Токены Convex Auth — в `@capacitor/preferences`** через проп `storage`
   (штатный путь провайдера для нативных оболочек). Причина — политика WebKit на
   очистку script-writable storage при неактивности; Preferences живут в
   UserDefaults и переживают всё, кроме удаления приложения. Адаптер
   [`src/lib/authStorage.ts`](../../src/lib/authStorage.ts): `getItem` возвращает
   `value ?? null`. Веб — без изменений (`storage={undefined}`).
6. **Нативные плагины за существующими модулями, а не по компонентам:**
   - [`src/lib/native.ts`](../../src/lib/native.ts) — единственная точка
     `isNative()` (обёртка `Capacitor.isNativePlatform()`, мокается в тестах);
   - [`src/lib/haptics.ts`](../../src/lib/haptics.ts) — ветка `@capacitor/haptics`
     (`Haptics.impact({ style: ImpactStyle.Light })` на верный,
     `Haptics.notification({ type: NotificationType.Error })` на промах/retry);
     веб-ветка `navigator.vibrate` и гейт mute — прежние;
   - [`src/lib/useTheme.ts`](../../src/lib/useTheme.ts) — в эффекте применения темы
     `StatusBar.setStyle({ style: resolved === "dark" ? Style.Dark : Style.Light })`
     (внимание: `Style.Dark` = светлый текст для тёмного фона);
   - `capacitor.config.ts` — `SplashScreen { launchAutoHide: true, launchShowDuration: 0,
     backgroundColor: "#f4f3ef" }`, `Keyboard { resize: "body" }`.
   - [`src/components/exercises/TypeExercise.tsx`](../../src/components/exercises/TypeExercise.tsx)
     — атрибуты `autoCapitalize="none" autoCorrect="off" spellCheck={false}
     enterKeyHint="done" lang="pt-PT"` на инпуте (влияет и на веб — безвредно, даже
     полезно на Android/десктопе).
7. **Озвучка: сначала Web Speech API, плагин — только по факту.** Capacitor
   выставляет `mediaTypesRequiringUserActionForPlayback = []`, поэтому авто-озвучка
   после ответа и автоплей аудио-карточки должны работать без жеста. Проверка в
   симуляторе — по диагностическим логам: в [`src/lib/speech.ts`](../../src/lib/speech.ts)
   добавляются `console.debug("[speech] voices=N pt=<name|none>")` при прогреве и
   `console.debug("[speech] start|end|error <text>")` на событиях utterance
   (Capacitor пробрасывает console в системный лог → `xcrun simctl … log stream`).
   Если `pt=none` или `start` не приходит после двух честных попыток (в т.ч.
   проверить `voiceschanged`), подключить `@capacitor-community/text-to-speech`
   за тем же API `speech.ts` (`speak/speakAuto/speakSmart/canSpeakPortuguese`):
   `TextToSpeech.speak({ text, lang: "pt-PT", rate })`, гейт по
   `getSupportedLanguages()`. Внешние контракты модуля не меняются, тесты `speech.test.ts`
   дополняются веткой плагина.
8. **ATS: `NSAllowsLocalNetworking = YES`.** Debug-сборка в worktree ходит в
   локальный Convex по `http://127.0.0.1:3210` (симулятор делит loopback с Mac).
   Ключ разрешён Apple без обоснования и безвреден в release (прод — `https/wss`).
9. **Регистрация — оба флага, тесты переворачиваются, а не удаляются:**
   `convex/auth.test.ts` блок «registration disabled» → «registration enabled»:
   флаг `true`; `signUp` создаёт `users`/`authAccounts` и возвращает токены;
   повторный `signUp` на тот же email → ошибка без дубля; `signIn` работает.
   `SignIn.ct.tsx`: переключатель виден, тап переводит форму в «Регистрация» /
   «Зарегистрироваться» и обратно. Сообщение об ошибке `REGISTRATION_DISABLED` в
   UI остаётся (мёртвый, но безвредный путь на случай отката).
10. **Release без fastlane:** `scripts/ios/release.sh` — `xcodebuild archive`
    (`-destination 'generic/platform=iOS'`, `DEVELOPMENT_TEAM`, `-allowProvisioningUpdates`
    + ключ App Store Connect API через `-authenticationKeyPath/-authenticationKeyID/
    -authenticationKeyIssuerID`) → `xcodebuild -exportArchive` с
    `scripts/ios/ExportOptions.plist` (`method = app-store-connect`,
    `destination = upload`, `signingStyle = automatic`,
    `manageAppVersionAndBuildNumber = true` — Xcode сам инкрементит build number,
    `teamID` подставляется скриптом). Переменные — из `.env.ios-release.local`:
    `IOS_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`, `VITE_CONVEX_URL`.
    Без ключа скрипт печатает хендофф-инструкцию и завершается кодом 2 (не 1 — это
    «ожидаемо не готово», а не сбой). Сессия скрипт **только пишет и проверяет
    синтаксически** (`bash -n`, `plutil -lint`); запускает его владелец после ревью.
11. **Команда подписи.** На машине две identity: `Apple Development … (2GJM94F693)`
    и `Developer ID Application … (G2AA82378K)`. Developer ID выдаётся только
    платной программе → в примере env стоит `IOS_TEAM_ID=G2AA82378K`; при провале
    provisioning скрипт подсказывает попробовать вторую команду. Симуляторная
    сборка команды не требует и от этого не зависит; archive/provisioning сессия
    не запускает (это обращение к Apple от имени аккаунта — только владелец).
12. **Ничего не покидает машину без владельца.** Сессия не делает `git push`, не
    открывает PR, не загружает в TestFlight, не запускает `xcodebuild` с
    `-allowProvisioningUpdates` против устройства. Все коммиты — локально в ветке
    `feat/ios-capacitor-app`; тело PR — в `specs/feat/ios-capacitor-app.pr.md`
    (шаблон `ship-task` + матрица смоука + хендофф). Мёрж и прод-деплой — тем более
    решение владельца. Разрешённые внешние взаимодействия: dev-деплой Convex через
    `npx convex dev` (штатный dev-цикл проекта: в основном checkout — облачный dev
    `fast-hound-404`, в worktree — локальный), npm registry, context7.
13. **Иконки/сплэш** — из существующего `public/favicon.svg`: `scripts/ios/render-assets.mjs`
    рендерит через `playwright-core` (Chromium уже установлен для CT) непрозрачные PNG
    `assets/icon-only.png` (1024², фон `#f4f3ef`), `assets/splash.png` (2732²) и
    `assets/splash-dark.png` (фон `#16150f`); затем `npx capacitor-assets generate --ios`.
    Альфа-канала у iOS-иконки быть не должно.

## Тестирование

**Автотесты (в том же PR, по [`test-policy`](../../.claude/skills/test-policy/SKILL.md)):**
- backend `convex/auth.test.ts` — регистрация включена (см. решение 9).
- unit `src/lib/authStorage.test.ts` — адаптер над моком `@capacitor/preferences`
  (get → `value ?? null`, set/remove делегируют); `src/lib/haptics.test.ts` —
  нативная ветка зовёт `Haptics`, mute глушит и её, веб-ветка прежняя;
  `src/lib/useTheme.test.ts` — на нативной платформе вызывается `StatusBar.setStyle`
  с ожидаемым стилем, в вебе — нет; `src/lib/speech.test.ts` — диагностические
  логи не ломают поведение (+ ветка плагина, если он подключён).
- CT `SignIn.ct.tsx` — переключатель регистрации и смена формы; `TypeExercise.ct.tsx`
  — атрибуты инпута (`enterKeyHint`, `autoCapitalize`, `autoCorrect`).
- `npm run verify` и `npm run build` (Pages-сборка не должна измениться: `dist/`,
  base `/portuguese/`, `404.html`). Push не выполняется, поэтому pre-push не
  сработает — `npm run verify` гоняется явно после последнего коммита.

**Контрольная точка после каждого значимого шага** (раннбук, раздел 2a): автотесты
затронутого уровня + `npm run check`, пересборка и ручная проверка релевантных шагов
в iOS-симуляторе через MCP-инструменты (тапы, ввод, скриншоты, лог), запись в журнал;
полный `npm run verify` — в конце каждой фазы. Ни одна фаза не закрывается без неё.

**Смоук в симуляторе** (протокол и команды — в раннбуке; устройства: `iPhone 17 Pro`
iOS 26.5 — основной, `iPhone SE (3rd generation)` iOS 17.4 — малый экран):

| # | Шаг | Ожидание |
|---|---|---|
| 1 | Холодный запуск | Сплэш → экран входа без белого экрана и без адресной строки |
| 2 | Регистрация нового email | Переключатель есть, форма «Регистрация», после отправки — дашборд («Повторение»/«Темы») |
| 3 | Убить процесс, запустить снова | Сразу дашборд (токен из Preferences), без повторного входа |
| 4 | Темы → урок → теория | Flip-карта переворачивается по тапу, «Начать практику» открывает сессию `1/N` |
| 5 | MC-карточка | 4 варианта, верный → фидбэк «Верно!» + «следующий повтор: …» + «Дальше»; в логе `[speech] start` |
| 6 | Type-карточка | Тап в поле → клавиатура → ввод → «Проверить»/Done → фидбэк; поле не перекрыто клавиатурой; нет автокоррекции |
| 7 | Выход из сессии (X) | Дашборд, `ScoreRow` виден |
| 8 | Раздел «Построение предложений» | Сборка плитками и cloze решаются, фидбэк корректен |
| 9 | Тема: light → dark → system | Фон и статус-бар меняются; после перезапуска выбор сохранён; `simctl ui appearance dark` при `system` переключает |
| 10 | Mute | Иконка меняется, авто-озвучка молчит (нет `[speech] start` после ответа), ручной 🔊 звучит |
| 11 | Выход из аккаунта → вход | SignIn → вход тем же email → дашборд |
| 12 | Малый экран (SE) | Карточка с кнопкой «Дальше» без прокрутки, safe-area не режет шапку/низ |
| 13 | Лог за прогон | Нет `Unhandled`, `TypeError`, `Failed to load`, ошибок Convex/Auth |

Критерий стабильности: полный проход 1–11,13 на iPhone 17 Pro **два раза подряд без
правок кода** + 12 на SE.

## Критерии приёмки (Definition of Done)

- [ ] `ios/` в репозитории, `npm run ios:build` и `npm run ios:sim` работают с чистого
      клона (после `npm ci`); CI-job `ios-build` зелёный.
- [ ] Матрица смоука выполнена по критерию стабильности; скриншоты шагов сохранены
      и перечислены в теле PR (пути + краткие наблюдения).
- [ ] Каждая фаза закрыта контрольной точкой (тесты + симулятор + журнал) — видно по
      журналу прогресса и скриншотам промежуточных прогонов.
- [ ] Регистрация включена и покрыта тестами; `npm run verify` и `npm run build` зелёные.
- [ ] Гейты проекта пройдены: спека актуализирована `/spec`, `/code-review` прогнан
      и каждая находка разобрана (реальные — починены с тестом), `npm run verify` и
      `npm run build` зелёные на финальном коммите (вывод — в PR-описании).
- [ ] Документация обновлена: CLAUDE.md (команды, структура `ios/`+`scripts/ios/`,
      регистрация включена), README (раздел iOS/TestFlight), скилл `browser-smoke`
      (вход через регистрацию), baseline
      [`specs/feature/auth-and-signup-gate.md`](../feature/auth-and-signup-gate.md).
- [ ] Ветка `feat/ios-capacitor-app`: все изменения закоммичены, `git status` чистый,
      `git push` **не выполнялся**, PR **не открывался**. Тело будущего PR — файл
      `specs/feat/ios-capacitor-app.pr.md` (по шаблону `ship-task`: цель, что сделано,
      решения, тестирование с матрицей смоука и путями скриншотов, итог code-review,
      раздел «Хендофф: TestFlight»), закоммичен в ветку.
- [ ] Release-скрипты написаны и проверены синтаксически; загрузка в TestFlight **не
      выполнялась** (решение владельца) — в хендоффе перечислено, что осталось.

## Хендофф человеку

**Шаг 0 — ревью и отправка в GitHub (по решению владельца сессия этого не делает):**
`git checkout feat/ios-capacitor-app`, посмотреть дифф `git diff main...HEAD` и
`git log --oneline main..HEAD`, прогнать `npm run ios:sim` и пройтись по
приложению в симуляторе; при необходимости — правки следующей сессией. Затем
`git push -u origin feat/ios-capacitor-app` (pre-push прогонит spec-гейт и `verify`)
и `gh pr create --base main --title "feat: iOS-приложение на Capacitor + регистрация"
--body-file specs/feat/ios-capacitor-app.pr.md`; CI прогонит и `ios-build`.

**TestFlight.** Автономно нельзя: создать запись приложения и ключ API можно только
в веб-интерфейсе с 2FA. Шаги владельца (≈10 минут), после которых `npm run ios:release`
загружает сборку сам:

1. developer.apple.com → Identifiers → App ID с bundle ID из `capacitor.config.ts`
   (или довериться automatic signing — `xcodebuild -allowProvisioningUpdates` с
   ключом API регистрирует App ID сам).
2. App Store Connect → Apps → «+» → New App: iOS, имя, primary language Russian,
   тот же bundle ID, SKU любой.
3. App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → сгенерировать ключ с ролью **App Manager**; скачать `.p8` (даётся
   один раз), записать Key ID и Issuer ID. Положить в
   `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`.
4. Создать `.env.ios-release.local` по образцу `.env.ios-release.example`
   (`IOS_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`, `VITE_CONVEX_URL`).
5. `npm run ios:release` → сборка появится в TestFlight через 5–15 минут обработки.
6. TestFlight → Internal Testing (участники команды, без ревью) или External Testing
   (публичная ссылка; первая сборка версии проходит Beta App Review). Добавить
   тестера, отправить приглашение.
7. Дальше: сборка живёт 90 дней — раз в квартал (или на каждый релиз кода) повторять
   шаг 5, либо подключить Xcode Cloud (25 ч/мес входят в программу) на push в `main`.

Порядок: сначала шаг 0 (ревью), потом TestFlight. Сессия загрузку не выполняет ни при
каких условиях (решение 12).

## Карта файлов

**Добавлено:**
- `capacitor.config.ts`; `ios/` (проект Xcode из шаблона Capacitor + Info.plist-правки);
  `assets/` (исходники иконки/сплэша — генерируются скриптом, коммитятся);
- `scripts/ios/render-assets.mjs`, `scripts/ios/run-sim.sh`, `scripts/ios/release.sh`,
  `scripts/ios/ExportOptions.plist`; `.env.ios-release.example`;
- `src/lib/native.ts`, `src/lib/authStorage.ts` (+ `.test.ts`);
- `specs/feat/ios-capacitor-app.md` (эта спека), `specs/feat/ios-capacitor-app.runbook.md`,
  `specs/feat/ios-capacitor-app.pr.md` (тело PR, пишется в конце работы).

**Изменено:**
- `convex/auth.ts`, `src/components/SignIn.tsx` (флаги) + `convex/auth.test.ts`,
  `src/components/SignIn.ct.tsx`;
- `src/main.tsx` (storage), `src/lib/haptics.ts` (+test), `src/lib/useTheme.ts` (+test),
  `src/lib/speech.ts` (+test), `src/components/exercises/TypeExercise.tsx` (+ct);
- `vite.config.ts`, `package.json`/`package-lock.json`, `tsconfig.node.json`,
  `.oxlintrc.json`, `.gitignore`, `.github/workflows/ci.yml`;
- `CLAUDE.md`, `README.md`, `.claude/skills/browser-smoke/SKILL.md`,
  `specs/feature/auth-and-signup-gate.md`.

## Известные ограничения / дальнейшие шаги

- Push, PR и загрузка в TestFlight — только владельцем после ревью (решение 12);
  сессия останавливается на локальной ветке и симуляторной сборке. TestFlight также
  требует ручных шагов владельца (запись приложения, ключ API).
- Bundle ID закрепляется первой загрузкой — менять до неё.
- Шрифты (Bricolage Grotesque, Manrope) грузятся с Google Fonts — при холодном
  старте без сети падаем на системные. Self-host через `@fontsource` — кандидат на
  следующий шаг (не блокер: без сети приложение и так не работает).
- Хаптика и статус-бар не проверяемы в симуляторе на ощупь — проверяем вызовы по
  логам/тестам; статус-бар виден на скриншоте.
- Речь: iOS-голоса могут отличаться от macOS Chrome; «Joana» (pt-PT) — обычно есть.
  Если нет — решение 7 (плагин TTS).
- Android остаётся через PWA/APK — отдельная задача. Пуши, офлайн — не планируются.
- После мёржа регистрация откроется и на сайте — это осознанное решение владельца.
