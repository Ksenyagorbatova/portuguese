import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const native = vi.hoisted(() => ({ hideNativeSplash: vi.fn() }));
vi.mock("../lib/native", () => native);

import { HideNativeSplash } from "./HideNativeSplash";

describe("HideNativeSplash", () => {
  it("hides the native splash once, after the first commit, and renders nothing", () => {
    const { container, rerender } = render(<HideNativeSplash />);
    expect(native.hideNativeSplash).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    // Перерисовки не повторяют скрытие (эффект с пустыми зависимостями).
    rerender(<HideNativeSplash />);
    expect(native.hideNativeSplash).toHaveBeenCalledTimes(1);
  });
});
