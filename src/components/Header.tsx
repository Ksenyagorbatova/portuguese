import { useAuthActions } from "@convex-dev/auth/react";

export function Header({ streak }: { streak: number }) {
  const { signOut } = useAuthActions();
  return (
    <div className="header">
      <div>
        <div className="lbl-small">Português Europeu · A0–A1</div>
        <div className="h-title">Тренажёр</div>
        <button className="signout-btn" onClick={() => void signOut()}>
          выйти
        </button>
      </div>
      <div className="streak">
        🔥 <span>{streak}</span>
      </div>
    </div>
  );
}
