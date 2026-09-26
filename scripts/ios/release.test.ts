import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// scripts/ios/release.sh до сборки: разбор .env.ios-release.local (построчно,
// БЕЗ исполнения как shell) и валидация. Скрипт гоняется в копии репозитория
// во временном каталоге с --check — до vite/xcodebuild он не доходит.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "release-sh-"));
  mkdirSync(path.join(dir, "scripts/ios"), { recursive: true });
  copyFileSync(path.join(repo, "scripts/ios/release.sh"), path.join(dir, "scripts/ios/release.sh"));
  copyFileSync(path.join(repo, ".env.ios-release"), path.join(dir, ".env.ios-release"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeLocal(text: string): void {
  writeFileSync(path.join(dir, ".env.ios-release.local"), text);
}

// HOME = временный каталог: ~/… в значениях раскрывается туда.
function check() {
  const r = spawnSync("sh", [path.join(dir, "scripts/ios/release.sh"), "--check"], {
    encoding: "utf8",
    env: { ...process.env, HOME: dir },
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

function keyFile(rel: string): string {
  const file = path.join(dir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "-----BEGIN PRIVATE KEY-----\n");
  return file;
}

const VALID = [
  "IOS_TEAM_ID=G2AA82378K",
  "ASC_KEY_ID=ABCDEF1234",
  "ASC_ISSUER_ID=69a6de7e-0000-47e3-e053-5b8c7c11a4d1",
  "ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_ABCDEF1234.p8",
].join("\n");

describe("release.sh — configuration gate (exit 2 = «not set up yet»)", () => {
  it("without .env.ios-release.local prints the one-time handoff", () => {
    const { status, out } = check();
    expect(status).toBe(2);
    expect(out).toContain("Нет .env.ios-release.local");
    expect(out).toContain("TestFlight: что нужно один раз");
  });

  it("the example copied verbatim is parsed, not executed: it stops at the missing key file", () => {
    copyFileSync(path.join(repo, ".env.ios-release.example"), path.join(dir, ".env.ios-release.local"));
    const { status, out } = check();
    expect(status).toBe(2);
    // ~/ раскрыт в HOME — путь в сообщении настоящий.
    expect(out).toContain(`Нет файла ключа App Store Connect: ${dir}/.appstoreconnect/private_keys/`);
  });

  it("a placeholder that would break `source` (<you>) is just a missing file", () => {
    writeLocal(VALID.replace(/ASC_KEY_PATH=.*/, "ASC_KEY_PATH=/Users/<you>/AuthKey_ABCDEF1234.p8"));
    const { status, out } = check();
    expect(status).toBe(2);
    expect(out).toContain("Нет файла ключа App Store Connect: /Users/<you>/AuthKey_ABCDEF1234.p8");
  });

  it("lists every missing key", () => {
    writeLocal("IOS_TEAM_ID=G2AA82378K\n# ASC_KEY_ID=ABCDEF1234\n");
    const { status, out } = check();
    expect(status).toBe(2);
    expect(out).toContain("не заданы: ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH");
  });

  it.each(["g2aa82378k", "G2AA8237", "G2AA82378K; touch pwned", "G2AA/2378K"])(
    "rejects Team ID %j without running anything from it",
    (team) => {
      keyFile(".appstoreconnect/private_keys/AuthKey_ABCDEF1234.p8");
      writeLocal(VALID.replace("IOS_TEAM_ID=G2AA82378K", `IOS_TEAM_ID=${team}`));
      const { status, out } = check();
      expect(status).toBe(2);
      expect(out).toContain("IOS_TEAM_ID");
      expect(existsSync(path.join(dir, "pwned"))).toBe(false);
    },
  );

  it("rejects a malformed Key ID and Issuer ID", () => {
    keyFile(".appstoreconnect/private_keys/AuthKey_ABCDEF1234.p8");
    writeLocal(VALID.replace("ASC_KEY_ID=ABCDEF1234", "ASC_KEY_ID=abc"));
    expect(check()).toMatchObject({ status: 2, out: expect.stringContaining("ASC_KEY_ID") });
    writeLocal(VALID.replace(/ASC_ISSUER_ID=.*/, "ASC_ISSUER_ID=not a uuid"));
    expect(check()).toMatchObject({ status: 2, out: expect.stringContaining("ASC_ISSUER_ID") });
  });

  it("requires the committed prod URL to be a *.convex.cloud deployment", () => {
    keyFile(".appstoreconnect/private_keys/AuthKey_ABCDEF1234.p8");
    writeLocal(VALID);
    writeFileSync(path.join(dir, ".env.ios-release"), "VITE_CONVEX_URL=http://127.0.0.1:3210\n");
    expect(check()).toMatchObject({ status: 2, out: expect.stringContaining("прод-деплоем") });
    rmSync(path.join(dir, ".env.ios-release"));
    expect(check()).toMatchObject({ status: 2, out: expect.stringContaining("прод-деплоем") });
  });
});

describe("release.sh --check — a complete setup", () => {
  it("passes with quotes, spaces, CRLF and ~/ in values; takes the prod URL from .env.ios-release", () => {
    keyFile("My Keys/AuthKey_ABCDEF1234.p8");
    writeLocal(
      [
        'IOS_TEAM_ID="G2AA82378K"',
        "ASC_KEY_ID='ABCDEF1234'",
        "  ASC_ISSUER_ID = 69a6de7e-0000-47e3-e053-5b8c7c11a4d1",
        'ASC_KEY_PATH="~/My Keys/AuthKey_ABCDEF1234.p8"',
        // Устаревшая строка из старого образца — игнорируется с предупреждением.
        "VITE_CONVEX_URL=https://dev-deployment-123.convex.cloud",
      ].join("\r\n"),
    );
    const { status, out } = check();
    expect(out).toContain("VITE_CONVEX_URL в .env.ios-release.local игнорируется");
    expect(status).toBe(0);
    const prod = readFileSync(path.join(repo, ".env.ios-release"), "utf8").match(/^VITE_CONVEX_URL=(.+)$/m)?.[1];
    expect(prod).toMatch(/^https:\/\/[a-z0-9-]+\.convex\.cloud$/);
    expect(out).toContain(`✔ Настройка релиза в порядке: команда G2AA82378K, ключ ABCDEF1234, Convex ${prod}.`);
  });
});
