import { describe, it, expect, vi, afterEach } from "vitest";
import { adaptSrs, wKey, nextDueLabel, pluralRu } from "./srs";
import { localDay } from "./day";

describe("pluralRu", () => {
  const words = (n: number) => pluralRu(n, "слово", "слова", "слов");

  it("picks the Russian plural form: 1 слово / 2 слова / 5 слов", () => {
    expect(words(1)).toBe("слово");
    expect(words(2)).toBe("слова");
    expect(words(5)).toBe("слов");
  });

  it("handles the teens and the 21/22 wrap-around", () => {
    expect(words(11)).toBe("слов");
    expect(words(14)).toBe("слов");
    expect(words(21)).toBe("слово");
    expect(words(22)).toBe("слова");
    expect(words(0)).toBe("слов");
  });
});

describe("wKey", () => {
  it("joins lessonKey and pt with the '||' separator", () => {
    expect(wKey("greetings_1", "olá")).toBe("greetings_1||olá");
  });
});

describe("adaptSrs", () => {
  const raw = (lastDay: string | null) => ({
    streak: 3,
    lastDay,
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

  it("rebuilds keyed lookup maps from the array-shaped server payload", () => {
    const s = adaptSrs(raw(null));
    expect(s.cards["g1||olá"]).toMatchObject({ interval: 6, ef: 2.5, seen: 2 });
    expect(s.tags["g1||olá"]).toBe("learned");
    expect(s.streak).toBe(3);
  });

  // «День закрыт»: сервер отдаёт сырой lastDay (день стрика), а «сегодня» в
  // таймзоне пользователя знает только клиент — сравнение живёт здесь.
  it("doneToday is true only when lastDay equals the CLIENT's current local day", () => {
    expect(adaptSrs(raw(localDay())).doneToday).toBe(true);
    expect(adaptSrs(raw("2000-01-01")).doneToday).toBe(false);
    expect(adaptSrs(raw(null)).doneToday).toBe(false);
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
