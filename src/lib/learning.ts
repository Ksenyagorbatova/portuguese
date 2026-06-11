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

// Слово-«липучка» (П.4): провалено (quality 0) суммарно ≥ этого числа раз. Чисто
// клиентский порог для бейджа «даётся тяжело» в разборе ошибок — сервер лишь
// копит счётчик lapses, классификации/расписания SM-2 он не касается.
export const LEECH_THRESHOLD = 5;

// Порог темы (доля выученных слов), с которого подмешиваются предложения.
export const SENTENCE_TOPIC_THRESHOLD = 0.8;

// Разбавка «хвоста из вводов»: когда узнавание (MC) уже набрано, а
// воспроизведение (Type) ещё нет, очередь выдавала бы ТОЛЬКО ручные вводы —
// печатать подряд утомительно (фидбэк владельца). С этой вероятностью вместо
// ввода показываем выбор СВЕРХ порога: прогресс он не двигает (слово доберёт
// вводы в следующей сессии — очередь статична), зато череда разбавляется.
// Держать небольшим: каждый relief-показ удлиняет добор слова на одну карточку.
export const TYPE_TAIL_MC_CHANCE = 0.25;

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
// мешаем выбор (MC) и ручной ввод (Type) среди ещё НЕ набранных навыков; в
// «хвосте из вводов» изредка разбавляем выбором сверх порога (см.
// TYPE_TAIL_MC_CHANCE — поэтому набор порогов внутри ОДНОЙ очереди не
// гарантирован: недобранное слово возвращается в следующую сессию). `rnd`
// инжектируется ради детерминизма в тестах.
//
// audioOk (П.1) — доступно ли аудирование (звук не в mute И есть Web Speech API).
// Гейт резолвит вызывающий (Session) — функция остаётся чистой; на момент сборки
// пула решаем, входит ли mc_audio_ru. Аудио добавляется ТОЛЬКО для выученных
// слов (третья ступень) и только когда audioOk.
export function pickExerciseType(
  card: StageCard | undefined,
  tag: BadgeTag,
  rnd: () => number = Math.random,
  audioOk = false,
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
    if (!firstEncounter && needType && !needMc) {
      // Хвост из вводов: с шансом TYPE_TAIL_MC_CHANCE — выбор сверх порога.
      if (rnd() < TYPE_TAIL_MC_CHANCE) return rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
      return "type_pt";
    }
    const pickType = !firstEncounter && needType && rnd() < 0.5;
    if (pickType) return "type_pt";
    return rnd() < 0.5 ? "mc_pt_ru" : "mc_ru_pt";
  }

  // Выучено — повторение (due/review): микс зрительных типов; аудирование (П.1,
  // третья ступень) добавляется равноправным слотом ТОЛЬКО здесь и только при
  // audioOk (озвучка доступна — не mute и есть TTS). На due сохраняем лёгкий
  // уклон в воспроизведение (ручной ввод): повтор выученного полезнее проверять
  // «вслепую». Так due-слово (mc/type добиты, повтор наступил) иногда приходит
  // ушами, но чаще — вводом.
  const pool: ExerciseType[] = ["mc_pt_ru", "mc_ru_pt", "type_pt"];
  if (tag === "due") pool.push("type_pt"); // уклон в воспроизведение на due
  if (audioOk) pool.push("mc_audio_ru");
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
