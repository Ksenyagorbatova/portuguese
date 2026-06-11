import { useEffect, useState } from "react";
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
import { pickExerciseType, LEECH_THRESHOLD } from "../lib/learning";
import { isMuted, isSpeechSupported } from "../lib/speech";
import { McExercise } from "./exercises/McExercise";
import { TypeExercise } from "./exercises/TypeExercise";
import { SentenceBuilder } from "./exercises/SentenceBuilder";
import { Complete } from "./Complete";
import { CourseComplete } from "./CourseComplete";
import { Icon } from "./Icon";

// Финал курса (П.5): цифры экрана + флаг «показано». null — курс ещё не закрыт.
type CourseStats = {
  wordsTotal: number;
  topicsTotal: number;
  days: number | null;
  bestStreak: number;
};
// localStorage-флаг «финал курса уже видели» — экран показывается один раз.
const COURSE_SEEN_KEY = "pt-course-complete-seen";

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
  onReadTheory,
  courseComplete,
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
  // Открыть теорию урока (липучки, П.4) — ссылка «Перечитать теорию» в разборе.
  onReadTheory: (topicKey: string, lessonKey: string) => void;
  // Финал курса (П.5): цифры экрана, если этой сессией закрыта последняя тема;
  // null — курс ещё не пройден (показываем обычный Complete).
  courseComplete: CourseStats | null;
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
  // Доступно ли аудирование (П.1) — звук не в mute И есть Web Speech API.
  // Считается в момент выбора типа (на каждом advance): mute мог переключиться
  // внутри сессии, гейт должен это уважать.
  const audioOk = () => isSpeechSupported() && !isMuted();
  // Урок слова в дереве курса — для ссылки «Перечитать теорию» (липучки, П.4).
  const lessonOf = (word: WordView): { topicKey: string; label: string } | null => {
    for (const t of course.topics)
      for (const l of t.lessons)
        if (l.lessonKey === word.lessonKey) return { topicKey: t.topicKey, label: l.label };
    return null;
  };

  const [type, setType] = useState<ExerciseType>(() => {
    const it = queue[0];
    if (it && it.kind === "word")
      return pickExerciseType(stageCardOf(wKey(it.word.lessonKey, it.word.pt)), it.tag, Math.random, audioOk());
    return "mc_pt_ru";
  });

  // Финал курса (П.5) показываем ОДИН раз: флаг читаем при mount (стабильно),
  // пишем — только когда экран реально показан (см. эффект ниже у atEnd).
  const [courseSeen] = useState(() => {
    try {
      return !!localStorage.getItem(COURSE_SEEN_KEY);
    } catch {
      return false;
    }
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
      setType(pickExerciseType(stageCardOf(wKey(it.word.lessonKey, it.word.pt)), it.tag, Math.random, audioOk()));
    if (ni >= queue.length) onComplete?.(); // очередь исчерпана → дальше Complete
    setIdx(ni);
  }

  // Финал курса (П.5): показываем CourseComplete ВМЕСТО Complete, когда сессией
  // закрыта последняя тема (courseComplete != null) и его ещё не видели. Флаг
  // пишем в эффекте — только когда экран реально на экране (atEnd), чтобы
  // ранний выход не «сжёг» единственный показ.
  const atEnd = idx >= queue.length;
  const showCourse = atEnd && courseComplete != null && !courseSeen;
  useEffect(() => {
    if (showCourse) {
      try {
        localStorage.setItem(COURSE_SEEN_KEY, "1");
      } catch {
        // storage недоступен — флаг не сохранится, в этой сессии покажем как есть
      }
    }
  }, [showCourse]);

  if (atEnd) {
    if (showCourse && courseComplete) {
      return (
        <CourseComplete
          wordsTotal={courseComplete.wordsTotal}
          topicsTotal={courseComplete.topicsTotal}
          days={courseComplete.days}
          bestStreak={courseComplete.bestStreak}
          onGoReview={onGoReview}
        />
      );
    }
    // Липучки (П.4): среди промахов — те, у кого накопилось lapses ≥ порога
    // (счётчик серверный, сквозной). Бейдж «даётся тяжело» + ссылка на теорию
    // урока ПЕРВОЙ липучки. Показываем только в разборе ошибок, нигде больше.
    const isLeech = (w: WordView) =>
      (cards[wKey(w.lessonKey, w.pt)]?.lapses ?? 0) >= LEECH_THRESHOLD;
    const leechKeys = mistakes.filter(isLeech).map((w) => wKey(w.lessonKey, w.pt));
    const firstLeech = mistakes.find(isLeech);
    const lo = firstLeech ? lessonOf(firstLeech) : null;
    const relearn =
      firstLeech && lo
        ? { label: lo.label, topicKey: lo.topicKey, lessonKey: firstLeech.lessonKey }
        : null;
    return (
      <Complete
        correct={score.correct}
        total={score.total}
        dueCountAll={dueCountAll}
        heading={heading}
        nextStep={nextStep}
        mistakes={mistakes}
        leechKeys={leechKeys}
        relearn={relearn}
        onRestart={onRestart}
        onPickLesson={onPickLesson}
        onGoReview={onGoReview}
        onGoTopics={onGoTopics}
        onRetryMistakes={() => onRetryMistakes(mistakes)}
        onReadTheory={onReadTheory}
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
          mode={type === "mc_pt_ru" ? "pt_ru" : type === "mc_ru_pt" ? "ru_pt" : "audio_ru"}
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
