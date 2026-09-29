import { Icon, type IconName } from "./Icon";

export type Tab = "review" | "topics" | "profile";
const TABS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: "review", label: "Сегодня", icon: "repeat" },
  { tab: "topics", label: "Курс", icon: "book-open" },
  { tab: "profile", label: "Профиль", icon: "user" },
];

// Fixed thumb-reachable navigation outside lessons and exercises.
export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="m-bottom-nav" aria-label="Основная навигация">
      {TABS.map((item) => (
        <button key={item.tab} className="m-nav-item" type="button"
          aria-current={tab === item.tab ? "page" : undefined} onClick={() => onTab(item.tab)}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
