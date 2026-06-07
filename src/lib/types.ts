// Shared client types. Content shapes mirror what convex/courseQueries.getCourse
// returns; SRS shapes mirror convex/progress.getSrsState.

export type WordView = { lessonKey: string; pt: string; ru: string; note?: string };
export type TheorySection = { heading: string; words: string[] };
export type Theory = { intro: string; tip: string; sections: TheorySection[] };
export type LessonView = { lessonKey: string; label: string; theory: Theory; words: WordView[] };
export type TopicView = { topicKey: string; label: string; icon: string; lessons: LessonView[] };
export type CrossSentenceView = {
  sentenceKey: string;
  words: string[];
  answer: string;
  ru: string;
  required: string[];
};
export type Course = { topics: TopicView[]; crossSentences: CrossSentenceView[] };

// Server-computed per-word classification.
export type Tag = "new" | "due" | "learned" | "ongoing";

export type CardFields = {
  interval: number;
  ef: number;
  due: number;
  seen: number;
  correct: number;
  lastSeen: number;
  mcCorrect: number; // правильные выборы (MC) — этап «выбор»
  typeCorrect: number; // правильные ручные вводы (Type) — этап «ввод»
};
export type Stat = { total: number; seen: number; learned: number; due: number };

export type SrsState = {
  streak: number;
  cards: Record<string, CardFields>;
  tags: Record<string, Tag>;
  seenTheory: string[];
  learnedPts: string[];
  dueCountAll: number;
  lessonStats: Record<string, Stat>;
  topicStats: Record<string, Stat>;
};

// Badge tag used in the UI (ongoing/learned both render as "review").
export type BadgeTag = "due" | "new" | "review" | "cross";

export type ExerciseType = "mc_pt_ru" | "mc_ru_pt" | "type_pt";

// Результат ответа, который упражнение сообщает сессии.
//   mode     — каким упражнением отвечали (двигает этап / SM-2 на сервере)
//   correct  — ответ в итоге верный (в т.ч. со 2-й попытки) → растит этап
//   firstTry — верно с первой попытки → засчитывается в счёт сессии
export type AnswerResult = {
  mode: "mc" | "type" | "sentence";
  correct: boolean;
  firstTry: boolean;
};

export type SessionItem =
  | { kind: "word"; word: WordView; tag: BadgeTag }
  | { kind: "sentence"; sentence: CrossSentenceView; tag: "cross" };

// Where a session was launched from (drives the "next lesson" suggestion).
export type SessionOrigin = "review" | { topicKey: string; lessonKey: string };
