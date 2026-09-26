feat: iOS-приложение на Capacitor + включение регистрации

## Зачем

Тренажёр становится устанавливаемым iOS-приложением для раздачи тестерам через
TestFlight: та же SPA (React 19 + Vite 8 + Convex) в нативной оболочке Capacitor 8,
с иконкой, сплэшем, сохранением входа, хаптикой и статус-баром под тему. Чтобы
тестеры могли завести аккаунт с телефона, **включена публичная регистрация** (и на
сайте). Веб-версия на GitHub Pages в остальном не меняется.

Спека — [`specs/feat/ios-capacitor-app.md`](specs/feat/ios-capacitor-app.md),
протокол автономной сессии и история решений — [`…runbook.md`](specs/feat/ios-capacitor-app.runbook.md).

## Что сделано

- **iOS-проект `ios/`** (Capacitor 8.5.2, Swift Package Manager, без CocoaPods):
  локальный бандл `dist-ios` (Vite-режимы `ios` / `ios-release`, base `/`), iPhone-only,
  портрет, локаль `ru`, минимальная iOS 16.4, манифест приватности
  (`UserDefaults` CA92.1, email и прогресс — App Functionality, без трекинга).
- **Нативные адаптации за существующими модулями** (`isNative()` / `hasNativePlugin()`):
  токены Convex Auth в `@capacitor/preferences` (переживают чистку storage WebKit),
  хаптика Taptic Engine (`@capacitor/haptics`, mute глушит), статус-бар по теме
  приложения (`SystemBars` из core), клавиатура ужимает WebView
  (`Keyboard.resize = native`), поле ответа без автокоррекции/капитализации с
  клавишей «done», safe-area и подложка под статус-баром в CSS.
- **Запуск без вспышек:** нативный сплэш держится до первого настоящего экрана
  (вход / загруженный курс / экран ошибки), фон WebView до первой отрисовки —
  цвет `PageBackground` = `--page` (генерится из `src/index.css`, рассинхрон ловит тест).
- **Регистрация включена** (оба флага `SIGNUP_ENABLED`). `signUp` на занятый email →
  `ConvexError("ACCOUNT_EXISTS")` **без проверки пароля** (иначе signUp был бы
  оракулом подбора пароля — штатный путь провайдера сверяет пароль без rate
  limit); `INVALID_EMAIL` на мусорный адрес; коды → понятные тексты в UI;
  переключатель «Нет аккаунта?» — настоящая `<button>`.
- **Сборка и релиз:** `npm run ios:build | ios:sim | ios:open | ios:assets | ios:release`;
  CI-job `ios-build` (симулятор, без подписи); `scripts/ios/release.sh` — прод-бандл
  (URL из коммитнутого `.env.ios-release`) → `xcodebuild archive` → upload в App
  Store Connect по ключу API; env читается построчно, не исполняется;
  `--check` — проверка настройки без сборки.
- **Документация:** CLAUDE.md (iOS-раздел, правило аддитивного API Convex для
  замороженного клиента), README (сборка, симулятор, TestFlight), скилл
  `browser-smoke`, baseline-спеки auth / theme / training-ui.

## Ключевые решения и фолбэки

- Локальный бандл, а не `server.url` на Pages (App Store 4.2 + независимость от
  Pages); цена — замороженный клиент → правки API Convex только аддитивные.
- Без `@capacitor/status-bar` (гонка с JS) и без `@capacitor/assets` (тянет sharp и
  cli@5): свой `render-assets.mjs` на playwright-core + PNG-кодек без альфы.
- Без плагина TTS: Web Speech API в WKWebView работает (голос pt-PT «Жуана»).
- SwiftPM-сборки — с `-packageAuthorizationProvider netrc` (иначе висит на Keychain).
- Фолбэки раннбука (CocoaPods, TTS-плагин) не понадобились.

## Тестирование

- `npm run verify` — зелёный на финальном коммите: typecheck + oxlint (0 диагностик),
  **Vitest 27 файлов / 290 тестов** (backend + frontend), **Playwright CT 155**.
- `npm run build` — зелёный (Pages-бандл с base `/portuguese/`).
- Новые/изменённые тесты: `convex/auth.test.ts` (регистрация, ACCOUNT_EXISTS даже с
  верным паролем и без сессии, INVALID_EMAIL, рубильник), `SignIn.ct.tsx` (коды
  ошибок → тексты, кнопка-переключатель с клавиатуры, рубильник), `authStorage`,
  `native`, `haptics`, `useTheme` (статус-бар), `speech` (диагностика),
  `HideNativeSplash` (+ кто снимает сплэш), `SafeArea.ct`, `TypeExercise.ct`,
  `scripts/ios/png`, `page-colors` (страж рассинхрона цвета), `release` (ветки
  валидации `release.sh`, `--check`).

**Смоук в iOS-симуляторе — 2026-09-26, финальная сборка** (доказательства:
`~/Library/Logs/portuguese-ios/smoke-2026-09-26/`, логи без строк с токенами):

| # | Шаг | 17 Pro (p3) | 17 Pro (p4) | SE (se2) |
|---|---|---|---|---|
| 1 | Холодный старт: сплэш → экран, без белого кадра и спиннера | ✅ | ✅ | ✅ |
| 2 | Регистрация → дашборд; занятый email → «уже есть», без входа | ✅ | ✅ | — |
| 3 | Kill → запуск: сразу дашборд | ✅ | ✅ | — |
| 4 | Темы → теория, flip + озвучка → сессия `1/20` | ✅ | ✅ | ✅ |
| 5 | MC: «Верно!», «следующий повтор», хаптика, озвучка | ✅ | ✅ | ✅ |
| 6 | Ввод: поле и «Проверить» над клавиатурой, done/«Проверить» | ✅ | ✅ | ✅ |
| 7 | Выход из сессии → ScoreRow | ✅ | ✅ | — |
| 8 | Предложения: плитки и cloze | ✅ | ✅ | — |
| 9 | Тема light/dark/system, рестарт, тема ОС, статус-бар | ✅ | ✅ | — |
| 10 | Mute: без хаптики/авто-озвучки, ручная 🔊 звучит | ✅ | ✅ | — |
| 11 | Неверный пароль (баннер над клавиатурой) → вход, прогресс на месте | ✅ | ✅ | ✅ |
| 12 | Малый экран: «Дальше» без прокрутки | — | — | ✅ |
| 13 | Лог без ошибок приложения | ✅ | ✅ | ✅ |

p3 и p4 — iPhone 17 Pro (iOS 26.5), оба с чистой установки, без правок кода между
ними; SE — iPhone SE 3rd (iOS 17.4). Пути к скриншотам по шагам — в спеке
(«Тестирование»). Веб-смоук: регистрация, повтор email в другом регистре →
«Аккаунт с таким email уже есть — войдите.», вход, фокус переключателя с клавиатуры.

## Code review

`/code-review` (max) по диффу ветки: 15 подтверждённых/правдоподобных находок, все
исправлены (тест, воспроизводящий дефект, был красным до фикса), главные:
signUp как оракул пароля (безопасность), нет манифеста приватности (отказ App Store
Connect), клавиатура `body` прятала низ формы, deployment target ниже цели бандла,
двойной сплэш, `isOpaque` навсегда, `release.sh` исполнял env-файл и не проверял
Team ID, порядок шагов TestFlight, `lang` на поле ответа (VoiceOver). Не сделано
осознанно: детерминированный рендер иконки (глиф зависит от шрифтов машины) —
в «Известных ограничениях» спеки.

## Хендофф: ревью → push → PR → TestFlight

1. **Ревью локально:** `git log --oneline main..HEAD`, `git diff main...HEAD`;
   `npx convex dev` (dev-функции с включённой регистрацией) и `npm run ios:sim` —
   пройтись по приложению (можно зарегистрировать свой тестовый email).
2. **Push:** `git push -u origin feat/ios-capacitor-app` (pre-push прогонит
   spec-гейт и `npm run verify`).
3. **PR:** `gh pr create --base main --title "feat: iOS-приложение на Capacitor + включение регистрации" --body-file specs/feat/ios-capacitor-app.pr.md`;
   CI прогонит и `ios-build` (на GitHub он ещё не запускался — локальный эквивалент
   зелёный). После мёржа регистрация откроется и на проде (сайт).
4. **TestFlight** (≈15 минут веб-интерфейсов Apple с 2FA, потом одна команда):
   1. developer.apple.com → Identifiers: App ID `io.github.ksenyagorbatova.portuguese`;
      Devices — хотя бы один iPhone (development-профиль архива).
   2. App Store Connect → New App: iOS, «Português», Russian, этот Bundle ID;
      анкета App Privacy — как в `PrivacyInfo.xcprivacy`.
   3. App Store Connect API → Team Keys → ключ с ролью App Manager, `.p8` в
      `~/.appstoreconnect/private_keys/`.
   4. `cp .env.ios-release.example .env.ios-release.local`, заполнить;
      `sh scripts/ios/release.sh --check`.
   5. `npm run ios:release` → через 5–15 минут сборка в TestFlight → Internal Testing.
5. **До внешнего тестирования / App Store:** удаление аккаунта из приложения
   (Guideline 5.1.1(v)), проверка озвучки при беззвучном режиме на устройстве.

Сессия, подготовившая ветку, **не делала** `git push`, не открывала PR, не
запускала `ios:release` / archive / загрузку в TestFlight.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
