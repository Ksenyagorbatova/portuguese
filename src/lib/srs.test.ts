import { describe, it, expect, vi, afterEach } from "vitest";
import { adaptSrs, wKey, nextDueLabel, intervalLabel } from "./srs";

describe("wKey", () => {
  it("joins lessonKey and pt with the '||' separator", () => {
    expect(wKey("greetings_1", "olá")).toBe("greetings_1||olá");
  });
});

describe("adaptSrs", () => {
  it("rebuilds keyed lookup maps from the array-shaped server payload", () => {
    const s = adaptSrs({
      streak: 3,
      cards: [
        { lessonKey: "g1", pt: "olá", interval: 6, ef: 2.5, due: 100, seen: 2, correct: 2, lastSeen: 50, mcCorrect: 2, typeCorrect: 0 },
      ],
      tags: [{ lessonKey: "g1", pt: "olá", tag: "learned" }],
      seenTheory: ["g1"],
      learnedPts: ["olá"],
      dueCountAll: 0,
      lessonStats: {},
      topicStats: {},
    });
    expect(s.cards["g1||olá"]).toMatchObject({ interval: 6, ef: 2.5, seen: 2 });
    expect(s.tags["g1||olá"]).toBe("learned");
    expect(s.streak).toBe(3);
  });
});

describe("nextDueLabel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 'новое' for an unseen card", () => {
    expect(nextDueLabel(undefined)).toBe("новое");
    expect(
      nextDueLabel({ interval: 0, ef: 2.5, due: 0, seen: 0, correct: 0, lastSeen: 0, mcCorrect: 0, typeCorrect: 0 }),
    ).toBe("новое");
  });

  it("labels the relative due date", () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const day = 86400000;
    const card = (due: number) => ({
      interval: 1, ef: 2.5, due, seen: 1, correct: 1, lastSeen: 0, mcCorrect: 1, typeCorrect: 0,
    });
    expect(nextDueLabel(card(day))).toBe("завтра");
    expect(nextDueLabel(card(3 * day))).toBe("через 3 дн.");
    expect(nextDueLabel(card(-day))).toBe("прямо сейчас");
  });

  it("rounds large intervals into human buckets (weeks / months / year)", () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const day = 86400000;
    const card = (due: number) => ({
      interval: 1, ef: 2.5, due, seen: 1, correct: 1, lastSeen: 0, mcCorrect: 1, typeCorrect: 0,
    });
    // weeks (Russian plural: 1 неделю, 2 недели, 5 недель — though <28d caps at 4)
    expect(nextDueLabel(card(7 * day))).toBe("через 1 неделю");
    expect(nextDueLabel(card(21 * day))).toBe("через 3 недели");
    // months
    expect(nextDueLabel(card(30 * day))).toBe("через 1 месяц");
    expect(nextDueLabel(card(90 * day))).toBe("через 3 месяца");
    expect(nextDueLabel(card(150 * day))).toBe("через 5 месяцев");
    // a year+ — including the legacy «through 455 days» case
    expect(nextDueLabel(card(330 * day))).toBe("примерно через год");
    expect(nextDueLabel(card(455 * day))).toBe("примерно через год");
  });
});

describe("intervalLabel", () => {
  it("formats the interval buckets", () => {
    const base = { ef: 2.5, due: 0, seen: 1, correct: 1, lastSeen: 0, mcCorrect: 1, typeCorrect: 0 };
    expect(intervalLabel(undefined)).toBe("");
    expect(intervalLabel({ ...base, interval: 1 })).toBe("1 день");
    expect(intervalLabel({ ...base, interval: 3 })).toBe("3 дня");
    expect(intervalLabel({ ...base, interval: 10 })).toBe("10 дн.");
  });
});
