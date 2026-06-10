import { useEffect, useId, useRef } from "react";

// Внутренний диалог подтверждения вместо window.confirm: системный диалог
// нестилизуем и ломает визуальный язык. Семантика модалки: role="dialog",
// aria-modal, фокус при открытии на «безопасной» кнопке (отмена), Esc =
// отмена, Tab зациклен между двумя кнопками. Анимация — фейд оверлея +
// подъём карточки за --dur, с гейтом prefers-reduced-motion (в CSS).
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Фокус при открытии — на «Остаться» (безопасный выбор). При закрытии
  // возвращаем фокус открывшему элементу: после «Остаться» пользователь
  // продолжает с того же места (логотип); после «Выйти» экран сменится и
  // фокус на отвязанном узле — безвредный no-op.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
      return;
    }
    // Tab-trap: цикл по двум кнопкам диалога.
    if (e.key === "Tab") {
      e.preventDefault();
      const next = document.activeElement === cancelRef.current ? confirmRef : cancelRef;
      next.current?.focus();
    }
  }

  return (
    // Клик по подложке = «остаться» (как Esc): случайный промах не должен
    // выбрасывать из тренировки.
    <div className="m-dialog-overlay" onClick={onCancel} onKeyDown={onKeyDown}>
      <div
        className="m-card m-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="m-dialog-title" id={titleId}>
          {title}
        </div>
        <div className="m-dialog-msg" id={messageId}>
          {message}
        </div>
        <div className="m-dialog-actions">
          <button ref={confirmRef} className="m-btn m-btn--primary m-btn--block" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} className="m-btn m-btn--ghost m-btn--block" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
