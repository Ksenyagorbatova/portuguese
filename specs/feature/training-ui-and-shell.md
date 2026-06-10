# UI тренировки: Shell, хедер, сессия, теория, упражнения

Статус: baseline (отгружено) · 2026-06-10

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
- **Во время сессии** (`view.kind==="session"`) Shell скрывает `ScoreRow` и
  `TabBar` — остаётся «само поле тренировки». `ScoreRow` показывается только ПОСЛЕ
  сессии (`score.total > 0`).
- **Выход по логотипу из активной сессии — через подтверждение**: `goHome`
  спрашивает `window.confirm("Выйти из тренировки?")` и при отмене оставляет
  сессию. «Активная» = `view.kind === "session"` и НЕ `sessionDone`: `Complete`
  рендерится внутри `Session` (`view.kind` не меняется), поэтому Session
  сигналит опциональным `onComplete?` из `advance()` при исчерпании очереди,
  Shell ставит флаг `sessionDone` (сброс — в `startReview`/`startLesson`) — и
  с экрана Complete логотип уходит домой без вопроса. Confirm только на пути
  логотипа: «К повторению» с экрана `Complete` и «Назад» из теории уходят без
  вопроса (там нечего терять).
- Под хедером — [`OfflineBanner`](../../src/components/OfflineBanner.tsx)
  (`useConvexConnectionState().isWebSocketConnected`): при разрыве соединения
  ненавязчивый баннер «Нет соединения — ответы сохранятся…» (класс `.m-offline`,
  амбер-токены `--rev-*`). Convex-клиент сам ставит мутации в очередь и
  доотправляет при реконнекте — детали в
  [`../fix/exercise-network-resilience.md`](../fix/exercise-network-resilience.md).

**Хедер** ([`src/components/Header.tsx`](../../src/components/Header.tsx)): слева
логотип-кнопка «на главный экран» (`onHome → вкладка «Повторение»`; во время
сессии — с confirm, см. выше; фон — флаг Португалии, токены
`--flag-green`/`--flag-red`, только в иконке). Справа по
порядку: стрик 🔥, переключатель темы (3 режима, см.
[`theme-system-mode.md`](theme-system-mode.md)), выход (`log-out`, крайний правый).

**Сессия** ([`src/components/Session.tsx`](../../src/components/Session.tsx)): строка
прогресса показывает **позицию** `idx+1/items.length` (знаменатель растёт с
переспросами), а НЕ долю освоения. Освоение смотрим на «Темах»/«Повторении»
(серверный `learned`). Мини-кольцо освоения в сессии пробовали и убрали — стартовало
с нуля каждую сессию и расходилось с глобальным прогрессом. У сессии свой выход
(крестик в строке прогресса). До-ответную строку «следующий повтор …» показываем
**только для реально `due`-слов** (на досрочной практике будущая дата — шум).
Ротация/выбор упражнения — см. [`session-queue-and-rotation.md`](session-queue-and-rotation.md)
и [`word-learning-model.md`](word-learning-model.md).

**Теория** ([`src/components/Theory.tsx`](../../src/components/Theory.tsx)) **не
скрывается** после прохождения: flip-карточки (тап → переворот + `speak(pt)`),
секции из `lesson.theory`, кнопка «Начать практику» (`beginFromTheory`) и «Назад»
(`switchTab("topics")`). Онбординг (теория перед первой практикой) сохранён.

**Дашборд:** `ReviewTab` — кольцо «% выучено» (от просмотренных слов), плитки
просмотрено/выучено/к повтору, баннер (4 состояния), кнопка действия. Числа со
словом «слово» склоняются через `pluralRu` (`src/lib/srs.ts`) — в баннере и на
кнопке (`Complete` склоняет так же: «Ещё N слово ждёт / слова ждут / слов ждут»).
**Кнопка повторения честная**: сессия берёт максимум `REVIEW_DUE_LIMIT` (=15,
экспорт из [`src/lib/queue.ts`](../../src/lib/queue.ts)) срочных слов, поэтому при
`due > 15` кнопка показывает «Повторить (15 из N)», иначе — «Повторить (N слов)».
`TabBar` — segmented «Повторение»/«Темы». `ScoreRow` — верно/заданий/точность
(после сессии).

**Упражнения** ([`src/components/exercises/`](../../src/components/exercises/)) —
проверка на клиенте, `quality`: первая попытка верно `2`, со 2-й `1`, провал `0`:
- `McExercise` — выбор (`mc_pt_ru`/`mc_ru_pt`); неверные варианты из ТОГО ЖЕ урока
  (`getWrong`, [`src/lib/wrongOptions.ts`](../../src/lib/wrongOptions.ts)).
- `TypeExercise` — ручной ввод (`type_pt`); сверка без диакритики/регистра и без
  пунктуации (`.!?,` и многоточия необязательны с обеих сторон, как в
  `sentenceMatch`; дефис значим); для слов-лейблов с вариантами («um / uma»)
  принимается и каждый вариант, и весь лейбл целиком
  (`variantsMatch`, [`src/lib/text.ts`](../../src/lib/text.ts)).
- `SentenceBuilder` — кросс-предложение из плиток (`sentenceMatch`); **на сервер НЕ
  пишется** (`recordAnswer` не вызывается), влияет только на счёт сессии.

В Mc/Type `finish()` защищён от двойного ответа (синхронный `pendingRef` +
`e.repeat`-guard у Enter) и **не блокирует UI на сетевом roundtrip**: фидбэк и
«Дальше» появляются сразу, метка «следующий повтор» подтягивается с ответом
сервера (до тех пор «—»; при отказе мутации — «—» + пометка «Не удалось
сохранить ответ»). Подробно —
[`../fix/exercise-network-resilience.md`](../fix/exercise-network-resilience.md).

**Озвучка** ([`src/lib/speech.ts`](../../src/lib/speech.ts)) — Web Speech API,
чисто клиентская (`primeVoices`, `speak`).

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
  [`src/index.css`](../../src/index.css) — **имена классов сохранять**.

## Тестирование

Компонентные тесты Playwright CT рядом с компонентами (`*.ct.tsx`): `Shell`,
`Session`, `Header`, `ReviewTab`, `TopicsTab`, `Theory`, `TabBar`, `ScoreRow`,
`SignIn`, `Feedback`, `Complete`, `exercises/*`. Компоненты с Convex-хуками
изолируются стабами (`src/test/mocks`, алиас в `playwright-ct.config.ts`); для
`Shell` стаб `useQuery` отдаёт фикстуры по имени функции (`getFunctionName`),
которые тест передаёт через `mount(..., { hooksConfig: { queries } })` →
`beforeMount` в [`playwright/index.tsx`](../../playwright/index.tsx).
`Shell.ct.tsx` покрывает онбординг теории (просмотрена/нет) и confirm выхода
из сессии (принял/отменил/на экране Complete без confirm/вне сессии).

## Карта файлов

- Оркестрация: [`Shell.tsx`](../../src/components/Shell.tsx), [`App.tsx`](../../src/App.tsx), [`main.tsx`](../../src/main.tsx), [`Splash.tsx`](../../src/components/Splash.tsx), [`ErrorBoundary.tsx`](../../src/components/ErrorBoundary.tsx), [`OfflineBanner.tsx`](../../src/components/OfflineBanner.tsx).
- Хром/дашборд: [`Header.tsx`](../../src/components/Header.tsx), [`TabBar.tsx`](../../src/components/TabBar.tsx), [`ReviewTab.tsx`](../../src/components/ReviewTab.tsx), [`ScoreRow.tsx`](../../src/components/ScoreRow.tsx), [`TopicsTab.tsx`](../../src/components/TopicsTab.tsx).
- Тренировка: [`Session.tsx`](../../src/components/Session.tsx), [`Theory.tsx`](../../src/components/Theory.tsx), [`exercises/`](../../src/components/exercises/), [`Feedback.tsx`](../../src/components/Feedback.tsx), [`Complete.tsx`](../../src/components/Complete.tsx).
- Утилиты: [`text.ts`](../../src/lib/text.ts), [`wrongOptions.ts`](../../src/lib/wrongOptions.ts), [`speech.ts`](../../src/lib/speech.ts).

## Известные ограничения

- Проверка ответов — на клиенте; `SentenceBuilder` вообще не пишет прогресс.
- До первой загрузки курса/SRS — экран `Splash` (холодного офлайн-старта нет,
  Convex требует сети; при разрыве УЖЕ загруженной сессии тренировка продолжает
  работать — мутации копятся в очереди клиента, баннер предупреждает).
