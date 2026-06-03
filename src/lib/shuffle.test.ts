import { describe, it, expect, vi, afterEach } from "vitest";
import { shuffle } from "./shuffle";

describe("shuffle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a new array and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves length and the multiset of elements", () => {
    const input = ["a", "b", "c", "d"];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it("is deterministic for a fixed Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // random()===0 ⇒ j = floor(0*(i+1)) = 0 at each step ⇒ known permutation.
    expect(shuffle([1, 2, 3])).toEqual([2, 3, 1]);
  });
});
