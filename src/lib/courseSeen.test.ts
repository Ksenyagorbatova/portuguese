import { afterEach, describe, expect, it, vi } from "vitest";
import { COURSE_SEEN_KEY, forgetCourseSeen } from "./courseSeen";

describe("forgetCourseSeen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("removes the course-finale flag", () => {
    localStorage.setItem(COURSE_SEEN_KEY, "1");
    forgetCourseSeen();
    expect(localStorage.getItem(COURSE_SEEN_KEY)).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => forgetCourseSeen()).not.toThrow();
  });
});
