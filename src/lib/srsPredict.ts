import { MC_TARGET, TYPE_TARGET } from "./learning";
import type { CardFields } from "./types";

// ─── ЗЕРКАЛО серверного планировщика — только для ДИСПЛЕЯ ───────────────────
// Подпись «следующий повтор: …» должна появляться ВМЕСТЕ с вердиктом, а не
// после сетевого roundtrip'а (текст «—» → «завтра» дёргался у пользователя на
// глазах). Сервер (convex/progress.ts, recordAnswer) остаётся единственным
// источником истины для ДАННЫХ; эта функция повторяет его расчёт локально,
// чтобы метку можно было показать мгновенно.
//
// Дублирование узаконено тем же способом, что пороги MC_TARGET/TYPE_TARGET:
// кросс-слойный ПИН-ТЕСТ в convex/progress.test.ts прогоняет матрицу сценариев
// через НАСТОЯЩИЙ recordAnswer и сверяет ответ сервера с этим предсказанием —
// разъедутся формулы (или MAX_INTERVAL ниже), упадёт тест. Меняешь серверный
// планировщик → правь зеркало в том же PR.
const DAY = 86400000;
// Потолок интервала — дублирует convex/progress.ts (см. пин-тест).
const MAX_INTERVAL = 120;

const DEFAULT_CARD: CardFields = {
  interval: 0,
  ef: 2.5,
  due: 0,
  seen: 0,
  correct: 0,
  lastSeen: 0,
  mcCorrect: 0,
  typeCorrect: 0,
};

const isLearned = (c: Pick<CardFields, "mcCorrect" | "typeCorrect">) =>
  c.mcCorrect >= MC_TARGET && c.typeCorrect >= TYPE_TARGET;

// Какой будет карточка после recordAnswer({quality, mode}) — зеркало серверной
// математики один-в-один: «событие повторения» (graduating | dueReview) двигает
// SM-2; недоученное — фикс-шаг «завтра»; ранний lapse выученного приближает
// повтор; ранняя верная практика расписание не трогает.
export function predictCardAfterAnswer(
  existing: CardFields | undefined,
  quality: 0 | 1 | 2,
  mode: "mc" | "type",
  now: number = Date.now(),
): CardFields {
  const c = existing ?? DEFAULT_CARD;
  const right = quality >= 1;
  const mcCorrect = c.mcCorrect + (right && mode === "mc" ? 1 : 0);
  const typeCorrect = c.typeCorrect + (right && mode === "type" ? 1 : 0);

  const wasLearned = isLearned(c);
  const nowLearned = isLearned({ mcCorrect, typeCorrect });
  const graduating = !wasLearned && nowLearned;
  const dueReview = wasLearned && c.due <= now;

  let { interval, ef, due } = c;
  if (graduating || dueReview) {
    const q = quality === 2 ? 5 : quality === 1 ? 3 : 1;
    ef = Math.max(1.3, c.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (q < 2) interval = 1;
    else if (c.interval === 0) interval = 1;
    else if (c.interval === 1) interval = 6;
    else interval = Math.round(c.interval * ef);
    interval = Math.min(interval, MAX_INTERVAL);
    due = now + interval * DAY;
  } else if (!nowLearned) {
    due = now + DAY;
  } else if (quality === 0) {
    interval = 1;
    due = now + DAY;
  }
  // else: ранняя верная практика выученного — расписание не меняется.

  return {
    interval,
    ef,
    due,
    seen: c.seen + 1,
    correct: c.correct + (right ? 1 : 0),
    lastSeen: now,
    mcCorrect,
    typeCorrect,
  };
}
