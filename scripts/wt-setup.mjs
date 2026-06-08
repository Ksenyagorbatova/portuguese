import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isLinkedWorktree } from "./worktree.mjs";
// NB: `./wt-seed.mjs` подключается ЛЕНИВО (динамический import ниже), НЕ здесь.
// Он зависит от `jose`, а вся задача этого скрипта — создать node_modules:
// статический импорт заставил бы ESM резолвить `jose` при загрузке файла и
// упал бы ERR_MODULE_NOT_FOUND на свежем worktree до шага 1 (установки).
// `./worktree.mjs` импортировать статически безопасно — только node-builtins.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const convexBin = join(root, "node_modules", ".bin", "convex");

function run(label, cmd, args, { optional = false } = {}) {
  console.log(`\n— ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root });
  if (r.status !== 0 && !optional) process.exit(r.status ?? 1);
  return r.status ?? 1;
}

if (!isLinkedWorktree()) {
  console.log(
    "ℹ Не git-worktree — настраивать нечего.\n" +
      "  Основной checkout уже использует облачный dev-деплой и фиксированные порты.\n" +
      "  `npm run wt:setup` нужен только внутри `git worktree add` чекаутов.",
  );
  process.exit(0);
}

console.log("🌿 Готовлю git-worktree (изолированно от основного checkout)…");

// 1) Зависимости (свой node_modules для этого worktree).
run("Installing dependencies", "npm", ["ci"]);

// 2) Привязать проект Convex, скопировав .env.local основного checkout — даёт
//    линковку проекта (чтобы локальный деплой создавался без интерактива) и
//    рабочий VITE_CONVEX_URL из коробки.
try {
  const list = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" });
  const mainPath = list
    .split("\n")
    .find((l) => l.startsWith("worktree "))
    ?.slice("worktree ".length)
    .trim();
  const mainEnv = mainPath ? join(mainPath, ".env.local") : null;
  const ourEnv = join(root, ".env.local");
  if (mainEnv && existsSync(mainEnv) && !existsSync(ourEnv)) {
    copyFileSync(mainEnv, ourEnv);
    console.log(`\n— Привязал Convex (скопировал .env.local из ${mainPath})`);
  }
} catch (e) {
  console.warn(`⚠ Не удалось скопировать .env.local из основного checkout: ${e.message}`);
}

// 3) Создать + выбрать изолированный локальный Convex-деплой для этого worktree.
//    `create` почти no-op, если уже есть; `select` указывает .env.local на
//    локальный деплой (свои функции/схема/данные).
run("Creating local Convex deployment", convexBin, ["deployment", "create", "local"], {
  optional: true,
});
run("Selecting local Convex deployment", convexBin, ["deployment", "select", "local"], {
  optional: true,
});

// 4) Поднять Convex Auth env на локальном деплое + засеять контент и рабочий
//    dev-аккаунт (dev@example.com / 12345678q), чтобы свежий worktree сразу был
//    кликабелен — регистрация выключена, так что без сида залогиниться нечем.
//    Идемпотентно и строго локально (см. scripts/wt-seed.mjs + convex/seed.ts;
//    отдельно — `npm run wt:seed`). Подключается здесь (после установки), чтобы
//    его зависимость `jose` уже существовала. Обёрнуто: если ленивый импорт или
//    сид бросит — падаем в баннер «НЕ засеян», а не в сырой stack trace
//    (worktree всё равно рабочий: зависимости + деплой на месте).
let seedStatus;
try {
  const { provisionLocalAuthAndSeed } = await import("./wt-seed.mjs");
  seedStatus = await provisionLocalAuthAndSeed({ root, convexBin });
} catch (e) {
  console.warn(`⚠ Провижининг auth / сид упал: ${e.message}`);
  seedStatus = 1;
}

const seededLines =
  seedStatus === 0
    ? "   • Dev-логин:   dev@example.com / 12345678q  (засеян; пере-сид: npm run wt:seed)\n" +
      "   • Контент:     залит — темы/слова готовы к тренировке"
    : "   • Dev-логин:   НЕ засеян — провижининг не завершился; повтори: npm run wt:seed\n" +
      "   • Контент:     НЕ залит — тот же повтор: npm run wt:seed";

console.log(`
✅ Worktree готов.
   • Web dev:     npm run dev       (авто-свободный порт — не конфликтует с другими worktree)
   • Backend:     npx convex dev    (изолированный локальный деплой — свои данные/схема)
${seededLines}
   • Тесты:       npm test · npm run test:ct
`);
