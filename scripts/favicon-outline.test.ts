import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FAVICON_PATH, FONT_PATH, glyphPathData, outlineFavicon } from "./favicon-outline.mjs";

// «pt» фавикона — контуры шрифта, а не <text>: иначе сайт, иконка и сплэш iOS
// (render-assets.mjs рендерит тот же SVG) рисуют глиф ШРИФТА ЗРИТЕЛЯ/МАШИНЫ.
const favicon = readFileSync(FAVICON_PATH, "utf8");
const font = readFileSync(FONT_PATH);

// Габариты по опорным точкам path data (M/L/C/Q — пары чисел x y).
function bbox(d: string) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("favicon: «pt» as font outlines", () => {
  it("the committed favicon carries no <text> — rendering does not depend on installed fonts", () => {
    expect(favicon).not.toMatch(/<text\b/);
    expect(favicon).toMatch(/<path id="pt" fill="#ffffff" d="M/);
  });

  // Страж рассинхрона: перегенерация из pinned-шрифта даёт ровно закоммиченный
  // файл (правка параметров/шрифта без `npm run favicon:outline` — красный тест).
  it("regenerating from the pinned font reproduces the committed favicon", () => {
    expect(outlineFavicon(favicon, font)).toBe(favicon);
  });

  it("the glyphs are centred horizontally and fit inside the 42×42 tile", () => {
    const { minX, maxX, minY, maxY } = bbox(glyphPathData(font));
    expect(minX).toBeGreaterThan(4);
    expect(maxX).toBeLessThan(38);
    expect(Math.abs(minX - (42 - maxX))).toBeLessThan(1.5);
    expect(minY).toBeGreaterThan(4);
    expect(maxY).toBeLessThan(38);
  });

  it("fails loudly when the favicon has no outline to regenerate", () => {
    expect(() => outlineFavicon("<svg/>", font)).toThrow(/favicon-outline/);
  });

  // Логотип выводится из этих двух пакетов: версии — точные (не ^), чтобы
  // обновление шрифта или парсера было осознанным, а не попутным.
  it("pins the font and the outliner to exact versions", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
    for (const dep of ["@fontsource/bricolage-grotesque", "opentype.js"]) {
      expect(pkg.devDependencies[dep], dep).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
