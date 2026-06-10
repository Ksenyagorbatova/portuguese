import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

// Flip to true after enabling GitHub/Google providers in convex/auth.ts and
// setting their OAuth env vars (see README). Until then, Password-only.
const OAUTH_ENABLED = false;

// Public registration toggle. Keep in sync with SIGNUP_ENABLED in
// convex/auth.ts (the server enforces it; this only hides the UI). When false,
// the sign-up switch is hidden and only existing users can sign in.
const SIGNUP_ENABLED = false;

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("flow", flow);
    try {
      await signIn("password", fd);
    } catch {
      setError(
        flow === "signIn"
          ? "Не удалось войти. Проверьте email и пароль."
          : "Не удалось зарегистрироваться. Возможно, аккаунт с таким email уже есть.",
      );
      setPending(false);
    }
  }

  return (
    <div className="m-signin m-view">
      <div className="m-signin-brand">
        <div className="m-signin-logo">pt</div>
        <div>
          <div className="m-signin-kicker">PORTUGUÊS EUROPEU · A0–A1</div>
          <div className="m-signin-title">{flow === "signIn" ? "С возвращением" : "Регистрация"}</div>
        </div>
      </div>

      <div className="m-card">
        {error && <div className="m-auth-err" style={{ marginBottom: 12 }}>{error}</div>}

        <form className="m-form" onSubmit={onSubmit}>
          <div className="m-field">
            <input
              className="m-input"
              name="email"
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              required
            />
          </div>
          <div className="m-field">
            <input
              className="m-input"
              name="password"
              type="password"
              placeholder="Пароль"
              aria-label="Пароль"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
          </div>
          <button
            className="m-btn m-btn--primary m-btn--block m-btn--lg"
            type="submit"
            disabled={pending}
            style={{ marginTop: 4 }}
          >
            {pending ? "…" : flow === "signIn" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        {OAUTH_ENABLED && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <button
              className="m-btn m-btn--ghost m-btn--block"
              type="button"
              onClick={() => void signIn("github")}
            >
              Войти через GitHub
            </button>
            <button
              className="m-btn m-btn--ghost m-btn--block"
              type="button"
              onClick={() => void signIn("google")}
            >
              Войти через Google
            </button>
          </div>
        )}

        {SIGNUP_ENABLED && (
          <div
            className="m-switch"
            onClick={() => {
              setError(null);
              setFlow((f) => (f === "signIn" ? "signUp" : "signIn"));
            }}
          >
            {flow === "signIn" ? (
              <span>
                Нет аккаунта? <b>Зарегистрироваться</b>
              </span>
            ) : (
              <span>
                Уже есть аккаунт? <b>Войти</b>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
