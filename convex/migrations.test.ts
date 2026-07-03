import { describe, it, expect } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

type ProgressSeed = {
  lessonKey: string;
  pt: string;
  mcCorrect?: number;
  typeCorrect?: number;
  lapses?: number;
};

// Вставить progress-строки напрямую (миграция работает по таблице progress,
// от контента не зависит). Фиксированные SRS-поля — детерминизм без Date.now().
async function seedProgress(
  t: TestConvex<typeof schema>,
  userId: Id<"users">,
  rows: ProgressSeed[],
) {
  await t.run(async (ctx) => {
    for (const r of rows) {
      await ctx.db.insert("progress", {
        userId,
        lessonKey: r.lessonKey,
        pt: r.pt,
        interval: 6,
        ef: 2.5,
        due: 1000,
        seen: 5,
        correct: 4,
        lastSeen: 900,
        mcCorrect: r.mcCorrect ?? 3,
        typeCorrect: r.typeCorrect ?? 2,
        lapses: r.lapses,
      });
    }
  });
}

function getRow(
  t: TestConvex<typeof schema>,
  userId: Id<"users">,
  lessonKey: string,
  pt: string,
) {
  return t.run((ctx) =>
    ctx.db
      .query("progress")
      .withIndex("by_user_lesson_pt", (q) =>
        q.eq("userId", userId).eq("lessonKey", lessonKey).eq("pt", pt),
      )
      .unique(),
  );
}

const rowsWithPt = (t: TestConvex<typeof schema>, pt: string) =>
  t.run(async (ctx) => (await ctx.db.query("progress").collect()).filter((p) => p.pt === pt));

describe("migrations.rebalanceNumbers", () => {
  it("переносит прогресс перемещённого слова numbers_2 → numbers_3, сохраняя все счётчики", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedProgress(t, userId, [{ lessonKey: "numbers_2", pt: "trinta", mcCorrect: 3, typeCorrect: 2, lapses: 1 }]);

    const res = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(res).toEqual({ moved: 1, cleaned: 0 });

    // Старого ключа больше нет, новый несёт ровно те же SRS-значения.
    expect(await getRow(t, userId, "numbers_2", "trinta")).toBeNull();
    const moved = await getRow(t, userId, "numbers_3", "trinta");
    expect(moved).not.toBeNull();
    expect(moved).toMatchObject({
      lessonKey: "numbers_3",
      pt: "trinta",
      interval: 6,
      ef: 2.5,
      due: 1000,
      seen: 5,
      correct: 4,
      lastSeen: 900,
      mcCorrect: 3,
      typeCorrect: 2,
      lapses: 1,
    });
  });

  it("переносит все пять переехавших чисел разом", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedProgress(t, userId, [
      { lessonKey: "numbers_2", pt: "trinta" },
      { lessonKey: "numbers_2", pt: "quarenta" },
      { lessonKey: "numbers_2", pt: "cinquenta" },
      { lessonKey: "numbers_2", pt: "sessenta" },
      { lessonKey: "numbers_2", pt: "cem" },
    ]);

    const res = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(res).toEqual({ moved: 5, cleaned: 0 });

    for (const pt of ["trinta", "quarenta", "cinquenta", "sessenta", "cem"]) {
      expect(await getRow(t, userId, "numbers_2", pt)).toBeNull();
      expect(await getRow(t, userId, "numbers_3", pt)).not.toBeNull();
    }
  });

  it("не трогает слова, оставшиеся в numbers_2, и слова других уроков", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedProgress(t, userId, [
      { lessonKey: "numbers_2", pt: "vinte" }, // 20 — остаётся в 11–20
      { lessonKey: "numbers_1", pt: "dez" }, // другой урок
      { lessonKey: "greetings_1", pt: "Olá" }, // другая тема
    ]);

    const res = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(res).toEqual({ moved: 0, cleaned: 0 });

    expect(await getRow(t, userId, "numbers_2", "vinte")).not.toBeNull();
    expect(await getRow(t, userId, "numbers_1", "dez")).not.toBeNull();
    expect(await getRow(t, userId, "greetings_1", "Olá")).not.toBeNull();
  });

  it("идемпотентна: повторный прогон ничего не переносит и не плодит дублей", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedProgress(t, userId, [{ lessonKey: "numbers_2", pt: "cem" }]);

    const first = await t.mutation(internal.migrations.rebalanceNumbers, {});
    const second = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(first).toEqual({ moved: 1, cleaned: 0 });
    expect(second).toEqual({ moved: 0, cleaned: 0 });

    // Ровно одна строка «cem» — в numbers_3.
    expect(await rowsWithPt(t, "cem")).toHaveLength(1);
    expect(await getRow(t, userId, "numbers_3", "cem")).not.toBeNull();
  });

  it("при уже существующей numbers_3-строке удаляет осиротевшую numbers_2 без дубля", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    // Коллизия: и старый numbers_2, и уже актуальный numbers_3 по одному pt.
    await seedProgress(t, userId, [
      { lessonKey: "numbers_2", pt: "trinta", mcCorrect: 1 },
      { lessonKey: "numbers_3", pt: "trinta", mcCorrect: 3 },
    ]);

    const res = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(res).toEqual({ moved: 0, cleaned: 1 });

    // Остаётся ровно одна «trinta» — актуальная numbers_3 (mc=3), сирота удалена.
    const rows = await rowsWithPt(t, "trinta");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lessonKey: "numbers_3", mcCorrect: 3 });
  });

  it("переносит независимо у нескольких пользователей", async () => {
    const t = convexTest(schema, modules);
    const a = await t.run((ctx) => ctx.db.insert("users", {}));
    const b = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedProgress(t, a, [{ lessonKey: "numbers_2", pt: "cem" }]);
    await seedProgress(t, b, [{ lessonKey: "numbers_2", pt: "cem" }]);

    const res = await t.mutation(internal.migrations.rebalanceNumbers, {});
    expect(res).toEqual({ moved: 2, cleaned: 0 });

    expect(await getRow(t, a, "numbers_3", "cem")).not.toBeNull();
    expect(await getRow(t, b, "numbers_3", "cem")).not.toBeNull();
  });
});
