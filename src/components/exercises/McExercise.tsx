import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { BadgeTag, CardFields, Course, WordView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { getWrong } from "../../lib/wrongOptions";
import { nextDueLabel, intervalLabel } from "../../lib/srs";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { FeedbackBox, NextButton } from "../Feedback";

type Resolved = { ok: boolean; dueLabel: string };

export function McExercise({
  word,
  mode,
  tag,
  card,
  course,
  isLast,
  onAnswered,
  onNext,
}: {
  word: WordView;
  mode: "pt_ru" | "ru_pt";
  tag: BadgeTag;
  card: CardFields | undefined;
  course: Course;
  isLast: boolean;
  onAnswered: (firstTryCorrect: boolean) => void;
  onNext: () => void;
}) {
  const recordAnswer = useMutation(api.progress.recordAnswer);
  const options = useMemo(() => shuffle([word, ...getWrong(course, word)]), [word, course]);
  const [wrongPicked, setWrongPicked] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState(0);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const label = (o: WordView) => (mode === "pt_ru" ? o.ru : o.pt);
  const isCorrectOpt = (o: WordView) => o.pt === word.pt;

  async function finish(quality: 0 | 1 | 2, ok: boolean) {
    speak(word.pt);
    onAnswered(quality === 2);
    const res = await recordAnswer({ lessonKey: word.lessonKey, pt: word.pt, quality });
    setResolved({ ok, dueLabel: nextDueLabel(res.card) });
  }

  function choose(o: WordView) {
    if (resolved) return;
    const first = tries === 0;
    if (isCorrectOpt(o)) {
      void finish(first ? 2 : 1, true);
    } else {
      setWrongPicked((prev) => new Set(prev).add(o.pt));
      if (tries < 1) setTries(1);
      else void finish(0, false);
    }
  }

  function optClass(o: WordView): string {
    if (resolved) {
      if (isCorrectOpt(o)) return "opt correct";
      if (wrongPicked.has(o.pt)) return "opt wrong";
      return "opt";
    }
    return wrongPicked.has(o.pt) ? "opt wrong" : "opt";
  }

  const question = mode === "pt_ru" ? word.pt : word.ru;
  const prompt = mode === "pt_ru" ? "Что это значит по-русски?" : "Как это по-португальски?";

  return (
    <div className="card">
      <div className="q-type">
        {mode === "pt_ru" ? "Выберите перевод" : "Выберите по-португальски"} <Badge tag={tag} />
      </div>
      <div className="q-text">{question}</div>
      {word.note && <div className="q-note">{word.note}</div>}
      {tag !== "new" && (
        <div className="eb-info">
          ⏱ следующий повтор: {nextDueLabel(card)} · интервал: {intervalLabel(card)}
        </div>
      )}
      <div className="q-sub">{prompt}</div>
      <div className="opts-grid">
        {options.map((o) => (
          <button
            key={o.pt}
            className={optClass(o)}
            disabled={resolved !== null || wrongPicked.has(o.pt)}
            onClick={() => choose(o)}
          >
            {label(o)}
          </button>
        ))}
      </div>
      {!resolved && tries > 0 && (
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
