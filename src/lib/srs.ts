import type { CardFields, SrsState, Stat, Tag } from "./types";

// Progress key matching convex/progress.ts (lessonKey + "||" + pt).
export const wKey = (lessonKey: string, pt: string): string => lessonKey + "||" + pt;

// Shape returned by convex/progress.getSrsState — cards/tags come as ARRAYS
// (pt has non-ASCII accents, illegal in Convex object field names).
type RawSrsState = {
  streak: number;
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
    };
  }
  return {
    streak: raw.streak,
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
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Display labels (ported from nextDueLabel/intervalLabel). Computed client-side
// from the card + current time; purely presentational. Большие интервалы
// округляем в недели/месяцы/«примерно через год» — «через 455 дн» читается как
// сломанное (а на проде у части слов до миграции лежат именно такие легаси-due).
export function nextDueLabel(card: CardFields | undefined): string {
  if (!card || !card.seen) return "новое";
  const days = Math.round((card.due - Date.now()) / 86400000);
  if (days <= 0) return "прямо сейчас";
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

export function intervalLabel(card: CardFields | undefined): string {
  if (!card || !card.seen) return "";
  if (card.interval <= 1) return "1 день";
  if (card.interval < 7) return `${card.interval} дня`;
  return `${card.interval} дн.`;
}
