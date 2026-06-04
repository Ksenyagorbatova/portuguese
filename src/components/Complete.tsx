import { Icon } from "./Icon";

export function Complete({
  correct,
  total,
  dueCountAll,
  nextLesson,
  onRestart,
  onPickLesson,
  onGoReview,
}: {
  correct: number;
  total: number;
  dueCountAll: number;
  nextLesson: { topicKey: string; lessonKey: string; label: string } | null;
  onRestart: () => void;
  onPickLesson: (topicKey: string, lessonKey: string) => void;
  onGoReview: () => void;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const emoji = pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪";
  return (
    <div className="m-card m-complete">
      <div className="m-complete-emoji">{emoji}</div>
      <div className="m-complete-title">Сессия завершена!</div>
      <div className="m-complete-score">
        Верно: <b>{correct}</b> из <b>{total}</b> ({pct}%)
      </div>
      {dueCountAll > 0 ? (
        <div className="m-complete-note due">
          <Icon name="circle-alert" /> Ещё {dueCountAll} слов ждут повторения
        </div>
      ) : (
        <div className="m-complete-note ok">
          <Icon name="circle-check" /> Все повторения сделаны!
        </div>
      )}
      <div className="m-complete-actions">
        <button className="m-btn m-btn--primary m-btn--block m-btn--lg" onClick={onRestart}>
          <Icon name="rotate-ccw" size={18} /> Ещё раз
        </button>
        {nextLesson && (
          <button
            className="m-btn m-btn--tinted m-btn--block"
            onClick={() => onPickLesson(nextLesson.topicKey, nextLesson.lessonKey)}
          >
            {nextLesson.label} <Icon name="arrow-right" size={18} />
          </button>
        )}
        {dueCountAll > 0 && (
          <button className="m-btn m-btn--ghost m-btn--block" onClick={onGoReview}>
            <Icon name="repeat" size={18} /> К повторению
          </button>
        )}
      </div>
    </div>
  );
}
