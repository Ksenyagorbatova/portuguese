import { pluralRu } from "../lib/srs";
import { Icon } from "./Icon";

// Финал курса (П.5): экран, когда выучены ВСЕ темы. Самый эмоциональный момент
// продукта — итог пути + честное «повторение не заканчивается» (SRS вечен).
// Без конфетти: тихая система празднует сдержанно. Показывается ВМЕСТО Complete
// один раз (флаг в localStorage держит Session). Чистый презентационный
// компонент — цифры приходят пропами, считает их Shell из уже имеющихся данных;
// отсутствие startedAt (→ days=null) не ломает экран: плитка «дней» просто
// исчезает.
export function CourseComplete({
  wordsTotal,
  topicsTotal,
  days,
  bestStreak,
  onGoReview,
}: {
  wordsTotal: number;
  topicsTotal: number;
  days: number | null;
  bestStreak: number;
  onGoReview: () => void;
}) {
  return (
    <div className="m-card m-course">
      <div className="m-course-emoji">🇵🇹</div>
      <div className="m-course-title">Курс пройден!</div>
      <div className="m-course-sub">
        Все {topicsTotal} {pluralRu(topicsTotal, "тема", "темы", "тем")} закрыты. Boa viagem!
      </div>
      <div className="m-course-stats">
        <div className="m-course-stat">
          <div className="m-course-stat-n">{wordsTotal}</div>
          <div className="m-course-stat-l">{pluralRu(wordsTotal, "слово", "слова", "слов")}</div>
        </div>
        {days != null && (
          <div className="m-course-stat">
            <div className="m-course-stat-n">{days}</div>
            <div className="m-course-stat-l">{pluralRu(days, "день", "дня", "дней")}</div>
          </div>
        )}
        <div className="m-course-stat">
          <div className="m-course-stat-n">🔥 {bestStreak}</div>
          <div className="m-course-stat-l">лучший стрик</div>
        </div>
      </div>
      {/* Честный CTA: курс конечен, повторение — нет. Ведёт на review-таб. */}
      <button className="m-btn m-btn--primary m-btn--block m-btn--lg" onClick={onGoReview}>
        <Icon name="repeat" size={18} /> Повторение продолжается
      </button>
    </div>
  );
}
