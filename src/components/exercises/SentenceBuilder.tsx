import { useMemo, useState } from "react";
import type { CrossSentenceView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { sentenceMatch } from "../../lib/text";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { FeedbackBox, NextButton } from "../Feedback";

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
    <div className="card">
      <div className="q-type">
        Составьте предложение <Badge tag="cross" />
      </div>
      <div className="q-text" style={{ fontSize: 17 }}>
        {sentence.ru}
      </div>
      <div className="q-sub">Расставьте слова в правильном порядке:</div>

      <div className="ans-row">
        {selected.length === 0 ? (
          <span className="ans-ph">нажимай слова снизу…</span>
        ) : (
          selected.map((id, idx) => (
            <div
              key={idx}
              className="atile"
              onClick={() => !resolved && setSelected((s) => s.filter((_, i) => i !== idx))}
            >
              {wordById.get(id)}
            </div>
          ))
        )}
      </div>

      <div className="word-bank">
        {tiles.map((t) => (
          <div
            key={t.id}
            className={"wtile" + (used.has(t.id) ? " used" : "")}
            onClick={() => !resolved && !used.has(t.id) && setSelected((s) => [...s, t.id])}
          >
            {t.w}
          </div>
        ))}
      </div>

      {!resolved && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="submit-btn" onClick={check}>
            Проверить
          </button>
          <button
            className="submit-btn"
            style={{ background: "#888" }}
            onClick={() => !resolved && setSelected([])}
          >
            Очистить
          </button>
        </div>
      )}

      {!resolved && retry && (
        <FeedbackBox kind="retry">
          <b>Не совсем!</b> Попробуйте ещё раз.
        </FeedbackBox>
      )}
      {resolved && (
        <>
          <FeedbackBox kind={resolved.ok ? "success" : "error"}>
            <b>{resolved.ok ? "Верно!" : "Правильно:"}</b> {sentence.answer}
            <br />
            <small>{sentence.ru}</small>
          </FeedbackBox>
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
