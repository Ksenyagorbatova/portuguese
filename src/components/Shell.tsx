import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type {
  CompleteHeading,
  LessonView,
  NextStep,
  SessionItem,
  SessionOrigin,
  TopicView,
  WordView,
} from "../lib/types";
import { buildLessonQueue, buildMistakesQueue, buildReviewQueue } from "../lib/queue";
import { SENTENCE_TOPIC_THRESHOLD } from "../lib/learning";
import { adaptSrs } from "../lib/srs";
import { ConfirmDialog } from "./ConfirmDialog";
import { Header } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
import { ScoreRow } from "./ScoreRow";
import { TabBar } from "./TabBar";
import { ReviewTab } from "./ReviewTab";
import { TopicsTab } from "./TopicsTab";
import { Theory } from "./Theory";
import { Session } from "./Session";
import { Splash } from "./Splash";
import type { ThemeChoice } from "../lib/useTheme";

type Tab = "review" | "topics";
type View =
  | { kind: "home" }
  | { kind: "theory"; topicKey: string; lesson: LessonView }
  | { kind: "session"; queue: SessionItem[]; origin: SessionOrigin };

export function Shell({
  themeChoice,
  onCycleTheme,
}: {
  themeChoice: ThemeChoice;
  onCycleTheme: () => void;
}) {
  const course = useQuery(api.courseQueries.getCourse);
  const rawSrs = useQuery(api.progress.getSrsState);
  const markTheorySeen = useMutation(api.progress.markTheorySeen);
  // adaptSrs rebuilds the keyed maps from the array payload — memoize so the
  // rebuild happens per server update, not on every render.
  const srs = useMemo(() => (rawSrs == null ? rawSrs : adaptSrs(rawSrs)), [rawSrs]);

  const [tab, setTab] = useState<Tab>("review");
  const [view, setView] = useState<View>({ kind: "home" });
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [nonce, setNonce] = useState(0); // bump to remount Session on (re)start
  // Очередь дойдена до конца — Session уже показывает Complete (view.kind при
  // этом всё ещё "session"): прерывать нечего, goHome не спрашивает confirm.
  const [sessionDone, setSessionDone] = useState(false);
  // Открыт ли диалог «Выйти из тренировки?» (свой вместо window.confirm).
  const [confirmExit, setConfirmExit] = useState(false);

  // course === undefined → loading; srs === null → not authed yet (race)
  if (!course || !srs) return <Splash />;
  const c = course;
  const s = srs;

  function startReview() {
    setScore({ correct: 0, total: 0 });
    setNonce((n) => n + 1);
    setSessionDone(false);
    setView({ kind: "session", queue: buildReviewQueue(c, s), origin: "review" });
  }
  function startLesson(topicKey: string, lesson: LessonView) {
    setScore({ correct: 0, total: 0 });
    setNonce((n) => n + 1);
    setSessionDone(false);
    setView({
      kind: "session",
      queue: buildLessonQueue(lesson, s, c),
      origin: { topicKey, lessonKey: lesson.lessonKey },
    });
  }
  function openLesson(topicKey: string, lesson: LessonView) {
    if (!s.seenTheory.includes(lesson.lessonKey)) {
      setView({ kind: "theory", topicKey, lesson });
    } else {
      startLesson(topicKey, lesson);
    }
  }
  function beginFromTheory(topicKey: string, lesson: LessonView) {
    void markTheorySeen({ lessonKey: lesson.lessonKey });
    startLesson(topicKey, lesson);
  }
  // Open theory for viewing at any time (even after practice started), from the
  // per-lesson "Теория" button — theory is no longer hidden once seen.
  function openTheory(topicKey: string, lesson: LessonView) {
    void markTheorySeen({ lessonKey: lesson.lessonKey });
    setView({ kind: "theory", topicKey, lesson });
  }
  function switchTab(t: Tab) {
    setTab(t);
    setView({ kind: "home" });
  }
  // Logo-«домой» during an ACTIVE session would silently kill the progress —
  // ask first (свой ConfirmDialog вместо нестилизуемого window.confirm). Once
  // the session is complete (sessionDone, экран Complete) or outside a session
  // there is nothing to interrupt. Other switchTab callers (Complete's
  // «К повторению», Theory's «Назад») stay confirm-free too.
  function goHome() {
    const active = view.kind === "session" && !sessionDone;
    if (active) {
      setConfirmExit(true);
      return;
    }
    switchTab("review");
  }
  function findLesson(topicKey: string, lessonKey: string): LessonView | null {
    return (
      c.topics
        .find((t: TopicView) => t.topicKey === topicKey)
        ?.lessons.find((l: LessonView) => l.lessonKey === lessonKey) ?? null
    );
  }
  // Сколько слов урока ещё не выучено. lessonStats реактивны (Convex), поэтому
  // к экрану Complete значение уже учитывает ответы сессии; у нетронутого
  // урока строки в lessonStats может не быть — тогда весь урок впереди.
  function lessonRemaining(topicKey: string, lessonKey: string): number {
    const ls = s.lessonStats[lessonKey];
    if (ls) return ls.total - ls.learned;
    return findLesson(topicKey, lessonKey)?.words.length ?? 0;
  }
  // Финал-трамплин: CTA по фактическому прогрессу — продолжить недоученный
  // урок → следующий урок темы → (тема ≥ порога предложений) первый урок
  // следующей темы. Для review-сессий шага вперёд нет (CTA «Ещё раз»).
  function nextStepOf(origin: SessionOrigin): NextStep | null {
    if (origin === "review") return null;
    const ti = c.topics.findIndex((t: TopicView) => t.topicKey === origin.topicKey);
    const topic = c.topics[ti];
    if (!topic) return null;
    const remaining = lessonRemaining(origin.topicKey, origin.lessonKey);
    if (remaining > 0) return { kind: "continue", remaining };
    const i = topic.lessons.findIndex((l: LessonView) => l.lessonKey === origin.lessonKey);
    const nx = topic.lessons[i + 1];
    if (nx) return { kind: "lesson", topicKey: origin.topicKey, lessonKey: nx.lessonKey, label: nx.label };
    const ts = s.topicStats[origin.topicKey];
    const topicReady = !!ts && ts.total > 0 && ts.learned / ts.total >= SENTENCE_TOPIC_THRESHOLD;
    const nextTopic = c.topics[ti + 1];
    const first = nextTopic?.lessons[0];
    if (topicReady && first)
      return { kind: "topic", topicKey: nextTopic.topicKey, lessonKey: first.lessonKey, label: nextTopic.label };
    return null;
  }
  // Заголовок финала: «Тема закрыта!» только при 100% слов темы, «Урок выучен!»
  // при добитом уроке, иначе «Сессия завершена!».
  function headingOf(origin: SessionOrigin): CompleteHeading {
    if (origin === "review") return "session";
    const ts = s.topicStats[origin.topicKey];
    if (ts && ts.total > 0 && ts.learned === ts.total) return "topic";
    if (lessonRemaining(origin.topicKey, origin.lessonKey) === 0) return "lesson";
    return "session";
  }
  // Мини-сессия из промахов финала: та же статичная механика, origin
  // наследуется (после неё финал снова считает CTA по факту).
  function retryMistakes(origin: SessionOrigin, words: WordView[]) {
    if (words.length === 0) return;
    setScore({ correct: 0, total: 0 });
    setNonce((n) => n + 1);
    setSessionDone(false);
    setView({ kind: "session", queue: buildMistakesQueue(words, s), origin });
  }
  function onRestart() {
    if (view.kind !== "session") return;
    if (view.origin === "review") {
      startReview();
    } else {
      const lesson = findLesson(view.origin.topicKey, view.origin.lessonKey);
      if (lesson) startLesson(view.origin.topicKey, lesson);
    }
  }
  function onPickLesson(topicKey: string, lessonKey: string) {
    const lesson = findLesson(topicKey, lessonKey);
    if (lesson) openLesson(topicKey, lesson);
  }

  const inSession = view.kind === "session";

  let content;
  if (view.kind === "session") {
    content = (
      <Session
        key={nonce}
        queue={view.queue}
        course={c}
        cards={s.cards}
        dueCountAll={s.dueCountAll}
        heading={headingOf(view.origin)}
        nextStep={nextStepOf(view.origin)}
        onScore={(correct, total) => setScore({ correct, total })}
        onRestart={onRestart}
        onPickLesson={onPickLesson}
        onGoReview={() => switchTab("review")}
        onExit={() => setView({ kind: "home" })}
        onRetryMistakes={(words) => retryMistakes(view.origin, words)}
        onComplete={() => setSessionDone(true)}
      />
    );
  } else if (view.kind === "theory") {
    content = (
      <Theory
        lesson={view.lesson}
        onBegin={() => beginFromTheory(view.topicKey, view.lesson)}
        onBack={() => switchTab("topics")}
      />
    );
  } else {
    content =
      tab === "review" ? (
        <ReviewTab course={c} srs={s} onStart={startReview} onGoTopics={() => switchTab("topics")} />
      ) : (
        <TopicsTab course={c} srs={s} onOpenLesson={openLesson} onOpenTheory={openTheory} />
      );
  }

  const viewKey =
    view.kind === "session"
      ? `session-${nonce}`
      : view.kind === "theory"
        ? `theory-${view.lesson.lessonKey}`
        : `home-${tab}`;

  // During a session the stat strip and tab bar are hidden so only the training
  // card remains — keeps the «Дальше» button on-screen without scrolling
  // (the session has its own exit control instead of the tabs).
  return (
    <>
      <Header
        streak={s.streak}
        doneToday={s.doneToday}
        themeChoice={themeChoice}
        onCycleTheme={onCycleTheme}
        onHome={goHome}
      />
      {confirmExit && (
        <ConfirmDialog
          title="Выйти из тренировки?"
          message="Прогресс этой сессии не сохранится."
          confirmLabel="Выйти"
          cancelLabel="Остаться"
          onConfirm={() => {
            setConfirmExit(false);
            switchTab("review");
          }}
          onCancel={() => setConfirmExit(false)}
        />
      )}
      <OfflineBanner />
      {!inSession && (
        <>
          {score.total > 0 && <ScoreRow correct={score.correct} total={score.total} />}
          <TabBar tab={tab} onTab={switchTab} />
        </>
      )}
      <div className="m-view" key={viewKey}>
        {content}
      </div>
    </>
  );
}
