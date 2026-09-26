// Фон страницы по темам для нативной части iOS-оболочки. Источник правды —
// --page в src/index.css (:root — светлая тема, [data-theme="dark"] — тёмная);
// отсюда его берут сплэш (render-assets.mjs) и цвет PageBackground в каталоге
// ассетов (фон WebView до первой отрисовки — MainViewController).
import { readFileSync } from "node:fs";

// Значение --page внутри первого блока `selector { … }` (блоки без вложенных
// скобок — объявления кастомных свойств).
function pageIn(css, selector) {
  const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  return block && /--page:\s*(#[0-9a-fA-F]{6})\b/.exec(block)?.[1]?.toLowerCase();
}

export function pageColors(css) {
  const light = pageIn(css, ":root");
  const dark = pageIn(css, '\\[data-theme="dark"\\]');
  if (!light || !dark) throw new Error("page-colors: --page (#rrggbb) not found in :root / [data-theme=dark]");
  return { light, dark };
}

export function readPageColors(indexCssPath) {
  return pageColors(readFileSync(indexCssPath, "utf8"));
}

function srgb(hex) {
  const [red, green, blue] = [1, 3, 5].map((i) => `0x${hex.slice(i, i + 2).toUpperCase()}`);
  return { "color-space": "srgb", components: { red, green, blue, alpha: "1.000" } };
}

// Contents.json для PageBackground.colorset: светлый — «any», тёмный — dark.
export function pageBackgroundColorset({ light, dark }) {
  const colors = [
    { idiom: "universal", color: srgb(light) },
    {
      idiom: "universal",
      appearances: [{ appearance: "luminosity", value: "dark" }],
      color: srgb(dark),
    },
  ];
  return JSON.stringify({ colors, info: { version: 1, author: "xcode" } }, null, 2) + "\n";
}
