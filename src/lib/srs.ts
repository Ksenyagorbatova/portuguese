import type { CardFields, SrsState, Stat, Tag } from "./types";
import { localDay } from "./day";

// Progress key matching convex/progress.ts (lessonKey + "||" + pt).
export const wKey = (lessonKey: string, pt: string): string => lessonKey + "||" + pt;

// Shape returned by convex/progress.getSrsState — cards/tags come as ARRAYS
// (pt has non-ASCII accents, illegal in Convex object field names).
type RawSrsState = {
  streak: number;
  lastDay: string | null;
  bestStreak: number;
  startedAt: string | null;
  cards: Array<{ lessonKey: string; pt: string } & CardFields>;
  tags: Array<{ lessonKey: string; pt: string; tag: string }>;
  seenTheory: string[];
  learnedPts: string[];
  dueCountAll: number;
  lessonStats: Record<string, Stat>;
  topicStats: Record<string, Stat>;
};

// Rebuild the keyed lookup maps the UI expects (no field-name limits in JS).
export function adaptSrs(raw: RawSrsState): SrsState {
  const tags: Record<string, Tag> = {};
  for (const t of raw.tags) tags[wKey(t.lessonKey, t.pt)] = t.tag as Tag;
  const cards: Record<string, CardFields> = {};
  for (const c of raw.cards) {
    cards[wKey(c.lessonKey, c.pt)] = {
      interval: c.interval, ef: c.ef, due: c.due,
      seen: c.seen, correct: c.correct, lastSeen: c.lastSeen,
      mcCorrect: c.mcCorrect, typeCorrect: c.typeCorrect,
      lapses: c.lapses ?? 0,
    };
  }
  return {
    streak: raw.streak,
    // «День закрыт»: последний ответ пришёлся на ТЕКУЩИЙ локальный день
    // клиента. Сервер отдаёт сырой lastDay (день стрика) — сравниваем здесь,
    // потому что «сегодня» в таймзоне пользователя знает только клиент (та же
    // логика, что clientDay в recordAnswer). Пересчитывается на каждом ответе
    // сервера: после первой сессии дня галочка загорается реактивно.
    doneToday: raw.lastDay != null && raw.lastDay === localDay(),
    bestStreak: raw.bestStreak,
    startedAt: raw.startedAt,
    cards,
    tags,
    seenTheory: raw.seenTheory,
    learnedPts: raw.learnedPts,
    dueCountAll: raw.dueCountAll,
    lessonStats: raw.lessonStats,
    topicStats: raw.topicStats,
  };
}

// Russian plural picker: one (1, 21…), few (2–4, 22–24…), many (0, 5–20…).
// Exported for UI strings («1 слово», «2 слова», «5 слов» и т.п.).
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const startOfLocalDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Display label for the next review (ported from the original nextDueLabel).
// Computed client-side from the card + current time; purely presentational.
// Живёт только в POST-answer фидбэке — там due всегда в будущем (планировщик
// после ответа двигает расписание вперёд либо сознательно не трогает: ранняя
// верная практика выученного слова, due позже сегодня), а переспросов в
// статичной очереди нет. Поэтому дни считаем КАЛЕНДАРНЫМИ локальными (а не
// round по 24 часа): due позже сегодня → «сегодня» (round-ноль давал ложное
// «прямо сейчас» — жалоба), due за полночью → честное «завтра». Большие
// интервалы округляем в недели/месяцы/«примерно через год» — «через 455 дн»
// читается как сломанное (а на проде у части слов до миграции лежат именно
// такие легаси-due).
export function nextDueLabel(card: CardFields | undefined): string {
  if (!card || !card.seen) return "новое";
  const days = Math.round((startOfLocalDay(card.due) - startOfLocalDay(Date.now())) / 86400000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 7) return `через ${days} дн.`;
  if (days < 28) {
    const w = Math.round(days / 7);
    return `через ${w} ${pluralRu(w, "неделю", "недели", "недель")}`;
  }
  if (days < 330) {
    const m = Math.round(days / 30);
    return `через ${m} ${pluralRu(m, "месяц", "месяца", "месяцев")}`;
  }
  return "примерно через год";
}

// День недели в форме «в …» для прогноза повторений (П.2). Индекс — Date.getDay
// (0=воскресенье … 6=суббота). Падеж винительный («в пятницу»), у вторника — «во».
const WEEKDAY_IN = [
  "в воскресенье",
  "в понедельник",
  "во вторник",
  "в среду",
  "в четверг",
  "в пятницу",
  "в субботу",
];

// Прогноз ближайшего повтора (П.2): среди карточек с будущим `due` находим
// ближайший КАЛЕНДАРНЫЙ день строго ПОСЛЕ сегодняшнего и число слов в нём.
// «Сегодня» не показываем — сегодняшние слова и есть due (этот прогноз живёт
// ровно в состоянии due===0, превращая пустой экран в причину вернуться).
// null — планировать нечего (нет карточек с будущим повтором). `lead` уже
// готов к показу: «Завтра» либо «В пятницу»/«Во вторник» (с заглавной).
export function nextReviewForecast(
  cards: Record<string, CardFields>,
  now: number = Date.now(),
): { count: number; lead: string } | null {
  const today = startOfLocalDay(now);
  const byDay = new Map<number, number>();
  for (const c of Object.values(cards)) {
    if (!c.due || c.due <= now) continue; // нет расписания или уже due (= сегодня)
    const day = startOfLocalDay(c.due);
    if (day <= today) continue; // due позже сейчас, но ещё сегодня — не показываем
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  if (byDay.size === 0) return null;
  const nearest = Math.min(...byDay.keys());
  const count = byDay.get(nearest) ?? 0;
  const daysAhead = Math.round((nearest - today) / 86400000);
  const weekday = WEEKDAY_IN[new Date(nearest).getDay()];
  const lead = daysAhead === 1 ? "Завтра" : weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return { count, lead };
}

// Сколько дней идёт курс — от startedAt (день первого ответа) до сегодня
// включительно (П.5, плитка «N дней»). null — старт неизвестен (легаси-строка
// без поля). startedAt и localDay() — оба YYYY-MM-DD; Date.parse трактует их как
// UTC-полночь соответствующего локального дня, поэтому разница чистая в сутках.
export function daysSinceStart(
  startedAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  const today = Date.parse(localDay(new Date(now)));
  if (Number.isNaN(start) || Number.isNaN(today)) return null;
  return Math.max(1, Math.round((today - start) / 86400000) + 1);
}
