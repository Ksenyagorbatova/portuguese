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
    <div className="card" style={{ textAlign: "center", padding: "2rem 1.5rem" }}>
      <div style={{ fontSize: 38, marginBottom: ".6rem" }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: ".4rem" }}>
        Сессия завершена!
      </div>
      <div style={{ fontSize: 14, color: "#555", marginBottom: ".3rem" }}>
        Верно: {correct} из {total} ({pct}%)
      </div>
      {dueCountAll > 0 ? (
        <div style={{ fontSize: 13, color: "#c03030", marginBottom: "1rem" }}>
          🔴 Ещё {dueCountAll} слов ждут повторения по Эббингаузу
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#1d9e75", marginBottom: "1rem" }}>
          ✅ Все повторения сделаны!
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="submit-btn" onClick={onRestart}>
          Ещё раз
        </button>
        {nextLesson && (
          <button
            className="next-btn"
            style={{ width: "auto" }}
            onClick={() => onPickLesson(nextLesson.topicKey, nextLesson.lessonKey)}
          >
            → {nextLesson.label}
          </button>
        )}
        {dueCountAll > 0 && (
          <button className="next-btn" style={{ width: "auto" }} onClick={onGoReview}>
            🔁 К повторению
          </button>
        )}
      </div>
    </div>
  );
}
