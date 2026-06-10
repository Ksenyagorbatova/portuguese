// Session result strip: three elevated cards with big tabular numerals. Shown
// only after a session (Shell gates on score.total > 0). "К повтору" lives in
// the review hero, so it's not duplicated here.
export function ScoreRow({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) + "%" : "—";
  const cell = (n: string | number, label: string) => (
    <div className="m-stat">
      <div className="m-stat-n">{n}</div>
      <div className="m-stat-l">{label}</div>
    </div>
  );
  return (
    <div className="m-stats">
      {cell(correct, "Верно")}
      {cell(total, "Заданий")}
      {cell(pct, "Точность")}
    </div>
  );
}
