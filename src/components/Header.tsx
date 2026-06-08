import { useAuthActions } from "@convex-dev/auth/react";
import { Icon } from "./Icon";
import type { Theme } from "../lib/useTheme";

export function Header({
  streak,
  theme,
  onToggleTheme,
}: {
  streak: number;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const { signOut } = useAuthActions();
  const dark = theme === "dark";
  return (
    <div className="m-header">
      <div className="m-brand">
        <div className="m-logo">pt</div>
      </div>
      <div className="m-header-right">
        <button className="m-signout" onClick={() => void signOut()}>
          выйти
        </button>
        <button
          className="m-icon-btn"
          onClick={onToggleTheme}
          aria-label={dark ? "Светлая тема" : "Тёмная тема"}
          title={dark ? "Светлая тема" : "Тёмная тема"}
        >
          <Icon name={dark ? "sun" : "moon"} />
        </button>
        <div className="m-streak">
          <span className="m-flame">🔥</span>
          <b>{streak}</b>
        </div>
      </div>
    </div>
  );
}
