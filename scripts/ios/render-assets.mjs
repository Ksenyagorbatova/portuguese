#!/usr/bin/env node
// Иконка и сплэш iOS-оболочки из логотипа сайта (public/favicon.svg — флаг
// Португалии + «pt», единый источник дизайна). Пишет прямо в каталог ассетов
// Xcode (ios/App/App/Assets.xcassets):
//   • AppIcon.appiconset/AppIcon-512@2x.png — 1024², full-bleed (углы скругляет
//     iOS), RGB без альфа-канала: иконку с альфой App Store Connect отвергает;
//   • Splash.imageset/splash-2732x2732*.png — логотип по центру на фоне темы
//     (--page из src/index.css: светлая и тёмная — appearance dark), ×3 масштаба;
//   • PageBackground.colorset — тот же --page цветом каталога: фон WebView до
//     первой отрисовки (MainViewController в ios/App/App/SceneDelegate.swift).
// Рендер — Chromium из playwright-core (уже стоит для Playwright CT; при
// отсутствии: `npx playwright install chromium`). PNG перекодируется в RGB
// своим кодеком (./png.mjs) — без @capacitor/assets и sharp.
//
//   npm run ios:assets
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { decodePng, encodeRgbPng, toOpaqueRgb } from "./png.mjs";
import { pageBackgroundColorset, readPageColors } from "./page-colors.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const xcassets = path.join(root, "ios/App/App/Assets.xcassets");

// Фон страницы по темам — --page из src/index.css (единственный источник;
// рассинхрон с каталогом ассетов ловит scripts/ios/page-colors.test.ts).
const PAGE = readPageColors(path.join(root, "src/index.css"));
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
// Логотип на сплэше: ~100pt на iPhone 17 Pro после aspect-fill LaunchScreen.
const SPLASH_MARK = 320;

// favicon.svg с заданным размером; fullBleed — квадрат без скругления (иконку
// iOS маскирует сама). Замены проверяются: правка фавикона, ломающая их,
// должна уронить скрипт, а не тихо дать старый дизайн.
function markSvg(size, { fullBleed }) {
  let svg = readFileSync(path.join(root, "public/favicon.svg"), "utf8");
  const sized = svg.replace(/(<svg\b[^>]*?)\swidth="42"\sheight="42"/, `$1 width="${size}" height="${size}"`);
  if (sized === svg) throw new Error("render-assets: favicon.svg root width/height not found");
  svg = sized;
  if (fullBleed) {
    const square = svg.replace(/(<rect\b[^>]*?)\srx="[\d.]+"/, "$1");
    if (square === svg) throw new Error("render-assets: favicon.svg <rect rx> not found");
    svg = square;
  }
  return svg;
}

async function renderPng(page, { size, background, svg }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${background}">` +
      `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">` +
      `${svg}</div></body></html>`,
  );
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size, height: size } });
  const img = decodePng(shot);
  return encodeRgbPng(img.width, img.height, toOpaqueRgb(img));
}

function writeAsset(rel, data) {
  writeFileSync(path.join(xcassets, rel), data);
  console.log(`  ✔ ${rel} (${Math.round(data.length / 1024)} KB)`);
}

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });

    const icon = await renderPng(page, {
      size: ICON_SIZE,
      background: PAGE.light,
      svg: markSvg(ICON_SIZE, { fullBleed: true }),
    });
    writeAsset("AppIcon.appiconset/AppIcon-512@2x.png", icon);

    const mark = markSvg(SPLASH_MARK, { fullBleed: false });
    const images = [];
    for (const [theme, background] of Object.entries(PAGE)) {
      const png = await renderPng(page, { size: SPLASH_SIZE, background, svg: mark });
      const suffix = theme === "dark" ? "-dark" : "";
      // Три масштаба — копии одного 2732² (как в шаблоне Capacitor): картинку
      // растягивает aspect-fill LaunchScreen.storyboard.
      for (const [scale, n] of [["1x", "-2"], ["2x", "-1"], ["3x", ""]]) {
        const filename = `splash-2732x2732${suffix}${n}.png`;
        writeAsset(`Splash.imageset/${filename}`, png);
        images.push({
          idiom: "universal",
          filename,
          scale,
          ...(theme === "dark" ? { appearances: [{ appearance: "luminosity", value: "dark" }] } : {}),
        });
      }
    }
    writeAsset(
      "Splash.imageset/Contents.json",
      Buffer.from(JSON.stringify({ images, info: { version: 1, author: "xcode" } }, null, 2) + "\n"),
    );
    writeAsset("PageBackground.colorset/Contents.json", Buffer.from(pageBackgroundColorset(PAGE)));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
