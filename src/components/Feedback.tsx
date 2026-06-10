import type { ReactNode } from "react";
import type { WordView } from "../lib/types";
import { Icon } from "./Icon";

// Structured answer feedback (icon + body). Animates in (fade + 8px rise).

export function ResultFeedback({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={"m-fb " + (ok ? "success" : "error")}>
      <div className="m-fb-ico">
        <Icon name={ok ? "check" : "x"} />
      </div>
      <div className="m-fb-body">{children}</div>
    </div>
  );
}

export function RetryBox({ children }: { children: ReactNode }) {
  return (
    <div className="m-fb retry">
      <div className="m-fb-ico">
        <Icon name="rotate-ccw" />
      </div>
      <div className="m-fb-body">{children}</div>
    </div>
  );
}

// Word-answer feedback shared by the multiple-choice and type exercises:
// verdict + «pt — ru», optional note, and the real next-review interval.
// dueLabel приходит с ответом сервера; null — ответа ещё нет (мутация в пути
// или офлайн-очереди) либо мутация упала — показываем «—». saveFailed
// добавляет ненавязчивую пометку: ответ сервером отвергнут и в расписание
// повторов не попал.
export function WordFeedback({
  ok,
  word,
  dueLabel,
  saveFailed,
}: {
  ok: boolean;
  word: WordView;
  dueLabel: string | null;
  saveFailed?: boolean;
}) {
  return (
    <ResultFeedback ok={ok}>
      {ok ? <b>Верно!</b> : "Правильно:"} <span className="m-fb-pt">{word.pt}</span> — {word.ru}
      {word.note && <div className="m-fb-sub">💡 {word.note}</div>}
      <div className="m-fb-sub">
        <Icon name="clock" /> следующий повтор: {dueLabel ?? "—"}
      </div>
      {saveFailed && (
        <div className="m-fb-sub">
          <Icon name="circle-alert" /> Не удалось сохранить ответ.
        </div>
      )}
    </ResultFeedback>
  );
}

export function NextButton({ isLast, onClick }: { isLast: boolean; onClick: () => void }) {
  return (
    <button className="m-btn m-btn--ghost m-btn--block" style={{ marginTop: 10 }} onClick={onClick}>
      {isLast ? "Завершить" : "Дальше"} <Icon name="arrow-right" size={18} />
    </button>
  );
}
