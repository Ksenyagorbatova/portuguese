import { useState } from "react";
import type {
  AnswerResult,
  CardFields,
  CompleteHeading,
  Course,
  ExerciseType,
  NextStep,
  SessionItem,
  WordView,
} from "../lib/types";
import { wKey } from "../lib/srs";
import { pickExerciseType } from "../lib/learning";
import { McExercise } from "./exercises/McExercise";
import { TypeExercise } from "./exercises/TypeExercise";
import { SentenceBuilder } from "./exercises/SentenceBuilder";
import { Complete } from "./Complete";
import { Icon } from "./Icon";

// Local per-session stage progress for one word (seeded from the server card,
// then advanced client-side as the user answers — drives the per-card exercise
// type for repeat shows of the same word within the static queue).
//   mc/type — correct choices / manual inputs so far.
type WordProgress = { mc: number; type: number };

export function Session({
  queue,
  course,
  cards,
  dueCountAll,
  heading,
  nextStep,
  onScore,
  onRestart,
  onPickLesson,
  onGoReview,
  onGoTopics,
  onExit,
  onRetryMistakes,
  onComplete,
}: {
  queue: SessionItem[];
  course: Course;
  cards: Record<string, CardFields>;
  dueCountAll: number;
  heading: CompleteHeading;
  nextStep: NextStep | null;
  onScore: (correct: number, total: number) => void;
  onRestart: () => void;
  onPickLesson: (topicKey: string, lessonKey: string) => void;
  onGoReview: () => void;
  onGoTopics: () => void;
  onExit: () => void;
  // Мини-сессия с финала: повторить промахнутые слова этой сессии.
  onRetryMistakes: (words: WordView[]) => void;
  // Сессия дойдена до экрана Complete (очередь исчерпана) — Shell по этому
  // флагу перестаёт спрашивать confirm при выходе по логотипу.
  onComplete?: () => void;
}) {
  // The queue is STATIC: built once before mount, never grows — a miss does not
  // re-insert the card (per-word progress is server-side, the next session
  // resumes the grind). Only the cursor moves.
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  // Уникальные слова, отвеченные с quality 0 (исчерпаны обе попытки) — финал
  // показывает их разбором «Споткнулся на» с кнопкой повтора.
  const [mistakes, setMistakes] = useState<WordView[]>([]);

  // Per-session stage progress, seeded from the server cards on mount.
  const [wp, setWp] = useState<Record<string, WordProgress>>(() =>
    Object.fromEntries(
      Object.entries(cards).map(([k, c]) => [k, { mc: c.mcCorrect, type: c.typeCorrect }]),
    ),
  );
  const stageCardOf = (key: string) => {
    const p = wp[key];
    return p ? { mcCorrect: p.mc, typeCorrect: p.type } : undefined;
  };

  const [type, setType] = useState<ExerciseType>(() => {
    const it = queue[0];
    if (it && it.kind === "word")
      return pickExerciseType(stageCardOf(wKey(it.word.lessonKey, it.word.pt)), it.tag);
    return "mc_pt_ru";
  });

  function handleAnswered(result: AnswerResult) {
    const ns = {
      correct: score.correct + (result.firstTry ? 1 : 0),
      total: score.total + 1,
    };
    setScore(ns);
    onScore(ns.correct, ns.total);

    const item = queue[idx];
    if (item.kind === "sentence") return; // предложения в разбор ошибок не попадают
    const key = wKey(item.word.lessonKey, item.word.pt);
    const cur = wp[key] ?? { mc: 0, type: 0 };
    const next: WordProgress = {
      mc: cur.mc + (result.correct && result.mode === "mc" ? 1 : 0),
      type: cur.type + (result.correct && result.mode === "type" ? 1 : 0),
    };
    setWp((prev) => ({ ...prev, [key]: next }));

    if (!result.correct) {
      setMistakes((prev) =>
        prev.some((w) => wKey(w.lessonKey, w.pt) === key) ? prev : [...prev, item.word],
      );
    }
  }

  function advance() {
    const ni = idx + 1;
    const it = queue[ni];
    if (it && it.kind === "word")
      setType(pickExerciseType(stageCardOf(wKey(it.word.lessonKey, it.word.pt)), it.tag));
    if (ni >= queue.length) onComplete?.(); // очередь исчерпана → дальше Complete
    setIdx(ni);
  }

  if (idx >= queue.length) {
    return (
      <Complete
        correct={score.correct}
        total={score.total}
        dueCountAll={dueCountAll}
        heading={heading}
        nextStep={nextStep}
        mistakes={mistakes}
        onRestart={onRestart}
        onPickLesson={onPickLesson}
        onGoReview={onGoReview}
        onGoTopics={onGoTopics}
        onRetryMistakes={() => onRetryMistakes(mistakes)}
      />
    );
  }

  const item = queue[idx];
  const isLast = idx === queue.length - 1;
  // Полоса = ПОЗИЦИЯ в сессии. Очередь статична → знаменатель не меняется.
  const posPct = queue.length > 0 ? Math.round((idx / queue.length) * 100) : 0;

  let exercise;
  if (item.kind === "sentence") {
    exercise = (
      <SentenceBuilder
        key={idx}
        sentence={item.sentence}
        isLast={isLast}
        onAnswered={handleAnswered}
        onNext={advance}
      />
    );
  } else {
    const card = cards[wKey(item.word.lessonKey, item.word.pt)];
    if (type === "type_pt") {
      exercise = (
        <TypeExercise
          key={idx}
          word={item.word}
          tag={item.tag}
          card={card}
          isLast={isLast}
          onAnswered={handleAnswered}
          onNext={advance}
        />
      );
    } else {
      exercise = (
        <McExercise
          key={idx}
          word={item.word}
          mode={type === "mc_pt_ru" ? "pt_ru" : "ru_pt"}
          tag={item.tag}
          card={card}
          course={course}
          isLast={isLast}
          onAnswered={handleAnswered}
          onNext={advance}
        />
      );
    }
  }

  return (
    <div className="m-session">
      <div className="m-session-top">
        <button
          className="m-session-exit"
          onClick={onExit}
          aria-label="Выйти из тренировки"
          title="Выйти из тренировки"
        >
          <Icon name="x" size={18} />
        </button>
        <div
          className="m-progress"
          role="progressbar"
          aria-label="Позиция в сессии"
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuenow={idx + 1}
        >
          <div className="m-progress-fill" style={{ width: `${posPct}%` }} />
        </div>
        <span className="m-progress-count">
          {idx + 1}/{queue.length}
        </span>
      </div>
      {exercise}
    </div>
  );
}
