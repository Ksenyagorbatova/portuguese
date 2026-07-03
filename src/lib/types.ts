// Shared client types. Content shapes mirror what convex/courseQueries.getCourse
// returns; SRS shapes mirror convex/progress.getSrsState.

export type WordView = { lessonKey: string; pt: string; ru: string; note?: string };
export type TheorySection = { heading: string; words: string[] };
export type Theory = { intro: string; tip: string; sections: TheorySection[] };
export type LessonView = { lessonKey: string; label: string; theory: Theory; words: WordView[] };
export type TopicView = {
  topicKey: string;
  label: string;
  icon: string;
  lessons: LessonView[];
  // Раздел «Построение предложений» темы (per-topic, в отличие от глобальных
  // crossSentences). Может быть пустым — тогда строка раздела не показывается.
  sentences: TopicSentenceView[];
};
export type CrossSentenceView = {
  sentenceKey: string;
  words: string[];
  answer: string;
  ru: string;
  required: string[];
};
// Предложение раздела «Построение предложений». Одно предложение порождает ОБА
// упражнения: сборку из банка слов (build) и выбор пропущенного слова (cloze).
//   words  — токены-эталон в правильном порядке (пунктуация прилипает к токену)
//   answer — words.join(" ")
//   blank  — целевое слово темы (ровно один из words), которое прячется в cloze;
//            дистракторы к нему берутся из слов темы (см. buildSentenceQueue)
export type TopicSentenceView = {
  sentenceKey: string;
  topicKey: string;
  words: string[];
  answer: string;
  ru: string;
  blank: string;
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
  // Накопительные провалы (quality 0) — «липучки» (П.4). Optional: фикстуры
  // тестов его не задают, сервер всегда отдаёт число (?? 0) — читать как `?? 0`.
  lapses?: number;
};
export type Stat = { total: number; seen: number; learned: number; due: number };

export type SrsState = {
  streak: number;
  doneToday: boolean; // последний ответ — в текущий локальный день клиента
  bestStreak: number; // максимум стрика за всё время (финал курса, П.5)
  startedAt: string | null; // день первого ответа YYYY-MM-DD (null — данных нет)
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

// mc_audio_ru (П.1) — «прослушай португальское слово, выбери русский перевод»:
// третья ступень освоения (только для выученных слов, в повторении).
export type ExerciseType = "mc_pt_ru" | "mc_ru_pt" | "type_pt" | "mc_audio_ru";

// Результат ответа, который упражнение сообщает сессии.
//   mode     — каким упражнением отвечали (двигает этап / SM-2 на сервере)
//   correct  — ответ в итоге верный (в т.ч. со 2-й попытки) → растит этап
//   firstTry — верно с первой попытки → засчитывается в счёт сессии
// "audio" (П.1, аудио-экстра) — НЕ двигает выученность (mc/type не растут): это
// дополнительная тренировка слуха сверх программы, серверный mode "audio".
export type AnswerResult = {
  mode: "mc" | "type" | "sentence" | "audio";
  correct: boolean;
  firstTry: boolean;
};

export type SessionItem =
  | { kind: "word"; word: WordView; tag: BadgeTag }
  | { kind: "sentence"; sentence: CrossSentenceView; tag: "cross" }
  // Раздел «Построение предложений»: сборка из банка (build) и выбор
  // пропущенного слова (cloze). Оба несут TopicSentenceView; прогресс SRS не
  // двигают (как и "sentence") — влияют только на счёт сессии.
  | { kind: "build"; sentence: TopicSentenceView; tag: "cross" }
  | { kind: "cloze"; sentence: TopicSentenceView; tag: "cross" };

// Where a session was launched from (drives the "next step" suggestion).
//   "review" — вкладка «Повторение»; { topicKey, lessonKey } — словарная сессия
//   урока; { topicKey, kind:"sentences" } — раздел «Построение предложений» темы
//   (без шага вперёд и финала курса — предложения прогресс не двигают).
export type SessionOrigin =
  | "review"
  | { kind: "lesson"; topicKey: string; lessonKey: string }
  | { kind: "sentences"; topicKey: string };

// Финал-трамплин: главный CTA экрана Complete по ФАКТИЧЕСКОМУ прогрессу.
//   continue — в уроке остались недоученные слова (рестарт того же урока);
//   lesson   — урок добит, есть следующий урок темы;
//   topic    — урок добит, тема ≥ порога, перекат на первый урок следующей темы.
export type NextStep =
  | { kind: "continue"; remaining: number }
  | { kind: "lesson"; topicKey: string; lessonKey: string; label: string }
  | { kind: "topic"; topicKey: string; lessonKey: string; label: string };

// Заголовок финала: чем закончилась сессия (тема целиком / урок / просто сессия).
export type CompleteHeading = "topic" | "lesson" | "session";
