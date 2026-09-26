import { useState, type FormEvent } from "react";
import { ConvexError } from "convex/values";
import { useAuthActions } from "@convex-dev/auth/react";
import { HideNativeSplash } from "./HideNativeSplash";

// Flip to true after enabling GitHub/Google providers in convex/auth.ts and
// setting their OAuth env vars (see README). Until then, Password-only.
const OAUTH_ENABLED = false;

// Public registration toggle — ENABLED since 2026-09-26 (iOS/TestFlight: testers
// sign up from the phone). Keep in sync with SIGNUP_ENABLED in convex/auth.ts
// (the server enforces it; this only shows/hides the UI). When false, the
// sign-up switch is hidden and only existing users can sign in.
const SIGNUP_ENABLED = true;

type Flow = "signIn" | "signUp";

// ConvexError codes thrown by convex/auth.ts (ConvexError data reaches production
// clients; plain server Errors arrive as a bare «Server Error»). Literals, not
// imports — convex/auth.ts is server code.
function authErrorMessage(e: unknown, flow: Flow): string {
  const code = e instanceof ConvexError ? e.data : null;
  if (code === "ACCOUNT_EXISTS") return "Аккаунт с таким email уже есть — войдите.";
  if (code === "REGISTRATION_DISABLED") return "Регистрация сейчас закрыта.";
  if (code === "INVALID_EMAIL") return "Проверьте email — похоже, в нём опечатка.";
  return flow === "signIn"
    ? "Не удалось войти. Проверьте email и пароль."
    : "Не удалось зарегистрироваться. Проверьте соединение и попробуйте ещё раз.";
}

export function SignIn({ signupEnabled = SIGNUP_ENABLED }: { signupEnabled?: boolean }) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>("signIn");
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
    } catch (err) {
      setError(authErrorMessage(err, flow));
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
            {/* iOS-клавиатура иначе делает первую букву заглавной и
                «исправляет» адрес автокоррекцией (сервер нормализует регистр,
                но не опечатки автозамены). */}
            <input
              className="m-input"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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

        {signupEnabled && (
          // <button type="button">: доступен с клавиатуры/скринридера и не
          // сабмитит форму; UA-стили кнопки гасит :where-reset в index.css.
          <button
            type="button"
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
          </button>
        )}
      </div>
      {/* iOS-оболочка: первый настоящий экран для гостя — убрать нативный сплэш. */}
      <HideNativeSplash />
    </div>
  );
}
