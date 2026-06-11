import { describe, it, expect } from "vitest";
import {
  isWordLearned,
  pickExerciseType,
  remainingReps,
  MC_TARGET,
  TYPE_TARGET,
  TYPE_TAIL_MC_CHANCE,
} from "./learning";

// Последовательность значений rnd для веток с несколькими бросками.
const rndSeq = (...vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

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

  it("picks the manual input when only Type is still owed (вне relief-шанса)", () => {
    // Первый бросок ≥ TYPE_TAIL_MC_CHANCE → ввод, как и раньше.
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 0 }, "new", r(0.3))).toBe("type_pt");
    expect(pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 1 }, "new", r(0.9))).toBe("type_pt");
  });

  it("«хвост из вводов» изредка разбавляется выбором СВЕРХ порога (relief)", () => {
    // Узнавание набрано, остался ввод: бросок < TYPE_TAIL_MC_CHANCE → выбор,
    // направление — вторым броском.
    const tail = { mcCorrect: MC_TARGET, typeCorrect: 1 };
    expect(pickExerciseType(tail, "new", rndSeq(0.1, 0.2))).toBe("mc_pt_ru");
    expect(pickExerciseType(tail, "new", rndSeq(0.1, 0.8))).toBe("mc_ru_pt");
    // Ровно на пороге — уже ввод (строгое <).
    expect(pickExerciseType(tail, "new", r(TYPE_TAIL_MC_CHANCE))).toBe("type_pt");
  });

  it("relief не трогает обратный хвост: только MC в недоборе → всегда выбор", () => {
    expect(pickExerciseType({ mcCorrect: 1, typeCorrect: TYPE_TARGET }, "new", r(0.1))).toBe("mc_pt_ru");
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

  const learned = { mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET };

  it("keeps mixing on a learned 'due' review, leaning manual (type weighted)", () => {
    // due-пул [mc_pt_ru, mc_ru_pt, type_pt, type_pt]: ручной ввод вдвое вероятнее.
    expect(pickExerciseType(learned, "due", r(0.6))).toBe("type_pt");
    expect(pickExerciseType(learned, "due", r(0.99))).toBe("type_pt");
    expect(pickExerciseType(learned, "due", r(0.1))).toBe("mc_pt_ru");
  });

  it("mixes the three visual types uniformly on a learned 'review' word", () => {
    // review-пул из 3 (без audioOk): индексы 0/1/2.
    expect(pickExerciseType(learned, "review", r(0.1))).toBe("mc_pt_ru");
    expect(pickExerciseType(learned, "review", r(0.5))).toBe("mc_ru_pt");
    expect(pickExerciseType(learned, "review", r(0.9))).toBe("type_pt");
  });

  // ── П.1: аудирование — третья ступень (только выученные, только при audioOk) ──
  it("adds mc_audio_ru to the LEARNED pool only when audioOk is true", () => {
    // review-пул с аудио [mc_pt_ru, mc_ru_pt, type_pt, mc_audio_ru] — индекс 3.
    expect(pickExerciseType(learned, "review", r(0.9), true)).toBe("mc_audio_ru");
    // due-пул с аудио [mc_pt_ru, mc_ru_pt, type_pt, type_pt, mc_audio_ru] — индекс 4.
    expect(pickExerciseType(learned, "due", r(0.95), true)).toBe("mc_audio_ru");
    // Без audioOk (mute / нет TTS) тот же бросок даёт зрительный тип, не аудио.
    expect(pickExerciseType(learned, "review", r(0.9), false)).not.toBe("mc_audio_ru");
  });

  it("NEVER picks mc_audio_ru for a not-yet-learned word, even with audioOk", () => {
    // Недобранное узнавание/ввод — аудио недоступно ни при каком броске.
    expect(pickExerciseType({ mcCorrect: 1, typeCorrect: 0 }, "review", r(0.99), true)).not.toBe(
      "mc_audio_ru",
    );
    expect(pickExerciseType({ mcCorrect: 0, typeCorrect: 0 }, "new", r(0.99), true)).not.toBe(
      "mc_audio_ru",
    );
    // Хвост из вводов (узнавание добито, ввод — нет): relief даёт выбор, не аудио.
    expect(
      pickExerciseType({ mcCorrect: MC_TARGET, typeCorrect: 1 }, "review", r(0.99), true),
    ).not.toBe("mc_audio_ru");
  });
});

describe("remainingReps (остаток показов до «выучено» — питает interleaved-очередь)", () => {
  it("counts both skills' shortfalls for a fresh word (no card)", () => {
    expect(remainingReps(undefined)).toBe(MC_TARGET + TYPE_TARGET);
    expect(remainingReps({ mcCorrect: 0, typeCorrect: 0 })).toBe(MC_TARGET + TYPE_TARGET);
  });

  it("sums what is still owed across MC and Type", () => {
    expect(remainingReps({ mcCorrect: 1, typeCorrect: 0 })).toBe(MC_TARGET - 1 + TYPE_TARGET);
    expect(remainingReps({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET - 1 })).toBe(1);
  });

  it("is zero for a learned word and never negative on overshoot", () => {
    expect(remainingReps({ mcCorrect: MC_TARGET, typeCorrect: TYPE_TARGET })).toBe(0);
    expect(remainingReps({ mcCorrect: MC_TARGET + 2, typeCorrect: TYPE_TARGET + 5 })).toBe(0);
  });
});
