# Стрик «день закрыт», ConfirmDialog, тач-чипы, медленная озвучка (дизайн-ревью v2, блок C)

Ветка: `feat/ui-polish-v2` · 2026-06-10 · готово (PR 3/3 серии дизайн-ревью v2;
блок A — `feat/session-static-queue` #36, блок B — `fix/a11y-spoiler-contrast` #37)

## Цель

Блок «полировка» (#7–10) из дизайн-ревью v2 (handoff-пакет
`design_handoff_review_v2`): статус дня в стрике, свой диалог вместо
`window.confirm`, скрытие чипов хоткеев на таче, медленное произношение по
повторному тапу.

## Изменения данных / API

- **`getSrsState`** (единственное серверное изменение,
  [`convex/progress.ts`](../../convex/progress.ts)): в ответ добавлено
  `lastDay: string | null` — день стрика из `userStats` (локальный день клиента
  последнего ответа; `null` до первого ответа). **Решение** (согласовано):
  `doneToday` вычисляет КЛИЕНТ — `adaptSrs` сравнивает `lastDay` со своим
  `localDay()`. Сервер не знает «текущий день клиента» (query без аргументов),
  таймзонная истина живёт там, где она есть — как `clientDay` в `recordAnswer`.
  Альтернатива (аргумент `clientDay` в query) отклонена как расширение
  сигнатуры без выгоды. Скаляр, не Record — не-ASCII-готча не задета.
- Клиентский `SrsState` получил `doneToday: boolean`
  ([`types.ts`](../../src/lib/types.ts), [`adaptSrs`](../../src/lib/srs.ts)).
  Реактивность: первый же ответ дня обновляет `userStats.lastDay` → подписка
  `getSrsState` пере-выполняется → галочка загорается без перезагрузки.

## Поведение

- **#7** В пилюле стрика после числа — кружок 16px: серый (`--surface-3` +
  `--ink-400`-галочка) до первой сессии дня, акцентный с белой галочкой после.
  `aria-label` пилюли: «Стрик N дн., сегодня пройдено / ещё не пройдено».
- **#8** Клик по логотипу в активной сессии открывает внутренний
  [`ConfirmDialog`](../../src/components/ConfirmDialog.tsx) (оверлей
  `rgba(26,26,23,.35)`, карточка `m-card` ≤320px, `--e3`): «Выйти из
  тренировки?» / «Прогресс этой сессии не сохранится.», «Выйти» (primary) и
  «Остаться» (ghost, фокус при открытии). `role="dialog"` `aria-modal`, Esc и
  клик по подложке = «остаться», Tab зациклен; фейд+подъём за `--dur`, гейт
  `prefers-reduced-motion`. На Complete и вне сессии диалога нет;
  `window.confirm` в кодовой базе не осталось.
- **#9** `@media (pointer:coarse){ .m-opt-key{display:none} }` — чипы A–E
  скрыты на таче; флекс-раскладка `m-opt` без чипа остаётся ровной.
- **#10** Повторный тап по 🔊 (тот же текст, окно 4с) — replay на rate 0.6,
  затем цикл заново; другой текст сбрасывает. `speakSmart` подключён к кнопке
  🔊 MC и флип-картам теории; `aria-label`/`title` — «Прослушать (второй тап —
  медленно)». Авто-озвучка после ответа — обычный `speak`. **Обычная скорость
  поднята 0.85 → 0.9** (по букве спеки хендоффа, согласовано).

## Ключевые решения

- `ConfirmDialog` — переиспользуемый (тексты пропсами), Tab-trap руками по
  двум кнопкам (других фокусируемых в карточке нет), фокус возвращается
  открывшему элементу при закрытии («Остаться» → продолжаешь с логотипа).
- Кружок дня — `aria-hidden` (состояние проговаривает label пилюли целиком,
  `role="img"`).
- `speakSmart` хранит последний тап в модульном состоянии; в тестах каждому
  кейсу — своя «эпоха» `Date.now`, чтобы хвост соседнего теста выпадал из окна.
- context7 не дёргался осознанно: ни одной новой формы внешнего API
  (поле в return существующего query, стандартные React-паттерны, стабильный
  `SpeechSynthesisUtterance.rate`).

## Тестирование

- backend ([`convex/progress.test.ts`](../../convex/progress.test.ts)):
  `lastDay` — `null` до первого ответа, равен `clientDay` после.
- unit: [`srs.test.ts`](../../src/lib/srs.test.ts) — `doneToday` true только
  при `lastDay === localDay()` (иначе/`null` — false);
  [`speech.test.ts`](../../src/lib/speech.test.ts) — дефолт-rate 0.9 и
  `opts.rate`; `speakSmart`: 0.9 → 0.6 → 0.9, истёкшее окно, смена текста.
- CT: [`Header.ct.tsx`](../../src/components/Header.ct.tsx) — серый кружок /
  акцентная галочка + aria-label; [`ConfirmDialog.ct.tsx`](../../src/components/ConfirmDialog.ct.tsx)
  — модальная семантика (фокус, Esc, Tab-trap, подложка/карточка, колбэки);
  [`Shell.ct.tsx`](../../src/components/Shell.ct.tsx) — диалоговые сценарии
  переписаны с `window.confirm` на `role=dialog` («Выйти» уходит,
  «Остаться»/Esc оставляют, Complete и вне сессии — без диалога).
- Фикстуры `SrsState`/raw-стабов дополнены `doneToday`/`lastDay`
  (queue.test, ReviewTab/TopicsTab/Shell.ct).

## Карта файлов

Добавлено:
- [`src/components/ConfirmDialog.tsx`](../../src/components/ConfirmDialog.tsx) (+ `.ct.tsx`).

Изменено:
- [`convex/progress.ts`](../../convex/progress.ts) — `lastDay` в ответе.
- [`src/lib/srs.ts`](../../src/lib/srs.ts), [`types.ts`](../../src/lib/types.ts) — `doneToday`.
- [`src/lib/speech.ts`](../../src/lib/speech.ts) — `rate`-opts (дефолт 0.9), `speakSmart`.
- [`src/components/Header.tsx`](../../src/components/Header.tsx) — кружок дня, label.
- [`src/components/Shell.tsx`](../../src/components/Shell.tsx) — `confirmExit` + диалог.
- [`src/components/exercises/McExercise.tsx`](../../src/components/exercises/McExercise.tsx),
  [`Theory.tsx`](../../src/components/Theory.tsx) — `speakSmart`.
- [`src/index.css`](../../src/index.css) — `.m-streak-day`, `.m-dialog-*`,
  `pointer:coarse`, reduced-motion гейт диалога.
- Доки: `training-ui-and-shell.md` (хедер/диалог/озвучка/тач),
  `srs-scheduling.md` (`lastDay` в API).

## Известные ограничения

- «Прогресс этой сессии не сохранится» — про счёт/позицию сессии: SRS-ответы
  уже записаны на сервер по мере ответов (формулировка из дизайн-ревью).
- Галочка дня не гаснет ровно в полночь без действия пользователя (нет таймера
  на смену дня) — обновится при первом ререндере/ответе нового дня.
- Кружок виден и при `streak = 0` (статус дня независим от длины серии).
