import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HINT_SHOW_LIMIT, markHintShown, shouldShowHint } from "./hints";

const KEY = "pt-hint-test-seen";

describe("гашение служебных хинтов (localStorage-счётчик)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("показывает хинт первые HINT_SHOW_LIMIT раз, дальше гасит насовсем", () => {
    for (let i = 0; i < HINT_SHOW_LIMIT; i++) {
      expect(shouldShowHint(KEY)).toBe(true);
      markHintShown(KEY);
    }
    expect(shouldShowHint(KEY)).toBe(false);
    markHintShown(KEY); // лишний учёт ничего не ломает
    expect(shouldShowHint(KEY)).toBe(false);
  });

  it("мусор в хранилище читается как «не показывали»", () => {
    window.localStorage.setItem(KEY, "не число");
    expect(shouldShowHint(KEY)).toBe(true);
    window.localStorage.setItem(KEY, "-5");
    expect(shouldShowHint(KEY)).toBe(true);
  });

  it("недоступное хранилище (приватный режим) → хинт остаётся постоянным, без падений", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(shouldShowHint(KEY)).toBe(true);
    expect(() => markHintShown(KEY)).not.toThrow();
    expect(shouldShowHint(KEY)).toBe(true);
  });
});
