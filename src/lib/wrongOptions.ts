import type { WordView, Course } from "./types";
import { shuffle } from "./shuffle";
import { deaccent } from "./text";

// Flat list of every word in the course. The client already has the whole
// course cached; used for the cross-lesson fallback below.
export function allWordsOf(course: Course): WordView[] {
  return course.topics.flatMap((t) => t.lessons.flatMap((l) => l.words));
}

// MC distractors are drawn from the SAME lesson as the correct answer, so wrong
// options stay topically relevant. If a lesson is too small to supply `count`
// distractors, top up from the rest of the course so there are always 4 options.
// `accept` — дополнительный фильтр кандидатов (сверх differs); отфильтрованное
// компенсируется тем же добором из остального курса.
export function getWrong(
  course: Course,
  correct: WordView,
  count = 3,
  accept: (w: WordView) => boolean = () => true,
): WordView[] {
  const all = allWordsOf(course);
  const differs = (w: WordView) => w.pt !== correct.pt && w.ru !== correct.ru && accept(w);
  const sameLesson = all.filter((w) => w.lessonKey === correct.lessonKey && differs(w));
  const pool = shuffle(sameLesson).slice(0, count);
  if (pool.length < count) {
    const rest = shuffle(all.filter((w) => w.lessonKey !== correct.lessonKey && differs(w)));
    pool.push(...rest.slice(0, count - pool.length));
  }
  return pool;
}

// Дистракторы для АУДИО-вопроса (mc_audio_ru): исключаем только-акцентных
// близнецов правильного ответа (deaccent-равный pt: tem/têm, vem/vêm) — TTS
// произносит их неотличимо, близнец в вариантах превращал бы вопрос в монетку,
// а неверный ответ на due-слове роняет интервал SM-2 (recordAnswer.dueReview).
// Трейдофф: пары с реально разным звучанием (avó/avô — открытый/закрытый
// гласный) фильтр тоже уберёт — вопрос станет чуть легче, но никогда не станет
// неотвечаемым; фонетическую модель ради этого не строим.
export function getWrongForAudio(course: Course, correct: WordView, count = 3): WordView[] {
  return getWrong(course, correct, count, (w) => deaccent(w.pt) !== deaccent(correct.pt));
}
