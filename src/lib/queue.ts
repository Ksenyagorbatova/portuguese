import type {
  BadgeTag,
  Course,
  CrossSentenceView,
  LessonView,
  SessionItem,
  SrsState,
  TopicSentenceView,
  TopicView,
  WordView,
} from "./types";
import { shuffle } from "./shuffle";
import { wKey } from "./srs";
import { remainingReps, SENTENCE_TOPIC_THRESHOLD, SESSION_SIZE } from "./learning";

// Client-side session-queue builders. The server (getSrsState) supplies the
// due/new/learned/ongoing classification via `tags`; here we shuffle, slice and
// inject cross-sentences — the non-deterministic, presentational half. Ported
// from the original buildLessonQueue/buildReviewQueue.

// Review session cap: at most this many due words per run (the review button
// in ReviewTab shows «15 из N» when more are waiting — keep these in sync by
// importing the constant, not by re-hardcoding the number).
export const REVIEW_DUE_LIMIT = 15;

const wordItem = (word: WordView, tag: BadgeTag): SessionItem => ({ kind: "word", word, tag });
const sentenceItem = (sentence: CrossSentenceView): SessionItem => ({
  kind: "sentence",
  sentence,
  tag: "cross",
});
// Элементы раздела «Построение предложений» темы (per-topic TopicSentenceView).
const buildItem = (sentence: TopicSentenceView): SessionItem => ({ kind: "build", sentence, tag: "cross" });
const clozeItem = (sentence: TopicSentenceView): SessionItem => ({ kind: "cloze", sentence, tag: "cross" });

// Map each word's pt → EVERY topicKey it belongs to. Контент сейчас держит
// слово ровно в одном уроке (инвариант content.test.ts), но карта остаётся
// множеством: вернись дубль — гейт ниже считает слово готовым при ЛЮБОЙ
// готовой теме, а не молча переносит порог на последнюю тему по порядку.
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
// Используется только в глобальном «Повторении» (buildReviewQueue): словарные
// сессии урока предложений больше НЕ несут (они вынесены в раздел «Построение
// предложений» темы — buildSentenceQueue), поэтому тематического фильтра
// (forTopicKey) здесь больше нет.
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

const badgeOfWith =
  (srs: SrsState) =>
  (w: WordView): BadgeTag => {
    const t = srs.tags[wKey(w.lessonKey, w.pt)] ?? "new";
    return t === "due" ? "due" : t === "new" ? "new" : "review";
  };

// Статичная interleaved-сборка: проходами по словам — в каждом проходе свой
// shuffle и по ОДНОЙ карточке на слово; слово выбывает, когда набранные в
// очередь показы покрывают его остаток до «выучено» (repsOf). Так разные слова
// чередуются (interleaving запоминается лучше тесного цикла по одному слову),
// а очередь не превышает budget. Сосед-гард на стыке проходов: то же слово не
// идёт два раза подряд — swap с соседом (выполним, пока в проходе ≥2 слов).
function interleavedReps(
  words: WordView[],
  srs: SrsState,
  budget: number,
  repsOf: (w: WordView) => number,
  dueFirst: boolean,
): SessionItem[] {
  const badgeOf = badgeOfWith(srs);
  const isDue = (w: WordView) => badgeOf(w) === "due";
  const left = new Map<string, number>();
  for (const w of words) left.set(wKey(w.lessonKey, w.pt), repsOf(w));

  const q: SessionItem[] = [];
  let firstPass = true;
  while (q.length < budget) {
    const pass = shuffle(words.filter((w) => (left.get(wKey(w.lessonKey, w.pt)) ?? 0) > 0));
    if (pass.length === 0) break;
    // Срочные (due) — первыми в ПЕРВОМ проходе; внутри групп порядок от shuffle.
    if (firstPass && dueFirst) {
      pass.sort((a, b) => Number(isDue(b)) - Number(isDue(a)));
      firstPass = false;
    }
    const last = q[q.length - 1];
    if (
      last?.kind === "word" &&
      pass.length > 1 &&
      wKey(pass[0].lessonKey, pass[0].pt) === wKey(last.word.lessonKey, last.word.pt)
    ) {
      [pass[0], pass[1]] = [pass[1], pass[0]];
    }
    for (const w of pass) {
      if (q.length >= budget) break;
      const k = wKey(w.lessonKey, w.pt);
      q.push(wordItem(w, badgeOf(w)));
      left.set(k, (left.get(k) ?? 0) - 1);
    }
  }
  return q;
}

// A lesson session: a STATIC queue of at most SESSION_SIZE cards built from ALL
// not-yet-learned words of the lesson, interleaved (see interleavedReps). The
// queue never grows after start — a miss does not re-queue the card; per-word
// progress lives on the server, so the next session resumes the grind. Once the
// whole lesson is learned the session falls back to a one-pass review of its
// words. Per-card exercise type (MC/Type) is decided later in Session.tsx.
export function buildLessonQueue(lesson: LessonView, srs: SrsState): SessionItem[] {
  const cardOf = (w: WordView) => srs.cards[wKey(w.lessonKey, w.pt)];
  // Словарная сессия — ЧИСТОЕ заучивание слов: предложения сюда больше НЕ
  // подмешиваются (раньше 2 вставлялись на позиции 4/7). Они вынесены в
  // отдельный раздел «Построение предложений» темы — см. buildSentenceQueue.
  const unfinished = lesson.words.filter((w) => remainingReps(cardOf(w)) > 0);
  return unfinished.length > 0
    ? interleavedReps(unfinished, srs, SESSION_SIZE, (w) => remainingReps(cardOf(w)), true)
    : // Урок выучен целиком — повторение: каждое слово по одному показу.
      shuffle(lesson.words)
        .slice(0, SESSION_SIZE)
        .map((w) => wordItem(w, badgeOfWith(srs)(w)));
}

// Сессия раздела «Построение предложений» темы: статичная очередь из предложений
// темы, каждое случайно как сборка (build) или выбор пропущенного слова (cloze).
// Раздел всегда доступен (гейта освоенности нет — механика узнавания не требует
// знать слова наизусть); предложения прогресс SRS не двигают. rnd инжектируется
// ради детерминизма в тестах.
export function buildSentenceQueue(topic: TopicView, rnd: () => number = Math.random): SessionItem[] {
  return shuffle(topic.sentences)
    .slice(0, SESSION_SIZE)
    .map((s) => (rnd() < 0.5 ? clozeItem(s) : buildItem(s)));
}

// Мини-сессия «Повторить эти N слов» с финала: только промахнутые слова, та же
// статичная interleaved-механика, без предложений. Каждое слово получает
// МИНИМУМ один показ (промахнутое, но уже «выученное» review-слово иначе имело
// бы remainingReps 0 и выпало бы из мини-сессии, ради которой её и запускали).
export function buildMistakesQueue(words: WordView[], srs: SrsState): SessionItem[] {
  const repsOf = (w: WordView) => Math.max(1, remainingReps(srs.cards[wKey(w.lessonKey, w.pt)]));
  return interleavedReps(words, srs, SESSION_SIZE, repsOf, true);
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
  q.push(...shuffle(due).slice(0, REVIEW_DUE_LIMIT).map((w) => wordItem(w, "due")));
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
