import { describe, it, expect, vi } from "vitest";
import {
  buildLessonQueue,
  buildMistakesQueue,
  buildReviewQueue,
  buildSentenceQueue,
  REVIEW_DUE_LIMIT,
} from "./queue";
import { MC_TARGET, TYPE_TARGET, SESSION_SIZE } from "./learning";
import { wKey } from "./srs";
import { shuffle } from "./shuffle";
import type { CardFields, Course, LessonView, SessionItem, SrsState, TopicView } from "./types";

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
    else if (it.kind === "word" && it.tag === "due") c.due++;
    else if (it.kind === "word" && it.tag === "new") c.nw++;
    else if (it.kind === "word" && it.tag === "review") c.rv++;
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
  topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [lesson], sentences: [] }],
  crossSentences: [],
};

describe("buildLessonQueue (статичная interleaved-очередь ≤ SESSION_SIZE)", () => {
  it("builds interleaved passes over unfinished words (3 слова × 6 показов = 18)", () => {
    const q = buildLessonQueue(lesson, srsOf());
    expect(q).toHaveLength(3 * FULL_REPS); // 18 < SESSION_SIZE — очередь короче лимита
    expect(q.every((i) => i.kind === "word")).toBe(true);
    // Проход = по одной карточке на каждое слово: первые 3 — все разные.
    const firstPass = q.slice(0, 3).map((i) => (i.kind === "word" ? i.word.pt : ""));
    expect(new Set(firstPass).size).toBe(3);
  });

  // Предложения ВЫНЕСЕНЫ из словарной сессии (раздел «Построение предложений»
  // темы, buildSentenceQueue). Словарная очередь — только слова, никогда cross.
  it("НЕ содержит предложений — словарная сессия это чистое заучивание слов", () => {
    // Тема на 100%, required выучены — старый гейт вставил бы предложение;
    // buildLessonQueue его больше не принимает (course-параметр убран).
    const srs = srsOf({
      learnedPts: ["a", "b", "c"],
      topicStats: { t: { total: 3, seen: 3, learned: 3, due: 0 } },
    });
    const q = buildLessonQueue(lesson, srs);
    expect(q.every((i) => i.kind === "word")).toBe(true);
    expect(queueCounts(q).cr).toBe(0);
  });

  it("caps the queue at SESSION_SIZE and the denominator never grows past it", () => {
    const big: LessonView = {
      ...lesson,
      lessonKey: "lb",
      words: Array.from({ length: 10 }, (_, i) => ({ lessonKey: "lb", pt: `w${i}`, ru: `п${i}` })),
    };
    const q = buildLessonQueue(big, srsOf());
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
    const q = buildLessonQueue(lesson, srs);
    expect(q[0]).toMatchObject({ kind: "word", tag: "due", word: { pt: "c" } });
  });

  it("draws only from unfinished words — learned ones stay out", () => {
    const srs = srsOf({
      tags: { [wKey("l1", "a")]: "learned" },
      cards: { [wKey("l1", "a")]: cardOf(MC_TARGET, TYPE_TARGET) },
    });
    const q = buildLessonQueue(lesson, srs);
    expect(q.length).toBeGreaterThan(0);
    expect(q.some((i) => i.kind === "word" && i.word.pt === "a")).toBe(false);
  });

  it("counts a word's queued shows against its remaining reps (почти добитое слово)", () => {
    // b добито почти целиком: остался 1 верный ввод → ровно 1 показ в очереди.
    const srs = srsOf({
      tags: { [wKey("l1", "b")]: "ongoing" },
      cards: { [wKey("l1", "b")]: cardOf(MC_TARGET, TYPE_TARGET - 1) },
    });
    const q = buildLessonQueue(lesson, srs);
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
    const q = buildLessonQueue(lesson, srsOf({ cards: learnedAll, tags }));
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
    const srs = srsOf({
      tags: { [wKey("l1", "a")]: "learned" },
      cards: { [wKey("l1", "a")]: cardOf(MC_TARGET, TYPE_TARGET) },
    });
    const q = buildMistakesQueue([lesson.words[0]], srs);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "word", word: { pt: "a" } });
  });
});

describe("buildReviewQueue (+ гейт кросс-предложений: тема ≥80% и required выучены)", () => {
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
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [many], sentences: [] }],
      crossSentences: [],
    };
    const srs = srsOf({
      seenTheory: ["ld"],
      tags: Object.fromEntries(many.words.map((w) => [wKey("ld", w.pt), "due"] as const)),
    });
    expect(queueCounts(buildReviewQueue(manyCourse, srs)).due).toBe(REVIEW_DUE_LIMIT);
  });

  // Кросс-предложения остались ТОЛЬКО в «Повторении». Гейт: все required
  // выучены И приходят из тем ≥80%.
  const gateCourse: Course = {
    topics: [
      {
        topicKey: "t",
        label: "T",
        icon: "x",
        lessons: [{ ...lesson, words: ["a", "b", "c", "d", "e"].map((pt) => ({ lessonKey: "l1", pt, ru: pt })) }],
        sentences: [],
      },
    ],
    crossSentences: [
      { sentenceKey: "cs1", words: ["A", "B"], answer: "A B", ru: "—", required: ["a", "b"] },
    ],
  };
  const gateSrs = (learned: number, learnedPts: string[]) =>
    srsOf({
      seenTheory: ["l1"],
      learnedPts,
      tags: Object.fromEntries(learnedPts.map((pt) => [wKey("l1", pt), "learned"] as const)),
      topicStats: { t: { total: 5, seen: 5, learned, due: 0 } },
    });

  it("показывает предложение в повторении при теме ≥80% и выученных required", () => {
    expect(queueCounts(buildReviewQueue(gateCourse, gateSrs(4, ["a", "b", "c", "d"]))).cr).toBe(1);
  });

  it("прячет предложение, пока тема ниже 80%", () => {
    expect(queueCounts(buildReviewQueue(gateCourse, gateSrs(3, ["a", "b", "c"]))).cr).toBe(0);
  });

  it("прячет предложение, если required-слово не выучено (даже при 80%)", () => {
    expect(queueCounts(buildReviewQueue(gateCourse, gateSrs(4, ["a", "c", "d", "e"]))).cr).toBe(0);
  });
});

describe("buildSentenceQueue (раздел «Построение предложений» темы)", () => {
  const mkTopic = (n: number): TopicView => ({
    topicKey: "t",
    label: "T",
    icon: "x",
    lessons: [lesson],
    sentences: Array.from({ length: n }, (_, i) => ({
      sentenceKey: `ts_${i}`,
      topicKey: "t",
      words: [`W${i}`, "é?"],
      answer: `W${i} é?`,
      ru: `фраза ${i}`,
      blank: `W${i}`,
    })),
  });

  it("пустая тема (нет предложений) → пустая очередь", () => {
    expect(buildSentenceQueue({ ...mkTopic(0) })).toEqual([]);
  });

  it("строит очередь из всех предложений темы, ≤ SESSION_SIZE", () => {
    const q = buildSentenceQueue(mkTopic(5), () => 0);
    expect(q).toHaveLength(5);
    expect(q.every((i) => i.kind === "build" || i.kind === "cloze")).toBe(true);
  });

  it("каппирует большую тему по SESSION_SIZE", () => {
    const q = buildSentenceQueue(mkTopic(SESSION_SIZE + 8), () => 0.9);
    expect(q).toHaveLength(SESSION_SIZE);
  });

  it("rnd < 0.5 → cloze, иначе build (микс типов)", () => {
    expect(buildSentenceQueue(mkTopic(3), () => 0).every((i) => i.kind === "cloze")).toBe(true);
    expect(buildSentenceQueue(mkTopic(3), () => 0.9).every((i) => i.kind === "build")).toBe(true);
  });

  it("предложения несут исходный TopicSentenceView (topicKey/blank/answer)", () => {
    const [item] = buildSentenceQueue(mkTopic(1), () => 0);
    expect(item).toMatchObject({ kind: "cloze", sentence: { topicKey: "t", blank: "W0", answer: "W0 é?" } });
  });
});
