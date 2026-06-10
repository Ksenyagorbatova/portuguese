import { describe, expect, it } from "vitest";
import { CROSS_SENTENCES, TOPICS } from "./content";

// ─────────────────────────────────────────────────────────────────────────────
// Инварианты целостности контента — чистые проверки поверх content.ts,
// без convex-test (данные валидируются до того, как уйдут в сид).
//
// Ловят рассинхроны, которые ломаются МОЛЧА:
//   • строка из theory.sections[].words не существует среди слов урока →
//     Theory.tsx тихо не рендерит карточку (фильтр lesson.words.filter(...));
//   • required кросс-предложения не совпал ни с одним word.pt → предложение
//     никогда не всплывает (гейт сверяет по множеству выученных pt);
//   • исчезновение/переименование пары (lessonKey, pt) → осиротевший прогресс.
// ─────────────────────────────────────────────────────────────────────────────

// Все уроки курса (порядок итерации = порядок отображения, см. convex/seed.ts).
const lessons = Object.values(TOPICS).flatMap((topic) => topic.lessons);

// Все пары (lessonKey, pt) — натуральные ключи, на которые завязан прогресс.
const allPairs = lessons.flatMap((lesson) =>
  lesson.words.map((w) => ({ lessonKey: lesson.id, pt: w.pt })),
);

// Все существующие word.pt курса: required кросс-предложений сверяется с
// множеством выученных pt БЕЗ привязки к уроку (см. src/lib/queue.ts).
const allPts = new Set(allPairs.map((p) => p.pt));

// sentenceKey выводится из индекса массива ровно как в convex/seed.ts.
const sentenceKey = (i: number) => `cs_${String(i + 1).padStart(4, "0")}`;

const findDuplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  }
  return [...dups];
};

describe("целостность контента", () => {
  // ГЛАВНЫЙ ИНВАРИАНТ. Прогресс пользователя хранится под натуральным ключом
  // (lessonKey, pt) — см. convex/progress.ts (wKey = `${lessonKey}||${pt}`).
  // Исчезновение или переименование существующей пары МОЛЧА осиротит весь
  // накопленный по ней прогресс на проде (сид не удаляет и не переносит строки).
  //
  // Снапшот фиксирует полный отсортированный список пар. Если тест упал:
  //   • в диффе ТОЛЬКО добавленные строки (новые слова/уроки) — ок,
  //     обнови снапшот: `npx vitest run --project backend -u`;
  //   • есть УДАЛЁННЫЕ или ИЗМЕНЁННЫЕ строки — СТОП: так нельзя, правка
  //     существующих ключей идёт только через миграцию прогресса
  //     (см. .claude/skills/content-authoring/SKILL.md).
  // Обновление снапшота — осознанное действие после этой проверки, не рефлекс.
  it("golden-снапшот: полный список пар (lessonKey, pt) стабилен", () => {
    const pairs = allPairs.map(({ lessonKey, pt }) => `${lessonKey}||${pt}`).sort();
    expect(pairs).toMatchSnapshot();
  });

  it("каждый required[] кросс-предложения существует как word.pt какого-то урока", () => {
    const missing = CROSS_SENTENCES.flatMap((s, i) =>
      s.required
        .filter((r) => !allPts.has(r))
        .map((r) => `${sentenceKey(i)} «${s.answer}»: required "${r}" не существует как word.pt`),
    );
    expect(missing).toEqual([]);
  });

  it("каждая строка theory.sections[].words существует среди words[].pt своего урока", () => {
    const missing = lessons.flatMap((lesson) => {
      const own = new Set(lesson.words.map((w) => w.pt));
      return lesson.theory.sections.flatMap((sec) =>
        sec.words
          .filter((w) => !own.has(w))
          .map((w) => `${lesson.id} / «${sec.heading}»: "${w}" нет среди слов урока`),
      );
    });
    expect(missing).toEqual([]);
  });

  it("answer кросс-предложения равен words.join(' ')", () => {
    const mismatches = CROSS_SENTENCES.filter((s) => s.words.join(" ") !== s.answer).map(
      (s) => `«${s.answer}» ≠ words.join(' ') = «${s.words.join(" ")}»`,
    );
    expect(mismatches).toEqual([]);
  });

  it("(lessonKey, pt) уникальна внутри урока", () => {
    const dups = lessons.flatMap((lesson) =>
      findDuplicates(lesson.words.map((w) => w.pt)).map((pt) => `${lesson.id}: дубль pt "${pt}"`),
    );
    expect(dups).toEqual([]);
  });

  it("lessonKey уникален глобально", () => {
    expect(findDuplicates(lessons.map((l) => l.id))).toEqual([]);
  });

  // topicKey — ключи Record, дубль невозможен структурно; фиксируем явно на
  // случай рефакторинга TOPICS в массив.
  it("topicKey уникален глобально", () => {
    expect(findDuplicates(Object.keys(TOPICS))).toEqual([]);
  });

  // sentenceKey выводится из индекса массива (cs_0001, ...) — уникален, пока
  // деривация в seed.ts остаётся индексной; фиксируем контракт.
  it("sentenceKey уникален глобально", () => {
    expect(findDuplicates(CROSS_SENTENCES.map((_, i) => sentenceKey(i)))).toEqual([]);
  });

  // "||" — разделитель составного ключа wKey (convex/progress.ts, src/lib/srs.ts).
  // Попади он в pt или lessonKey — составной ключ стал бы неоднозначным.
  it('ни pt, ни lessonKey не содержат "||"', () => {
    const bad = [
      ...lessons.filter((l) => l.id.includes("||")).map((l) => `lessonKey "${l.id}"`),
      ...allPairs
        .filter(({ pt }) => pt.includes("||"))
        .map(({ lessonKey, pt }) => `${lessonKey}: pt "${pt}"`),
    ];
    expect(bad).toEqual([]);
  });
});
