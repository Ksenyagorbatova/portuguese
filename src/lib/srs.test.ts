import { describe, it, expect, vi, afterEach } from "vitest";
import {
  adaptSrs,
  wKey,
  nextDueLabel,
  pluralRu,
  nextReviewForecast,
  daysSinceStart,
} from "./srs";
import type { CardFields } from "./types";
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
    bestStreak: 5,
    startedAt: "2026-01-01",
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

  // П.4/П.5: новые поля прокидываются; отсутствующий в карточке lapses → 0.
  it("passes through bestStreak/startedAt and defaults a missing card lapses to 0", () => {
    const s = adaptSrs(raw(null));
    expect(s.bestStreak).toBe(5);
    expect(s.startedAt).toBe("2026-01-01");
    expect(s.cards["g1||olá"].lapses).toBe(0);
  });
});

// П.2: прогноз ближайшего повтора. Карточки с будущим due → ближайший
// КАЛЕНДАРНЫЙ день строго после сегодня + число слов в нём.
describe("nextReviewForecast (П.2)", () => {
  const DAY = 86400000;
  const card = (due: number): CardFields => ({
    interval: 1, ef: 2.5, due, seen: 1, correct: 1, lastSeen: 0, mcCorrect: 3, typeCorrect: 3,
  });
  const now = Date.parse("2026-06-11T12:00:00"); // четверг, локальный полдень

  it("«Завтра» с числом слов, когда ближайший повтор завтра", () => {
    const f = nextReviewForecast(
      { a: card(now + DAY), b: card(now + DAY + 3600000), c: card(now + 5 * DAY) },
      now,
    );
    expect(f).toEqual({ count: 2, lead: "Завтра" }); // c — позже, не в счёт
  });

  it("называет день недели для повтора дальше завтрашнего", () => {
    // Ближайший due — через 5 дней: 2026-06-16, вторник → «Во вторник» (особая «во»).
    const f = nextReviewForecast({ a: card(now + 5 * DAY) }, now);
    expect(f).toEqual({ count: 1, lead: "Во вторник" });
  });

  it("обычная форма «в» для других дней (пятница)", () => {
    const wed = Date.parse("2026-06-10T12:00:00"); // среда
    // через 2 дня — 2026-06-12, пятница → «В пятницу».
    expect(nextReviewForecast({ a: card(wed + 2 * DAY) }, wed)).toEqual({ count: 1, lead: "В пятницу" });
  });

  it("не показывает «сегодня»: due позже сейчас, но в пределах суток → пропуск", () => {
    // due через 3 часа (тот же календарный день) — не прогноз; будущих дней нет.
    expect(nextReviewForecast({ a: card(now + 3 * 3600000) }, now)).toBeNull();
  });

  it("null, когда планировать нечего (нет карточек с будущим due)", () => {
    expect(nextReviewForecast({}, now)).toBeNull();
    expect(nextReviewForecast({ a: card(now - DAY) }, now)).toBeNull(); // уже due
  });
});

// П.5: дни курса от startedAt до сегодня включительно.
describe("daysSinceStart (П.5)", () => {
  const now = Date.parse("2026-06-11T12:00:00");

  it("null без startedAt", () => {
    expect(daysSinceStart(null, now)).toBeNull();
  });

  it("считает дни включительно (старт сегодня → 1)", () => {
    expect(daysSinceStart("2026-06-11", now)).toBe(1);
    expect(daysSinceStart("2026-06-01", now)).toBe(11); // 10 дней назад + сегодня
  });

  it("не опускается ниже 1 при старте «в будущем» (защита от рассинхрона часов)", () => {
    expect(daysSinceStart("2026-06-20", now)).toBe(1);
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
    expect(nextDueLabel(card(-day))).toBe("сегодня");
  });

  // Метка живёт ТОЛЬКО в post-answer фидбэке, где «прямо сейчас» всегда враньё:
  // планировщик после ответа либо двигает due вперёд, либо сознательно не
  // трогает (ранняя верная практика выученного, due позже сегодня), а
  // переспросов в статичной очереди нет. Считаем КАЛЕНДАРНЫМИ локальными
  // днями: due позже сегодня → «сегодня»; за полночью (23:00 → 08:00) —
  // честное «завтра», а не round-ноль.
  it("календарные дни: due позже сегодня → «сегодня», за полночью → «завтра»", () => {
    const at = (day: number, hour: number) => new Date(2026, 5, day, hour).getTime();
    const card = (due: number) => ({
      interval: 1, ef: 2.5, due, seen: 1, correct: 1, lastSeen: 0, mcCorrect: 3, typeCorrect: 3,
    });
    // 10:00 → due 13:00 того же дня: раньше вырождалось в «прямо сейчас».
    vi.spyOn(Date, "now").mockReturnValue(at(15, 10));
    expect(nextDueLabel(card(at(15, 13)))).toBe("сегодня");
    // 23:00 → due 08:00 следующего дня: 9 часов, round дал бы 0 (ложное
    // «сегодня») — календарно это завтра.
    vi.spyOn(Date, "now").mockReturnValue(at(15, 23));
    expect(nextDueLabel(card(at(16, 8)))).toBe("завтра");
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
