import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { WordView } from "../lib/types";
import { speakSmart } from "../lib/speech";
import { Icon } from "./Icon";

// One action position for typing, sentence building and feedback.
export function ActionBar({ children }: { children: ReactNode }) {
  const space = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const element = space.current;
    if (!viewport || !element) return;

    const update = () => {
      // Safari's keyboard shrinks only the visual viewport. Capacitor resizes
      // the WebView itself, so its inset is already zero. Don't follow pinch zoom.
      const inset = viewport.scale === 1
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      element.style.setProperty("--action-bottom", `${inset}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div className="m-action-space" ref={space}><div className="m-action-bar">{children}</div></div>;
}

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
  missingAccents,
}: {
  ok: boolean;
  word: WordView;
  dueLabel: string | null;
  saveFailed?: boolean;
  missingAccents?: boolean;
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
      {missingAccents && <div className="m-fb-sub">Ответ принят без акцентов. Запомните написание выше.</div>}
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
    <ActionBar>
      {/* autoFocus: после ответа Enter ведёт к следующей карточке. */}
      <button
        className="m-btn m-btn--primary m-btn--block"
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
    </ActionBar>
  );
}
