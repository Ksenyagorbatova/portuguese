import { useMemo, useState } from "react";
import type {
  BadgeTag,
  CardFields,
  Course,
  ExerciseType,
  SessionItem,
} from "../lib/types";
import { queueCounts } from "../lib/queue";
import { wKey } from "../lib/srs";
import { McExercise } from "./exercises/McExercise";
import { TypeExercise } from "./exercises/TypeExercise";
import { SentenceBuilder } from "./exercises/SentenceBuilder";
import { Complete } from "./Complete";

function pickExerciseType(tag: BadgeTag): ExerciseType {
  const pool: ExerciseType[] = ["mc_pt_ru", "mc_ru_pt", "type_pt"];
  // 'due' items lean on typing to reinforce (ported from nextExercise).
  if (tag === "due") {
    return Math.random() < 0.5 ? "type_pt" : pool[Math.floor(Math.random() * 2)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

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
}) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [type, setType] = useState<ExerciseType>(() => {
    const it = queue[0];
    return it && it.kind === "word" ? pickExerciseType(it.tag) : "mc_pt_ru";
  });

  const counts = useMemo(() => queueCounts(queue), [queue]);

  function handleAnswered(firstTryCorrect: boolean) {
    const ns = {
      correct: score.correct + (firstTryCorrect ? 1 : 0),
      total: score.total + 1,
    };
    setScore(ns);
    onScore(ns.correct, ns.total);
  }

  function advance() {
    const ni = idx + 1;
    const it = queue[ni];
    if (it && it.kind === "word") setType(pickExerciseType(it.tag));
    setIdx(ni);
  }

  if (idx >= queue.length) {
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

  const item = queue[idx];
  const isLast = idx === queue.length - 1;
  const width = Math.round((idx / queue.length) * 100);

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
    <>
      <div className="m-session-top">
        <div className="m-progress">
          <div className="m-progress-fill" style={{ width: `${width}%` }} />
        </div>
        <span className="m-progress-count">
          {idx + 1}/{queue.length}
        </span>
      </div>
      <SessionChips counts={counts} />
      {exercise}
    </>
  );
}

function SessionChips({
  counts,
}: {
  counts: { due: number; nw: number; rv: number; cr: number };
}) {
  const chip = (cls: string, n: number, label: string) =>
    n > 0 ? (
      <span className={"m-badge " + cls}>
        <span className={"m-dot " + cls} />
        {n} {label}
      </span>
    ) : null;
  if (counts.due + counts.nw + counts.rv + counts.cr === 0) return null;
  return (
    <div className="m-chips">
      {chip("due", counts.due, "срочных")}
      {chip("new", counts.nw, "новых")}
      {chip("rev", counts.rv, "повторений")}
      {chip("cross", counts.cr, "сочетаний")}
    </div>
  );
}
