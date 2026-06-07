import { describe, it, expect } from "vitest";
import {
  wordStage,
  pickExerciseType,
  shouldRequeue,
  MC_TARGET,
  TYPE_TARGET,
  SESSION_REQUEUE_CAP,
} from "./learning";

describe("wordStage", () => {
  it("defaults to 'choosing' with no card or zero counters", () => {
    expect(wordStage(undefined)).toBe("choosing");
    expect(wordStage({ mcCorrect: 0, typeCorrect: 0 })).toBe("choosing");
    expect(wordStage({ mcCorrect: MC_TARGET - 1, typeCorrect: 0 })).toBe("choosing");
  });

  it("moves to 'typing' once MC_TARGET correct choices are reached", () => {
    expect(wordStage({ mcCorrect: MC_TARGET, typeCorrect: 0 })).toBe("typing");
    expect(wordStage({ mcCorrect: MC_TARGET + 2, typeCorrect: TYPE_TARGET - 1 })).toBe("typing");
  });

  it("is 'learned' only at TYPE_TARGET correct manual inputs", () => {
    expect(wordStage({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET })).toBe("learned");
  });
});

describe("pickExerciseType", () => {
  const r = (v: number) => () => v;

  it("choosing stage → multiple-choice (direction by rnd)", () => {
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: 0 }, "new", r(0.2))).toBe("mc_pt_ru");
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: 0 }, "new", r(0.7))).toBe("mc_ru_pt");
  });

  it("typing stage → always manual input", () => {
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 0 }, "new", r(0.1))).toBe("type_pt");
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 1 }, "new", r(0.9))).toBe("type_pt");
  });

  it("learned 'due' review leans toward manual input", () => {
    const learned = { mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET };
    expect(pickExerciseType(learned, "due", r(0.2))).toBe("type_pt");
  });
});

describe("shouldRequeue", () => {
  it("requeues not-yet-learned words until the session cap", () => {
    expect(shouldRequeue("choosing", 0)).toBe(true);
    expect(shouldRequeue("typing", SESSION_REQUEUE_CAP - 1)).toBe(true);
    expect(shouldRequeue("typing", SESSION_REQUEUE_CAP)).toBe(false);
  });

  it("never requeues a learned word", () => {
    expect(shouldRequeue("learned", 0)).toBe(false);
  });
});
