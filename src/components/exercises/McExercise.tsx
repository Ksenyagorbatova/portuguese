import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { AnswerResult, BadgeTag, CardFields, Course, WordView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { getWrong } from "../../lib/wrongOptions";
import { nextDueLabel } from "../../lib/srs";
import { speak } from "../../lib/speech";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { WordFeedback, RetryBox, NextButton } from "../Feedback";

type Resolved = { ok: boolean; dueLabel: string };

const KEYS = ["A", "B", "C", "D", "E"];

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
  onAnswered: (result: AnswerResult) => void;
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
    onAnswered({ mode: "mc", correct: quality >= 1, firstTry: quality === 2 });
    const res = await recordAnswer({ lessonKey: word.lessonKey, pt: word.pt, quality, mode: "mc" });
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
      if (isCorrectOpt(o)) return "m-opt correct";
      if (wrongPicked.has(o.pt)) return "m-opt wrong";
      return "m-opt";
    }
    return wrongPicked.has(o.pt) ? "m-opt wrong" : "m-opt";
  }

  const question = mode === "pt_ru" ? word.pt : word.ru;
  const prompt = mode === "pt_ru" ? "Что это значит по-русски?" : "Как это по-португальски?";

  return (
    <div className="m-card">
      <div className="m-q-head">
        <span className="m-q-kind">
          {mode === "pt_ru" ? "Выберите перевод" : "Выберите по-португальски"}
        </span>
        <Badge tag={tag} />
      </div>
      <div className="m-q-row">
        <div className="m-q-text">{question}</div>
        {mode === "pt_ru" && (
          <button className="m-audio" onClick={() => speak(word.pt)} aria-label="Прослушать">
            <Icon name="volume" />
          </button>
        )}
      </div>
      {word.note && <div className="m-q-note">{word.note}</div>}
      {/* Строку показываем только для реально просроченных (due) слов: при
          досрочной практике («Тренировать все слова») дата будущего повтора —
          шум. После ответа расписание всё равно показывает Feedback. */}
      {tag === "due" && (
        <div className="m-q-srs">
          <Icon name="clock" /> следующий повтор: {nextDueLabel(card)}
        </div>
      )}
      <div className="m-q-prompt">{prompt}</div>
      <div className="m-opts">
        {options.map((o, i) => (
          <button
            key={o.pt}
            className={optClass(o)}
            disabled={resolved !== null || wrongPicked.has(o.pt)}
            onClick={() => choose(o)}
          >
            <span className="m-opt-key">{KEYS[i]}</span>
            <span className="m-opt-label">{label(o)}</span>
            <span className="m-opt-mark">
              <Icon name={isCorrectOpt(o) ? "check" : "x"} size={20} />
            </span>
          </button>
        ))}
      </div>
      {!resolved && tries > 0 && (
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
