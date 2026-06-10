import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { AnswerResult, BadgeTag, CardFields, WordView } from "../../lib/types";
import { variantsMatch } from "../../lib/text";
import { localDay } from "../../lib/day";
import { nextDueLabel } from "../../lib/srs";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { WordFeedback, RetryBox, NextButton } from "../Feedback";

// dueLabel: null — ответ сервера ещё не пришёл (или мутация упала), Feedback
// покажет «—»; saveFailed — мутация отвергнута, ответ в расписание не попал.
type Resolved = { ok: boolean; dueLabel: string | null; saveFailed?: boolean };

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
  onAnswered: (result: AnswerResult) => void;
  onNext: () => void;
}) {
  const recordAnswer = useMutation(api.progress.recordAnswer);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [retry, setRetry] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  // Синхронный guard от двойного ответа: проверка по state (resolved) не
  // закрывает окно между событием и применением обновления — ref выставляется
  // ДО любой асинхронщины, и повторный Enter/клик не даёт второго finish().
  const pendingRef = useRef(false);

  function finish(quality: 0 | 1 | 2, ok: boolean) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    speak(word.pt);
    onAnswered({ mode: "type", correct: quality >= 1, firstTry: quality === 2 });
    // UI резолвим сразу, НЕ дожидаясь сети: при разрыве соединения Convex
    // не реджектит мутацию, а держит её в очереди до реконнекта (промис висит
    // неограниченно долго) — ждать его значит подвесить упражнение. Метка
    // следующего повтора подтянется с ответом сервера; при отказе мутации
    // останется «—» с пометкой, что ответ не сохранился.
    setResolved({ ok, dueLabel: null });
    void recordAnswer({
      lessonKey: word.lessonKey,
      pt: word.pt,
      quality,
      mode: "type",
      clientDay: localDay(),
    }).then(
      (res) => setResolved({ ok, dueLabel: nextDueLabel(res.card) }),
      () => setResolved({ ok, dueLabel: null, saveFailed: true }),
    );
  }

  function check() {
    if (resolved || pendingRef.current) return;
    const ok = variantsMatch(value, word.pt);
    const first = tries === 0;
    if (ok) {
      finish(first ? 2 : 1, true);
    } else if (tries < 1) {
      setTries(1);
      setRetry(true);
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      finish(0, false);
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
      {/* Только для реально просроченных (due) слов — см. McExercise. */}
      {tag === "due" && (
        <div className="m-q-srs">
          <Icon name="clock" /> следующий повтор: {nextDueLabel(card)}
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
            if (e.repeat) return; // удержание клавиши: авторепит шлёт повторные keydown
            if (e.key === "Enter") check();
          }}
        />
      </div>
      <div className="m-hint">
        <Icon name="info" /> Акценты и пунктуация необязательны — «ate logo» = «até logo»
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
          <WordFeedback
            ok={resolved.ok}
            word={word}
            dueLabel={resolved.dueLabel}
            saveFailed={resolved.saveFailed}
          />
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
