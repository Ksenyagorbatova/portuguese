import type { ReactNode } from "react";
import type { WordView } from "../lib/types";
import { speakSmart } from "../lib/speech";
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
      {ok ? <b>Верно!</b> : "Правильно:"}{" "}
      <span className="m-fb-pt" lang="pt-PT">{word.pt}</span> — {word.ru}
      {/* Озвучка из фидбэка: момент, когда хочется переслушать слово. Повторный
          тап в течение 4с — медленно (speakSmart, как у 🔊 в вопросе). */}
      <button
        className="m-fb-audio"
        onClick={() => speakSmart(word.pt)}
        aria-label="Прослушать (второй тап — медленно)"
        title="Прослушать (второй тап — медленно)"
      >
        <Icon name="volume" size={13} />
      </button>
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
    // autoFocus: после ответа фокус на «Дальше» — Enter ведёт к следующей карточке.
    <button
      className="m-btn m-btn--ghost m-btn--block"
      style={{ marginTop: 10 }}
      autoFocus
      onKeyDown={(e) => {
        // Зажатый Enter (autorepeat) не должен проскакивать карточку мимо
        // фидбэка: отмена повторного keydown отменяет синтезируемый click.
        if (e.key === "Enter" && e.repeat) e.preventDefault();
      }}
      onClick={onClick}
    >
      {isLast ? "Завершить" : "Дальше"} <Icon name="arrow-right" size={18} />
    </button>
  );
}
