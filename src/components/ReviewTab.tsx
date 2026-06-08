import type { Course, SrsState } from "../lib/types";
import { Icon } from "./Icon";
import { ProgressRing } from "./ProgressRing";

export function ReviewTab({
  course,
  srs,
  onStart,
  onGoTopics,
}: {
  course: Course;
  srs: SrsState;
  onStart: () => void;
  onGoTopics: () => void;
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
  const pct = seenCount > 0 ? Math.round((learnedCount / seenCount) * 100) : 0;

  let banner;
  if (seenCount === 0) {
    banner = (
      <div className="m-banner info">
        <Icon name="book-open" />
        <span>Открой любую тему и изучи теорию — слова появятся здесь для повторения.</span>
      </div>
    );
  } else if (due > 0) {
    banner = (
      <div className="m-banner due">
        <Icon name="circle-alert" />
        <span>
          <b>{due} слов</b> пора повторить по методу Эббингауза
        </span>
      </div>
    );
  } else if (learnedCount > 0) {
    banner = (
      <div className="m-banner ok">
        <Icon name="circle-check" />
        <span>Все повторения сделаны вовремя. Отлично!</span>
      </div>
    );
  } else {
    banner = (
      <div className="m-banner info">
        <Icon name="sparkles" />
        <span>Слова из пройденных тем готовы к тренировке.</span>
      </div>
    );
  }

  return (
    <div className="m-hero">
      <div className="m-hero-top">
        <ProgressRing pct={pct} size={96} stroke={9}>
          <div className="m-ring-pct">{pct}%</div>
          <div className="m-ring-cap">выучено</div>
        </ProgressRing>
        <div className="m-hero-cols">
          <div className="m-hero-row">
            <span className="m-dot accent" />
            <span className="m-hero-num">{seenCount}</span>
            <span className="m-hero-cap">просмотрено слов</span>
          </div>
          <div className="m-hero-row">
            <span className="m-dot accent" />
            <span className="m-hero-num">{learnedCount}</span>
            <span className="m-hero-cap">выучено</span>
          </div>
          <div className="m-hero-row">
            <span className={"m-dot " + (due > 0 ? "due" : "accent")} />
            <span className="m-hero-num" style={due > 0 ? { color: "var(--due-ink)" } : undefined}>
              {due || "✓"}
            </span>
            <span className="m-hero-cap">к повтору</span>
          </div>
        </div>
      </div>
      {banner}
      <button
        className="m-btn m-btn--primary m-btn--block m-btn--lg"
        style={{ marginTop: 20 }}
        onClick={seenCount === 0 ? onGoTopics : onStart}
      >
        {due > 0 ? (
          <>
            <Icon name="repeat" size={18} /> Повторить ({due} слов)
          </>
        ) : seenCount > 0 ? (
          <>
            <Icon name="repeat" size={18} /> Тренировать все слова
          </>
        ) : (
          <>
            <Icon name="book-open" size={18} /> Открыть темы
          </>
        )}
      </button>
    </div>
  );
}
