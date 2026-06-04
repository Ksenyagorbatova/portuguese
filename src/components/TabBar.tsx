type Tab = "review" | "topics";

// Segmented control with a spring-animated sliding thumb.
export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const i = tab === "topics" ? 1 : 0;
  return (
    <div className="m-seg" data-i={i}>
      <div className="m-seg-thumb" />
      <button className={"m-seg-btn" + (i === 0 ? " on" : "")} onClick={() => onTab("review")}>
        Повторение
      </button>
      <button className={"m-seg-btn" + (i === 1 ? " on" : "")} onClick={() => onTab("topics")}>
        Темы
      </button>
    </div>
  );
}
