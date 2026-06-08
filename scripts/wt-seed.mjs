import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { isLinkedWorktree } from "./worktree.mjs";

// Поднять Convex Auth env-ключи на изолированном ЛОКАЛЬНОМ деплое и засеять
// контент + рабочий dev-аккаунт. ТОЛЬКО ДЛЯ WORKTREE — см. CLAUDE.md «Worktree».
// Используется и как шаг `npm run wt:setup`, и отдельно как `npm run wt:seed`
// (идемпотентно, безопасно перезапускать).

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..");
const convexBinPath = join(rootDir, "node_modules", ".bin", "convex");

// Важно лишь для OAuth / magic-link редиректов, которых это приложение не
// использует, так что для email+password входа значение неважно. Порт dev в
// worktree смещён, но localhost:5173 — нормальная заглушка в любом случае.
const SITE_URL = "http://localhost:5173";

// Имена уже выставленных на выбранном деплое env-переменных. Захватываем stdout
// (не inherit), чтобы значения секретов не печатались — нужны только имена.
// null, если список прочитать не удалось (напр. локального деплоя ещё нет).
function convexEnvNames({ root, convexBin }) {
  const r = spawnSync(convexBin, ["env", "list"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return null;
  const names = new Set();
  for (const line of (r.stdout || "").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) names.add(match[1]);
  }
  return names;
}

// Жёсткий предохранитель: выбранный Convex-деплой — локальный? CLI пишет
// CONVEX_DEPLOYMENT в .env.local как `<type>:<name>`, так что локальный (или
// анонимный) деплой имеет префикс `local:` / `anonymous:`; облако — `dev:` /
// `prod:`. wt-setup сначала копирует (облачный) .env.local основного checkout, и
// только `deployment select local` его переписывает — а этот шаг best-effort.
// Отказ провижинить/сеять, пока это не локальный деплой, гарантирует, что
// неудавшийся select не перенаправит ключи + сид на облачный деплой.
export function selectsLocalDeployment(root) {
  let content;
  try {
    content = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return false;
  }
  const match = content.match(/^\s*CONVEX_DEPLOYMENT\s*=\s*(.+)$/m);
  if (!match) return false;
  let value = match[1].trim();
  const inlineComment = value.indexOf(" #");
  if (inlineComment !== -1) value = value.slice(0, inlineComment).trim();
  value = value.replace(/^["']|["']$/g, "");
  return value.startsWith("local:") || value.startsWith("anonymous:");
}

// Сгенерировать пару ключей RS256 ровно в той форме, что ждёт рантайм Convex
// Auth: JWT_PRIVATE_KEY — приватный ключ PKCS8 с переводами строк, сжатыми в
// пробелы (читается обратно через importPKCS8), JWKS — публичный ключ как набор JWK.
async function generateAuthKeys() {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  return { JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "), JWKS: jwks };
}

// `convex env set NAME -- VALUE`: `--` останавливает разбор опций, чтобы значения,
// начинающиеся с `-` (заголовок PKCS8), не читались как флаги. Аргументы
// передаются массивом (без шелла), так что пробелы/переводы строк сохраняются.
function setEnv({ root, convexBin }, name, value) {
  const r = spawnSync(convexBin, ["env", "set", name, "--", value], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });
  return r.status === 0;
}

/**
 * Идемпотентно поднять локальный деплой: выставить три Convex Auth env-ключа
 * (JWT_PRIVATE_KEY, JWKS, SITE_URL) плюс флаг-предохранитель ALLOW_DEV_SEED,
 * затем задеплоить функции и прогнать (идемпотентный) seed:seedLocal. Возвращает
 * код выхода процесса (0 = успех).
 *
 * JWT_PRIVATE_KEY/JWKS генерируются, только когда отсутствуют — перезапуск
 * никогда не ротирует ключ (что инвалидировало бы существующие сессии).
 */
export async function provisionLocalAuthAndSeed({ root = rootDir, convexBin = convexBinPath } = {}) {
  // Жёсткий предохранитель: выходим до любых действий с деплоем, если .env.local
  // не выбирает локальный. Защита от того, что неудавшийся `deployment select
  // local` оставил .env.local указывающим на скопированный облачный деплой.
  if (!selectsLocalDeployment(root)) {
    console.error(
      "✗ Отказ провижинить/сеять: выбранный Convex-деплой не локальный.\n" +
        "  CONVEX_DEPLOYMENT в .env.local должен быть `local:`/`anonymous:` деплоем;\n" +
        "  убедись, что `convex deployment select local` прошёл (перезапусти `npm run wt:setup`).",
    );
    return 1;
  }

  console.log("\n— Провижиню Convex Auth env на локальном деплое");
  const have = convexEnvNames({ root, convexBin });
  if (have === null) {
    console.warn(
      "⚠ Не удалось прочитать env локального деплоя.\n" +
        "  Убедись, что локальный деплой существует (запусти `npm run wt:setup`).",
    );
    return 1;
  }

  const toSet = [];
  // JWT_PRIVATE_KEY + JWKS трактуем как одно целое: они должны быть согласованной
  // парой, поэтому (пере)генерируем обе, если нет ОБЕИХ. Гейт только по
  // JWT_PRIVATE_KEY оставил бы JWKS навсегда невыставленным, если прошлый запуск
  // выставил ключ, но упал до JWKS — auth остался бы сломан без восстановления.
  if (!have.has("JWT_PRIVATE_KEY") || !have.has("JWKS")) {
    const { JWT_PRIVATE_KEY, JWKS } = await generateAuthKeys();
    toSet.push(["JWT_PRIVATE_KEY", JWT_PRIVATE_KEY], ["JWKS", JWKS]);
  } else {
    console.log("  • JWT_PRIVATE_KEY + JWKS уже выставлены — оставляю (регенерация сбросила бы сессии)");
  }
  if (!have.has("SITE_URL")) toSet.push(["SITE_URL", SITE_URL]);
  // Помечает деплой как локальный, чтобы seed:seedLocal запустился (на облачных
  // dev/prod этого флага никогда нет — см. convex/seed.ts).
  if (!have.has("ALLOW_DEV_SEED")) toSet.push(["ALLOW_DEV_SEED", "1"]);

  for (const [name, value] of toSet) {
    console.log(`  • set ${name}`);
    if (!setEnv({ root, convexBin }, name, value)) {
      console.error(`✗ Не удалось выставить ${name} на локальном деплое.`);
      return 1;
    }
  }
  if (toSet.length === 0) console.log("  • все auth env-ключи уже на месте");

  console.log("\n— Деплою функции + сею контент и dev-аккаунт (dev@example.com)");
  const seed = spawnSync(convexBin, ["dev", "--once", "--run", "seed:seedLocal"], {
    cwd: root,
    stdio: "inherit",
  });
  if (seed.status !== 0) {
    console.warn("⚠ Сид упал. Перезапусти в любой момент: `npm run wt:seed`.");
    return seed.status ?? 1;
  }

  console.log("\n✅ Локальный деплой поднят и засеян (контент + dev-аккаунт).");
  console.log("   Вход:  dev@example.com  /  12345678q");
  return 0;
}

// CLI-вход (`npm run wt:seed`): гейт по worktree, как у `npx convex`.
function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  if (!isLinkedWorktree()) {
    console.log(
      "ℹ Не git-worktree — пропускаю локальный сид.\n" +
        "  Основной checkout использует облачный деплой (auth-env ставится вручную; его НЕ сеют).",
    );
    process.exit(0);
  }
  if (!existsSync(join(rootDir, ".env.local"))) {
    console.error(
      "✗ Этот worktree ещё не настроен — сначала `npm run wt:setup`\n" +
        "  (ставит зависимости и поднимает изолированный локальный Convex-деплой).",
    );
    process.exit(1);
  }
  process.exit(await provisionLocalAuthAndSeed());
}
