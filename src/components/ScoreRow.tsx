export function ScoreRow({
  correct,
  total,
  due,
}: {
  correct: number;
  total: number;
  due: number;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) + "%" : "—";
  return (
    <div className="score-row">
      <div className="sc">
        <div className="sc-n">{correct}</div>
        <div className="sc-l">Верно</div>
      </div>
      <div className="sc">
        <div className="sc-n">{total}</div>
        <div className="sc-l">Заданий</div>
      </div>
      <div className="sc">
        <div className="sc-n">{pct}</div>
        <div className="sc-l">Точность</div>
      </div>
      <div className="sc">
        <div className="sc-n" style={due > 0 ? { color: "#c03030" } : undefined}>
          {due || "—"}
        </div>
        <div className="sc-l">К повтору</div>
      </div>
    </div>
  );
}
