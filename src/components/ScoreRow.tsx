// Stat strip: four elevated cards with big tabular numerals. "К повтору" turns
// red when there are due words.
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
  const cell = (n: string | number, label: string, alert?: boolean) => (
    <div className="m-stat">
      <div className={"m-stat-n" + (alert ? " alert" : "")}>{n}</div>
      <div className="m-stat-l">{label}</div>
    </div>
  );
  return (
    <div className="m-stats">
      {cell(correct, "Верно")}
      {cell(total, "Заданий")}
      {cell(pct, "Точность")}
      {cell(due || "—", "К повтору", due > 0)}
    </div>
  );
}
