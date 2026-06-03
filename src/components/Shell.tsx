import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { LessonView, SessionItem, SessionOrigin, TopicView } from "../lib/types";
import { buildLessonQueue, buildReviewQueue } from "../lib/queue";
import { adaptSrs } from "../lib/srs";
import { Header } from "./Header";
import { ScoreRow } from "./ScoreRow";
import { TabBar } from "./TabBar";
import { ReviewTab } from "./ReviewTab";
import { TopicsTab } from "./TopicsTab";
import { Theory } from "./Theory";
import { Session } from "./Session";
import { Splash } from "./Splash";

type Tab = "review" | "topics";
type View =
  | { kind: "home" }
  | { kind: "theory"; topicKey: string; lesson: LessonView }
  | { kind: "session"; queue: SessionItem[]; origin: SessionOrigin };

export function Shell() {
  const course = useQuery(api.courseQueries.getCourse);
  const rawSrs = useQuery(api.progress.getSrsState);
  const markTheorySeen = useMutation(api.progress.markTheorySeen);
  const srs = rawSrs == null ? rawSrs : adaptSrs(rawSrs);

  const [tab, setTab] = useState<Tab>("review");
  const [view, setView] = useState<View>({ kind: "home" });
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [nonce, setNonce] = useState(0); // bump to remount Session on (re)start

  // course === undefined → loading; srs === null → not authed yet (race)
  if (!course || !srs) return <Splash />;
  const c = course;
  const s = srs;

  function startReview() {
    setScore({ correct: 0, total: 0 });
    setNonce((n) => n + 1);
    setView({ kind: "session", queue: buildReviewQueue(c, s), origin: "review" });
  }
  function startLesson(topicKey: string, lesson: LessonView) {
    setScore({ correct: 0, total: 0 });
    setNonce((n) => n + 1);
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
  function switchTab(t: Tab) {
    setTab(t);
    setView({ kind: "home" });
  }
  function findLesson(topicKey: string, lessonKey: string): LessonView | null {
    return (
      c.topics
        .find((t: TopicView) => t.topicKey === topicKey)
        ?.lessons.find((l: LessonView) => l.lessonKey === lessonKey) ?? null
    );
  }
  function nextLessonOf(
    origin: SessionOrigin,
  ): { topicKey: string; lessonKey: string; label: string } | null {
    if (origin === "review") return null;
    const topic = c.topics.find((t: TopicView) => t.topicKey === origin.topicKey);
    if (!topic) return null;
    const i = topic.lessons.findIndex((l: LessonView) => l.lessonKey === origin.lessonKey);
    const nx = topic.lessons[i + 1];
    return nx ? { topicKey: origin.topicKey, lessonKey: nx.lessonKey, label: nx.label } : null;
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

  let content;
  if (view.kind === "session") {
    content = (
      <Session
        key={nonce}
        queue={view.queue}
        course={c}
        cards={s.cards}
        dueCountAll={s.dueCountAll}
        nextLesson={nextLessonOf(view.origin)}
        onScore={(correct, total) => setScore({ correct, total })}
        onRestart={onRestart}
        onPickLesson={onPickLesson}
        onGoReview={() => switchTab("review")}
      />
    );
  } else if (view.kind === "theory") {
    content = <Theory lesson={view.lesson} onBegin={() => beginFromTheory(view.topicKey, view.lesson)} />;
  } else {
    content =
      tab === "review" ? (
        <ReviewTab course={c} srs={s} onStart={startReview} />
      ) : (
        <TopicsTab course={c} srs={s} onOpenLesson={openLesson} />
      );
  }

  return (
    <>
      <Header streak={s.streak} />
      <ScoreRow correct={score.correct} total={score.total} due={s.dueCountAll} />
      <TabBar tab={tab} onTab={switchTab} />
      {content}
    </>
  );
}
