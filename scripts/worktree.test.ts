import { isBuiltin } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { portOffset } from "./worktree.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

describe("worktree.portOffset", () => {
  it("детерминирован для одного cwd и лежит в [1, 900)", () => {
    const a = portOffset();
    const b = portOffset();
    expect(a).toBe(b); // тот же cwd → тот же офсет (стабильная полоса портов)
    expect(Number.isInteger(a)).toBe(true);
    // НИКОГДА 0 — иначе worktree сел бы на базовый порт основного checkout (5173/3100).
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThan(900);
  });
});

// wt-setup.mjs запускается ПЕРВЫМ в свежем worktree (см. CLAUDE.md «Worktree»):
// node_modules ещё нет, его создаёт шаг 1. Поэтому статический граф импортов
// wt-setup.mjs не должен тянуть сторонние пакеты — ESM резолвит статические
// импорты модуля жадно при загрузке, так что один `import … from "jose"` в
// графе уронил бы bootstrap с ERR_MODULE_NOT_FOUND до установки. Сид
// (`wt-seed.mjs`, зависит от jose) подключается ЛЕНИВО. Тесты пинят инвариант.

// Спецификаторы статических импортов (`import … from "x"` / `import "x"`).
// Динамический `import("x")` НЕ матчится — это и есть лазейка для модулей с
// зависимостями.
function staticImportSpecifiers(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(/^\s*import\b[\s\S]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1]);
  for (const m of source.matchAll(/^\s*import\s*["']([^"']+)["']\s*;?\s*$/gm)) specs.push(m[1]);
  return specs;
}

// Все сторонние (не builtin, не относительные) пакеты, достижимые из `entry`
// через статический граф. Относительные .mjs/.js импорты прослеживаются; builtins
// (`node:*`) игнорируются.
function transitiveThirdPartyImports(entry: string, seen = new Set<string>()): string[] {
  const abs = resolve(entry);
  if (seen.has(abs)) return [];
  seen.add(abs);
  const out: string[] = [];
  for (const spec of staticImportSpecifiers(readFileSync(abs, "utf8"))) {
    if (spec.startsWith("node:") || isBuiltin(spec)) continue;
    if (spec.startsWith(".")) out.push(...transitiveThirdPartyImports(join(dirname(abs), spec), seen));
    else out.push(spec);
  }
  return out;
}

describe("wt-setup.mjs остаётся import-clean до установки зависимостей", () => {
  it("не тянет сторонние пакеты через статический граф импортов", () => {
    expect(transitiveThirdPartyImports(join(scriptsDir, "wt-setup.mjs"))).toEqual([]);
  });

  it("подключает сид лениво, только после шага установки зависимостей", () => {
    const src = readFileSync(join(scriptsDir, "wt-setup.mjs"), "utf8");
    const dynIdx = src.search(/await import\(\s*["']\.\/wt-seed\.mjs["']\s*\)/);
    expect(dynIdx).toBeGreaterThan(-1);
    const installIdx = src.indexOf("Installing dependencies");
    expect(installIdx).toBeGreaterThan(-1);
    expect(dynIdx).toBeGreaterThan(installIdx);
    expect(staticImportSpecifiers(src)).not.toContain("./wt-seed.mjs");
  });
});
