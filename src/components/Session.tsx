import { useState } from "react";
import type {
  AnswerResult,
  CardFields,
  Course,
  ExerciseType,
  SessionItem,
} from "../lib/types";
import { wKey } from "../lib/srs";
import { pickExerciseType, shouldRequeue, requeuePosition } from "../lib/learning";
import { McExercise } from "./exercises/McExercise";
import { TypeExercise } from "./exercises/TypeExercise";
import { SentenceBuilder } from "./exercises/SentenceBuilder";
import { Complete } from "./Complete";
import { Icon } from "./Icon";

// Local per-session stage progress for one word (seeded from the server card,
// then advanced client-side as the user answers — drives in-session rotation).
//   mc/type — correct choices / manual inputs so far; shown — times displayed.
type WordProgress = { mc: number; type: number; shown: number };

export function Session({
  queue,
  course,
  cards,
  dueCountAll,
  nextLesson,
  onScore,
  onRestart,
  onPickLesson,
  onGoReview,
  onExit,
}: {
  queue: SessionItem[];
  course: Course;
  cards: Record<string, CardFields>;
  dueCountAll: number;
  nextLesson: { topicKey: string; lessonKey: string; label: string } | null;
  onScore: (correct: number, total: number) => void;
  onRestart: () => void;
  onPickLesson: (topicKey: string, lessonKey: string) => void;
  onGoReview: () => void;
  onExit: () => void;
}) {
  // Mutable working queue: not-yet-learned words get re-inserted as the user
  // answers, so a new word is drilled within the same session (choosing →
  // typing → learned) instead of being shown once and deferred to SM-2.
  const [items, setItems] = useState<SessionItem[]>(queue);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Per-session stage progress, seeded from the server cards on mount.
  const [wp, setWp] = useState<Record<string, WordProgress>>(() =>
    Object.fromEntries(
      Object.entries(cards).map(([k, c]) => [k, { mc: c.mcCorrect, type: c.typeCorrect, shown: 0 }]),
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

    const item = items[idx];
    if (item.kind === "sentence") {
      // A sentence is shown once — never re-queued.
      return;
    }
    const key = wKey(item.word.lessonKey, item.word.pt);
    const cur = wp[key] ?? { mc: 0, type: 0, shown: 0 };
    const next: WordProgress = {
      mc: cur.mc + (result.correct && result.mode === "mc" ? 1 : 0),
      type: cur.type + (result.correct && result.mode === "type" ? 1 : 0),
      shown: cur.shown + 1,
    };
    setWp((prev) => ({ ...prev, [key]: next }));

    const stageCard = { mcCorrect: next.mc, typeCorrect: next.type };
    if (shouldRequeue(stageCard, next.shown)) {
      setItems((prev) => {
        const n = [...prev];
        n.splice(requeuePosition(idx, n.length), 0, item);
        return n;
      });
    }
  }

  function advance() {
    const ni = idx + 1;
    const it = items[ni];
    if (it && it.kind === "word")
      setType(pickExerciseType(stageCardOf(wKey(it.word.lessonKey, it.word.pt)), it.tag));
    setIdx(ni);
  }

  if (idx >= items.length) {
    return (
      <Complete
        correct={score.correct}
        total={score.total}
        dueCountAll={dueCountAll}
        nextLesson={nextLesson}
        onRestart={onRestart}
        onPickLesson={onPickLesson}
        onGoReview={onGoReview}
      />
    );
  }

  const item = items[idx];
  const isLast = idx === items.length - 1;
  // Полоса = ПОЗИЦИЯ в сессии (пройдено карточек / всего, растёт с переспросами).
  const posPct = items.length > 0 ? Math.round((idx / items.length) * 100) : 0;

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
        <div className="m-progress">
          <div className="m-progress-fill" style={{ width: `${posPct}%` }} />
        </div>
        <span className="m-progress-count">
          {idx + 1}/{items.length}
        </span>
      </div>
      {exercise}
    </div>
  );
}
