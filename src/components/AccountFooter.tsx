import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { ConfirmDialog } from "./ConfirmDialog";

// Строка аккаунта внизу главного экрана: кто вошёл + удаление аккаунта изнутри
// приложения (App Store Review Guideline 5.1.1(v) — приложение с регистрацией
// обязано его давать; на сайте то же самое). Выход — по-прежнему кнопка в шапке.
// Удаление: подтверждение → account:deleteAccount (сервер стирает пользователя,
// прогресс и все строки Convex Auth) → signOut (сессии уже нет — он лишь стирает
// токены на клиенте, и App показывает экран входа).
export function AccountFooter() {
  const viewer = useQuery(api.account.viewer);
  const deleteAccount = useMutation(api.account.deleteAccount);
  const { signOut } = useAuthActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = viewer?.email ?? null;

  async function onConfirm() {
    setConfirming(false);
    setDeleting(true);
    try {
      await deleteAccount({});
    } catch {
      setError("Не удалось удалить аккаунт. Проверьте соединение и попробуйте ещё раз.");
      setDeleting(false);
      return;
    }
    await signOut();
  }

  return (
    <div className="m-account">
      {email && <span className="m-account-email">{email}</span>}
      <button
        type="button"
        className="m-account-delete"
        disabled={deleting}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {deleting ? "Удаляем аккаунт…" : "Удалить аккаунт"}
      </button>
      {error && (
        <div className="m-auth-err" role="alert">
          {error}
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Удалить аккаунт?"
          message={`${email ? `Аккаунт ${email}` : "Аккаунт"} и весь прогресс — слова, повторения, стрик — удалятся навсегда. Восстановить их будет нельзя.`}
          confirmLabel="Удалить навсегда"
          cancelLabel="Отмена"
          danger
          onConfirm={() => void onConfirm()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
