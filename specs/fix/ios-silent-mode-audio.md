# Озвучка iOS при включённом тихом режиме

Ветка: `fix/ios-silent-mode-audio` · 2026-09-29 · статус: исправление установлено
на подключённый iPhone; слышимость в тихом режиме ещё нужно подтвердить вручную.

## Цель

Слова, ручное прослушивание и аудио-упражнения должны звучать в установленном
iOS-приложении при включённом Ring/Silent, если громкость медиа ненулевая.
До исправления общая аудиосессия сохраняла категорию `.soloAmbient` даже после
`onstart` Web Speech — это воспроизведено нативными тестами. iOS глушит такую
категорию переключателем тихого режима.

## Изменения данных / API

Сервер, данные, Web Speech API и интерфейс `src/lib/speech.ts` не меняются.
`AppDelegate.application(_:didFinishLaunchingWithOptions:)` до создания WebView
задаёт общей `AVAudioSession` категорию `.playback`, режим `.default` и опцию
`.mixWithOthers`. Ошибка настройки логируется, запуск приложения продолжается.

## Поведение

- Установленная iOS-оболочка воспроизводит речь независимо от Ring/Silent.
- Mute приложения продолжает выключать авто-озвучку и аудио-карточки;
  ручная кнопка 🔊 остаётся явным запросом на звук.
- Другие приложения могут продолжать воспроизведение (`.mixWithOthers`).
- Громкость медиа, Bluetooth/наушники и системные прерывания не переопределяются.
- Фоновый режим audio не добавлен. Safari/GitHub Pages используют прежний путь.

## Ключевые решения

- **Настройка в AppDelegate.** В WebKit Web Speech обслуживается
  `PlatformSpeechSynthesizer` в UI-процессе, его `AVSpeechSynthesizer` по умолчанию
  использует общую аудиосессию приложения. Замена Web Speech плагином не нужна.
- **Не активировать сессию на старте.** `setActive(true)` при запуске не вызываем:
  настройка политики сама не начинает воспроизведение, сессию использует
  синтезатор при речи.
- **Нативное покрытие.** JS-моки не воспроизводят AVAudioSession. Добавлены
  app-hosted XCTest и общая схема App; CI `ios-build` запускает их на доступном
  iPhone-симуляторе. Проверка синтеза пропускается только на образах без голосов,
  проверка категории после запуска выполняется всегда.

Источники: [Apple: playback](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playback),
[Apple: общая сессия AVSpeechSynthesizer](https://developer.apple.com/videos/play/wwdc2020/10022/),
[WebKit: UIProcess/WebPageProxy.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/WebPageProxy.cpp),
[WebKit: PlatformSpeechSynthesizerCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/cocoa/PlatformSpeechSynthesizerCocoa.mm).

## Тестирование

- XCTest: проверка категории и смешивания после запуска; реальный вызов
  `speechSynthesis.speak` в WKWebView, ожидание `onstart`, повторная проверка
  аудиосессии. До фикса оба теста падали на `.soloAmbient`; после — оба прошли
  на iPhone 17 Pro / iOS 26.5, без пропусков.
- `npm run ios:build` — успешно (веб-бандл + cap sync).
- `LC_ALL=C npm run verify` — успешно: typecheck + lint, 312 Vitest-тестов,
  175 Playwright CT. При обычном запуске с UTF-8-локалью падают 5 существующих
  проверок `scripts/ios/release.test.ts`: macOS `sh` захватывает байт закрывающей
  кавычки `»` в имя переменной (`$ASC_KEY_ID»` и аналоги). Это воспроизводится
  отдельно от приложения и не связано с аудио; release.sh в этой ветке не менялся.
- `npm run build` — успешно.
- Смоук: исправленная сборка запускается в симуляторе до экрана входа;
  настоящий синтез в процессе приложения дополнительно проверен XCTest.
  Ручной проход авторизованного урока не выполнялся (в симуляторе нет сессии).
- Ревью полного изменения: дополнительных дефектов в правке аудио не найдено.
- Release-сборка для физического iPhone подписана существующим Apple Development
  сертификатом и установлена через `devicectl` поверх версии 1.0 (1) как 1.0 (2).
  Bundle ID, команда подписи и группы Keychain совпадают с предыдущей сборкой;
  приложение не удалялось. JS-бандл побайтово совпадает с прежним и подключён
  к тому же production Convex. `codesign --verify --deep --strict` — успешно.
  На iPhone 17 Pro / iOS 27.0 подтверждён номер сборки 2; запуск через
  `devicectl device process launch` завершился успешно.

Локальный запуск нативных тестов (предварительно `npm run ios:build`):

```sh
xcodebuild test -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -packageAuthorizationProvider netrc -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
```

## Карта файлов

- `ios/App/App/AppDelegate.swift` — политика аудиосессии.
- `ios/App/AppTests/AudioSessionTests.swift` — нативные регрессионные тесты.
- `ios/App/App.xcodeproj/project.pbxproj`, `xcshareddata/xcschemes/App.xcscheme` —
  тестовый target и схема; AppTests не участвует в archive.
- `.github/workflows/ci.yml` — запуск XCTest на macOS.
- `specs/feature/training-ui-and-shell.md`, `specs/feat/ios-capacitor-app.md` —
  актуализация правил озвучки iOS.

## Ограничения и выпуск

Симулятор подтверждает категорию аудиосессии и запуск синтеза, но не доказывает
слышимый звук при физическом Ring/Silent. Перед выпуском проверить на iPhone:
тихий режим включён/выключен, динамик/наушники, ручное 🔊 и авто-озвучку,
mute приложения, повтор после сворачивания. Громкость медиа должна быть ненулевой.

Исправление требует новой нативной сборки: её можно установить напрямую с Mac
на подключённый iPhone или распространить через TestFlight. Деплой сайта/Convex
установленную сборку не обновляет. В этой задаче выполнена прямая установка;
публикация TestFlight не выполнялась. Номер сборки 2 передан параметром
`CURRENT_PROJECT_VERSION` при сборке, версия в Xcode-проекте не менялась.
