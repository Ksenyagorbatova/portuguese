import { describe, it, expect, vi } from "vitest";
import { buildLessonQueue, buildMistakesQueue, buildReviewQueue, REVIEW_DUE_LIMIT } from "./queue";
import { MC_TARGET, TYPE_TARGET, SESSION_SIZE } from "./learning";
import { wKey } from "./srs";
import { shuffle } from "./shuffle";
import type { CardFields, Course, LessonView, SessionItem, SrsState, Stat } from "./types";

// shuffle → identity so queue order/slicing is deterministic to assert on
// (vi.fn, чтобы отдельные тесты могли подменить порядок через
// mockImplementationOnce — например, для сосед-гарда на стыке проходов).
vi.mock("./shuffle", () => ({ shuffle: vi.fn(<T,>(a: readonly T[]): T[] => [...a]) }));
const shuffleMock = vi.mocked(shuffle);

// Полная карточка прогресса с нужными этапными счётчиками (остальное — нули).
function cardOf(mc: number, type: number): CardFields {
  return { interval: 0, ef: 2.5, due: 0, seen: 1, correct: 1, lastSeen: 0, mcCorrect: mc, typeCorrect: type };
}
// Остаток показов нового слова (без карточки) до «выучено».
const FULL_REPS = MC_TARGET + TYPE_TARGET;

// Local tally of queue items by badge (срочные · новые · повторения · сочетания).
function queueCounts(queue: SessionItem[]): { due: number; nw: number; rv: number; cr: number } {
  const c = { due: 0, nw: 0, rv: 0, cr: 0 };
  for (const it of queue) {
    if (it.kind === "sentence") c.cr++;
    else if (it.tag === "due") c.due++;
    else if (it.tag === "new") c.nw++;
    else if (it.tag === "review") c.rv++;
  }
  return c;
}

function srsOf(over: Partial<SrsState> = {}): SrsState {
  return {
    streak: 0,
    doneToday: false,
    bestStreak: 0,
    startedAt: null,
    cards: {},
    tags: {},
    seenTheory: [],
    learnedPts: [],
    dueCountAll: 0,
    lessonStats: {},
    topicStats: {},
    ...over,
  };
}

const lesson: LessonView = {
  lessonKey: "l1",
  label: "L1",
  theory: { intro: "", tip: "", sections: [] },
  words: [
    { lessonKey: "l1", pt: "a", ru: "а" },
    { lessonKey: "l1", pt: "b", ru: "б" },
    { lessonKey: "l1", pt: "c", ru: "в" },
  ],
};
const course: Course = {
  topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [lesson] }],
  crossSentences: [],
};

describe("buildLessonQueue (статичная interleaved-очередь ≤ SESSION_SIZE)", () => {
  it("builds interleaved passes over unfinished words (3 слова × 6 показов = 18)", () => {
    const q = buildLessonQueue(lesson, srsOf(), course);
    expect(q).toHaveLength(3 * FULL_REPS); // 18 < SESSION_SIZE — очередь короче лимита
    expect(q.every((i) => i.kind === "word")).toBe(true);
    // Проход = по одной карточке на каждое слово: первые 3 — все разные.
    const firstPass = q.slice(0, 3).map((i) => (i.kind === "word" ? i.word.pt : ""));
    expect(new Set(firstPass).size).toBe(3);
  });

  it("caps the queue at SESSION_SIZE and the denominator never grows past it", () => {
    const big: LessonView = {
      ...lesson,
      lessonKey: "lb",
      words: Array.from({ length: 10 }, (_, i) => ({ lessonKey: "lb", pt: `w${i}`, ru: `п${i}` })),
    };
    const bigCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [big] }],
      crossSentences: [],
    };
    const q = buildLessonQueue(big, srsOf(), bigCourse);
    expect(q).toHaveLength(SESSION_SIZE); // 10 слов × 6 показов = 60 → cap 20
    // Interleaving: до первого повтора любого слова идут ВСЕ 10 разных слов.
    const pts = q.map((i) => (i.kind === "word" ? i.word.pt : ""));
    expect(new Set(pts.slice(0, 10)).size).toBe(10);
  });

  it("places due words first in the FIRST pass", () => {
    const srs = srsOf({
      tags: { [wKey("l1", "c")]: "due" },
      cards: { [wKey("l1", "c")]: cardOf(1, 0) },
    });
    const q = buildLessonQueue(lesson, srs, course);
    expect(q[0]).toMatchObject({ kind: "word", tag: "due", word: { pt: "c" } });
  });

  it("draws only from unfinished words — learned ones stay out", () => {
    const srs = srsOf({
      tags: { [wKey("l1", "a")]: "learned" },
      cards: { [wKey("l1", "a")]: cardOf(MC_TARGET, TYPE_TARGET) },
    });
    const q = buildLessonQueue(lesson, srs, course);
    expect(q.length).toBeGreaterThan(0);
    expect(q.some((i) => i.kind === "word" && i.word.pt === "a")).toBe(false);
  });

  it("counts a word's queued shows against its remaining reps (почти добитое слово)", () => {
    // b добито почти целиком: остался 1 верный ввод → ровно 1 показ в очереди.
    const srs = srsOf({
      tags: { [wKey("l1", "b")]: "ongoing" },
      cards: { [wKey("l1", "b")]: cardOf(MC_TARGET, TYPE_TARGET - 1) },
    });
    const q = buildLessonQueue(lesson, srs, course);
    const bShows = q.filter((i) => i.kind === "word" && i.word.pt === "b").length;
    expect(bShows).toBe(1);
    expect(q).toHaveLength(2 * FULL_REPS + 1); // a и c — по 6, b — 1
  });

  it("falls back to a one-pass review when the whole lesson is learned", () => {
    const learnedAll = Object.fromEntries(
      lesson.words.map((w) => [wKey("l1", w.pt), cardOf(MC_TARGET, TYPE_TARGET)] as const),
    );
    const tags = Object.fromEntries(
      lesson.words.map((w) => [wKey("l1", w.pt), "learned"] as const),
    );
    const q = buildLessonQueue(lesson, srsOf({ cards: learnedAll, tags }), course);
    expect(q).toHaveLength(3); // каждое слово по одному показу
    expect(queueCounts(q).rv).toBe(3);
  });

  it("never puts the same word on two adjacent cards (сосед-гард на стыке проходов)", () => {
    // Первый вызов shuffle — проход 1 в обратном порядке [c,b,a], второй —
    // identity [a,b,c]: стык a|a без гарда. Гард обязан свапнуть.
    shuffleMock.mockImplementationOnce(<T,>(arr: readonly T[]): T[] => [...arr].reverse());
    const q = buildMistakesQueue(lesson.words, srsOf());
    for (let i = 1; i < q.length; i++) {
      const prev = q[i - 1];
      const cur = q[i];
      if (prev.kind === "word" && cur.kind === "word") {
        expect(cur.word.pt, `cards ${i - 1} and ${i} repeat the same word`).not.toBe(prev.word.pt);
      }
    }
  });
});

describe("buildMistakesQueue (мини-сессия «Повторить эти N слов»)", () => {
  it("interleaves only the given words, no sentences, capped at SESSION_SIZE", () => {
    const srs = srsOf();
    const q = buildMistakesQueue(lesson.words, srs); // 3 новых × 6 = 18
    expect(q).toHaveLength(3 * FULL_REPS);
    expect(q.every((i) => i.kind === "word")).toBe(true);
    const pts = new Set(q.map((i) => (i.kind === "word" ? i.word.pt : "")));
    expect(pts).toEqual(new Set(["a", "b", "c"]));
  });

  it("gives an already-learned (review) miss at least ONE show", () => {
    // Промах на выученном слове: remainingReps 0, но мини-сессию запускали
    // ровно ради него — слово обязано получить показ.
    const srs = srsOf({
      tags: { [wKey("l1", "a")]: "learned" },
      cards: { [wKey("l1", "a")]: cardOf(MC_TARGET, TYPE_TARGET) },
    });
    const q = buildMistakesQueue([lesson.words[0]], srs);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "word", word: { pt: "a" } });
  });
});

describe("buildReviewQueue", () => {
  it("excludes words from lessons whose theory was not seen", () => {
    expect(buildReviewQueue(course, srsOf())).toHaveLength(0);
  });

  it("includes due words once their lesson's theory was seen", () => {
    const srs = srsOf({
      seenTheory: ["l1"],
      tags: { [wKey("l1", "a")]: "due", [wKey("l1", "b")]: "due" },
    });
    expect(queueCounts(buildReviewQueue(course, srs)).due).toBe(2);
  });

  it("caps the due words at REVIEW_DUE_LIMIT (the review button shows «N из M»)", () => {
    const many: LessonView = {
      ...lesson,
      lessonKey: "ld",
      words: Array.from({ length: REVIEW_DUE_LIMIT + 5 }, (_, i) => ({
        lessonKey: "ld",
        pt: `w${i}`,
        ru: `п${i}`,
      })),
    };
    const manyCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [many] }],
      crossSentences: [],
    };
    const srs = srsOf({
      seenTheory: ["ld"],
      tags: Object.fromEntries(many.words.map((w) => [wKey("ld", w.pt), "due"] as const)),
    });
    expect(queueCounts(buildReviewQueue(manyCourse, srs)).due).toBe(REVIEW_DUE_LIMIT);
  });
});

describe("cross-sentence gate (topic ≥80% + required learned)", () => {
  const gateLesson: LessonView = {
    lessonKey: "l1",
    label: "L1",
    theory: { intro: "", tip: "", sections: [] },
    words: ["a", "b", "c", "d", "e"].map((pt) => ({ lessonKey: "l1", pt, ru: pt })),
  };
  const gateCourse: Course = {
    topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [gateLesson] }],
    crossSentences: [
      { sentenceKey: "cs1", words: ["A", "B"], answer: "A B", ru: "—", required: ["a", "b"] },
    ],
  };
  const stat = (learned: number): Record<string, Stat> => ({
    t: { total: 5, seen: 5, learned, due: 0 },
  });

  it("hides the sentence while the topic is below 80% learned", () => {
    const srs = srsOf({ learnedPts: ["a", "b"], topicStats: stat(3) }); // 60%
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(0);
  });

  it("shows the sentence once the topic hits 80% AND required words are learned", () => {
    const srs = srsOf({ learnedPts: ["a", "b"], topicStats: stat(4) }); // 80%
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(1);
  });

  it("hides the sentence if a required word is not learned, even at 80%", () => {
    const srs = srsOf({ learnedPts: ["a"], topicStats: stat(4) }); // b missing
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(0);
  });

  it("keeps words + injected sentences within SESSION_SIZE total", () => {
    // 5 недоученных слов × 6 показов = 30 кандидатов + 1 предложение: бюджет
    // слов ужимается так, чтобы ОБЩИЙ размер очереди не превысил SESSION_SIZE.
    const srs = srsOf({ learnedPts: ["a", "b"], topicStats: stat(4) });
    const q = buildLessonQueue(gateLesson, srs, gateCourse);
    expect(q.length).toBeLessThanOrEqual(SESSION_SIZE);
    expect(queueCounts(q).cr).toBe(1);
  });

  // Дубль pt в двух темах: слово считается готовым, когда готова ХОТЯ БЫ ОДНА
  // из его тем — иначе добавление дубля молча переносило бы гейт на последнюю
  // тему по порядку. (Контент сейчас дублей не содержит — content.test.ts это
  // запрещает; ветка остаётся защитой от их возвращения.)
  it("treats a duplicated word as ready when ANY of its topics is ready", () => {
    const lessonA: LessonView = {
      lessonKey: "a1",
      label: "A1",
      theory: { intro: "", tip: "", sections: [] },
      words: [
        { lessonKey: "a1", pt: "x", ru: "х" },
        { lessonKey: "a1", pt: "y", ru: "у" },
      ],
    };
    const lessonB: LessonView = {
      lessonKey: "b1",
      label: "B1",
      theory: { intro: "", tip: "", sections: [] },
      words: [
        { lessonKey: "b1", pt: "x", ru: "х" }, // дубль x во второй теме
        { lessonKey: "b1", pt: "z", ru: "з" },
      ],
    };
    const dupCourse: Course = {
      topics: [
        { topicKey: "tA", label: "A", icon: "x", lessons: [lessonA] },
        { topicKey: "tB", label: "B", icon: "x", lessons: [lessonB] },
      ],
      crossSentences: [
        { sentenceKey: "cs-dup", words: ["X"], answer: "X", ru: "—", required: ["x"] },
      ],
    };
    // Тема A освоена полностью, тема B не начата: гейт должен открыться по A
    // (старый last-wins смотрел только на B и прятал предложение).
    const srs = srsOf({
      learnedPts: ["x", "y"],
      topicStats: {
        tA: { total: 2, seen: 2, learned: 2, due: 0 },
        tB: { total: 2, seen: 0, learned: 0, due: 0 },
      },
    });
    const q = buildLessonQueue(lessonA, srs, dupCourse);
    expect(q.filter((i) => i.kind === "sentence")).toHaveLength(1);
  });
});

describe("тематический фильтр предложений (сессия урока — только предложения своей темы)", () => {
  // Две темы: tA освоена целиком (x, y выучены), tB не начата (p, q новые).
  // Предложение построено из слов tA — по гейту выученности оно «открыто».
  const lessonA: LessonView = {
    lessonKey: "a1",
    label: "A1",
    theory: { intro: "", tip: "", sections: [] },
    words: [
      { lessonKey: "a1", pt: "x", ru: "х" },
      { lessonKey: "a1", pt: "y", ru: "у" },
    ],
  };
  const lessonB: LessonView = {
    lessonKey: "b1",
    label: "B1",
    theory: { intro: "", tip: "", sections: [] },
    words: [
      { lessonKey: "b1", pt: "p", ru: "п" },
      { lessonKey: "b1", pt: "q", ru: "к" },
    ],
  };
  const mkCourse = (required: string[]): Course => ({
    topics: [
      { topicKey: "tA", label: "A", icon: "x", lessons: [lessonA] },
      { topicKey: "tB", label: "B", icon: "x", lessons: [lessonB] },
    ],
    crossSentences: [
      { sentenceKey: "cs1", words: ["X", "Y"], answer: "X Y", ru: "—", required },
    ],
  });
  const readyA = srsOf({
    learnedPts: ["x", "y"],
    tags: { [wKey("a1", "x")]: "learned", [wKey("a1", "y")]: "learned" },
    cards: {
      [wKey("a1", "x")]: cardOf(MC_TARGET, TYPE_TARGET),
      [wKey("a1", "y")]: cardOf(MC_TARGET, TYPE_TARGET),
    },
    topicStats: {
      tA: { total: 2, seen: 2, learned: 2, due: 0 },
      tB: { total: 2, seen: 0, learned: 0, due: 0 },
    },
  });

  it("НЕ вставляет предложение чужой темы в сессию урока (жалоба: конструктор не к месту)", () => {
    // Учим урок темы B — открытое предложение темы A в его сессию не лезет.
    expect(queueCounts(buildLessonQueue(lessonB, readyA, mkCourse(["x"]))).cr).toBe(0);
  });

  it("вставляет предложение своей темы в сессию урока", () => {
    expect(queueCounts(buildLessonQueue(lessonA, readyA, mkCourse(["x"]))).cr).toBe(1);
  });

  it("предложение из слов ДВУХ тем принадлежит обеим — показывается в уроках каждой", () => {
    const both = srsOf({
      learnedPts: ["x", "y", "p", "q"],
      topicStats: {
        tA: { total: 2, seen: 2, learned: 2, due: 0 },
        tB: { total: 2, seen: 2, learned: 2, due: 0 },
      },
    });
    const course = mkCourse(["x", "p"]);
    expect(queueCounts(buildLessonQueue(lessonA, both, course)).cr).toBe(1);
    expect(queueCounts(buildLessonQueue(lessonB, both, course)).cr).toBe(1);
  });

  it("глобальное повторение темы не фильтрует — смешение тем там уместно", () => {
    // readyA — уже готовый SrsState (srsOf отработал внутри фикстуры).
    const srs = { ...readyA, seenTheory: ["a1"] };
    expect(queueCounts(buildReviewQueue(mkCourse(["x"]), srs)).cr).toBe(1);
  });
});
