import { useAuthActions } from "@convex-dev/auth/react";
import type { ThemeChoice } from "../lib/useTheme";
import { AccountFooter } from "./AccountFooter";
import { Icon, type IconName } from "./Icon";

const THEMES: Record<ThemeChoice, { label: string; icon: IconName }> = {
  light: { label: "Светлая", icon: "sun" },
  dark: { label: "Тёмная", icon: "moon" },
  system: { label: "Как на устройстве", icon: "contrast" },
};

export function Profile({ email, themeChoice, onCycleTheme, muted, onToggleMute }: {
  email: string | null;
  themeChoice: ThemeChoice;
  onCycleTheme: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const { signOut } = useAuthActions();
  const theme = THEMES[themeChoice];
  return (
    <section className="m-profile" aria-label="Настройки профиля">
      <div className="m-card">
        <h2 className="m-profile-heading">Настройки</h2>
        <button type="button" className="m-setting" onClick={onCycleTheme}
          aria-label={`Тема: ${theme.label.toLowerCase()}. Изменить`}>
          <Icon name={theme.icon} />
          <span><b>Оформление</b><span className="m-setting-value">{theme.label}</span></span>
          <Icon name="chevron-right" size={18} />
        </button>
        <button type="button" className="m-setting" onClick={onToggleMute} aria-pressed={!muted}>
          <Icon name={muted ? "volume-off" : "volume"} />
          <span><b>Автоозвучка</b><span className="m-setting-value">{muted ? "Выключена" : "Включена"}</span></span>
          <span className="m-setting-state">{muted ? "Выкл." : "Вкл."}</span>
        </button>
        <p className="m-profile-note">По кнопке звука можно прослушать ответ в любое время.</p>
      </div>
      <div className="m-card">
        <h2 className="m-profile-heading">Аккаунт</h2>
        <button type="button" className="m-btn m-btn--ghost m-btn--block" onClick={() => void signOut()}>
          <Icon name="log-out" /> Выйти из аккаунта
        </button>
        <AccountFooter email={email} />
      </div>
    </section>
  );
}
