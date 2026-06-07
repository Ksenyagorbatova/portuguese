import type { BadgeTag, CardFields, ExerciseType } from "./types";

// ─── Staged-learning model ───────────────────────────────────────────────────
// Каждое слово проходит этапы: «выбор» (MC) → «ввод» (Type) → «выучено».
// Этап определяется счётчиками mcCorrect/typeCorrect в карточке.
//
// TYPE_TARGET ДУБЛИРУЕТСЯ на сервере (convex/progress.ts, isLearned) — держать
// синхронно: Convex бандлится отдельно и не делит модули с src/.

export const MC_TARGET = 3; // правильных выборов → переход к ручному вводу
export const TYPE_TARGET = 3; // правильных ручных вводов → слово выучено

// Порог темы (доля выученных слов), с которого подмешиваются предложения.
export const SENTENCE_TOPIC_THRESHOLD = 0.8;

// Новых слов в стартовой очереди сессии (каждое требует MC_TARGET+TYPE_TARGET
// верных ответов, чтобы дойти до «выучено» в рамках одной тренировки).
export const NEW_PER_SESSION = 4;

// Сколько карточек между повторами одного слова внутри сессии.
export const REQUEUE_GAP = 3;
// Предохранитель: максимум показов одного слова за сессию (от зацикливания).
export const SESSION_REQUEUE_CAP = 12;

export type Stage = "choosing" | "typing" | "learned";

type StageCard = Pick<CardFields, "mcCorrect" | "typeCorrect">;

// Этап освоения слова по его счётчикам. Отсутствие карточки → «выбор».
export function wordStage(card?: StageCard): Stage {
  const mc = card?.mcCorrect ?? 0;
  const type = card?.typeCorrect ?? 0;
  if (type >= TYPE_TARGET) return "learned";
  if (mc >= MC_TARGET) return "typing";
  return "choosing";
}

// Тип упражнения по этапу слова. `rnd` инжектируется ради детерминизма в тестах.
export function pickExerciseType(
  card: StageCard | undefined,
  tag: BadgeTag,
  rnd: () => number = Math.random,
): ExerciseType {
  const stage = wordStage(card);
  if (stage === "choosing") return rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
  if (stage === "typing") return "type_pt";
  // learned — повторение (due/review): уклон в ручной ввод (ported nextExercise).
  if (tag === "due") return rnd() < 0.5 ? "type_pt" : rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
  const pool: ExerciseType[] = ["mc_pt_ru", "mc_ru_pt", "type_pt"];
  return pool[Math.floor(rnd() * pool.length)];
}

// Вернуть ли слово в очередь внутри сессии: пока не выучено и не упёрлись в CAP.
export function shouldRequeue(stage: Stage, seenCount: number): boolean {
  return stage !== "learned" && seenCount < SESSION_REQUEUE_CAP;
}
