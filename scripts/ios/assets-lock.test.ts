import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Иконка и сплэш iOS (PNG в Assets.xcassets) рендерятся из public/favicon.svg
// командой `npm run ios:assets`, которая записывает отпечаток исходника в
// scripts/ios/assets.lock.json. Правка фавикона (флаг, скругление, контуры «pt»)
// без перерисовки — красный тест, а не устаревшая иконка в TestFlight.
const root = path.resolve(__dirname, "../..");

describe("iOS icon/splash are rendered from the current favicon", () => {
  it("assets.lock.json matches the sha256 of public/favicon.svg", () => {
    const lock = JSON.parse(readFileSync(path.join(root, "scripts/ios/assets.lock.json"), "utf8"));
    const actual = createHash("sha256")
      .update(readFileSync(path.join(root, "public/favicon.svg")))
      .digest("hex");
    expect(lock["public/favicon.svg"]).toBe(actual);
  });
});
