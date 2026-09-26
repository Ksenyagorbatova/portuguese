#!/usr/bin/env node
// «pt» фавикона (public/favicon.svg) — векторными контурами шрифта, а не
// SVG-текстом. Текст рисуется шрифтом, который есть у ЗРИТЕЛЯ: Bricolage
// Grotesque в системе обычно не установлен, и фавикон сайта, иконка и сплэш iOS
// (scripts/ios/render-assets.mjs рендерит тот же SVG Chromium'ом) получали глиф
// системного шрифта — разный на разных машинах. Контуры из самого шрифта дают
// один и тот же логотип везде (Bricolage 800, как в шапке приложения).
//
// Источник глифов — @fontsource/bricolage-grotesque (WOFF, начертание 800,
// latin). Шрифт и opentype.js закреплены точными версиями (без ^) —
// перегенерация детерминирована, страж — favicon-outline.test.ts.
// Параметры надписи — как у бывшего SVG-текста:
// font-size 21, letter-spacing -0.6, центр строки по x = 21 (text-anchor
// middle), середина em-бокса по hhea ascender/descender на y = 21
// (dominant-baseline central). letter-spacing — только МЕЖДУ буквами (так
// центрирует WebKit; Chromium добавляет его и после последней буквы, сдвигая
// слово на ~0.3 единицы влево) — так «pt» ровнее по центру плитки. Кернинг не
// применяем: у пары p→t в Bricolage он нулевой, а GPOS-lookup'ы шрифта (тип 9,
// Extension) opentype.js 2.0 всё равно не читает.
//
//   npm run favicon:outline   # переписывает public/favicon.svg, если изменился
// После — `npm run ios:assets` (иконка и сплэш iOS из нового фавикона; страж
// рассинхрона — scripts/ios/assets-lock.test.ts).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDirectRun } from "./is-direct-run.mjs";

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
  const font = opentype.parse(fontBuffer);
  const scale = FONT_SIZE / font.unitsPerEm;
  // Посимвольно (charToGlyph), без GSUB-подстановок: для «pt» лигатуры и
  // контекстные формы не нужны, а часть их lookup-типов opentype.js не умеет.
  const glyphs = [...TEXT].map((ch) => font.charToGlyph(ch));
  const step = (i) => glyphs[i].advanceWidth * scale + (i < glyphs.length - 1 ? LETTER_SPACING : 0);
  const width = glyphs.reduce((sum, _glyph, i) => sum + step(i), 0);
  const baseline = CENTER_Y + ((font.ascender + font.descender) / 2) * scale;
  let x = CENTER_X - width / 2;
  let d = "";
  glyphs.forEach((glyph, i) => {
    d += glyph.getPath(x, baseline, FONT_SIZE).toPathData(2);
    x += step(i);
  });
  return d;
}

const PATH_RE = /<path id="pt"[^>]*\/>/;

// Фавикон с надписью, перегенерированной из шрифта (идемпотентно).
export function outlineFavicon(svg, fontBuffer) {
  if (!PATH_RE.test(svg)) {
    throw new Error('favicon-outline: в favicon.svg нет <path id="pt"> с надписью');
  }
  return svg.replace(PATH_RE, `<path id="pt" fill="#ffffff" d="${glyphPathData(fontBuffer)}"/>`);
}

if (isDirectRun(import.meta.url)) {
  const before = readFileSync(FAVICON_PATH, "utf8");
  const after = outlineFavicon(before, readFileSync(FONT_PATH));
  if (after === before) {
    console.log("  ✔ public/favicon.svg уже актуален");
  } else {
    writeFileSync(FAVICON_PATH, after);
    console.log("  ✔ public/favicon.svg: «pt» — контурами Bricolage Grotesque 800");
  }
}
