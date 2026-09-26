import { useState } from "react";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { forgetCourseSeen } from "../lib/courseSeen";
import { ConfirmDialog } from "./ConfirmDialog";

// Строка аккаунта внизу главного экрана: кто вошёл + удаление аккаунта изнутри
// приложения (App Store Review Guideline 5.1.1(v) — приложение с регистрацией
// обязано его давать; на сайте то же самое). Выход — по-прежнему кнопка в шапке.
// Удаление: подтверждение → account:deleteAccount (сервер стирает пользователя,
// прогресс и все строки Convex Auth) → флаг финала курса на устройстве (он из
// прогресса) → signOut (сессии уже нет — он лишь стирает токены на клиенте, и
// App показывает экран входа). email приходит из Shell (account:viewer), null —
// ещё не загружен или запрос недоступен.

type Phase = "idle" | "confirming" | "deleting" | "failed";

const OFFLINE_NOTE = "Удалить аккаунт можно при подключении к сети";

export function AccountFooter({ email }: { email: string | null }) {
  const deleteAccount = useMutation(api.account.deleteAccount);
  const { signOut } = useAuthActions();
  const { isWebSocketConnected } = useConvexConnectionState();
  const [phase, setPhase] = useState<Phase>("idle");

  async function onConfirm() {
    // Диалог остаётся открытым (pending) до ответа: с экрана не уйти, и
    // результат не потеряется вместе с размонтированным футером.
    setPhase("deleting");
    try {
      await deleteAccount({});
    } catch (e) {
      console.error("Удаление аккаунта не удалось:", e);
      setPhase("failed");
      return;
    }
    forgetCourseSeen();
    await signOut();
  }

  // Офлайн мутация встала бы в очередь без ответа и потерялась бы при закрытии
  // приложения — удаление доступно только с живым соединением.
  const offline = !isWebSocketConnected;

  return (
    <div className="m-account">
      {email && <span className="m-account-email">{email}</span>}
      <button
        type="button"
        className="m-account-delete"
        disabled={offline}
        onClick={() => setPhase("confirming")}
      >
        Удалить аккаунт
      </button>
      {offline && <span className="m-account-note">{OFFLINE_NOTE}</span>}
      {phase === "failed" && (
        <div className="m-auth-err" role="alert">
          Не удалось удалить аккаунт. Попробуйте ещё раз.
        </div>
      )}
      {(phase === "confirming" || phase === "deleting") && (
        <ConfirmDialog
          title="Удалить аккаунт?"
          message={`${email ? `Аккаунт ${email}` : "Аккаунт"} и весь прогресс — слова, повторения, стрик — удалятся навсегда. Восстановить их будет нельзя.`}
          confirmLabel="Удалить навсегда"
          cancelLabel="Отмена"
          danger
          pending={phase === "deleting"}
          pendingLabel={isWebSocketConnected ? "Удаляем аккаунт…" : "Ждём соединения…"}
          onConfirm={() => void onConfirm()}
          onCancel={() => setPhase("idle")}
        />
      )}
    </div>
  );
}
