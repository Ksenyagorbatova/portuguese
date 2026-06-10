import type { ReactNode } from "react";
import type { WordView } from "../lib/types";
import { Icon } from "./Icon";

// Structured answer feedback (icon + body). Animates in (fade + 8px rise).

export function ResultFeedback({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    // role="status" + aria-live: скринридер озвучивает появившийся вердикт.
    <div className={"m-fb " + (ok ? "success" : "error")} role="status" aria-live="polite">
      <div className="m-fb-ico">
        <Icon name={ok ? "check" : "x"} />
      </div>
      <div className="m-fb-body">{children}</div>
    </div>
  );
}

export function RetryBox({ children }: { children: ReactNode }) {
  return (
    <div className="m-fb retry" role="status" aria-live="polite">
      <div className="m-fb-ico">
        <Icon name="rotate-ccw" />
      </div>
      <div className="m-fb-body">{children}</div>
    </div>
  );
}

// Word-answer feedback shared by the multiple-choice and type exercises:
// verdict + «pt — ru», optional note, and the real next-review interval.
export function WordFeedback({
  ok,
  word,
  dueLabel,
}: {
  ok: boolean;
  word: WordView;
  dueLabel: string;
}) {
  return (
    <ResultFeedback ok={ok}>
      {ok ? <b>Верно!</b> : "Правильно:"}{" "}
      <span className="m-fb-pt" lang="pt-PT">{word.pt}</span> — {word.ru}
      {word.note && <div className="m-fb-sub">💡 {word.note}</div>}
      <div className="m-fb-sub">
        <Icon name="clock" /> следующий повтор: {dueLabel}
      </div>
    </ResultFeedback>
  );
}

export function NextButton({ isLast, onClick }: { isLast: boolean; onClick: () => void }) {
  return (
    // autoFocus: после ответа фокус на «Дальше» — Enter ведёт к следующей карточке.
    <button
      className="m-btn m-btn--ghost m-btn--block"
      style={{ marginTop: 10 }}
      autoFocus
      onClick={onClick}
    >
      {isLast ? "Завершить" : "Дальше"} <Icon name="arrow-right" size={18} />
    </button>
  );
}
