import { describe, it, expect } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
// Кросс-слойный пин порогов: backend-тесты намеренно берут MC_TARGET/TYPE_TARGET
// из КЛИЕНТСКОГО модуля (src/lib/learning — чистый TS без внешних API). Серверная
// копия констант живёт в convex/progress.ts (Convex бандлится отдельно) — если
// ЛЮБАЯ из двух копий разъедется, graduate-циклы ниже перестанут попадать в
// серверный порог и тесты упадут.
import { MC_TARGET, TYPE_TARGET } from "../src/lib/learning";
// Тот же приём для зеркала планировщика: клиент мгновенно предсказывает
// «следующий повтор» (src/lib/srsPredict), пин-матрица ниже сверяет
// предсказание с фактическим ответом recordAnswer.
import { predictCardAfterAnswer } from "../src/lib/srsPredict";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

// Create a user row and return a context authenticated as them. getAuthUserId
// parses identity.subject as `${userId}|${sessionId}`.
async function asUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

const W = { lessonKey: "l1", pt: "a" };

// recordAnswer валидирует (lessonKey, pt) по контенту — тестовое слово W
// должно существовать в words до первого ответа.
async function seedWordA(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("words", { lessonKey: "l1", pt: "a", ru: "а", order: 0 });
  });
}

// Только строка урока — слово (l1, a) сеется отдельным seedWordA, чтобы не
// плодить дублей words в тестах, где он уже вызван. markTheorySeen валидирует
// lessonKey по этой таблице.
async function seedLesson(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", {
      lessonKey: "l1",
      topicKey: "t1",
      label: "L1",
      order: 0,
      theory: { intro: "", tip: "", sections: [] },
    });
  });
}

type AuthCtx = Awaited<ReturnType<typeof asUser>>["as"];

// Drive a word to «learned»: MC_TARGET correct choices + TYPE_TARGET correct
// manual inputs (константы — из клиентского src/lib/learning, см. импорт выше).
// Returns the graduating answer's result. Mirrors what the in-session rotation
// produces, all within one session.
async function graduate(as: AuthCtx) {
  for (let i = 0; i < MC_TARGET; i++)
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
  let res!: Awaited<ReturnType<typeof as.mutation>>;
  for (let i = 0; i < TYPE_TARGET; i++)
    res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
  return res;
}

// Simulate time passing until the word is due (a real review only advances the
// SM-2 schedule when due<=now). Pulls every progress row's `due` into the past
// — tests here only ever have the single word "a".
async function makeDue(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("progress").collect();
    for (const row of rows) await ctx.db.patch(row._id, { due: 0 });
  });
}

describe("recordAnswer — SM-2 only advances on a review event", () => {
  it("does NOT compound the interval on in-session drilling answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    // MC_TARGET MC + (TYPE_TARGET−1) Type — pre-mastery drilling, на один ответ
    // меньше выпуска. Counters grow but the interval must stay at 0 (no
    // ladder-climbing): applying SM-2 on every rep is what blew the interval up
    // to «4131 дн». `due` is only a short learning step.
    for (let i = 0; i < MC_TARGET; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < TYPE_TARGET - 1; i++) {
      res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
      expect(res.card.interval).toBe(0);
    }
    expect(res.card.mcCorrect).toBe(MC_TARGET);
    expect(res.card.typeCorrect).toBe(TYPE_TARGET - 1);
    // due is a ~1-day learning step, never an exploded value.
    expect(res.card.due).toBeLessThanOrEqual(Date.now() + 2 * 86400000);
  });

  it("the graduating answer sets interval 1 (first real review)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const res = await graduate(as);
    expect(res.card.interval).toBe(1);
    expect(res.card.mcCorrect).toBe(MC_TARGET);
    expect(res.card.typeCorrect).toBe(TYPE_TARGET);
    expect(res.card.due).toBeGreaterThan(0);
  });

  // Кросс-слойный пин порогов: «(MC_TARGET−1) верных MC недостаточно для
  // learned» — и зеркально для Type. Выпуск (interval 0→1) обязан случиться
  // РОВНО на ответе, добирающем клиентские константы: если серверная копия
  // порога меньше — выпуск случится раньше (interval≠0 до добора), если больше —
  // не случится на добирающем ответе (interval≠1). Любой рассинхрон — красный.
  it("(MC_TARGET−1) верных MC недостаточно — выпуск ровно на доборе MC", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    for (let i = 0; i < TYPE_TARGET; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    for (let i = 0; i < MC_TARGET - 1; i++) {
      const res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
      expect(res.card.interval).toBe(0); // ещё не выучено — расписание не двигалось
    }
    const grad = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    expect(grad.card.interval).toBe(1); // именно этот ответ выпускает
  });

  it("(TYPE_TARGET−1) верных вводов недостаточно — выпуск ровно на доборе Type", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    for (let i = 0; i < MC_TARGET; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    for (let i = 0; i < TYPE_TARGET - 1; i++) {
      const res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
      expect(res.card.interval).toBe(0);
    }
    const grad = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(grad.card.interval).toBe(1);
  });

  it("does NOT move the schedule when a learned word is practised early (not due)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const grad = await graduate(as); // interval 1, due ~tomorrow (future)
    // Practise it again immediately — it is NOT due yet, so the spaced schedule
    // must stay put (early practice still counts toward seen, just not SM-2).
    const early = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(early.card.interval).toBe(grad.card.interval);
    expect(early.card.due).toBe(grad.card.due);
    expect(early.card.seen).toBe(grad.card.seen + 1);
  });

  describe("lapse выученного при ранней практике (quality=0)", () => {
    const DAY = 86400000;

    // Выученное слово с далёким due (≈30 дн): полный провал на ранней практике
    // приближает повтор (interval=1, due≈завтра), ef не штрафуется.
    async function learnedFarOut(t: ReturnType<typeof convexTest>, as: AuthCtx) {
      await graduate(as);
      await t.run(async (ctx) => {
        const rows = await ctx.db.query("progress").collect();
        for (const row of rows)
          await ctx.db.patch(row._id, { interval: 30, due: Date.now() + 30 * DAY });
      });
      const row = await t.run(async (ctx) => (await ctx.db.query("progress").collect())[0]);
      return row;
    }

    it("quality=0 → interval=1, due≈завтра, ef прежний", async () => {
      const t = convexTest(schema, modules);
      const { as } = await asUser(t);
      await seedWordA(t);
      const before = await learnedFarOut(t, as);

      const lapse = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
      expect(lapse.card.interval).toBe(1);
      expect(lapse.card.due).toBeGreaterThan(Date.now());
      expect(lapse.card.due).toBeLessThanOrEqual(Date.now() + DAY + 1000);
      // ef-штраф остаётся на due-повторах — ранний lapse его не трогает.
      expect(lapse.card.ef).toBe(before.ef);
    });

    it("quality=2 → расписание не тронуто (ранняя практика как раньше)", async () => {
      const t = convexTest(schema, modules);
      const { as } = await asUser(t);
      await seedWordA(t);
      const before = await learnedFarOut(t, as);

      const ok = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
      expect(ok.card.interval).toBe(before.interval);
      expect(ok.card.due).toBe(before.due);
      expect(ok.card.ef).toBe(before.ef);
    });

    it("quality=1 → расписание не тронуто", async () => {
      const t = convexTest(schema, modules);
      const { as } = await asUser(t);
      await seedWordA(t);
      const before = await learnedFarOut(t, as);

      const half = await as.mutation(api.progress.recordAnswer, { ...W, quality: 1, mode: "type" });
      expect(half.card.interval).toBe(before.interval);
      expect(half.card.due).toBe(before.due);
      expect(half.card.ef).toBe(before.ef);
    });
  });

  it("walks the interval ladder 1 → 6 on the next DUE review of a learned word", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await graduate(as); // interval 1, learned
    await makeDue(t); // a day passes → the word is due
    const review = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(review.card.interval).toBe(6);
  });

  it("caps the interval at MAX_INTERVAL (120 дн) however many perfect reviews", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await graduate(as);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 10; i++) {
      await makeDue(t);
      res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    }
    expect(res.card.interval).toBe(120);
  });

  it("resets a learned word's interval to 1 on a wrong DUE review", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await graduate(as);
    await makeDue(t);
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" }); // interval 6
    await makeDue(t);
    const wrong = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    expect(wrong.card.interval).toBe(1);
    // Still mastered — counters only grow, a single lapse doesn't unlearn it.
    expect(wrong.card.typeCorrect).toBeGreaterThanOrEqual(TYPE_TARGET);
  });

  it("keeps the ease factor at or above the 1.3 floor on repeated lapses", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await graduate(as);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 6; i++) {
      await makeDue(t);
      res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    }
    expect(res.card.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("first answer bumps the daily streak to 1", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    const res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    expect(res.streak).toBe(1);
    expect(res.card.seen).toBe(1);
    expect(res.card.correct).toBe(1);

    const row = await t.run((ctx) =>
      ctx.db
        .query("progress")
        .withIndex("by_user_lesson_pt", (q) =>
          q.eq("userId", userId).eq("lessonKey", "l1").eq("pt", "a"),
        )
        .unique(),
    );
    expect(row?.seen).toBe(1);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" }),
    ).rejects.toThrow();
  });
});

describe("staged-learning counters", () => {
  it("grows mcCorrect on correct MC answers and typeCorrect on correct Type answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const a = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    expect(a.card.mcCorrect).toBe(1);
    expect(a.card.typeCorrect).toBe(0);
    const b = await as.mutation(api.progress.recordAnswer, { ...W, quality: 1, mode: "type" });
    expect(b.card.mcCorrect).toBe(1);
    expect(b.card.typeCorrect).toBe(1);
  });

  it("does not grow stage counters on a wrong answer", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    const wrong = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    expect(wrong.card.mcCorrect).toBe(1);
    expect(wrong.card.typeCorrect).toBe(0);
  });
});

describe("getSrsState", () => {
  it("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.progress.getSrsState, {})).toBeNull();
  });

  // П.7 (дизайн-ревью v2): сырьё для галочки «день закрыт». Сервер отдаёт
  // lastDay (день стрика, локальный день клиента из clientDay); doneToday
  // вычисляет КЛИЕНТ (adaptSrs) — «сегодня» в таймзоне пользователя знает
  // только он, а у query нет аргументов.
  it("exposes the streak's lastDay (null before the first answer)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);

    let srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lastDay).toBeNull();

    await as.mutation(api.progress.recordAnswer, {
      ...W,
      quality: 2,
      mode: "mc",
      clientDay: "2026-06-10",
    });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lastDay).toBe("2026-06-10");
  });

  it("marks a word learned only once BOTH MC and Type targets are met", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await seedLesson(t);

    // MC_TARGET correct MC answers do NOT make it learned (recognition ≠ mastery).
    for (let i = 0; i < MC_TARGET; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    let srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.learnedPts).not.toContain("a");

    // (TYPE_TARGET−1) correct Type answers — still not learned.
    for (let i = 0; i < TYPE_TARGET - 1; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);

    // Добирающий Type-ответ → both skills met → learned.
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(1);
    expect(srs!.learnedPts).toContain("a");
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("learned");
  });

  it("does NOT mark a word learned from Type answers alone (MC still required)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await seedLesson(t);
    // TYPE_TARGET correct Type answers but zero MC → recognition is still owed.
    for (let i = 0; i < TYPE_TARGET; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.learnedPts).not.toContain("a");
  });

  it("classifies a partially-drilled word as ongoing (not due) — a learning step, not due=0", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await seedLesson(t);
    // A couple of correct drilling answers — seen, but not learned. The word
    // must read as «ongoing» (in-progress), NOT pile onto the urgent «due»
    // counter, and must NOT be stuck at due=0.
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].seen).toBe(1);
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.lessonStats["l1"].due).toBe(0);
    expect(srs!.dueCountAll).toBe(0);
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("ongoing");
  });

  it("treats a legacy progress row (no stage counters) as not learned", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    await seedLesson(t);
    // A row predating the staged-learning fields: high seen/correct, but no
    // mcCorrect/typeCorrect — must read as 0 and classify as ongoing, not learned.
    await t.run((ctx) =>
      ctx.db.insert("progress", {
        userId,
        lessonKey: "l1",
        pt: "a",
        interval: 6,
        ef: 2.5,
        due: Date.now() + 6 * 86400000,
        seen: 5,
        correct: 5,
        lastSeen: Date.now(),
      }),
    );
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].seen).toBe(1);
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("ongoing");
  });
});

describe("markTheorySeen", () => {
  it("records a lesson's theory as seen, idempotently", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedLesson(t);
    await as.mutation(api.progress.markTheorySeen, { lessonKey: "l1" });
    await as.mutation(api.progress.markTheorySeen, { lessonKey: "l1" });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("theorySeen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(1);

    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.seenTheory).toContain("l1");
  });

  it("rejects an unknown lessonKey and writes nothing", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    // Урок «l1» существует, мусорный ключ — нет.
    await seedLesson(t);
    await expect(
      as.mutation(api.progress.markTheorySeen, { lessonKey: "no-such-lesson" }),
    ).rejects.toThrow(/unknown lesson/);

    const rows = await t.run((ctx) =>
      ctx.db
        .query("theorySeen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("recordAnswer — валидация натурального ключа", () => {
  // Мусорный (lessonKey, pt) не должен молча создавать осиротевшую
  // progress-строку — мутация отказывает до записи.
  it("rejects an unknown (lessonKey, pt) and creates no progress row", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await expect(
      as.mutation(api.progress.recordAnswer, {
        lessonKey: "no-such-lesson",
        pt: "ghost",
        quality: 2,
        mode: "mc",
      }),
    ).rejects.toThrow(/unknown word/);

    expect(await t.run((ctx) => ctx.db.query("progress").collect())).toHaveLength(0);
  });

  it("rejects a known lessonKey with a wrong pt (the pair must match)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t); // существует только (l1, a)
    await expect(
      as.mutation(api.progress.recordAnswer, {
        lessonKey: "l1",
        pt: "b",
        quality: 2,
        mode: "mc",
      }),
    ).rejects.toThrow(/unknown word/);
    expect(await t.run((ctx) => ctx.db.query("progress").collect())).toHaveLength(0);
  });
});

describe("recordAnswer — честный стрик по clientDay", () => {
  type UserId = Awaited<ReturnType<typeof asUser>>["userId"];

  // Перевести существующую строку userStats в нужное состояние «прошлого»
  // (строка уже создана первым ответом — см. тесты ниже). Точный тип t (с
  // дженериком схемы) нужен ради типизации withIndex.
  async function setStats(
    t: TestConvex<typeof schema>,
    userId: UserId,
    streak: number,
    lastDay: string,
  ) {
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("userStats")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (row) await ctx.db.patch(row._id, { streak, lastDay });
    });
  }

  async function readStats(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => (await ctx.db.query("userStats").collect())[0]);
  }

  function answer(as: AuthCtx, clientDay?: string) {
    return as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc", clientDay });
  }

  it("тот же день — стрик не растёт", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const first = await answer(as, "2026-06-10");
    expect(first.streak).toBe(1);
    const second = await answer(as, "2026-06-10");
    expect(second.streak).toBe(1);
    expect((await readStats(t)).lastDay).toBe("2026-06-10");
  });

  it("вчера → +1", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    await answer(as, "2026-06-09");
    await setStats(t, userId, 4, "2026-06-09");

    const res = await answer(as, "2026-06-10");
    expect(res.streak).toBe(5);
    expect((await readStats(t)).lastDay).toBe("2026-06-10");
  });

  it("пропуск ≥1 дня → сброс в 1", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    await answer(as, "2026-06-05");
    await setStats(t, userId, 9, "2026-06-05");

    const res = await answer(as, "2026-06-10");
    expect(res.streak).toBe(1);
    expect((await readStats(t)).lastDay).toBe("2026-06-10");
  });

  it("legacy-формат lastDay (toDateString) мигрирует корректно: вчера → +1, формат становится YYYY-MM-DD", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    // Сегодня/вчера — от одного и того же момента и в ОДНОЙ (локальной) TZ
    // раннера, как их писал бы старый сервер и шлёт новый клиент.
    const now = Date.now();
    const todayLocal = new Date(now).toLocaleDateString("en-CA"); // YYYY-MM-DD
    const yesterdayLegacy = new Date(now - 86400000).toDateString(); // «Mon Jun 09 2026»

    await answer(as, todayLocal);
    await setStats(t, userId, 6, yesterdayLegacy);

    const res = await answer(as, todayLocal);
    expect(res.streak).toBe(7);
    expect((await readStats(t)).lastDay).toBe(todayLocal); // формат мигрировал
  });

  it("clientDay РАНЬШЕ lastDay (смена пояса) → no-op, не сбрасываем", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    await answer(as, "2026-06-10");
    await setStats(t, userId, 3, "2026-06-10");

    const res = await answer(as, "2026-06-09");
    expect(res.streak).toBe(3); // не сброшен и не увеличен
    expect((await readStats(t)).lastDay).toBe("2026-06-10"); // остался поздний день
  });

  it("невалидный clientDay → fallback на серверную UTC-дату", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const res = await answer(as, "10.06.2026"); // не YYYY-MM-DD
    expect(res.streak).toBe(1);
    expect((await readStats(t)).lastDay).toBe(new Date().toISOString().slice(0, 10));
  });

  it("regex-валидный, но непарсимый clientDay («2026-13-99») → fallback, без ложного сброса и отравления lastDay", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedWordA(t);
    // Имеющаяся серия; последний ответ — «сегодня» по серверному UTC (куда и
    // падает fallback при непарсимом clientDay).
    const utcToday = new Date().toISOString().slice(0, 10);
    await answer(as, utcToday);
    await setStats(t, userId, 5, utcToday);

    // «2026-13-99» проходит формат-regex, но Date.parse даёт NaN — без
    // parse-проверки NaN-diff проваливался в ветку сброса и мусор записывался
    // в lastDay (а следующий нормальный день давал ЕЩЁ один ложный сброс).
    const res = await answer(as, "2026-13-99");
    expect(res.streak).toBe(5); // fallback → тот же день → серия цела
    expect((await readStats(t)).lastDay).toBe(utcToday); // lastDay не отравлен
  });

  it("без clientDay (старый фронт) → серверная UTC-дата", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    const res = await answer(as);
    expect(res.streak).toBe(1);
    expect((await readStats(t)).lastDay).toBe(new Date().toISOString().slice(0, 10));
  });
});

// ─── Пин зеркала планировщика (src/lib/srsPredict) ───────────────────────────
// Клиент показывает «следующий повтор» МГНОВЕННО по локальному предсказанию;
// матрица ниже гонит те же ответы через НАСТОЯЩИЙ recordAnswer и сверяет поля.
// Разъедутся формулы (или MAX_INTERVAL) — упадёт здесь.
describe("predictCardAfterAnswer зеркалит recordAnswer (пин-матрица)", () => {
  // Текущая карточка слова из БД (undefined до первого ответа) — то же, что
  // упражнение получает пропом card.
  async function currentCard(t: TestConvex<typeof schema>) {
    const row = await t.run((ctx) =>
      ctx.db
        .query("progress")
        .withIndex("by_user_lesson_pt", (q) => q)
        .unique(),
    );
    if (!row) return undefined;
    const { interval, ef, due, seen, correct, lastSeen, mcCorrect, typeCorrect } = row;
    return { interval, ef, due, seen, correct, lastSeen, mcCorrect: mcCorrect ?? 0, typeCorrect: typeCorrect ?? 0 };
  }

  // Предсказать → выполнить → сверить. now у клиента и сервера различаются на
  // миллисекунды прогона: due сверяем с допуском, остальное — точно.
  async function step(
    t: TestConvex<typeof schema>,
    as: AuthCtx,
    quality: 0 | 1 | 2,
    mode: "mc" | "type",
  ) {
    const before = await currentCard(t);
    const predicted = predictCardAfterAnswer(before, quality, mode, Date.now());
    const { card: actual } = await as.mutation(api.progress.recordAnswer, { ...W, quality, mode });
    expect(actual.interval, `interval (q=${quality}, ${mode})`).toBe(predicted.interval);
    expect(actual.ef, `ef (q=${quality}, ${mode})`).toBeCloseTo(predicted.ef, 10);
    expect(actual.mcCorrect).toBe(predicted.mcCorrect);
    expect(actual.typeCorrect).toBe(predicted.typeCorrect);
    expect(actual.seen).toBe(predicted.seen);
    expect(actual.correct).toBe(predicted.correct);
    expect(Math.abs(actual.due - predicted.due), `due (q=${quality}, ${mode})`).toBeLessThan(5000);
  }

  it("вся жизнь слова: знакомство → добор → выпуск → due-повторы → лапсы", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);

    // Знакомство и добор обоих навыков (фикс-шаг «завтра» на каждом шаге).
    await step(t, as, 2, "mc");
    await step(t, as, 1, "mc");
    await step(t, as, 0, "type"); // промах недоученного
    for (let i = 0; i < MC_TARGET - 2; i++) await step(t, as, 2, "mc");
    for (let i = 0; i < TYPE_TARGET - 1; i++) await step(t, as, 2, "type");
    await step(t, as, 2, "type"); // выпуск (graduating)

    // Ранняя практика выученного: верная не двигает, q0 приближает повтор.
    await step(t, as, 2, "mc");
    await step(t, as, 0, "mc");

    // Настоящие due-повторы: q2 (1→6), снова q2 (6→×ef), q1 и q0.
    await makeDue(t);
    await step(t, as, 2, "type");
    await makeDue(t);
    await step(t, as, 2, "mc");
    await makeDue(t);
    await step(t, as, 1, "type");
    await makeDue(t);
    await step(t, as, 0, "mc");
  });

  it("потолок MAX_INTERVAL: разогнанный интервал клампится одинаково", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedWordA(t);
    await graduate(as);
    // Разогнать interval до сотни прямо в БД и сделать due.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("progress").collect();
      for (const r of rows) await ctx.db.patch(r._id, { interval: 100, due: 0 });
    });
    await step(t, as, 2, "mc"); // 100×ef > 120 → 120 с обеих сторон
  });
});

describe("reclampSchedules — heals legacy inflated rows", () => {
  const DAY = 86400000;

  it("clamps interval/due back under MAX_INTERVAL and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await asUser(t);
    const now = Date.now();
    // Legacy row written by the pre-cap scheduler: interval 600, due ~455 дн.
    const id = await t.run((ctx) =>
      ctx.db.insert("progress", {
        userId, lessonKey: "l1", pt: "a",
        interval: 600, ef: 2.6, due: now + 455 * DAY,
        seen: 8, correct: 8, lastSeen: now, mcCorrect: 3, typeCorrect: 3,
      }),
    );

    const first = await t.mutation(internal.progress.reclampSchedules, {});
    expect(first).toEqual({ scanned: 1, fixed: 1 });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row!.interval).toBe(120);
    expect(row!.due).toBeLessThanOrEqual(now + 120 * DAY);
    expect(row!.due).toBeGreaterThan(now); // still in the future, just sane

    // Re-running changes nothing — clamp is idempotent.
    const second = await t.mutation(internal.progress.reclampSchedules, {});
    expect(second).toEqual({ scanned: 1, fixed: 0 });
  });

  it("leaves already-sane rows untouched", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await asUser(t);
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("progress", {
        userId, lessonKey: "l1", pt: "b",
        interval: 10, ef: 2.5, due: now + 10 * DAY,
        seen: 6, correct: 6, lastSeen: now, mcCorrect: 3, typeCorrect: 3,
      }),
    );
    const res = await t.mutation(internal.progress.reclampSchedules, {});
    expect(res).toEqual({ scanned: 1, fixed: 0 });
  });
});
