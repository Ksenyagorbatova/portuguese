import { describe, it, expect } from "vitest";
import {
  isWordLearned,
  pickExerciseType,
  shouldRequeue,
  requeuePosition,
  MC_TARGET,
  TYPE_TARGET,
  REQUEUE_GAP,
  SESSION_REQUEUE_CAP,
} from "./learning";

describe("isWordLearned", () => {
  it("is false without a card or when either skill is below target", () => {
    expect(isWordLearned(undefined)).toBe(false);
    expect(isWordLearned({ mcCorrect: 0, typeCorrect: 0 })).toBe(false);
    // Type met but MC not — recognition still owed.
    expect(isWordLearned({ mcCorrect: MC_TARGET - 1, typeCorrect: TYPE_TARGET })).toBe(false);
    // MC met but Type not — recall still owed.
    expect(isWordLearned({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET - 1 })).toBe(false);
  });

  it("is true only when BOTH MC and Type targets are met", () => {
    expect(isWordLearned({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET })).toBe(true);
    expect(isWordLearned({ mcCorrect: MC_TARGET + 1, typeCorrect: TYPE_TARGET + 2 })).toBe(true);
  });
});

describe("pickExerciseType (mixed MC/Type until learned)", () => {
  const r = (v: number) => () => v;

  it("picks the manual input when only Type is still owed", () => {
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 0 }, "new", r(0.1))).toBe("type_pt");
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 1 }, "new", r(0.9))).toBe("type_pt");
  });

  it("picks multiple-choice (direction by rnd) when only MC is still owed", () => {
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: TYPE_TARGET }, "new", r(0.2))).toBe("mc_pt_ru");
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: TYPE_TARGET }, "new", r(0.7))).toBe("mc_ru_pt");
  });

  it("starts a brand-new word with multiple-choice (recognition before recall)", () => {
    // First encounter (no correct answers yet) → MC regardless of rnd: typing a
    // never-seen word blind is impossible. Direction still varies by rnd.
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: 0 }, "new", r(0.2))).toBe("mc_pt_ru");
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: 0 }, "new", r(0.7))).toBe("mc_ru_pt");
  });

  it("mixes both kinds randomly once the word has been touched (not phased)", () => {
    // After the first correct answer (e.g. mc=1) both skills are still owed →
    // rnd < 0.5 → manual input; rnd ≥ 0.5 → choice. So the order is mixed, unlike
    // the old «all MC then all Type» phases.
    expect(pickExerciseType({ mcCorrect: 1, typeCorrect: 0 }, "new", r(0.2))).toBe("type_pt");
    expect(pickExerciseType({ mcCorrect: 1, typeCorrect: 0 }, "new", r(0.7))).toBe("mc_ru_pt");
  });

  it("keeps mixing on a learned 'due' review (leans manual)", () => {
    const learned = { mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET };
    expect(pickExerciseType(learned, "due", r(0.2))).toBe("type_pt");
  });
});

describe("shouldRequeue", () => {
  it("requeues a not-yet-learned word until the session cap", () => {
    expect(shouldRequeue({ mcCorrect: 0, typeCorrect: 0 }, 0)).toBe(true);
    expect(shouldRequeue({ mcCorrect: MC_TARGET, typeCorrect: 0 }, SESSION_REQUEUE_CAP - 1)).toBe(true);
    expect(shouldRequeue({ mcCorrect: MC_TARGET, typeCorrect: 0 }, SESSION_REQUEUE_CAP)).toBe(false);
  });

  it("never requeues a learned word (both skills met)", () => {
    expect(shouldRequeue({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET }, 0)).toBe(false);
  });
});

describe("requeuePosition (spreads requeues across the whole queue, not a 3-cycle)", () => {
  it("keeps at least REQUEUE_GAP cards before the word repeats", () => {
    expect(requeuePosition(0, 10, () => 0)).toBe(REQUEUE_GAP);
    expect(requeuePosition(2, 10, () => 0)).toBe(2 + REQUEUE_GAP);
  });

  it("can land anywhere up to the END of the queue (so all words get a turn)", () => {
    expect(requeuePosition(0, 10, () => 0.999)).toBe(10);
  });

  it("does NOT collapse to a fixed idx+GAP cycle — position varies with rnd", () => {
    const atStart = requeuePosition(0, 12, () => 0);
    const atMid = requeuePosition(0, 12, () => 0.5);
    const atEnd = requeuePosition(0, 12, () => 0.999);
    expect(atStart).toBe(REQUEUE_GAP);
    expect(atEnd).toBe(12);
    expect(atMid).toBeGreaterThan(atStart);
    expect(atMid).toBeLessThan(atEnd);
  });

  it("appends to the end when the word is near the back (no room for the gap)", () => {
    expect(requeuePosition(8, 10, () => 0.5)).toBe(10);
    expect(requeuePosition(9, 10, () => 0)).toBe(10);
  });
});
