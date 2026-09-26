import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAVICON_PATH, FONT_PATH, glyphPathData, outlineFavicon } from "./favicon-outline.mjs";

// «pt» фавикона — контуры шрифта, а не <text>: иначе сайт, иконка и сплэш iOS
// (render-assets.mjs рендерит тот же SVG) рисуют глиф ШРИФТА ЗРИТЕЛЯ/МАШИНЫ.
const favicon = readFileSync(FAVICON_PATH, "utf8");
const font = readFileSync(FONT_PATH);

// Исходный вид фавикона с <text> — как был до перевода в контуры.
const LEGACY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" width="42" height="42">
  <rect width="42" height="42" rx="13" fill="url(#flag)"/>
  <text x="21" y="21" fill="#ffffff"
        font-family="'Bricolage Grotesque', system-ui, sans-serif"
        font-weight="800" font-size="21" letter-spacing="-0.6"
        text-anchor="middle" dominant-baseline="central">pt</text>
</svg>`;

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

  it("replaces the legacy <text> and keeps the rest of the SVG intact", () => {
    const out = outlineFavicon(LEGACY, font);
    expect(out).not.toMatch(/<text\b/);
    expect(out).toContain('<rect width="42" height="42" rx="13" fill="url(#flag)"/>');
    expect(out).toContain(`<path id="pt" fill="#ffffff" d="${glyphPathData(font)}"/>`);
  });

  it("the glyphs are centred horizontally and fit inside the 42×42 tile", () => {
    const { minX, maxX, minY, maxY } = bbox(glyphPathData(font));
    expect(minX).toBeGreaterThan(4);
    expect(maxX).toBeLessThan(38);
    expect(Math.abs(minX - (42 - maxX))).toBeLessThan(1.5);
    expect(minY).toBeGreaterThan(4);
    expect(maxY).toBeLessThan(38);
  });

  it("fails loudly when the favicon has neither the text nor the outline", () => {
    expect(() => outlineFavicon("<svg/>", font)).toThrow(/favicon-outline/);
  });
});
