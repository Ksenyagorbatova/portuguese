# UI тренировки: Shell, хедер, сессия, теория, упражнения

Статус: baseline (отгружено) · 2026-06-11

## Цель

Описать оболочку приложения (оркестрацию экранов), хедер, «поле тренировки»
сессии, доступ к теории и три типа упражнений. Глубокая логика SRS/очереди — в
смежных спеках; здесь — склейка и UX-решения.

## Поведение

**Точка входа.** [`src/main.tsx`](../../src/main.tsx): `ConvexReactClient`,
`primeVoices()`, корневой
[`ErrorBoundary`](../../src/components/ErrorBoundary.tsx) (внутри StrictMode,
снаружи провайдеров: ошибка рендера/query → сообщение на русском + кнопка
«Перезагрузить» вместо белого экрана), `ConvexAuthProvider`.
[`src/App.tsx`](../../src/App.tsx): `useTheme()` + развод `AuthLoading → Splash`,
`Unauthenticated → SignIn`, `Authenticated → Shell`.

**Shell — оркестратор** ([`src/components/Shell.tsx`](../../src/components/Shell.tsx)):
- `View = { home } | { theory } | { session }`; `tab = "review" | "topics"`.
  `switchTab` сбрасывает в `home`.
- `openLesson`: если теория урока НЕ просмотрена → показать `Theory` (онбординг);
  иначе сразу `startLesson`. `openTheory`: `markTheorySeen` + открыть `Theory` в
  любой момент (кнопка в `TopicsTab`). `beginFromTheory`: отметить + старт.
- `startReview`/`startLesson` строят очередь и обнуляют счёт; `nonce` ремаунтит
  `Session` (`key`); `onExit → home`. Серверный `getSrsState` адаптируется через
  `adaptSrs` под `useMemo` (пересборка Record-карт — раз на ответ сервера).
- **Mute авто-озвучки (П.3)** — источник истины в модуле `speech`
  (`isMuted()`/`setMuted()`, персист `localStorage` `pt-muted`). Shell держит
  зеркало в React-state (`muted`, инициализируется из `isMuted()`) ради
  перерисовки иконки в шапке; `toggleMute` зовёт `setMuted(next)` + `setState`.
  Прокидывается в `Header` (`muted`/`onToggleMute`).
- **Финал курса (П.5)** — Shell считает `courseCompleteOf(origin)`: для
  lesson-сессий, когда ВСЕ темы `learned===total`, возвращает плитки
  (всего слов/тем в курсе, `daysSinceStart(startedAt)`, `bestStreak`); иначе
  `null`. Передаётся в `Session` пропом `courseComplete` — тот показывает
  `CourseComplete` вместо `Complete` (см. ниже). `headingOf`/`nextStepOf` —
  заголовок и трамплин-CTA обычного финала.
- **Перечитать теорию из финала** — `onReadTheory(topicKey, lessonKey)` Shell
  мапит на `openTheory` (markTheorySeen + показ `Theory`); используется ссылкой
  «Перечитать теорию» по слову-липучке (П.4).
- **Во время сессии** (`view.kind==="session"`) Shell скрывает `ScoreRow` и
  `TabBar` — остаётся «само поле тренировки». `ScoreRow` показывается только ПОСЛЕ
  сессии (`score.total > 0`).
- **Выход по логотипу из активной сессии — через подтверждение**: `goHome`
  открывает внутренний
  [`ConfirmDialog`](../../src/components/ConfirmDialog.tsx) («Выйти из
  тренировки?» / «Прогресс этой сессии не сохранится.»; `window.confirm`
  заменён — системный диалог нестилизуем). Модальная семантика: `role="dialog"`
  `aria-modal`, фокус при открытии на безопасной «Остаться», Esc и клик по
  подложке = «остаться», Tab зациклен между кнопками; фейд+подъём за `--dur` с
  гейтом `prefers-reduced-motion`. «Активная» = `view.kind === "session"` и НЕ
  `sessionDone`: `Complete` рендерится внутри `Session` (`view.kind` не
  меняется), поэтому Session сигналит опциональным `onComplete?` из `advance()`
  при исчерпании очереди, Shell ставит флаг `sessionDone` (сброс — в
  `startReview`/`startLesson`) — и с экрана Complete логотип уходит домой без
  вопроса. Диалог только на пути логотипа: «К повторению» с экрана `Complete`
  и «Назад» из теории уходят без вопроса (там нечего терять).
- Под хедером — [`OfflineBanner`](../../src/components/OfflineBanner.tsx)
  (`useConvexConnectionState().isWebSocketConnected`): при разрыве соединения
  ненавязчивый баннер «Нет соединения — ответы сохранятся…» (класс `.m-offline`,
  амбер-токены `--rev-*`). Convex-клиент сам ставит мутации в очередь и
  доотправляет при реконнекте — детали в
  [`../fix/exercise-network-resilience.md`](../fix/exercise-network-resilience.md).

**Хедер** ([`src/components/Header.tsx`](../../src/components/Header.tsx)): слева
логотип-кнопка «на главный экран» (`onHome → вкладка «Повторение»`; во время
сессии — через ConfirmDialog, см. выше; фон — флаг Португалии, токены
`--flag-green`/`--flag-red`, только в иконке). Справа по
порядку: стрик 🔥 со статусом «день закрыт» (кружок 16px `m-streak-day`:
`--surface-3` + серая галочка до первой сессии дня, `--accent` + белая после —
по `doneToday` из `adaptSrs`; `aria-label` пилюли проговаривает состояние),
**кнопка mute** (П.3; `m-icon-btn`, 40px, МЕЖДУ стриком и темой),
переключатель темы (3 режима, см. [`theme-system-mode.md`](theme-system-mode.md)),
выход (`log-out`, крайний правый). **Mute-кнопка** глушит авто-озвучку: иконка
`volume`/`volume-off`, `aria-label`/`title` «Звук: включён»/«Звук: выключен» по
пропу `muted`, `onClick → onToggleMute`. Иконка `volume-off` (Lucide volume-x —
динамик с крестом) добавлена в [`Icon.tsx`](../../src/components/Icon.tsx);
состояние и персист держит модуль `speech` (Shell прокидывает зеркало).

**Сессия** ([`src/components/Session.tsx`](../../src/components/Session.tsx)): строка
прогресса показывает **позицию** `idx+1/queue.length` (очередь статична —
знаменатель не меняется), а НЕ долю освоения. Освоение смотрим на
«Темах»/«Повторении» (серверный `learned`). Мини-кольцо освоения в сессии
пробовали и убрали — стартовало с нуля каждую сессию и расходилось с глобальным
прогрессом. У сессии свой выход (крестик в строке прогресса). До-ответной строки
«следующий повтор …» на карточке НЕТ: для не-`due` слов будущая дата — шум, а для
`due` она всегда вырождалась в «прямо сейчас» (жалоба пользователей); расписание
после ответа показывает `Feedback`. Сессия копит уникальные промахи (quality 0)
для финала. Очередь/выбор упражнения — см.
[`session-queue-and-rotation.md`](session-queue-and-rotation.md)
и [`word-learning-model.md`](word-learning-model.md).

**Финал** ([`src/components/Complete.tsx`](../../src/components/Complete.tsx)) —
«трамплин», не отчёт-укор:
- Заголовок по факту: «Тема закрыта!» (100% слов темы) / «Урок выучен!» (урок
  добит) / «Сессия завершена!» (иначе; review-сессии — всегда последнее).
- **Разбор ошибок** «Споткнулся на» (если были промахи): до `MISTAKES_SHOWN` (=5)
  строк «pt — ru» с кнопкой 🔊 (`speak(pt)`, тинт `--due-bg`), предложения в разбор
  не попадают; кнопка «Повторить эти N слов» (`pluralRu`; берёт ВСЕ промахи, не
  только видимые 5) запускает мини-сессию `buildMistakesQueue` с тем же origin.
- **Слова-липучки (П.4)** — у строк разбора с `lapses ≥ LEECH_THRESHOLD` (счётчик
  серверный, сквозной; `learning.ts`) — бейдж `.m-leech` «даётся тяжело»
  (признаём, что слово вредное, а не ученик слаб). Под списком — ссылка
  `.m-relearn` «Перечитать теорию «{урок}»» (book-open, `onReadTheory →
  openTheory` урока ПЕРВОЙ липучки). Ссылка показывается **только когда сама
  липучка ВИДНА** в первых `MISTAKES_SHOWN` строках (`hasShownLeech`): иначе
  вела бы на слово, которого на экране нет (бейджа рядом тоже нет); `relearn`
  считается из первой липучки, поэтому «есть видимая липучка» ⇔ «первая липучка
  показана». Пропы Complete: `leechKeys` (wKey'и липучек), `relearn`,
  `onReadTheory` — все опциональны; деривацию из `cards.lapses` делает `Session`
  (см. ниже).
- **Трёхступенчатый primary-CTA** по фактическому прогрессу (`nextStepOf` в
  `Shell`, тип `NextStep`): в уроке остались слова → «Продолжить урок (ещё N
  слов)» (рестарт той же статичной очереди; ghost «Ещё раз» скрыт — дублировал
  бы primary); урок добит → «Следующий урок: …»; урок добит + тема ≥
  `SENTENCE_TOPIC_THRESHOLD` + есть следующая тема → «Следующая тема: …» (первый
  урок следующей темы через `openLesson`, с теорией, если не просмотрена). Для
  review-origin и тупиков primary — «Ещё раз».
- Строки «Ещё N слов ждут повторения» больше НЕТ (укор поверх празднования);
  «Все повторения сделаны!» осталась. Кнопка «К повторению (N)» показывает
  `min(dueCountAll, REVIEW_DUE_LIMIT)` — ту же честную математику, что кнопка
  героя.
- Ghost «К темам» (book-open) — всегда последняя в действиях: постоянный
  выход к списку тем с финала (фидбэк владельца).

**Финал курса** ([`src/components/CourseComplete.tsx`](../../src/components/CourseComplete.tsx),
П.5) — самый эмоциональный экран продукта, показывается **вместо** `Complete`,
когда выучены ВСЕ темы (`learned===total` по всем), и **только один раз** (флаг
`localStorage` `pt-course-complete-seen`; `Session` держит гейт). Чистый
презентационный компонент — цифры приходят пропами от `Shell`
(`courseCompleteOf`). Содержит: 🇵🇹 40px, display-заголовок «Курс пройден!»,
подзаголовок «Все N тем закрыты. Boa viagem!», три стат-плитки (`--surface-2`:
слова / дней от `startedAt` / 🔥 лучший стрик) и primary-CTA «Повторение
продолжается» (repeat) → review-таб (`onGoReview`; курс конечен, SRS — нет).
Без конфетти (тихая система празднует сдержанно). Переживает отсутствие
`startedAt`: `days=null` → плитка «дней» просто исчезает.

**Теория** ([`src/components/Theory.tsx`](../../src/components/Theory.tsx)) **не
скрывается** после прохождения: flip-карточки (тап → переворот + `speak(pt)`),
секции из `lesson.theory`, кнопка «Начать практику» (`beginFromTheory`) и «Назад»
(`switchTab("topics")`). Онбординг (теория перед первой практикой) сохранён.

**Дашборд:** `ReviewTab` — кольцо «% выучено» (от просмотренных слов), плитки
просмотрено/выучено/к повтору, баннер (4 состояния), кнопка действия. Числа со
словом «слово» склоняются через `pluralRu` (`src/lib/srs.ts`) — в баннере, на
кнопке и в финале («Повторить эти N слов», «Продолжить урок (ещё N слов)»).
**Кнопка повторения честная**: сессия берёт максимум `REVIEW_DUE_LIMIT` (=15,
экспорт из [`src/lib/queue.ts`](../../src/lib/queue.ts)) срочных слов, поэтому при
`due > 15` кнопка показывает «Повторить (15 из N)», иначе — «Повторить (N слов)».
**Прогноз повторений (П.2)** — строка `.m-forecast` под ok-баннером «Все
повторения сделаны…», **только когда `due===0` И `learnedCount>0`** (мост в
завтра вместо тупика): иконка clock 14px + «Завтра к повтору: N слов» либо «В
пятницу/Во вторник к повтору: N слов» (`nextReviewForecast` из
[`src/lib/srs.ts`](../../src/lib/srs.ts) — ближайший будущий КАЛЕНДАРНЫЙ день
строго после сегодня; «сегодня» = due, не показываем; нет будущих due → строки
нет). 12.5px, `--ink-500`.
`TabBar` — segmented «Повторение»/«Темы». `ScoreRow` — верно/заданий/точность
(после сессии). Пилюля-мета «сессия ≈ 5 мин» из дизайн-ревью v2 удалена по
решению владельца (лишний шум в строке урока).

**Упражнения** ([`src/components/exercises/`](../../src/components/exercises/)) —
проверка на клиенте, `quality`: первая попытка верно `2`, со 2-й `1`, провал `0`:
- `McExercise` — выбор (`mc_pt_ru`/`mc_ru_pt`); неверные варианты из ТОГО ЖЕ урока
  (`getWrong`, [`src/lib/wrongOptions.ts`](../../src/lib/wrongOptions.ts)).
- **Аудио-карточка (П.1)** — режим `mode="audio_ru"`: вместо текста вопроса —
  зона `.m-audio-hero` (тинт `--accent-50`, круглая кнопка 52px `--accent`, тень
  `--e-accent`, подпись «Нажми и слушай»), метка «Прослушайте слово», промпт «Что
  вы услышали?», варианты — РУССКИЕ. **pt-текст слова НЕ в DOM до ответа** (звук
  → буквы замыкается уже в `WordFeedback`). Авто-плей один раз при появлении
  (`speakAuto`; `playedRef`-гард от двойного прогона эффекта в React-StrictMode —
  иначе двойной cancel+speak вешал движок речи macOS Chrome на сессию), ручной
  тап по hero — `speakSmart` в ОБХОД mute. После ответа — обычный `WordFeedback`
  (слово письменно), без повторной авто-озвучки. Серверный режим ответа — `"audio"`
  (НЕ двигает выученность, экстра-тренировка слуха — см.
  [`word-learning-model.md`](word-learning-model.md)). Гейт показа аудио-типа —
  `audioOk()` в `Session` (`canSpeakPortuguese() && !isMuted()`).
- `TypeExercise` — ручной ввод (`type_pt`); сверка без диакритики/регистра и без
  пунктуации (`.!?,` и многоточия необязательны с обеих сторон, как в
  `sentenceMatch`; дефис значим); для слов-лейблов с вариантами («um / uma»)
  принимается и каждый вариант, и весь лейбл целиком
  (`variantsMatch`, [`src/lib/text.ts`](../../src/lib/text.ts)).
- `SentenceBuilder` — кросс-предложение из плиток (`sentenceMatch`); **на сервер НЕ
  пишется** (`recordAnswer` не вызывается), влияет только на счёт сессии.

В Mc/Type `finish()` защищён от двойного ответа (синхронный `pendingRef`; ввод
отвечает Enter'ом на **keyUP**, не keydown — после ответа фокус синхронно
уезжает на autoFocus-«Дальше», и Chrome добивал ТО ЖЕ физическое нажатие
кликом по кнопке на keyup, «проскакивая» фидбэк; на keyup нажатие тратится
целиком в инпуте, авторепит шлёт только keydown'ы и гарда не требует. Keyup
засчитывается только после СВОЕГО keydown в этом инпуте — **армирование**
`enterArmedRef`: иначе хвост Enter'а, нажатого на «Дальше» прошлой карточки,
давал фантомный пустой ответ на свежесмонтированном вводе) и
**не блокирует UI на сетевом roundtrip**: фидбэк,
«Дальше» И метка «следующий повтор» появляются сразу — метку мгновенно считает
клиентское зеркало планировщика (`srsPredict`, пин-тест к серверу — см.
[`srs-scheduling.md`](srs-scheduling.md)); ответ сервера тихо поправляет её при
расхождении, отказ мутации — «—» + пометка «Не удалось сохранить ответ».
Подробно —
[`../fix/exercise-network-resilience.md`](../fix/exercise-network-resilience.md).

В `WordFeedback` рядом с «pt — ru» — кнопка 🔊 (`m-fb-audio`, `speakSmart`:
повторный тап — медленно): озвучка доступна в момент разбора ответа, не только
авто-проигрышем. Служебные хинты («Акценты и пунктуация необязательны…» у
ввода, «Нажми на карточку…» в теории) **гаснут после `HINT_SHOW_LIMIT` (=3)
показов** — localStorage-счётчики `pt-hint-*-seen`
([`src/lib/hints.ts`](../../src/lib/hints.ts), `useFadingHint`: решение на
маунте, показ учитывается раз за маунт; недоступное хранилище → хинт остаётся
постоянным).

**Озвучка** ([`src/lib/speech.ts`](../../src/lib/speech.ts)) — Web Speech API,
чисто клиентская (`primeVoices`, `speak(text, {rate?})` — обычная скорость 0.9,
`speakSmart` — повторный тап по ТОМУ ЖЕ тексту в течение 4с играет медленно
0.6, затем цикл заново; другой текст сбрасывает цикл). **Mute (П.3)** разводит
авто- и ручную озвучку: `speakAuto(text)` — no-op при mute, используется там, где
слово/предложение играет САМО (после ответа, авто-плей аудио-карточки); ручные
кнопки 🔊 (`speak`/`speakSmart`) звучат в ОБХОД mute (явный тап — явное
намерение). Состояние mute (`isMuted`/`setMuted`) персистится в `localStorage`
`pt-muted`, читается раз при инициализации модуля. `speakSmart` подключён к
кнопке 🔊 в MC (`aria-label`/`title` «Прослушать (второй тап — медленно)»),
к hero аудио-карточки и к флип-картам теории; авто-озвучка после ответа — теперь
`speakAuto`.
**Надёжность речи (фикс «нет звука»):** `synth.resume()` зовётся и ДО (сразу
после `cancel()`), и ПОСЛЕ `speak()` — будит «paused»-движок Web Speech на
Chrome/macOS (`cancel` оставлял его в очереди без звука; гонку усугублял двойной
авто-плей StrictMode). **`isSpeechSupported` переименован в
`canSpeakPortuguese()`** и теперь требует ЗАГРУЖЕННОГО португальского голоса (не
только наличия API): без голоса аудио-карточку не показываем (вместе с `isMuted`
это гейт аудио-упражнения, П.1).

**Тач**: чипы хоткеев `m-opt-key` скрыты на `pointer:coarse` (на телефоне они
ничего не делают); раскладка `m-opt` остаётся ровной без чипа.

**Клавиатура и a11y** (ветка `fix/a11y-keyboard`, см.
[`../fix/a11y-keyboard.md`](../fix/a11y-keyboard.md)):

- **Хоткеи в MC**: `1–5` и латинские `A–E` (без модификаторов, без `e.repeat`)
  выбирают опцию, пока ответ не дан; для нелатинских раскладок — фоллбэк по
  физической позиции `e.code` KeyA–KeyE (только когда `e.key` не латинская
  буква: RU «ф» стреляет, AZERTY «q» — нет). Слушатель `keydown` на `window`
  (`useEffectEvent` + `useEffect` с очисткой), не срабатывает при фокусе в
  input/textarea. Кейкап `m-opt-key` — `aria-hidden`. После ответа фокус на
  «Дальше» (autofocus в `NextButton`) → Enter ведёт к следующей карточке
  (во всех упражнениях); зажатый Enter (autorepeat) гасится
  `onKeyDown`-guard'ом кнопки и не проскакивает карточку мимо фидбэка.
- **Навигация «Тем»**: шапка темы — `<button aria-expanded>`, строка урока —
  `div role="button" tabIndex=0` (внутри — кнопка «Теория», button-в-button
  невалиден) с Enter/Space и guard'ом `e.target === e.currentTarget`.
- **Плитки `SentenceBuilder` и flip-карточки теории — `<button>`**
  (использованные плитки — `aria-disabled` + guard'ы в onClick, НЕ `disabled`:
  нативный disabled ронял бы фокус на body; у flip — `aria-pressed`). UA-стили
  этих кнопок погашены `:where(...)`-reset'ом в конце `index.css` (нулевая
  специфичность — классовые правила побеждают, имена классов не тронуты).
- **Скринридер**: `ResultFeedback`/`RetryBox` — `role="status"` +
  `aria-live="polite"`; полоса прогресса сессии — `role="progressbar"`
  (`aria-label` «Позиция в сессии», `valuenow=idx+1`, `min=0`, `max=N`);
  поля SignIn — `aria-label` Email/Пароль.
- **Кольцо клавиатурного фокуса** (ветка `fix/a11y-spoiler-contrast`): все
  интерактивы рисуют `0 0 0 4px var(--accent-ring)` на `:focus-visible`
  (мышь колец не рисует); у элементов с собственной тенью кольцо добавляется
  к ней. 💡-заметка (`m-q-note`) ДО ответа удалена из Mc/Type — спойлерила
  ответ; после ответа заметка в `WordFeedback`, в теории — на флип-карте.
  Текст ≤13px — не светлее `--ink-500` (WCAG AA).
- **`lang="pt-PT"`** точечно на португальском тексте: вопрос MC pt→ru, опции
  MC ru→pt, pt-слово фидбэка, плитки конструктора, pt-сторона flip-карточки.

## Ключевые решения и алгоритмы

- Сессия — «чистое поле тренировки»: прячем глобальную статистику и навигацию,
  чтобы карточка с кнопкой «Дальше» помещалась без прокрутки (плотность — scoped
  `.m-session` в `src/index.css`, проверено вживую вплоть до 640px высоты).
- Строка прогресса — позиция, не освоение (освоение расходилось бы с «Темами»).
- CSS перенесён вербатим из исходного одно-файлового HTML в
  [`src/index.css`](../../src/index.css) — **имена классов сохранять**. Новые
  классы рекомендаций v4: `.m-audio-hero*` (П.1), `.m-forecast` (П.2),
  `.m-leech`/`.m-relearn` (П.4), `.m-course*` (П.5).
- **Фавикон (П.7):** [`public/favicon.svg`](../../public/favicon.svg) = логотип
  шапки (флаг Португалии + «pt»), подключён в [`index.html`](../../index.html)
  через `%BASE_URL%favicon.svg` (учитывает base-path: `/favicon.svg` в dev,
  `/portuguese/favicon.svg` в проде).

## Тестирование

Компонентные тесты Playwright CT рядом с компонентами (`*.ct.tsx`): `Shell`,
`Session`, `Header`, `ReviewTab`, `TopicsTab`, `Theory`, `TabBar`, `ScoreRow`,
`SignIn`, `Feedback`, `Complete`, `CourseComplete`, `exercises/*`. Компоненты с
Convex-хуками изолируются стабами (`src/test/mocks`, алиас в
`playwright-ct.config.ts`); для `Shell` стаб `useQuery` отдаёт фикстуры по имени
функции (`getFunctionName`), которые тест передаёт через
`mount(..., { hooksConfig: { queries } })` →
`beforeMount` в [`playwright/index.tsx`](../../playwright/index.tsx).
`Shell.ct.tsx` покрывает онбординг теории (просмотрена/нет), диалог выхода
из сессии («Выйти»/«Остаться»+Esc/на экране Complete без диалога/вне сессии)
и перекат финального CTA на следующую тему при 100% темы;
`ConfirmDialog.ct.tsx` — модальную семантику (фокус на «Остаться», Esc,
Tab-trap, подложка).

Рекомендации v4 (по фичам): `Header.ct.tsx` — mute-тоггл и позиция кнопки между
стриком и темой; `ReviewTab.ct.tsx` — прогноз повторений (П.2); `Complete.ct.tsx`
— бейдж липучки, ссылка «Перечитать теорию» и гейт её видимости (П.4);
`CourseComplete.ct.tsx` — итоговые плитки, `days=null`, плюрализация (П.5);
`McExercise.ct.tsx` — аудио-карточка (`audio_ru`: зона прослушивания, pt НЕ в
DOM до ответа, русские варианты, серверный режим `"audio"`); `Session.ct.tsx` —
once-гейт финала курса и деривация липучек из `cards.lapses`.
Юнит-тесты Vitest: [`src/lib/speech.test.ts`](../../src/lib/speech.test.ts) —
`resume()` будит движок, `canSpeakPortuguese` (true с pt-голосом, false без речи/
голоса), mute (`speakAuto` no-op при mute, ручной `speak` в обход).

## Карта файлов

- Оркестрация: [`Shell.tsx`](../../src/components/Shell.tsx), [`App.tsx`](../../src/App.tsx), [`main.tsx`](../../src/main.tsx), [`Splash.tsx`](../../src/components/Splash.tsx), [`ErrorBoundary.tsx`](../../src/components/ErrorBoundary.tsx), [`OfflineBanner.tsx`](../../src/components/OfflineBanner.tsx).
- Хром/дашборд: [`Header.tsx`](../../src/components/Header.tsx), [`TabBar.tsx`](../../src/components/TabBar.tsx), [`ReviewTab.tsx`](../../src/components/ReviewTab.tsx), [`ScoreRow.tsx`](../../src/components/ScoreRow.tsx), [`TopicsTab.tsx`](../../src/components/TopicsTab.tsx).
- Тренировка: [`Session.tsx`](../../src/components/Session.tsx), [`Theory.tsx`](../../src/components/Theory.tsx), [`exercises/`](../../src/components/exercises/), [`Feedback.tsx`](../../src/components/Feedback.tsx), [`Complete.tsx`](../../src/components/Complete.tsx), [`CourseComplete.tsx`](../../src/components/CourseComplete.tsx), [`ConfirmDialog.tsx`](../../src/components/ConfirmDialog.tsx).
- Утилиты: [`text.ts`](../../src/lib/text.ts), [`wrongOptions.ts`](../../src/lib/wrongOptions.ts), [`speech.ts`](../../src/lib/speech.ts), [`srs.ts`](../../src/lib/srs.ts) (`nextReviewForecast`/`daysSinceStart`), [`Icon.tsx`](../../src/components/Icon.tsx) (`volume`/`volume-off`).
- Ассеты: [`public/favicon.svg`](../../public/favicon.svg) (логотип-фавикон, П.7), [`index.html`](../../index.html).

## Известные ограничения

- Проверка ответов — на клиенте; `SentenceBuilder` вообще не пишет прогресс.
- До первой загрузки курса/SRS — экран `Splash` (холодного офлайн-старта нет,
  Convex требует сети; при разрыве УЖЕ загруженной сессии тренировка продолжает
  работать — мутации копятся в очереди клиента, баннер предупреждает).
- Аудио-карточка (П.1) требует загруженного pt-голоса и выключенного mute
  (`audioOk`); без них тип просто не выпадает — не ошибка, а тихая деградация.
- Финал курса (П.5) показывается ровно один раз (флаг `localStorage`): при
  недоступном/очищенном хранилище гейт «один раз» не переживёт перезагрузку.
