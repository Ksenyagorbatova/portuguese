import { useAuthActions } from "@convex-dev/auth/react";
import { Icon } from "./Icon";
import type { Theme } from "../lib/useTheme";

export function Header({
  streak,
  theme,
  onToggleTheme,
  onHome,
}: {
  streak: number;
  theme: Theme;
  onToggleTheme: () => void;
  onHome: () => void;
}) {
  const { signOut } = useAuthActions();
  const dark = theme === "dark";
  return (
    <div className="m-header">
      <div className="m-brand">
        <button className="m-logo" onClick={onHome} aria-label="На главный экран" title="На главный экран">
          pt
        </button>
      </div>
      <div className="m-header-right">
        <div className="m-streak">
          <span className="m-flame">🔥</span>
          <b>{streak}</b>
        </div>
        <button
          className="m-icon-btn"
          onClick={onToggleTheme}
          aria-label={dark ? "Светлая тема" : "Тёмная тема"}
          title={dark ? "Светлая тема" : "Тёмная тема"}
        >
          <Icon name={dark ? "sun" : "moon"} />
        </button>
        <button
          className="m-icon-btn"
          onClick={() => void signOut()}
          aria-label="Выйти"
          title="Выйти"
        >
          <Icon name="log-out" />
        </button>
      </div>
    </div>
  );
}
