import type { WordView, Course } from "./types";
import { shuffle } from "./shuffle";

// Flat list of every word in the course. The client already has the whole
// course cached; used for the cross-lesson fallback below.
export function allWordsOf(course: Course): WordView[] {
  return course.topics.flatMap((t) => t.lessons.flatMap((l) => l.words));
}

// MC distractors are drawn from the SAME lesson as the correct answer, so wrong
// options stay topically relevant. If a lesson is too small to supply `count`
// distractors, top up from the rest of the course so there are always 4 options.
export function getWrong(course: Course, correct: WordView, count = 3): WordView[] {
  const all = allWordsOf(course);
  const differs = (w: WordView) => w.pt !== correct.pt && w.ru !== correct.ru;
  const sameLesson = all.filter((w) => w.lessonKey === correct.lessonKey && differs(w));
  const pool = shuffle(sameLesson).slice(0, count);
  if (pool.length < count) {
    const rest = shuffle(all.filter((w) => w.lessonKey !== correct.lessonKey && differs(w)));
    pool.push(...rest.slice(0, count - pool.length));
  }
  return pool;
}
