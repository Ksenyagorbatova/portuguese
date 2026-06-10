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
import { SENTENCE_TOPIC_THRESHOLD } from "./learning";

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

// Map each word's pt → EVERY topicKey it belongs to (the same pt may live in
// several topics — farmácia, olho, cabelo…; the sentence gate below treats a
// word as ready when ANY of its topics is ready, otherwise adding a duplicate
// would silently move the gate to whichever topic happens to be last).
function wordTopicMap(course: Course): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const t of course.topics)
    for (const l of t.lessons)
      for (const w of l.words) {
        const s = m.get(w.pt);
        if (s) s.add(t.topicKey);
        else m.set(w.pt, new Set([t.topicKey]));
      }
  return m;
}

// A sentence appears only when (a) all its required words are learned AND
// (b) every required word comes from at least one ≥80%-learned topic. So
// combinations show up once a topic is almost fully mastered — not before.
function eligibleSentences(course: Course, srs: SrsState): CrossSentenceView[] {
  const learned = new Set(srs.learnedPts);
  const wordTopic = wordTopicMap(course);
  const topicReady = (topicKey: string) => {
    const st = srs.topicStats[topicKey];
    return !!st && st.total > 0 && st.learned / st.total >= SENTENCE_TOPIC_THRESHOLD;
  };
  return course.crossSentences.filter((s) => {
    if (!s.required.every((r) => learned.has(r))) return false;
    return s.required.every((r) => {
      const topics = wordTopic.get(r);
      return !!topics && [...topics].some(topicReady);
    });
  });
}

// A lesson session now drills the WHOLE lesson, not a slice: every word takes
// part. Due words go first (most urgent), the rest follow shuffled together.
// Per-word exercise type (MC/Type) and in-session rotation are decided later in
// Session.tsx — here we only set the starting line-up.
export function buildLessonQueue(lesson: LessonView, srs: SrsState, course: Course): SessionItem[] {
  const tagOf = (w: WordView) => srs.tags[wKey(w.lessonKey, w.pt)] ?? "new";
  const badgeOf = (w: WordView): BadgeTag => {
    const t = tagOf(w);
    return t === "due" ? "due" : t === "new" ? "new" : "review";
  };

  const due = lesson.words.filter((w) => tagOf(w) === "due");
  const rest = lesson.words.filter((w) => tagOf(w) !== "due");
  const q: SessionItem[] = [
    ...shuffle(due).map((w) => wordItem(w, "due")),
    ...shuffle(rest).map((w) => wordItem(w, badgeOf(w))),
  ];

  shuffle(eligibleSentences(course, srs))
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

  shuffle(eligibleSentences(course, srs))
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
