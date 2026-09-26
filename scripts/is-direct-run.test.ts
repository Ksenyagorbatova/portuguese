import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDirectRun } from "./is-direct-run.mjs";

// CLI-гейт скриптов (wt-seed, favicon-outline): через симлинк на скрипт или
// каталог запуск должен узнаваться так же, как по физическому пути.
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "direct-run-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("isDirectRun", () => {
  it("recognises the script by its physical path and through a symlink", () => {
    const script = path.join(dir, "script.mjs");
    writeFileSync(script, "");
    const link = path.join(dir, "link.mjs");
    symlinkSync(script, link);
    const url = pathToFileURL(script).href;
    expect(isDirectRun(url, script)).toBe(true);
    expect(isDirectRun(url, link)).toBe(true);
  });

  it("is false for another file, a missing path or no argv", () => {
    const script = path.join(dir, "script.mjs");
    const other = path.join(dir, "other.mjs");
    writeFileSync(script, "");
    writeFileSync(other, "");
    const url = pathToFileURL(script).href;
    expect(isDirectRun(url, other)).toBe(false);
    expect(isDirectRun(url, path.join(dir, "missing.mjs"))).toBe(false);
    expect(isDirectRun(url, "")).toBe(false);
  });
});
