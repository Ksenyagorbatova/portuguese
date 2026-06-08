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

// Сколько карточек между повторами одного слова внутри сессии.
export const REQUEUE_GAP = 3;
// Предохранитель: максимум показов одного слова за сессию (от зацикливания).
export const SESSION_REQUEUE_CAP = 12;

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

// Вернуть ли слово в очередь внутри сессии: пока не выучено и не упёрлись в CAP.
export function shouldRequeue(card: StageCard | undefined, seenCount: number): boolean {
  return !isWordLearned(card) && seenCount < SESSION_REQUEUE_CAP;
}

// Куда вставить не выученное слово обратно в рабочую очередь (idx — текущая
// позиция, length — длина очереди). СЛУЧАЙНО в задней части: от `idx+REQUEUE_GAP`
// (минимальный зазор, чтобы слово не повторилось сразу) до конца. Это ключевое:
// фиксированная вставка ровно на `idx+REQUEUE_GAP` образует тесный цикл из
// первых REQUEUE_GAP слов — остальные слова урока не показываются, пока первые
// не выучены. Случайная позиция до конца перемешивает ВСЕ слова сессии.
// `rnd` инжектируется ради детерминизма в тестах.
export function requeuePosition(
  idx: number,
  length: number,
  rnd: () => number = Math.random,
): number {
  const lo = Math.min(idx + REQUEUE_GAP, length);
  if (lo >= length) return length;
  return lo + Math.floor(rnd() * (length - lo + 1));
}
