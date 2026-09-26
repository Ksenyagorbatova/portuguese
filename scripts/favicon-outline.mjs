#!/usr/bin/env node
// «pt» фавикона (public/favicon.svg) — векторными контурами шрифта, а не <text>.
// SVG-<text> рисуется шрифтом, который есть у ЗРИТЕЛЯ: Bricolage Grotesque в
// системе обычно не установлен, и фавикон сайта, иконка и сплэш iOS
// (scripts/ios/render-assets.mjs рендерит тот же SVG Chromium'ом) получали
// глиф системного шрифта — разный на разных машинах. Контуры из самого шрифта
// дают один и тот же логотип везде, как в шапке приложения (Bricolage 800).
//
// Источник глифов — @fontsource/bricolage-grotesque (WOFF, начертание 800,
// latin): pinned devDependency, так что пересчёт детерминирован. Параметры
// надписи — ровно те, что были у <text>: font-size 21, letter-spacing -0.6,
// text-anchor middle (центр строки по x = 21), dominant-baseline central
// (середина em-бокса по hhea ascender/descender — на y = 21).
//
//   npm run favicon:outline   # переписывает public/favicon.svg, если изменился
// После — `npm run ios:assets` (иконка и сплэш iOS из нового фавикона).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// CJS-сборка opentype.js и в Node, и под Vitest (ESM-сборка без default-экспорта).
const opentype = createRequire(import.meta.url)("opentype.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FAVICON_PATH = path.join(root, "public/favicon.svg");
export const FONT_PATH = path.join(
  root,
  "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff",
);

const TEXT = "pt";
const FONT_SIZE = 21;
const LETTER_SPACING = -0.6;
const CENTER_X = 21;
const CENTER_Y = 21;

// Path data надписи в координатах viewBox 0 0 42 42 (2 знака после запятой).
export function glyphPathData(fontBuffer) {
  const buf = Buffer.from(fontBuffer);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const scale = FONT_SIZE / font.unitsPerEm;
  // Посимвольно (charToGlyph), без GSUB-подстановок: для «pt» лигатуры и
  // контекстные формы не нужны, а часть их lookup-типов opentype.js не умеет.
  const glyphs = [...TEXT].map((ch) => font.charToGlyph(ch));
  // Шаг после глифа i: advance + кернинг пары + letter-spacing (между буквами).
  const step = (i) =>
    glyphs[i].advanceWidth * scale +
    (i < glyphs.length - 1 ? font.getKerningValue(glyphs[i], glyphs[i + 1]) * scale + LETTER_SPACING : 0);
  const width = glyphs.reduce((sum, _g, i) => sum + step(i), 0);
  const baseline = CENTER_Y + ((font.ascender + font.descender) / 2) * scale;
  let x = CENTER_X - width / 2;
  let d = "";
  glyphs.forEach((glyph, i) => {
    d += glyph.getPath(x, baseline, FONT_SIZE).toPathData(2);
    x += step(i);
  });
  return d;
}

const TEXT_RE = /<text\b[^>]*>pt<\/text>/;
const PATH_RE = /<path id="pt"[^>]*\/>/;

// Фавикон с надписью контурами: заменяет <text>…pt</text> (исходный вид) или
// уже сгенерированный <path id="pt"> — повторный запуск идемпотентен.
export function outlineFavicon(svg, fontBuffer) {
  const glyphs = `<path id="pt" fill="#ffffff" d="${glyphPathData(fontBuffer)}"/>`;
  if (PATH_RE.test(svg)) return svg.replace(PATH_RE, glyphs);
  if (TEXT_RE.test(svg)) {
    return svg.replace(
      TEXT_RE,
      "<!-- «pt» — контуры Bricolage Grotesque 800 (npm run favicon:outline), а не SVG-текст:\n" +
        "       одинаково везде, без установленного шрифта (сайт, иконка и сплэш iOS). -->\n  " +
        glyphs,
    );
  }
  throw new Error('favicon-outline: в favicon.svg нет ни text «pt», ни <path id="pt">');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const before = readFileSync(FAVICON_PATH, "utf8");
  const after = outlineFavicon(before, readFileSync(FONT_PATH));
  if (after === before) {
    console.log("  ✔ public/favicon.svg уже актуален");
  } else {
    writeFileSync(FAVICON_PATH, after);
    console.log("  ✔ public/favicon.svg: «pt» — контурами Bricolage Grotesque 800");
  }
}
