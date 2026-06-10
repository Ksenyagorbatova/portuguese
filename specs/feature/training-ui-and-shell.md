# UI тренировки: Shell, хедер, сессия, теория, упражнения

Статус: baseline (отгружено) · 2026-06-10

## Цель

Описать оболочку приложения (оркестрацию экранов), хедер, «поле тренировки»
сессии, доступ к теории и три типа упражнений. Глубокая логика SRS/очереди — в
смежных спеках; здесь — склейка и UX-решения.

## Поведение

**Точка входа.** [`src/main.tsx`](../../src/main.tsx): `ConvexReactClient`,
`primeVoices()`, `ConvexAuthProvider`. [`src/App.tsx`](../../src/App.tsx):
`useTheme()` + развод `AuthLoading → Splash`, `Unauthenticated → SignIn`,
`Authenticated → Shell`.

**Shell — оркестратор** ([`src/components/Shell.tsx`](../../src/components/Shell.tsx)):
- `View = { home } | { theory } | { session }`; `tab = "review" | "topics"`.
  `switchTab` сбрасывает в `home`.
- `openLesson`: если теория урока НЕ просмотрена → показать `Theory` (онбординг);
  иначе сразу `startLesson`. `openTheory`: `markTheorySeen` + открыть `Theory` в
  любой момент (кнопка в `TopicsTab`). `beginFromTheory`: отметить + старт.
- `startReview`/`startLesson` строят очередь и обнуляют счёт; `nonce` ремаунтит
  `Session` (`key`); `onExit → home`.
- **Во время сессии** (`view.kind==="session"`) Shell скрывает `ScoreRow` и
  `TabBar` — остаётся «само поле тренировки». `ScoreRow` показывается только ПОСЛЕ
  сессии (`score.total > 0`).

**Хедер** ([`src/components/Header.tsx`](../../src/components/Header.tsx)): слева
логотип-кнопка «на главный экран» (`onHome → вкладка «Повторение»`; фон — флаг
Португалии, токены `--flag-green`/`--flag-red`, только в иконке). Справа по
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
просмотрено/выучено/к повтору, баннер (4 состояния), кнопка действия. `TabBar` —
segmented «Повторение»/«Темы». `ScoreRow` — верно/заданий/точность (после сессии).

**Упражнения** ([`src/components/exercises/`](../../src/components/exercises/)) —
проверка на клиенте, `quality`: первая попытка верно `2`, со 2-й `1`, провал `0`:
- `McExercise` — выбор (`mc_pt_ru`/`mc_ru_pt`); неверные варианты из ТОГО ЖЕ урока
  (`getWrong`, [`src/lib/wrongOptions.ts`](../../src/lib/wrongOptions.ts)).
- `TypeExercise` — ручной ввод (`type_pt`); сверка без диакритики/регистра
  (`variantsMatch`, [`src/lib/text.ts`](../../src/lib/text.ts)).
- `SentenceBuilder` — кросс-предложение из плиток (`sentenceMatch`); **на сервер НЕ
  пишется** (`recordAnswer` не вызывается), влияет только на счёт сессии.

**Озвучка** ([`src/lib/speech.ts`](../../src/lib/speech.ts)) — Web Speech API,
чисто клиентская (`primeVoices`, `speak`).

**Клавиатура и a11y** (ветка `fix/a11y-keyboard`, см.
[`../fix/a11y-keyboard.md`](../fix/a11y-keyboard.md)):

- **Хоткеи в MC**: `1–5` и латинские `A–E` (без модификаторов, без `e.repeat`)
  выбирают опцию, пока ответ не дан; слушатель `keydown` на `window`
  (`useEffectEvent` + `useEffect` с очисткой), не срабатывает при фокусе в
  input/textarea. Кейкап `m-opt-key` — `aria-hidden`. После ответа фокус на
  «Дальше» (autofocus в `NextButton`) → Enter ведёт к следующей карточке
  (во всех упражнениях).
- **Навигация «Тем»**: шапка темы — `<button aria-expanded>`, строка урока —
  `div role="button" tabIndex=0` (внутри — кнопка «Теория», button-в-button
  невалиден) с Enter/Space и guard'ом `e.target === e.currentTarget`.
- **Плитки `SentenceBuilder` и flip-карточки теории — `<button>`**
  (использованные плитки `disabled`; у flip — `aria-pressed`). UA-стили этих
  кнопок погашены `:where(...)`-reset'ом в конце `index.css` (нулевая
  специфичность — классовые правила побеждают, имена классов не тронуты).
- **Скринридер**: `ResultFeedback`/`RetryBox` — `role="status"` +
  `aria-live="polite"`; полоса прогресса сессии — `role="progressbar"`
  (`aria-label` «Позиция в сессии», `valuenow=idx+1`, `min=0`, `max=N`);
  поля SignIn — `aria-label` Email/Пароль.
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

Компонентные тесты Playwright CT рядом с компонентами (`*.ct.tsx`): `Session`,
`Header`, `ReviewTab`, `TopicsTab`, `Theory`, `TabBar`, `ScoreRow`, `SignIn`,
`Feedback`, `Complete`, `exercises/*`. Компоненты с Convex-хуками изолируются
стабами (`src/test/mocks`, алиас в `playwright-ct.config.ts`).

## Карта файлов

- Оркестрация: [`Shell.tsx`](../../src/components/Shell.tsx), [`App.tsx`](../../src/App.tsx), [`main.tsx`](../../src/main.tsx), [`Splash.tsx`](../../src/components/Splash.tsx).
- Хром/дашборд: [`Header.tsx`](../../src/components/Header.tsx), [`TabBar.tsx`](../../src/components/TabBar.tsx), [`ReviewTab.tsx`](../../src/components/ReviewTab.tsx), [`ScoreRow.tsx`](../../src/components/ScoreRow.tsx), [`TopicsTab.tsx`](../../src/components/TopicsTab.tsx).
- Тренировка: [`Session.tsx`](../../src/components/Session.tsx), [`Theory.tsx`](../../src/components/Theory.tsx), [`exercises/`](../../src/components/exercises/), [`Feedback.tsx`](../../src/components/Feedback.tsx), [`Complete.tsx`](../../src/components/Complete.tsx).
- Утилиты: [`text.ts`](../../src/lib/text.ts), [`wrongOptions.ts`](../../src/lib/wrongOptions.ts), [`speech.ts`](../../src/lib/speech.ts).

## Известные ограничения

- Проверка ответов — на клиенте; `SentenceBuilder` вообще не пишет прогресс.
- До первой загрузки курса/SRS — экран `Splash` (офлайна нет, Convex требует сети).
