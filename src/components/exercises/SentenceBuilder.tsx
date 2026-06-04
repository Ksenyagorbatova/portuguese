import { useMemo, useState } from "react";
import type { CrossSentenceView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { sentenceMatch } from "../../lib/text";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { ResultFeedback, RetryBox, NextButton } from "../Feedback";

// Cross-topic sentences don't touch SRS in the original — they only affect the
// session score. So this exercise calls onAnswered but NOT recordAnswer.
export function SentenceBuilder({
  sentence,
  isLast,
  onAnswered,
  onNext,
}: {
  sentence: CrossSentenceView;
  isLast: boolean;
  onAnswered: (firstTryCorrect: boolean) => void;
  onNext: () => void;
}) {
  // Tiles carry a stable id (their scrambled index) so duplicate words work.
  const tiles = useMemo(
    () => shuffle(sentence.words.map((w, i) => ({ w, id: i }))),
    [sentence],
  );
  const wordById = useMemo(() => {
    const m = new Map<number, string>();
    tiles.forEach((t) => m.set(t.id, t.w));
    return m;
  }, [tiles]);

  const [selected, setSelected] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const [retry, setRetry] = useState(false);
  const [resolved, setResolved] = useState<{ ok: boolean } | null>(null);

  const used = new Set(selected);

  function check() {
    if (resolved || selected.length === 0) return;
    const user = selected.map((id) => wordById.get(id) ?? "").join(" ");
    const ok = sentenceMatch(user, sentence.answer);
    const first = tries === 0;
    if (ok) {
      speak(sentence.answer);
      onAnswered(first);
      setResolved({ ok: true });
    } else if (tries < 1) {
      setTries(1);
      setRetry(true);
    } else {
      speak(sentence.answer);
      onAnswered(false);
      setResolved({ ok: false });
    }
  }

  return (
    <div className="m-card">
      <div className="m-q-head">
        <span className="m-q-kind">Составьте предложение</span>
        <Badge tag="cross" />
      </div>
      <div className="m-q-text sentence">{sentence.ru}</div>
      <div className="m-q-prompt">Расставьте слова в правильном порядке:</div>

      <div className={"m-answer" + (selected.length === 0 ? " empty" : "")}>
        {selected.length === 0 ? (
          <span className="m-ans-ph">нажимай слова снизу…</span>
        ) : (
          selected.map((id, idx) => (
            <div
              key={idx}
              className="m-atile"
              onClick={() => !resolved && setSelected((s) => s.filter((_, i) => i !== idx))}
            >
              {wordById.get(id)}
            </div>
          ))
        )}
      </div>

      <div className="m-bank">
        {tiles.map((t) => (
          <div
            key={t.id}
            className={"m-wtile" + (used.has(t.id) ? " used" : "")}
            onClick={() => !resolved && !used.has(t.id) && setSelected((s) => [...s, t.id])}
          >
            {t.w}
          </div>
        ))}
      </div>

      {!resolved && (
        <div style={{ display: "flex", gap: 10 }}>
          <button className="m-btn m-btn--primary" style={{ flex: 1 }} onClick={check}>
            Проверить
          </button>
          <button className="m-btn m-btn--ghost" onClick={() => setSelected([])}>
            Очистить
          </button>
        </div>
      )}

      {!resolved && retry && (
        <RetryBox>
          <b>Не совсем!</b> Попробуйте ещё раз.
        </RetryBox>
      )}
      {resolved && (
        <>
          <ResultFeedback ok={resolved.ok}>
            <b>{resolved.ok ? "Верно!" : "Правильно:"}</b>{" "}
            <span className="m-fb-pt">{sentence.answer}</span>
            <div className="m-fb-sub">{sentence.ru}</div>
          </ResultFeedback>
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
