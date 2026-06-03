import type { WordView, Course } from "./types";
import { shuffle } from "./shuffle";

// Flat list of every word in the course (for MC distractors). Ported from
// getAllWords/buildWrongPool — the client already has the whole course cached.
export function allWordsOf(course: Course): WordView[] {
  return course.topics.flatMap((t) => t.lessons.flatMap((l) => l.words));
}

export function getWrong(course: Course, correct: WordView, count = 3): WordView[] {
  const pool = allWordsOf(course).filter((w) => w.pt !== correct.pt && w.ru !== correct.ru);
  return shuffle(pool).slice(0, count);
}
