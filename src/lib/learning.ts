import type { BadgeTag, CardFields, ExerciseType } from "./types";

// ─── Mixed staged-learning model ─────────────────────────────────────────────
// Слово осваивается за два навыка: узнавание (MC, выбор) и воспроизведение
// (Type, ручной ввод). В рамках сессии оба тренируются ВПЕРЕМЕШКУ, в случайном
// порядке — не «сначала все выборы, потом все вводы». Слово выучено, когда
// набраны ОБА: MC_TARGET верных выборов И TYPE_TARGET верных вводов.
//
// MC_TARGET/TYPE_TARGET ДУБЛИРУЮТСЯ на сервере (convex/progress.ts, isLearned) —
// держать синхронно: Convex бандлится отдельно и не делит модули с src/.

export const MC_TARGET = 3; // верных выборов (узнавание)
export const TYPE_TARGET = 3; // верных ручных вводов (воспроизведение)

// Порог темы (доля выученных слов), с которого подмешиваются предложения.
export const SENTENCE_TOPIC_THRESHOLD = 0.8;

// Максимум карточек за сессию. Очередь СТАТИЧНА: собирается один раз при старте
// (interleaved-проходами по недоученным словам — см. queue.ts) и после старта не
// растёт — ошибка не вставляет переспрос. Прогресс mc/type хранится на сервере,
// следующая сессия продолжает добор с того же места.
export const SESSION_SIZE = 20;

type StageCard = Pick<CardFields, "mcCorrect" | "typeCorrect">;

// Выучено ли слово: набраны и узнавание (MC), и воспроизведение (Type).
// Отсутствие карточки → не выучено.
export function isWordLearned(card?: StageCard): boolean {
  const mc = card?.mcCorrect ?? 0;
  const type = card?.typeCorrect ?? 0;
  return mc >= MC_TARGET && type >= TYPE_TARGET;
}

// Тип упражнения для очередного показа слова. Пока слово не выучено — случайно
// мешаем выбор (MC) и ручной ввод (Type), но только среди ещё НЕ набранных
// навыков. Так в сессии гарантированно набираются и MC_TARGET выборов, и
// TYPE_TARGET вводов (сессия сходится), но в случайном порядке. `rnd`
// инжектируется ради детерминизма в тестах.
export function pickExerciseType(
  card: StageCard | undefined,
  tag: BadgeTag,
  rnd: () => number = Math.random,
): ExerciseType {
  const mc = card?.mcCorrect ?? 0;
  const type = card?.typeCorrect ?? 0;
  const needMc = mc < MC_TARGET;
  const needType = type < TYPE_TARGET;

  if (needMc || needType) {
    // Первое знакомство со словом (ещё ни одного верного ответа) → начинаем с
    // узнавания (MC): ввод по слову, которое ни разу не видел, набрать
    // невозможно. После первого верного ответа — случайный микс (оба навыка
    // нужны → 50/50; иначе единственный недобранный).
    const firstEncounter = mc === 0 && type === 0;
    const pickType = !firstEncounter && needType && (!needMc || rnd() < 0.5);
    if (pickType) return "type_pt";
    return rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
  }

  // Выучено — повторение (due/review): случайный микс всех трёх упражнений,
  // на due с уклоном в ручной ввод (ported nextExercise).
  if (tag === "due") return rnd() < 0.5 ? "type_pt" : rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
  const pool: ExerciseType[] = ["mc_pt_ru", "mc_ru_pt", "type_pt"];
  return pool[Math.floor(rnd() * pool.length)];
}

// Сколько показов слову ещё нужно до «выучено» (остаток до обоих порогов).
// Питает interleaved-сборку очереди в queue.ts: слово участвует в проходах,
// пока набранные в очередь показы не покроют этот остаток.
export function remainingReps(card?: StageCard): number {
  const mc = card?.mcCorrect ?? 0;
  const type = card?.typeCorrect ?? 0;
  return Math.max(0, MC_TARGET - mc) + Math.max(0, TYPE_TARGET - type);
}
