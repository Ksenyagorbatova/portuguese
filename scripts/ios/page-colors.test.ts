import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageBackgroundColorset, pageColors, readPageColors } from "./page-colors.mjs";

const root = path.resolve(__dirname, "../..");
const colorset = path.join(root, "ios/App/App/Assets.xcassets/PageBackground.colorset/Contents.json");

describe("page colors for the iOS shell", () => {
  it("reads --page of both themes from src/index.css", () => {
    expect(readPageColors(path.join(root, "src/index.css"))).toEqual({
      light: "#f4f3ef",
      dark: "#16150f",
    });
  });

  it("takes the first block of each selector and fails loudly when --page is gone", () => {
    const css = ':root{--ink:#000;--page:#AABBCC}[data-theme="dark"]{--page:#010203}';
    expect(pageColors(css)).toEqual({ light: "#aabbcc", dark: "#010203" });
    expect(() => pageColors(":root{--page:#aabbcc}")).toThrow(/--page/);
  });

  it("encodes the colorset with a dark appearance", () => {
    const json = JSON.parse(pageBackgroundColorset({ light: "#f4f3ef", dark: "#16150f" }));
    expect(json.colors[0].color.components).toMatchObject({ red: "0xF4", green: "0xF3", blue: "0xEF" });
    expect(json.colors[1].appearances).toEqual([{ appearance: "luminosity", value: "dark" }]);
    expect(json.colors[1].color.components).toMatchObject({ red: "0x16", green: "0x15", blue: "0x0F" });
  });

  // Страж рассинхрона: правка --page без `npm run ios:assets` оставила бы
  // нативный фон (и сплэш) старого цвета — мелькание на холодном старте.
  it("the committed PageBackground.colorset matches src/index.css", () => {
    const expected = pageBackgroundColorset(readPageColors(path.join(root, "src/index.css")));
    expect(readFileSync(colorset, "utf8")).toBe(expected);
  });
});
