import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { BadgeTag, CardFields, WordView } from "../../lib/types";
import { variantsMatch } from "../../lib/text";
import { nextDueLabel, intervalLabel } from "../../lib/srs";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { WordFeedback, RetryBox, NextButton } from "../Feedback";

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

  const inputClass = "m-input" + (resolved ? (resolved.ok ? " ok" : " err") : "");

  return (
    <div className="m-card">
      <div className="m-q-head">
        <span className="m-q-kind">Напишите по-португальски</span>
        <Badge tag={tag} />
      </div>
      <div className="m-q-text">{word.ru}</div>
      {word.note && <div className="m-q-note">{word.note}</div>}
      {tag !== "new" && (
        <div className="m-q-srs">
          <Icon name="clock" /> следующий повтор: {nextDueLabel(card)} · интервал:{" "}
          {intervalLabel(card)}
        </div>
      )}
      <div className="m-q-prompt">Введите перевод:</div>
      <div className="m-field">
        <input
          ref={inputRef}
          className={inputClass}
          value={value}
          disabled={resolved !== null}
          autoFocus
          autoComplete="off"
          placeholder="Ваш ответ…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") check();
          }}
        />
      </div>
      <div className="m-hint">
        <Icon name="info" /> Акценты необязательны — «ate logo» = «até logo»
      </div>
      {!resolved && (
        <button
          className="m-btn m-btn--primary m-btn--block"
          style={{ marginTop: 14 }}
          onClick={check}
        >
          Проверить
        </button>
      )}
      {!resolved && retry && (
        <RetryBox>
          <b>Не совсем!</b> Ещё одна попытка.
        </RetryBox>
      )}
      {resolved && (
        <>
          <WordFeedback ok={resolved.ok} word={word} dueLabel={resolved.dueLabel} />
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
