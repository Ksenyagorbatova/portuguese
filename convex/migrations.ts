import { internalMutation } from "./_generated/server";

// ─── Одноразовые миграции прогресса ──────────────────────────────────────────
// Прогресс завязан на натуральный ключ (userId, lessonKey, pt). Сид НИКОГДА не
// трогает таблицу progress (см. convex/seed.ts) — поэтому при ПЕРЕМЕЩЕНИИ слова
// между уроками (смена lessonKey в content.ts) накопленный прогресс по нему
// осиротеет: строка со старым lessonKey перестанет читаться, а слово всплывёт
// под новым ключом как новое. Такие переезды закрываем разовой миграцией здесь.
//
// Запуск (после деплоя нового контента):
//   локально:  npx convex run migrations:rebalanceNumbers
//   на проде:  npx convex run migrations:rebalanceNumbers --prod   (нужен CONVEX_DEPLOY_KEY)
// Идемпотентно: повторный прогон — no-op (переносить уже нечего).

// ─── rebalanceNumbers ────────────────────────────────────────────────────────
// Перебалансировка темы «Числа»: часть numbers_2 сжали до 11–20, а круглые
// десятки/сотню (30, 40, 50, 60, 100) вынесли в numbers_3 (30–1000). Слова
// setenta/oitenta/noventa/mil уже были в numbers_3 — их не трогаем. Переносим
// прогресс только по реально переехавшим pt.
const NUMBERS_MOVED_PTS = ["trinta", "quarenta", "cinquenta", "sessenta", "cem"];
const NUMBERS_FROM = "numbers_2";
const NUMBERS_TO = "numbers_3";

export const rebalanceNumbers = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Таблица progress мала (несколько пользователей × сотни слов) — полный скан
    // безопасен; индекс by_user_lesson_pt начинается с userId, поэтому отбор по
    // одному lessonKey всё равно шёл бы через все userId. Фильтруем в памяти.
    const all = await ctx.db.query("progress").collect();
    let moved = 0;
    let cleaned = 0;
    for (const p of all) {
      if (p.lessonKey !== NUMBERS_FROM || !NUMBERS_MOVED_PTS.includes(p.pt)) continue;
      // Уже есть строка под новым ключом? (повторный прогон, либо слово успели
      // переучить под numbers_3) — тогда старая numbers_2-строка лишняя, чистим,
      // чтобы не плодить осиротевший дубль. На первом прогоне такого не бывает
      // (numbers_3 этих pt раньше не содержал), так что это чистый перенос.
      const target = await ctx.db
        .query("progress")
        .withIndex("by_user_lesson_pt", (q) =>
          q.eq("userId", p.userId).eq("lessonKey", NUMBERS_TO).eq("pt", p.pt),
        )
        .unique();
      if (target) {
        await ctx.db.delete(p._id);
        cleaned++;
      } else {
        await ctx.db.patch(p._id, { lessonKey: NUMBERS_TO });
        moved++;
      }
    }
    return { moved, cleaned };
  },
});
