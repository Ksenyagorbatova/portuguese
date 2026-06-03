import type { Course, SrsState } from "../lib/types";

export function ReviewTab({
  course,
  srs,
  onStart,
}: {
  course: Course;
  srs: SrsState;
  onStart: () => void;
}) {
  const seenSet = new Set(srs.seenTheory);
  const seenLessons = course.topics
    .flatMap((t) => t.lessons)
    .filter((l) => seenSet.has(l.lessonKey));
  const seenCount = seenLessons.reduce(
    (n, l) => n + (srs.lessonStats[l.lessonKey]?.total ?? l.words.length),
    0,
  );
  const learnedCount = seenLessons.reduce(
    (n, l) => n + (srs.lessonStats[l.lessonKey]?.learned ?? 0),
    0,
  );
  const due = srs.dueCountAll;

  const banner =
    seenCount === 0 ? (
      <div className="eb-banner">
        👈 Сначала открой любую тему и изучи теорию — тогда слова появятся здесь для повторения.
      </div>
    ) : due > 0 ? (
      <div className="eb-banner">
        🔴 <b>{due} слов</b> пора повторить по методу Эббингауза!
      </div>
    ) : learnedCount > 0 ? (
      <div className="eb-banner ok">✅ Все повторения сделаны вовремя. Отлично!</div>
    ) : (
      <div className="eb-banner">Слова из пройденных тем готовы к тренировке.</div>
    );

  return (
    <div className="review-hero">
      <div className="review-stats">
        <div className="rs-item">
          <span className="rs-n">{seenCount}</span>
          <span className="rs-l">изучено слов</span>
        </div>
        <div className="rs-sep" />
        <div className="rs-item">
          <span className="rs-n">{learnedCount}</span>
          <span className="rs-l">усвоено</span>
        </div>
        <div className="rs-sep" />
        <div className="rs-item" style={due > 0 ? { color: "#c03030" } : undefined}>
          <span className="rs-n">{due || "✓"}</span>
          <span className="rs-l">к повтору</span>
        </div>
      </div>
      {banner}
      <button
        className="big-btn"
        disabled={seenCount === 0}
        style={seenCount === 0 ? { opacity: 0.45, cursor: "default" } : undefined}
        onClick={onStart}
      >
        {due > 0
          ? `🔁 Повторить (${due} слов)`
          : seenCount > 0
            ? "🔁 Тренировать все слова"
            : "📚 Сначала изучи тему"}
      </button>
    </div>
  );
}
