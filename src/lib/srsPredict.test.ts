import { describe, it, expect } from "vitest";
import { predictCardAfterAnswer } from "./srsPredict";
import { MC_TARGET, TYPE_TARGET } from "./learning";
import type { CardFields } from "./types";

// Юниты фиксируют ФОРМУ зеркала; равенство с настоящим сервером держит
// кросс-слойный пин-тест в convex/progress.test.ts (матрица сценариев через
// настоящий recordAnswer).

const DAY = 86400000;
const NOW = 1_000_000_000_000;

const card = (over: Partial<CardFields> = {}): CardFields => ({
  interval: 0,
  ef: 2.5,
  due: 0,
  seen: 0,
  correct: 0,
  lastSeen: 0,
  mcCorrect: 0,
  typeCorrect: 0,
  ...over,
});

describe("predictCardAfterAnswer (зеркало планировщика для дисплея)", () => {
  it("первый ответ по новому слову (без карточки): фикс-шаг «завтра»", () => {
    const next = predictCardAfterAnswer(undefined, 2, "mc", NOW);
    expect(next.due).toBe(NOW + DAY);
    expect(next.interval).toBe(0); // интервал не двигается вне события повторения
    expect(next.mcCorrect).toBe(1);
    expect(next.seen).toBe(1);
  });

  it("недоученное слово: расписание не умножается, due = завтра", () => {
    const next = predictCardAfterAnswer(card({ mcCorrect: 1, seen: 2, interval: 0 }), 2, "type", NOW);
    expect(next.due).toBe(NOW + DAY);
    expect(next.typeCorrect).toBe(1);
  });

  it("выпуск (graduating): оба порога добраны этим ответом → SM-2 интервал 1", () => {
    const c = card({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET - 1, interval: 0, seen: 5 });
    const next = predictCardAfterAnswer(c, 2, "type", NOW);
    expect(next.typeCorrect).toBe(TYPE_TARGET);
    expect(next.interval).toBe(1); // c.interval === 0 → 1
    expect(next.due).toBe(NOW + DAY);
  });

  it("due-повтор выученного: 1 → 6, дальше ×ef; неверный (q0) — interval 1 и ef-штраф", () => {
    const learned = { mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET };
    const after1 = predictCardAfterAnswer(card({ ...learned, interval: 1, ef: 2.5, due: NOW - 1 }), 2, "mc", NOW);
    expect(after1.interval).toBe(6);
    expect(after1.due).toBe(NOW + 6 * DAY);

    const after6 = predictCardAfterAnswer(card({ ...learned, interval: 6, ef: 2.6, due: NOW - 1 }), 2, "mc", NOW);
    expect(after6.interval).toBe(Math.round(6 * 2.7)); // ef растёт на +0.1 при q=5
    expect(after6.ef).toBeCloseTo(2.7);

    const lapse = predictCardAfterAnswer(card({ ...learned, interval: 6, ef: 2.5, due: NOW - 1 }), 0, "mc", NOW);
    expect(lapse.interval).toBe(1);
    expect(lapse.ef).toBeLessThan(2.5); // штраф за q=1
    expect(lapse.due).toBe(NOW + DAY);
  });

  it("ранняя практика выученного: верный ответ не трогает расписание, q0 приближает повтор", () => {
    const learned = card({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET, interval: 6, ef: 2.5, due: NOW + 5 * DAY });
    const ok = predictCardAfterAnswer(learned, 2, "type", NOW);
    expect(ok.interval).toBe(6);
    expect(ok.due).toBe(NOW + 5 * DAY); // не изменилось

    const lapse = predictCardAfterAnswer(learned, 0, "type", NOW);
    expect(lapse.interval).toBe(1);
    expect(lapse.due).toBe(NOW + DAY);
    expect(lapse.ef).toBe(2.5); // ранний lapse ef не штрафует
  });

  it("потолок MAX_INTERVAL: большой интервал клампится в 120 дней", () => {
    const learned = card({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET, interval: 100, ef: 2.5, due: NOW - 1 });
    const next = predictCardAfterAnswer(learned, 2, "mc", NOW);
    expect(next.interval).toBe(120);
    expect(next.due).toBe(NOW + 120 * DAY);
  });
});
