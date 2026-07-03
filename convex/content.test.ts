import { describe, expect, it } from "vitest";
import { CROSS_SENTENCES, TOPICS, TOPIC_SENTENCES } from "./content";

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

  // Дубль pt МЕЖДУ уроками — это два независимых прогресса (ключ (lessonKey, pt)):
  // слово, выученное в одной теме, в другой снова показывается как «новое»
  // (жалоба: в «Внешности» всплывали olho/cabelo из «Частей тела»). Слово живёт
  // ровно в одном уроке; напомнить его в другом можно текстом intro/tip теории,
  // но не дублем в words.
  it("pt уникален глобально (слово живёт ровно в одном уроке)", () => {
    expect(findDuplicates(allPairs.map((p) => p.pt))).toEqual([]);
  });

  // Обратное направление к проверке sections ↑: слово урока, не попавшее ни в
  // одну секцию теории, пользователь впервые встречает сразу в тренировке
  // «из ниоткуда» (жалоба «эти слова вообще ещё не проходились») — Theory.tsx
  // рендерит только пересечение sections[].words × lesson.words.
  it("каждое слово урока показано хотя бы в одной секции теории урока", () => {
    const missing = lessons.flatMap((lesson) => {
      const shown = new Set(lesson.theory.sections.flatMap((sec) => sec.words));
      return lesson.words
        .filter((w) => !shown.has(w.pt))
        .map((w) => `${lesson.id}: "${w.pt}" нет ни в одной секции теории`);
    });
    expect(missing).toEqual([]);
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

  // Разметка совета (m-tip в Theory.tsx) рендерит СВОЙ флаг 🇵🇹 слева — флаг в
  // начале текста tip давал бы два флага подряд (замечено владельцем на проде).
  it("tip теории не начинается с эмодзи-флага (флаг рисует разметка)", () => {
    const bad = lessons
      .filter((l) => l.theory.tip.startsWith("🇵🇹"))
      .map((l) => `${l.id}: tip начинается с 🇵🇹`);
    expect(bad).toEqual([]);
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

describe("целостность раздела «Построение предложений» (TOPIC_SENTENCES)", () => {
  // Зеркалит нормализацию ClozeExercise (deaccent + без хвостовой пунктуации):
  // blank хранится чистым ("Olá"), а токен в words может нести пунктуацию ("Olá!").
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .toLowerCase()
      .replace(/[.!?,]/g, "")
      .trim();
  const topicKeys = new Set(Object.keys(TOPICS));

  it("answer === words.join(' ')", () => {
    const bad = TOPIC_SENTENCES.filter((s) => s.words.join(" ") !== s.answer).map(
      (s) => `«${s.answer}» ≠ words.join(' ') = «${s.words.join(" ")}»`,
    );
    expect(bad).toEqual([]);
  });

  it("topicKey каждого предложения существует среди тем", () => {
    const bad = TOPIC_SENTENCES.filter((s) => !topicKeys.has(s.topicKey)).map(
      (s) => `«${s.answer}»: тема "${s.topicKey}" не существует`,
    );
    expect(bad).toEqual([]);
  });

  // blank обязан присутствовать среди words (нормализованно) — иначе
  // ClozeExercise не найдёт позицию пропуска (blankIdx === -1) и покажет
  // предложение без прочерка.
  it("blank присутствует среди words (нормализованно)", () => {
    const bad = TOPIC_SENTENCES.filter((s) => !s.words.some((w) => norm(w) === norm(s.blank))).map(
      (s) => `«${s.answer}»: blank "${s.blank}" нет среди words`,
    );
    expect(bad).toEqual([]);
  });

  // Дистракторы cloze — другие blank-слова той же темы (buildSentenceQueue/
  // ClozeExercise). Совпади blank двух предложений темы по норме — дистрактор
  // оказался бы вторым правильным ответом.
  it("blank-слова одной темы уникальны по норме", () => {
    const byTopic = new Map<string, string[]>();
    for (const s of TOPIC_SENTENCES) {
      const arr = byTopic.get(s.topicKey) ?? [];
      arr.push(norm(s.blank));
      byTopic.set(s.topicKey, arr);
    }
    const bad: string[] = [];
    for (const [tk, blanks] of byTopic)
      for (const d of findDuplicates(blanks)) bad.push(`${tk}: дубль blank "${d}"`);
    expect(bad).toEqual([]);
  });

  // Cloze показывает 4 варианта (1 верный + 3 дистрактора) — теме нужно ≥4
  // предложения, чтобы дистракторов хватило.
  it("у темы с предложениями их не меньше 4", () => {
    const count = new Map<string, number>();
    for (const s of TOPIC_SENTENCES) count.set(s.topicKey, (count.get(s.topicKey) ?? 0) + 1);
    const bad = [...count.entries()].filter(([, n]) => n < 4).map(([tk, n]) => `${tk}: только ${n}`);
    expect(bad).toEqual([]);
  });
});
