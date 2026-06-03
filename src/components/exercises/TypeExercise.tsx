import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { BadgeTag, CardFields, WordView } from "../../lib/types";
import { variantsMatch } from "../../lib/text";
import { nextDueLabel, intervalLabel } from "../../lib/srs";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { FeedbackBox, NextButton } from "../Feedback";

type Resolved = { ok: boolean; dueLabel: string };

export function TypeExercise({
  word,
  tag,
  card,
  isLast,
  onAnswered,
  onNext,
}: {
  word: WordView;
  tag: BadgeTag;
  card: CardFields | undefined;
  isLast: boolean;
  onAnswered: (firstTryCorrect: boolean) => void;
  onNext: () => void;
}) {
  const recordAnswer = useMutation(api.progress.recordAnswer);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [retry, setRetry] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  async function finish(quality: 0 | 1 | 2, ok: boolean) {
    speak(word.pt);
    onAnswered(quality === 2);
    const res = await recordAnswer({ lessonKey: word.lessonKey, pt: word.pt, quality });
    setResolved({ ok, dueLabel: nextDueLabel(res.card) });
  }

  function check() {
    if (resolved) return;
    const ok = variantsMatch(value, word.pt);
    const first = tries === 0;
    if (ok) {
      void finish(first ? 2 : 1, true);
    } else if (tries < 1) {
      setTries(1);
      setRetry(true);
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      void finish(0, false);
    }
  }

  const borderColor = resolved ? (resolved.ok ? "#5a9a22" : "#c03030") : undefined;

  return (
    <div className="card">
      <div className="q-type">
        Напишите по-португальски <Badge tag={tag} />
      </div>
      <div className="q-text">{word.ru}</div>
      {word.note && <div className="q-note">{word.note}</div>}
      {tag !== "new" && (
        <div className="eb-info">
          ⏱ следующий повтор: {nextDueLabel(card)} · интервал: {intervalLabel(card)}
        </div>
      )}
      <div className="q-sub">Введите перевод:</div>
      <div className="hint-line">ℹ️ Акценты необязательны — "ate logo" = "até logo"</div>
      <input
        ref={inputRef}
        className="type-in"
        value={value}
        disabled={resolved !== null}
        autoFocus
        autoComplete="off"
        placeholder="Ваш ответ…"
        style={borderColor ? { borderColor } : undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") check();
        }}
      />
      {!resolved && (
        <button className="submit-btn" onClick={check}>
          Проверить
        </button>
      )}
      {!resolved && retry && (
        <FeedbackBox kind="retry">
          <b>Не совсем!</b> Ещё одна попытка.
        </FeedbackBox>
      )}
      {resolved && (
        <>
          <FeedbackBox kind={resolved.ok ? "success" : "error"}>
            <b>{resolved.ok ? "Верно!" : "Правильно:"}</b>{" "}
            <span>
              {word.pt} = {word.ru}
              {word.note && (
                <>
                  <br />
                  <small>💡 {word.note}</small>
                </>
              )}
            </span>
            <div className="eb-info" style={{ marginTop: 5 }}>
              ⏱ {resolved.dueLabel}
            </div>
          </FeedbackBox>
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
