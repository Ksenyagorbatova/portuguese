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
    <div className="card" style={{ marginTop: "2rem" }}>
      <div className="lbl-small">Português Europeu · A0–A1</div>
      <div className="h-title" style={{ marginBottom: "1rem" }}>
        {flow === "signIn" ? "Вход" : "Регистрация"}
      </div>

      {error && <div className="auth-err">{error}</div>}

      <form onSubmit={onSubmit}>
        <input
          className="type-in"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
        />
        <input
          className="type-in"
          name="password"
          type="password"
          placeholder="Пароль"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          required
          minLength={6}
        />
        <button className="big-btn" type="submit" disabled={pending} style={{ marginTop: 0 }}>
          {pending ? "…" : flow === "signIn" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      {OAUTH_ENABLED && (
        <>
          <button className="next-btn" type="button" onClick={() => void signIn("github")}>
            Войти через GitHub
          </button>
          <button className="next-btn" type="button" onClick={() => void signIn("google")}>
            Войти через Google
          </button>
        </>
      )}

      {SIGNUP_ENABLED && (
        <div
          className="auth-switch"
          onClick={() => {
            setError(null);
            setFlow((f) => (f === "signIn" ? "signUp" : "signIn"));
          }}
        >
          {flow === "signIn" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </div>
      )}
    </div>
  );
}
