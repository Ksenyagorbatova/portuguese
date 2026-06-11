import { useAuthActions } from "@convex-dev/auth/react";
import { pluralRu } from "../lib/srs";
import { Icon, type IconName } from "./Icon";
import type { ThemeChoice } from "../lib/useTheme";

const THEME_ICON: Record<ThemeChoice, IconName> = {
  light: "sun",
  dark: "moon",
  system: "contrast",
};
const THEME_LABEL: Record<ThemeChoice, string> = {
  light: "Тема: светлая",
  dark: "Тема: тёмная",
  system: "Тема: системная",
};

export function Header({
  streak,
  doneToday,
  muted,
  onToggleMute,
  themeChoice,
  onCycleTheme,
  onHome,
}: {
  streak: number;
  doneToday: boolean;
  muted: boolean;
  onToggleMute: () => void;
  themeChoice: ThemeChoice;
  onCycleTheme: () => void;
  onHome: () => void;
}) {
  const { signOut } = useAuthActions();
  const themeLabel = THEME_LABEL[themeChoice];
  const muteLabel = muted ? "Звук: выключен" : "Звук: включён";
  const streakLabel = `Стрик ${streak} ${pluralRu(streak, "день", "дня", "дней")}, ${
    doneToday ? "сегодня пройдено" : "сегодня ещё не пройдено"
  }`;
  return (
    <div className="m-header">
      <div className="m-brand">
        <button className="m-logo" onClick={onHome} aria-label="На главный экран" title="На главный экран">
          pt
        </button>
      </div>
      <div className="m-header-right">
        <div className="m-streak" role="img" aria-label={streakLabel} title={streakLabel}>
          <span className="m-flame">🔥</span>
          <b>{streak}</b>
          {/* Статус дня: галочка загорается после первой сессии дня (данные
              перечитываются с сервера — без анимации, кроме transition). */}
          <span className={"m-streak-day" + (doneToday ? " done" : "")} aria-hidden="true">
            <Icon name="check" size={9} />
          </span>
        </div>
        <button
          className="m-icon-btn"
          onClick={onToggleMute}
          aria-label={muteLabel}
          title={muteLabel}
        >
          <Icon name={muted ? "volume-off" : "volume"} />
        </button>
        <button
          className="m-icon-btn"
          onClick={onCycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <Icon name={THEME_ICON[themeChoice]} />
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
