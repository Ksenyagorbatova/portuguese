import { beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({
  get: vi.fn<(o: { key: string }) => Promise<{ value: string | null }>>(),
  set: vi.fn<(o: { key: string; value: string }) => Promise<void>>(),
  remove: vi.fn<(o: { key: string }) => Promise<void>>(),
}));
vi.mock("@capacitor/preferences", () => ({ Preferences: prefs }));

const native = vi.hoisted(() => ({ isNative: vi.fn(() => false) }));
vi.mock("./native", () => native);

import { nativeTokenStorage, pickTokenStorage } from "./authStorage";

beforeEach(() => {
  vi.clearAllMocks();
  prefs.set.mockResolvedValue(undefined);
  prefs.remove.mockResolvedValue(undefined);
});

// Токены Convex Auth в iOS-оболочке живут в @capacitor/preferences (UserDefaults),
// а не в localStorage WKWebView, который WebKit вправе чистить.
describe("nativeTokenStorage", () => {
  it("getItem returns the stored value", async () => {
    prefs.get.mockResolvedValue({ value: "jwt-token" });
    await expect(nativeTokenStorage.getItem("__convexAuthJWT_x")).resolves.toBe("jwt-token");
    expect(prefs.get).toHaveBeenCalledWith({ key: "__convexAuthJWT_x" });
  });

  it("getItem maps a missing key to null (the TokenStorage contract)", async () => {
    prefs.get.mockResolvedValue({ value: null });
    await expect(nativeTokenStorage.getItem("absent")).resolves.toBeNull();
    // Веб-реализация плагина может вернуть undefined — тоже null.
    prefs.get.mockResolvedValue({ value: undefined as unknown as null });
    await expect(nativeTokenStorage.getItem("absent")).resolves.toBeNull();
  });

  it("setItem and removeItem delegate to Preferences", async () => {
    await nativeTokenStorage.setItem("k", "v");
    await nativeTokenStorage.removeItem("k");
    expect(prefs.set).toHaveBeenCalledWith({ key: "k", value: "v" });
    expect(prefs.remove).toHaveBeenCalledWith({ key: "k" });
  });
});

describe("pickTokenStorage", () => {
  it("web: undefined → ConvexAuthProvider keeps its default localStorage", () => {
    native.isNative.mockReturnValue(false);
    expect(pickTokenStorage()).toBeUndefined();
  });

  it("native shell: the Preferences adapter", () => {
    native.isNative.mockReturnValue(true);
    expect(pickTokenStorage()).toBe(nativeTokenStorage);
  });
});
