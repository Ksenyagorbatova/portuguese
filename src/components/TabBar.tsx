type Tab = "review" | "topics";

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="tab-bar">
      <button
        className={"tab-btn" + (tab === "review" ? " active" : "")}
        onClick={() => onTab("review")}
      >
        🔁 Повторение всех слов
      </button>
      <button
        className={"tab-btn" + (tab === "topics" ? " active" : "")}
        onClick={() => onTab("topics")}
      >
        📚 По темам
      </button>
    </div>
  );
}
