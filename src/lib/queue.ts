import type {
  BadgeTag,
  Course,
  CrossSentenceView,
  LessonView,
  SessionItem,
  SrsState,
  WordView,
} from "./types";
import { shuffle } from "./shuffle";
import { wKey } from "./srs";

// Client-side session-queue builders. The server (getSrsState) supplies the
// due/new/learned/ongoing classification via `tags`; here we shuffle, slice and
// inject cross-sentences — the non-deterministic, presentational half. Ported
// from the original buildLessonQueue/buildReviewQueue.

const wordItem = (word: WordView, tag: BadgeTag): SessionItem => ({ kind: "word", word, tag });
const sentenceItem = (sentence: CrossSentenceView): SessionItem => ({
  kind: "sentence",
  sentence,
  tag: "cross",
});

function eligibleSentences(course: Course, learnedPts: Set<string>): CrossSentenceView[] {
  return course.crossSentences.filter((s) => s.required.every((r) => learnedPts.has(r)));
}

export function buildLessonQueue(lesson: LessonView, srs: SrsState, course: Course): SessionItem[] {
  const tagOf = (w: WordView) => srs.tags[wKey(w.lessonKey, w.pt)] ?? "new";
  const due = lesson.words.filter((w) => tagOf(w) === "due");
  const unseen = lesson.words.filter((w) => tagOf(w) === "new");
  const ongoing = lesson.words.filter((w) => tagOf(w) === "ongoing");

  let q: SessionItem[] = [];
  q.push(...shuffle(due).map((w) => wordItem(w, "due")));
  q.push(...shuffle(unseen).slice(0, Math.max(0, 6 - due.length)).map((w) => wordItem(w, "new")));
  q.push(...shuffle(ongoing).slice(0, 3).map((w) => wordItem(w, "review")));
  if (q.length === 0) q = shuffle(lesson.words).slice(0, 8).map((w) => wordItem(w, "review"));

  const learned = new Set(srs.learnedPts);
  shuffle(eligibleSentences(course, learned))
    .slice(0, 2)
    .forEach((s, i) => {
      const pos = Math.min(4 + i * 3, q.length);
      q.splice(pos, 0, sentenceItem(s));
    });
  return q;
}

export function buildReviewQueue(course: Course, srs: SrsState): SessionItem[] {
  const seen = new Set(srs.seenTheory);
  // Only words from lessons whose theory has been seen (matches the original).
  const allWords = course.topics
    .flatMap((t) => t.lessons)
    .filter((l) => seen.has(l.lessonKey))
    .flatMap((l) => l.words);

  const tagOf = (w: WordView) => srs.tags[wKey(w.lessonKey, w.pt)] ?? "new";
  const due = allWords.filter((w) => tagOf(w) === "due");
  const ongoing = allWords.filter((w) => tagOf(w) === "ongoing");
  const learnedWords = allWords.filter((w) => tagOf(w) === "learned");

  let q: SessionItem[] = [];
  q.push(...shuffle(due).slice(0, 15).map((w) => wordItem(w, "due")));
  q.push(...shuffle(ongoing).slice(0, 8).map((w) => wordItem(w, "review")));
  q.push(...shuffle(learnedWords).slice(0, 3).map((w) => wordItem(w, "review")));
  if (q.length === 0) q = shuffle(allWords).slice(0, 10).map((w) => wordItem(w, "review"));

  const learned = new Set(srs.learnedPts);
  shuffle(eligibleSentences(course, learned))
    .slice(0, 3)
    .forEach((s, i) => {
      const pos = Math.min(3 + i * 4, q.length);
      q.splice(pos, 0, sentenceItem(s));
    });
  return q;
}

// Session status-chip counts (срочных · новых · повторений · сочетаний).
export function queueCounts(
  queue: SessionItem[],
): { due: number; nw: number; rv: number; cr: number } {
  let due = 0;
  let nw = 0;
  let rv = 0;
  let cr = 0;
  for (const it of queue) {
    if (it.kind === "sentence") {
      cr++;
      continue;
    }
    if (it.tag === "due") due++;
    else if (it.tag === "new") nw++;
    else if (it.tag === "review") rv++;
  }
  return { due, nw, rv, cr };
}
