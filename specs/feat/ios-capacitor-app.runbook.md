# Раннбук автономной сессии: iOS-приложение на Capacitor

Парный документ к спеке [`ios-capacitor-app.md`](ios-capacitor-app.md) (там — что и
почему; здесь — как, в каком порядке и когда считать готовым). Написан для сессии
Claude Code, которая работает **без человека у компьютера**: собирает, проверяет в
iOS-симуляторе, чинит и повторяет до выполнения критериев приёмки.

## 0. Режим работы (обязательно)

- **Никаких вопросов пользователю и пауз «на подтверждение».** Все развилки решаешь
  сам по этому раннбуку и спеке; каждое нетривиальное решение фиксируешь в спеке
  (раздел «Ключевые решения», с пометкой даты) и в журнале прогресса.
- **Единственные точки остановки:** (а) выполнен Definition of Done из спеки —
  ветка готова локально, тело PR написано в `specs/feat/ios-capacitor-app.pr.md`;
  (б) шаг требует секретов/действий владельца (Apple ID, ключ App Store Connect,
  запись приложения) — тогда доделываешь ВСЁ остальное, описываешь это в разделе
  «Хендофф» тела PR и завершаешь. Ничто другое остановкой не является.
- **Ничего не покидает машину без владельца:** НЕ `git push`, НЕ `gh pr create`,
  НЕ `npm run ios:release`/загрузка в TestFlight, НЕ `xcodebuild archive` с
  `-allowProvisioningUpdates` (это обращение к Apple от имени аккаунта). Владелец
  хочет проверить всё локально ДО отправки в удалённый репозиторий. Разрешённые
  внешние взаимодействия: dev-деплой Convex через `npx convex dev` (штатный dev-цикл
  проекта, в worktree он вообще локальный), npm registry, context7. Не коммитить в
  `main`; все коммиты — в ветке `feat/ios-capacitor-app`.
- **Контрольная точка после КАЖДОГО значимого шага** (раздел 2a): автотесты +
  пересборка + ручная проверка в iOS-симуляторе со скриншотами. Без неё к следующему
  пункту не переходишь и фазу не закрываешь.
- **Правило трёх гипотез:** один и тот же симптом чинишь не больше трёх заходов с
  разными гипотезами, затем переключаешься на задокументированный fallback (раздел 4);
  fallback'а нет — сужаешь объём, пишешь это в «Известные ограничения» спеки и идёшь
  дальше. Не зацикливаться — важнее довести целое.
- **Журнал прогресса** — файл `ios-progress.md` в scratchpad-каталоге сессии (путь
  в системном промпте). После каждой фазы: что сделано, что осталось, открытые
  проблемы, команды, которые сработали. После сжатия контекста первым делом читаешь
  журнал, спеку и раннбук.
- **Правила проекта действуют полностью:** CLAUDE.md, скиллы `test-policy`,
  `convex-conventions`, `spec`, `code-review`, `ship-task`, `browser-smoke`,
  `context7-first`. Перед кодом против API Capacitor / плагинов / Convex Auth —
  документация через context7 (`/websites/capacitorjs`, `/ionic-team/capacitor-plugins`).
- **Готчи инструментов:** `rtk` маскирует exit-коды и режет вывод — критичные
  проверки гоняй через `rtk proxy <cmd>` или с явным `; echo EXIT=$?`. Долгие
  процессы (`npx convex dev`, `log stream`) — только в фоне (`run_in_background`).
  Встроенный браузерный предпросмотр (`preview_*`) не достаёт до Convex — для веба
  используй Playwright CT/Chrome, для приложения — симулятор.
- **Коммиты** — осмысленными порциями после каждой фазы, футер
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (как в
  скилле `ship-task`; если твоя модель другая — подставь её имя).

## 1. Окружение (проверено 2026-09-26)

| Что | Факт |
|---|---|
| Xcode | 26.6 (`/Applications/Xcode.app`), `xcodebuild -checkFirstLaunchStatus` — ок |
| Симуляторы | `iPhone 17 Pro` iOS 26.5 UDID `ADAEF52E-115E-4F3E-A844-0587D20A42CC` (основной); `iPhone SE (3rd generation)` iOS 17.4 UDID `D46B05DA-FF4A-4FC3-B67D-4E620FA7A206` (малый экран); `iPhone 15` iOS 17.4 `4B854729-88F5-4D90-94D9-AB5C893FF6E0` |
| Node / npm | 24.15 (nvm) |
| CocoaPods / fastlane | `pod` есть (`/opt/homebrew/bin/pod`); fastlane нет и не нужен |
| Подпись | identities: `Apple Development … (2GJM94F693)`, `Developer ID Application … (G2AA82378K)` — Developer ID бывает только у платной программы → команда по умолчанию `G2AA82378K` |
| Репо | `Ksenyagorbatova/portuguese`, публичный (macOS-раннеры CI бесплатны), `gh` авторизован |
| Convex | основной checkout: `.env.local` → dev-деплой (`VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `VITE_CONVEX_SITE_URL`); worktree: локальный деплой от `npm run wt:setup`; прод: `https://harmless-seahorse-836.convex.cloud` (только для `ios-release`) |
| Рендер PNG | `playwright-core` 1.60 + Chromium в `~/Library/Caches/ms-playwright` (для иконок/сплэша); `qlmanage` как запасной вариант |
| MCP симулятора | `mcp__Claude_Code_iOS_Simulator__build` (`build` → `build_status`; `project_path`/`workspace_path` абсолютные, `scheme`), `mcp__Claude_Code_iOS_Simulator__control` (`launch app_path`, `screenshot`, `tap x y`, `text`, `swipe`, `button HOME`, `open_url`). Панель `attach` не нужна — человека нет; всё headless |
| CLI-дублёры | `xcodebuild`, `xcrun simctl boot/bootstatus/install/launch/terminate/uninstall/io screenshot/spawn log stream/ui appearance` |

**Бэкенд для смоука.** Клиенту в симуляторе нужен живой Convex с УЖЕ включённой
регистрацией (флаг — серверный код, его пушит `npx convex dev`):
- основной checkout: `npx convex dev` в фоне; Debug-сборка берёт `VITE_CONVEX_URL`
  из `.env.local` (dev-деплой, https/wss — ATS не мешает);
- worktree (`.claude/worktrees/…`): сначала `npm run wt:setup` (deps + локальный
  Convex + сид контента и `dev@example.com` / `12345678q`), затем `npx convex dev`
  в фоне; `npm run wt:seed` падает при работающем `convex dev` — останавливай его
  перед пересидом. Локальный URL `http://127.0.0.1:3210` → в Info.plist обязателен
  `NSAllowsLocalNetworking` (ставится в фазе 2 сразу).
- Тестовые аккаунты регистрируешь сам: `ios-smoke-<YYYYMMDD-HHMM>@example.com` /
  `12345678q`. **Никогда не против прода.**

**Программная клавиатура в симуляторе** (нужна для проверки «поле не перекрыто»):
до первого запуска Simulator.app — `defaults write com.apple.iphonesimulator
ConnectHardwareKeyboard -bool false`; если симулятор уже был запущен — `xcrun simctl
shutdown all` и запустить заново.

## 2a. Контрольная точка (обязательна после каждого значимого шага)

«Значимый шаг» — любая правка, влияющая на рантайм или сборку: `src/`, `convex/`,
`vite.config.ts`, `capacitor.config.ts`, `package.json`, `ios/` (Info.plist, pbxproj,
плагины), `scripts/ios/`, `.github/workflows/`. После такого шага, **до перехода к
следующему пункту**, без исключений:

1. **Автотесты.** `rtk proxy npm run check; echo EXIT=$?` (typecheck + lint) и тесты
   затронутого уровня: `npm run test:backend` / `npm run test:frontend` /
   `npx playwright test -c playwright-ct.config.ts <файл.ct.tsx>`. В конце каждой
   фазы — полный `rtk proxy npm run verify; echo EXIT=$?`. Красное — чинить сразу,
   дальше не идти.
2. **Симулятор «руками».** `npm run ios:build` → пересборка (MCP `build` →
   `build_status`) → `xcrun simctl terminate $UDID $BID` → MCP `control launch` →
   пройти релевантные шаги матрицы смоука тапами/вводом (`tap`, `text`, `button`):
   минимум — запуск без белого экрана, вход или дашборд, и те шаги, которых касалась
   правка (ввод → шаг 6, тема → шаг 9, storage → шаг 3 и т.д.). Каждое состояние —
   `screenshot` в папку текущего прогона (`<scratchpad>/ios-smoke/<HHMM>/NN-имя.png`),
   каждый скриншот **посмотреть глазами** (Read) и сравнить с ожиданием матрицы, а не
   просто сохранить. Лог приложения (раздел 3) — на ошибки после прогона.
3. **Журнал.** Что проверено, чем доказано (пути скриншотов, вывод команд с EXIT),
   что не сошлось и как починено.

Правки только документов/спеки контрольной точки в симуляторе не требуют —
достаточно `npm run check`. Панель симулятора (`control attach`) можно открыть один
раз в начале работы, чтобы владелец увидел живое приложение, когда вернётся; все
проверки при этом остаются headless (скриншоты).

## 2. Фазы

Каждая фаза: шаги → контрольная точка 2a → критерий выхода → коммит → запись в журнал.

### Ф0. Ветка и база

1. `git fetch origin`. Ветка `feat/ios-capacitor-app` уже существует локально: в ней
   спека и этот раннбук, ответвлена от `origin/main` (`8e822ef`, 2026-09-26).
   Основной checkout: `git checkout feat/ios-capacitor-app`. Worktree: та же команда
   внутри worktree (ветка не должна быть занята другим checkout'ом — основной стоит
   на `main`). Если `origin/main` ушёл вперёд — `git rebase origin/main`.
2. `npm ci` (worktree — через `npm run wt:setup`), затем базовый `npm run verify` —
   должен быть зелёным до твоих правок; красный — это не твоя задача, но зафиксируй.
3. Прочитай: CLAUDE.md, спеку, раннбук, `specs/feature/auth-and-signup-gate.md`,
   раздел «Тач/клавиатура» в `specs/feature/training-ui-and-shell.md`, скиллы
   `test-policy` и `convex-conventions`.

**Выход:** ты на ветке, зависимости стоят, verify зелёный, журнал создан.

### Ф1. Регистрация включена (TDD)

1. Красные тесты: в `convex/auth.test.ts` блок «registration disabled» переписать в
   «registration enabled» — флаг `true`; `signUp` (`t.action(api.auth.signIn, {provider:
   "password", params:{email, password, flow:"signUp"}})`) создаёт ровно одного
   `users` + `authAccounts`; повторный `signUp` на тот же email отвергается без
   дубля; `signIn` теми же кредами проходит. В `src/components/SignIn.ct.tsx` тест
   «does not expose the registration switch» → «exposes …»: переключатель виден, тап
   переводит заголовок в «Регистрация», кнопку в «Зарегистрироваться», обратный тап
   возвращает.
2. Зелёный: `SIGNUP_ENABLED = true` в `convex/auth.ts` и `src/components/SignIn.tsx`
   (комментарии «DISABLED» переписать). Атрибуты полей входа: email —
   `inputMode="email" autoCapitalize="none" autoCorrect="off"` (если ещё нет).
3. Доки: `specs/feature/auth-and-signup-gate.md` (статус «регистрация включена
   2026-09-26», как выключить обратно), CLAUDE.md (строка про регистрацию),
   README (упоминания «отключена»), `.claude/skills/browser-smoke/SKILL.md`
   (раздел «Вход»: регистрация доступна, dev-аккаунт остаётся для worktree).
4. Проверка: `npm run test:backend`, `npx playwright test -c playwright-ct.config.ts
   src/components/SignIn.ct.tsx`, `npm run check`.

**Выход:** тесты зелёные, доки согласованы. Коммит `feat(auth): включить публичную регистрацию (оба флага) + тесты`.

### Ф2. Vite-режим ios, Capacitor, первый запуск

1. context7: Capacitor 8 — `capacitor.config.ts`, `cap add ios --packagemanager SPM`,
   `cap sync`; плагины Preferences/Haptics/StatusBar/SplashScreen/Keyboard;
   `@capacitor/assets` (структура `assets/` и флаги `generate --ios`).
2. Зависимости: `npm i @capacitor/core@^8 @capacitor/ios@^8 @capacitor/preferences
   @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard`
   и `npm i -D @capacitor/cli@^8 @capacitor/assets`. Версии плагинов — мажор,
   совпадающий с core.
3. Конфиги: `vite.config.ts` (`build.outDir: mode.startsWith("ios") ? "dist-ios" : "dist"`;
   `base` уже верный); `package.json` скрипты `ios:build`, `ios:sim`, `ios:assets`,
   `ios:release`, `ios:open`; `.gitignore` += `dist-ios`; `.oxlintrc.json`
   ignorePatterns += `ios`, `dist-ios`; `tsconfig.node.json` include +=
   `capacitor.config.ts`; `capacitor.config.ts` по спеке (appId
   `io.github.ksenyagorbatova.portuguese`, appName `Português`, webDir `dist-ios`,
   plugins SplashScreen/Keyboard/StatusBar).
4. `npm run ios:build` (появится `dist-ios/`), затем `npx cap add ios --packagemanager SPM`,
   `npx cap sync ios`. Посмотри, что сгенерировалось: `ls ios/App`, `xcodebuild -list
   -project ios/App/App.xcodeproj` (или `-workspace ios/App/App.xcworkspace`, если он
   есть) — запомни схему (обычно `App`) и путь проекта для MCP `build`.
5. Info.plist и таргет (пути — по факту генерации, обычно `ios/App/App/Info.plist`):
   ```bash
   P=ios/App/App/Info.plist
   /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Português" $P
   /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" $P
   /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" $P
   /usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" -c "Add :UISupportedInterfaceOrientations array" -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" $P
   /usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" $P 2>/dev/null || true
   grep -n "TARGETED_DEVICE_FAMILY" ios/App/App.xcodeproj/project.pbxproj   # затем sed → = 1;
   ```
   Если ключ уже есть и `Add` падает — используй `Set`. Проверь итог `plutil -p $P`.
6. Первый запуск: `xcrun simctl boot <UDID 17 Pro>; xcrun simctl bootstatus <UDID> -b`;
   `npx convex dev` в фоне; MCP `build` (scheme `App`, device `iPhone 17 Pro`) →
   `build_status` до `.app` → MCP `control launch app_path=…` → `screenshot`.
   Ожидание: экран входа приложения (не белый экран, не Splash навечно). Затем
   регистрация тестового email через `tap`/`text` → дашборд.
7. Напиши `scripts/ios/run-sim.sh` (CLI-дублёр: `xcodebuild … -destination
   'platform=iOS Simulator,id=$UDID' -derivedDataPath build/DerivedData build` →
   `xcrun simctl install/launch`), чтобы цикл не зависел от MCP.

**Выход:** приложение запускается в симуляторе, вход/регистрация работают, `npm run
check` зелёный (lint не лезет в `ios/`), `npm run build` (Pages) не изменился. Коммит
`feat(ios): Capacitor-оболочка, vite-режим ios, первый запуск в симуляторе`.

### Ф3. Нативные адаптации (каждая — сначала тест)

1. `src/lib/native.ts` (`isNative()`), `src/lib/authStorage.ts` (+`.test.ts`, мок
   `@capacitor/preferences`), `src/main.tsx` → `storage={isNative() ? nativeTokenStorage : undefined}`.
   Проверка в симуляторе: вход → `xcrun simctl terminate <UDID> <bundleId>` → launch →
   дашборд без формы входа.
2. `src/lib/haptics.ts` — нативная ветка `@capacitor/haptics` (+тест: зовётся плагин,
   mute глушит, веб-ветка прежняя).
3. `src/lib/useTheme.ts` — `StatusBar.setStyle` по `resolved` на нативной платформе
   (+тест). Проверка: скриншоты light/dark — цвет текста статус-бара инвертируется.
4. `TypeExercise.tsx` — `autoCapitalize="none" autoCorrect="off" spellCheck={false}
   enterKeyHint="done" lang="pt-PT"` на инпуте (+CT на атрибуты). Проверка в
   симуляторе: тап в поле → клавиатура → поле и кнопка «Проверить» видны (скриншот);
   если перекрыто — перебрать `Keyboard.resize`: `body` → `native` → `ionic`, либо
   `scrollIntoView` на фокусе.
5. `src/lib/speech.ts` — диагностические `console.debug("[speech] …")` (voices при
   прогреве; start/end/error utterance) (+ правка тестов, если они ловят консоль).
   Проверка: ответ на MC → в логе `[speech] start`. Нет голоса/старта после двух
   честных попыток → плагин `@capacitor-community/text-to-speech` за тем же API
   (решение 7 спеки), тесты на ветку плагина.
6. Иконки/сплэш: `scripts/ios/render-assets.mjs` (playwright-core → PNG без альфы:
   `assets/icon-only.png` 1024², `assets/splash.png` 2732² фон `#f4f3ef`,
   `assets/splash-dark.png` фон `#16150f`), `npx capacitor-assets generate --ios`
   (флаги фона по README пакета). Проверка: `button HOME` → скриншот домашнего
   экрана — иконка с флагом и «pt», подпись «Português».
7. `capacitor.config.ts`: SplashScreen `launchAutoHide: true, launchShowDuration: 0,
   backgroundColor "#f4f3ef"`; Keyboard `resize` (что выбрано в п.4).

**Выход:** `npm run verify` зелёный, все проверки пунктов 1–7 подтверждены скриншотами
или логами. Коммит `feat(ios): нативные адаптации — storage токенов, хаптика, статус-бар, клавиатура, иконки`.

### Ф4. Цикл смоука до стабильности

Полный проход матрицы из спеки (раздел «Тестирование», шаги 1–13) по протоколу
раздела 3. Дефект → диагноз (лог, скриншот, исходник) → правка → `npm run ios:build`
→ пересборка → **проход с шага 1 заново** (после `xcrun simctl uninstall`, чтобы
состояние было чистым). Результат каждого шага — в журнал (✅/❌ + путь скриншота).

**Выход:** два полных чистых прохода подряд на iPhone 17 Pro без правок кода между
ними + проход шага 12 (и 1, 4–6) на iPhone SE. Коммит правок, если были.

### Ф5. CI, release-скрипты, документация

1. `.github/workflows/ci.yml` — job `ios-build` (`macos-latest`; `actions/checkout`,
   `setup-node` 24 с кэшем npm, `npm ci`, `VITE_CONVEX_URL=https://ci-placeholder.convex.cloud
   npm run ios:build`, `xcodebuild -project ios/App/App.xcodeproj -scheme App
   -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator'
   CODE_SIGNING_ALLOWED=NO build`; при SPM — предварительно
   `xcodebuild -resolvePackageDependencies`). Локально прогони ту же команду
   `xcodebuild` — она и есть проверка джоба. Пины версий actions — как у соседних
   джобов (SHA + комментарий версии).
2. `scripts/ios/release.sh` + `scripts/ios/ExportOptions.plist` +
   `.env.ios-release.example` по решению 10 спеки. Скрипт: `set -euo pipefail`;
   `set -a; . ./.env.ios-release.local; set +a` (если файла нет — печать хендоффа и
   `exit 2`); `xcodebuild archive` → `xcodebuild -exportArchive` с `destination upload`.
   Проверь синтаксис `bash -n`, плист — `plutil -lint`.
3. Archive/upload **не запускать** (решение 12 спеки: обращение к Apple — только
   владелец). Проверка release-скриптов ограничивается `bash -n scripts/ios/release.sh`,
   `plutil -lint scripts/ios/ExportOptions.plist` и сухим прогоном без
   `.env.ios-release.local` (скрипт должен напечатать хендофф и выйти с кодом 2).
4. Документация: CLAUDE.md (раздел «Команды» — `ios:*`; «Структура» — `ios/`,
   `scripts/ios/`, `assets/`, `capacitor.config.ts`; «Авторизация» — регистрация
   включена), README (раздел «iOS-приложение: сборка, симулятор, TestFlight»),
   скилл `browser-smoke` (если не сделано в Ф1), baseline `auth-and-signup-gate.md`.

**Выход:** локальный `xcodebuild` под симулятор проходит той же командой, что в CI;
скрипты валидны; доки обновлены. Коммит `chore(ios): CI-сборка под симулятор, release-скрипты, документация`.

### Ф6. Гейты и локальная готовность (без push и PR)

Гейты — по скиллу `ship-task`, но отгрузка останавливается ПЕРЕД push: (1) тесты на
месте → (2) `/spec` — актуализируй `specs/feat/ios-capacitor-app.md` по полному диффу
`main...HEAD` (статус, принятые решения и fallback'и, реальная карта файлов,
результаты смоука; в раннбук добавь раздел «Что отличилось от плана», если было) →
(3) `/code-review` на диффе ветки (субагенты — `model: "opus"`), каждая находка
разобрана, реальные баги — тест-красный → фикс → зелёный → (4) `npm run verify` →
(5) `npm run build` → (6) смоук: симуляторная матрица уже пройдена в Ф4 (сослаться
на журнал); для веба — CT `SignIn` + при наличии Chrome-MCP потоки 1–3 скилла
`browser-smoke` (в т.ч. регистрация) → (7) коммиты осмысленными порциями →
(8) **тело будущего PR** — файл `specs/feat/ios-capacitor-app.pr.md`: заголовок
`feat: iOS-приложение на Capacitor + включение регистрации`; цель; что сделано;
ключевые решения и fallback'и; тестирование (числа тестов, вывод `verify`/`build`,
матрица смоука ✅/❌ с путями скриншотов и датой прогонов); итог code-review;
раздел **«Хендофф: ревью → push → PR → TestFlight»** (шаг 0 и шаги TestFlight из
спеки, состояние: что готово, что делает владелец); футер
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Закоммить файл →
(9) финальная проверка на последнем коммите: `rtk proxy npm run verify; echo EXIT=$?`
и `rtk proxy npm run build; echo EXIT=$?` (pre-push не сработает — push не делаем),
`git status` чистый, `git log --oneline main..HEAD` осмысленный. **`git push` и
`gh pr create` НЕ выполнять.**

### Ф7. TestFlight — только подготовка

Ничего не загружать. Убедись, что `scripts/ios/release.sh`, `ExportOptions.plist`,
`.env.ios-release.example` и раздел «Хендофф» в теле PR дают владельцу путь «одна
команда после создания ключа». Если `.env.ios-release.local` уже лежит в репо —
не использовать его и не читать значения в логи; просто отметить в теле PR, что
владелец может сразу запускать `npm run ios:release` после push/ревью.

## 3. Протокол одного прохода смоука

```bash
UDID=ADAEF52E-115E-4F3E-A844-0587D20A42CC        # iPhone 17 Pro; для SE — D46B05DA-…
BID=io.github.ksenyagorbatova.portuguese
S=<scratchpad>/ios-smoke/$(date +%H%M)            # папка прогона: скриншоты + лог
mkdir -p $S
xcrun simctl boot $UDID 2>/dev/null; xcrun simctl bootstatus $UDID -b
xcrun simctl uninstall $UDID $BID 2>/dev/null || true          # чистое состояние
# лог приложения (в фоне, run_in_background): JS-console Capacitor попадает сюда
xcrun simctl spawn $UDID log stream --style compact --level debug --predicate 'process == "App"' > $S/log.txt 2>&1
```
Далее шаги матрицы спеки. Наблюдения: MCP `screenshot` (или `xcrun simctl io $UDID
screenshot $S/NN-name.png` + Read файла), координаты тапов — в points из скриншота
(размер экрана сообщает результат `launch`). Ввод текста: `tap` по полю, затем
`text`. Перезапуск: `xcrun simctl terminate $UDID $BID` → `launch`. Тёмная тема ОС:
`xcrun simctl ui $UDID appearance dark` (вернуть `light`). Домашний экран: `button HOME`.
Проверки лога после прогона:
```bash
grep -E "\[speech\]" $S/log.txt | tail -20
grep -iE "unhandled|typeerror|referenceerror|failed to load|convex.*error|auth.*error" $S/log.txt | head
```
Проход считается чистым, если все шаги матрицы ✅ и второй grep пуст (за вычетом
системного шума симулятора, который ты явно опознал и записал в журнал).

## 4. Диагностика и fallback'и

| Симптом | Что проверить / сделать |
|---|---|
| `cap add ios`: «webDir … does not exist» | сначала `npm run ios:build` |
| SPM: не резолвятся пакеты / странные ошибки сборки | повторить раз (сеть); затем fallback CocoaPods: удалить `ios/`, `npx cap add ios` (без флага), `npx cap sync ios` (pod install), проект — `ios/App/App.xcworkspace`; решение в спеку |
| «Signing for App requires a development team» при сборке под симулятор | `CODE_SIGNING_ALLOWED=NO` (симулятору подпись не нужна) |
| Белый экран после запуска | `cap sync` выполнен? `ios/App/App/public` содержит `dist-ios`? base `/` (grep `/portuguese/` в `dist-ios/index.html` — быть не должно); ошибки в `log.txt` |
| Не коннектится к Convex (вечный Splash) | worktree без `NSAllowsLocalNetworking`; `npx convex dev` не запущен; какой URL зашит — `grep -o 'https\?://[^"]*convex[^"]*\|127.0.0.1:[0-9]*' dist-ios/assets/*.js` |
| Регистрация: `REGISTRATION_DISABLED` | флаг сервера не запушен (`convex dev` не работал) или не перевёрнут |
| Клавиатура перекрывает поле | `Keyboard.resize`: `body` → `native` → `ionic`; либо `scrollIntoView` на фокусе; проверять на SE |
| Нет `[speech] start` | лог voices: `pt=none` → ждать `voiceschanged`/повторить `getVoices()`; всё равно нет → плагин TTS (решение 7) |
| Тёмный статус-бар на светлом фоне | `Style.Dark` = светлый текст (для тёмного фона) — не перепутать |
| Симулятор зависает / странное состояние | `xcrun simctl shutdown all`; крайний случай `xcrun simctl erase $UDID` (данные приложения не жалко) |
| oxlint ругается на `ios/App/App/public/**` | `ignorePatterns` в `.oxlintrc.json` |
| `tsc -b` спорит с `capacitor.config.ts` | include в `tsconfig.node.json`, типы из `@capacitor/cli` |
| `npm run wt:seed` падает | остановить `npx convex dev`, повторить |
| CT падает по порту | в worktree порты смещены автоматически; убить зависшие процессы `vite`/`playwright` |
| Archive: provisioning / «No Accounts» (при ручном запуске владельцем) | нужен ключ API или Apple ID в Xcode; вторая команда `2GJM94F693`; сессия archive не запускает |
| Upload: «No suitable application records» (при ручном запуске владельцем) | нет записи приложения в App Store Connect → создать (хендофф, шаг 2) |

## 5. Финальный отчёт (в чат, когда всё завершено)

Коротко: имя ветки и `git log --oneline main..HEAD`; путь к телу PR
(`specs/feat/ios-capacitor-app.pr.md`); что сделано (одним абзацем); матрица смоука
✅/❌ с путями скриншотов; числа тестов и статус `verify`/`build` на последнем
коммите; итог code-review; что владельцу сделать руками, в порядке: ревью диффа и
`npm run ios:sim` → `git push -u origin feat/ios-capacitor-app` → `gh pr create
--body-file specs/feat/ios-capacitor-app.pr.md` → шаги TestFlight; известные
ограничения. Без голословного «работает» — только с доказательствами (скриншоты,
логи, вывод команд). Явно подтверди: push, PR и загрузка в TestFlight не выполнялись.

## 6. Что отличилось от плана (итог автономной сессии 2026-09-26)

Факты, которые дорого выяснять заново; решения — в спеке (14–22).

- **`xcodebuild` висит на «Resolve Package Graph».** Не сеть: SwiftPM перед
  скачиванием бинарных артефактов `capacitor-swift-pm` ищет учётку github.com в
  Keychain и ждёт модальный диалог. Лечение — `-packageAuthorizationProvider netrc`
  (уже в `run-sim.sh`, `release.sh`, CI). После первого скачивания артефакты лежат в
  `~/Library/Caches/org.swift.swiftpm/artifacts`, и MCP-сборка (без этого флага)
  тоже проходит. Зависший `xcodebuild` виден только вне песочницы Bash
  (`dangerouslyDisableSandbox`), там же его можно `kill`.
- **Лог JS-консоли** — не `log stream`: `CAPLog` пишет в stdout. Рабочий способ —
  фоновый `xcrun simctl launch --console-pty --terminate-running-process <udid> <bid>
  > ~/Library/Logs/…/console.log` (путь в `/private/tmp/claude-*` процессам
  симулятора не виден). Debug-лог Capacitor печатает `TO JS {…}` со ЗНАЧЕНИЯМИ
  (включая токены из Preferences) — такие строки в отчёты не копировать.
- **Ввод в симуляторе.** MCP `text` вводит HID-событиями: при русской активной
  раскладке — кириллица; программная клавиатура после этого сворачивается
  (устройство считает, что подключена аппаратная). Префы устройства:
  `xcrun simctl spawn <udid> defaults write com.apple.keyboard.preferences
  AutomaticMinimizationEnabled -bool false` и `HardwareKeyboardLastSeen -bool false`
  (+ `KeyboardLastUsed en_US@sw=QWERTY;hw=Automatic`) и перезагрузка устройства.
  Надёжнее: email/пароль — `xcrun simctl pbcopy` + долгий тап → «Вставить»; ответ в
  Type-карточке — тапами по клавишам QWERTY. На iOS 17 первый показ клавиатуры
  перекрыт подсказкой про свайп-ввод — `DidShowContinuousPathIntroduction -bool true`.
- **MCP-инструмент симулятора просит разрешения владельца на КАЖДОЕ новое
  устройство.** SE без владельца не разрешить → SE проверен через WebKit Remote
  Inspector: npm `appium-remote-debugger` во временном каталоге (не в проекте),
  сокет — `xcrun simctl getenv <udid> RWI_LISTEN_SOCKET`; приложение видно как
  `process-App`, id страницы `PID.page` → `selectPage(pid, page)`; `execute` ждёт
  строку `{status, value}`; между сессиями инспектора нужна пауза ~3 с.
  Скриншоты — `xcrun simctl io <udid> screenshot`, ввод в WebView — JS
  (нативный сеттер value + `input`, `KeyboardEvent` Enter); клавиатура при
  программном `focus()` показывается (Capacitor: `keyboardShouldRequireUserInteraction = false`).
- **Белый кадр при запуске** нашёлся только на видео холодного старта
  (`xcrun simctl io <udid> recordVideo --codec=h264` → кадры через AVFoundation;
  ffmpeg из кэша Playwright h264 не читает). Статичный скриншот его не ловит.
- **`launchShowDuration: 0` ≠ «сплэш до готовности»** — плагин с нулём не
  показывает сплэш вообще (см. спеку, решение 20).
- **Статус-бар** — `SystemBars` из core вместо `@capacitor/status-bar` (решение 19).
- **Не понадобились:** fallback CocoaPods, плагин TTS.
- **Команды для следующей сессии:** сборка+установка — `npm run ios:sim`
  (DerivedData — `~/Library/Developer/Xcode/DerivedData/portuguese-ios-<хеш пути>`),
  или вручную `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration
  Debug -sdk iphonesimulator -destination "platform=iOS Simulator,id=$UDID"
  -derivedDataPath "$DERIVED" -packageAuthorizationProvider netrc
  CODE_SIGNING_ALLOWED=NO -quiet build` → `xcrun simctl install $UDID
  "$DERIVED/Build/Products/Debug-iphonesimulator/App.app"`. Первый запуск после
  установки — чёрные кадры (iOS строит снимок LaunchScreen): видео холодного старта
  писать после одного прогревочного запуска.

### Ф6: что нашло код-ревью и что изменилось после смоука Ф4

`/code-review` (max: 10 ракурсов + свип, субагенты на Opus) — 15 подтверждённых/
правдоподобных находок, все исправлены с тестом, воспроизводящим дефект (красный
до фикса); после правок — повторный смоук (спека, «Тестирование»).

- **signUp как оракул пароля (безопасность).** Проверено по исходнику
  `@convex-dev/auth` 0.0.93: signUp на существующий аккаунт идёт в
  `createAccountFromCredentials`, который сверяет пароль и выдаёт сессию без rate
  limit. Тест «даже верный пароль → ACCOUNT_EXISTS, ноль сессий» был красным;
  в симуляторе на живом dev-деплое — «Аккаунт с таким email уже есть — войдите.»
  (`cr-kbd/08`).
- **Клавиатура: `body` → `native`.** Решение Ф3 «body достаточно» проверялось на
  карточке Type, где всё и так выше клавиатуры. Ревью по `Keyboard.m` + CSS: режим
  `body` пишет `<body>` inline-height, а `min-height: 100vh` его перебивает —
  форма входа с баннером ошибки теряла низ под клавиатурой. В `native` WebView
  ужат до 539 pt (17 Pro), форма докручивается целиком (`cr-kbd/09`, `10`),
  RetryBox и «Проверить» над клавиатурой (`cr-kbd/03`).
- **Двойной сплэш.** Видео холодного старта ревью-сборки: логотип → спиннер
  «Загрузка…» → дашборд (`HideNativeSplash` сидел на корне и снимал сплэш до
  данных). Теперь его рендерят только настоящие экраны; видео `cr-fix-light2`,
  `cr-fix-dark`: логотип → кросс-фейд → дашборд.
- **`isOpaque = false`** в `capacitorDidLoad` оказалось лишним и вредным:
  `WebViewDelegationHandler.willLoadWebview` (вызывается ПОСЛЕ `capacitorDidLoad`)
  сохраняет текущее значение и восстанавливает его после загрузки — WebView
  оставался прозрачным навсегда. Убрано; белого кадра нет (те же видео).
- **Манифест приватности, iOS 16.4, `hasNativePlugin`** — по чек-листу App Store /
  цели бандла Vite 8 / отказоустойчивости провайдера авторизации.
- **release.sh** исполнял env-файл как shell (плейсхолдер `<you>` из образца —
  синтаксическая ошибка) и подставлял Team ID в `sed` без проверки — тест
  `release.test.ts` против старого скрипта: 8 из 11 красные.
- **Свип нашёл ещё четыре:** `lang="pt-PT"` на поле с русским плейсхолдером
  (VoiceOver), порядок хендоффа (App ID до New App), development-профиль архива
  требует устройство, правило аддитивного API для замороженного клиента —
  исправлено кодом/документацией.
- **Не сделано (осознанно):** детерминированный рендер иконки (Bricolage не
  установлен — глиф из `system-ui`; кандидат — текст фавикона в контуры).
  Сделано в доработке ниже.

### Доработка после отчёта: удаление аккаунта и иконка

Запрос владельца после первого отчёта: удаление аккаунта из приложения
(App Store 5.1.1(v)) и починка иконки. Коммиты `56be80b` (удаление), `91e03bb`
(«pt» контурами) и фиксы код-ревью поверх них. Решения — спека, 26 и 27.

**Код-ревью** (`/code-review` max: 10 ракурсов, 11 верификаторов, свип;
субагенты на Opus). Реальные находки исправлены, каждая с тестом, который был
красным до фикса:

- Второе устройство удалённого аккаунта висело на «Загрузка…» без шапки:
  `getSrsState` отдаёт `null`, а JWT ещё до часа валиден. Лечение: `viewer` =
  `gone` → `Shell` зовёт `signOut()`.
- Гонка входа и удаления (вход по паролю — две транзакции) оставляла
  сессию-сироту. Лечение: `beforeSessionCreation` → `ACCOUNT_DELETED`.
- Токен вышедшей (отозванной) сессии мог удалять аккаунт и писать прогресс.
  Лечение: `liveUserId` проверяет и сессию; lint запрещает голый `getAuthUserId`
  в `convex/`, `getCourse` тоже переведён.
- `account:viewer` через `useQuery` ронял всё приложение в экран ошибки, если
  функции нет на деплое: пойман смоуком до `convex dev --once`. Лечение: `useQueries`.
- Счётчики неудачных входов по email (путь кодов) переживали удаление.
- Все refresh-токены в одной транзакции: у брошенных сессий их сотни. Лечение:
  фоновая зачистка пачками.
- Офлайн мутация висела в очереди без ответа, а ошибка терялась при уходе с
  экрана. Лечение: кнопка офлайн отключена, диалог модальный до ответа, фокус
  после ошибки возвращается.
- Иконка: кернинг opentype.js молча не работал (GPOS type 9 не читается) — код
  убран, у p→t кернинг 0. `isDirectRun` ломался на симлинке — общий хелпер на
  realpath. Рассинхрон PNG и фавикона ничем не ловился — `assets.lock.json` + тест.
- Чистка: `USER_OWNED_TABLES` с проверкой полноты по схеме, фазы футера одним
  union, одно чтение пользователя в `viewer`, `requireLiveUserId`, общие
  хелперы backend-тестов (`src/test/convexAuth.ts`).
- Свип добавил: длинный email вылезал из диалога, контраст email 3.08:1,
  зона нажатия кнопки 28px, флаг финала курса переживал удаление, плавающие
  версии шрифта и парсера логотипа, тест Shell не проверял теорию. Всё
  исправлено. Повторный ввод пароля перед удалением — осознанно нет (спека, 26).
- Опровергнуты верификаторами: необработанный reject `signOut`; настройки
  устройства (тема, mute, подсказки) после удаления — они не данные аккаунта.

**Факты, которые дорого выяснять заново:**

- `@convex-dev/auth` 0.0.93: JWT живёт час и после `signOut`/удаления, сервер
  проверяет только подпись и срок; `getAuthUserId` просто режет `subject`;
  `beforeSessionCreation` вызывается внутри мутации `signIn` до вставки сессии;
  каждый refresh вставляет новую строку `authRefreshTokens`; лимиты неудачных
  входов — по `_id` аккаунта (пароль) и по сырому email (коды).
- `convex/react`: `useQuery` бросает ошибку запроса в ErrorBoundary,
  `useQueries` отдаёт её значением. Мутация без сети не отклоняется — ждёт
  соединения.
- opentype.js 2.0: в Node/Vitest — только CJS через `createRequire`; GPOS type 9
  (Extension) не читает. Chromium добавляет letter-spacing и после последней
  буквы, WebKit — нет.
- CT: цвета после смены `data-theme` читать после `document.getAnimations()`
  (у `body` переход фона); Playwright считает `aria-disabled` отключённым —
  клик только с `force: true`.
- Хук `tech-toolkit` блокирует Bash-команду, в тексте которой есть вызов
  создания PR через `gh` (даже внутри правки файла): такую правку делать
  скриптом из файла.

**Смоук** — спека, «Смоук доработки»: веб + iOS 17 Pro, доказательства в
`~/Library/Logs/portuguese-ios/smoke-2026-09-26/acct/`.
