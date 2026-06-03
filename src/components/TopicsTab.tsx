import { useState } from "react";
import type { Course, LessonView, SrsState, Stat, TopicView } from "../lib/types";

const EMPTY: Stat = { total: 0, seen: 0, learned: 0, due: 0 };

function LessonRow({
  topicKey,
  lesson,
  srs,
  onOpen,
}: {
  topicKey: string;
  lesson: LessonView;
  srs: SrsState;
  onOpen: (topicKey: string, lesson: LessonView) => void;
}) {
  const ls = srs.lessonStats[lesson.lessonKey] ?? { ...EMPTY, total: lesson.words.length };
  const seen = srs.seenTheory.includes(lesson.lessonKey);
  const lpct = ls.total > 0 ? Math.round((ls.learned / ls.total) * 100) : 0;
  return (
    <div className="lesson-row" onClick={() => onOpen(topicKey, lesson)}>
      <div className="lr-left">
        <div className="lr-name">{lesson.label}</div>
        <div className="lr-meta">
          {ls.learned}/{ls.total} слов · {seen ? `${lpct}%` : "📖 новая"}
        </div>
      </div>
      {ls.due > 0 ? (
        <span className="lr-due">🔴 {ls.due}</span>
      ) : ls.learned === ls.total && ls.total > 0 ? (
        <span className="lr-done">✓</span>
      ) : null}
    </div>
  );
}

function TopicBlock({
  topic,
  srs,
  onOpenLesson,
}: {
  topic: TopicView;
  srs: SrsState;
  onOpenLesson: (topicKey: string, lesson: LessonView) => void;
}) {
  const [open, setOpen] = useState(false);
  const ts = srs.topicStats[topic.topicKey] ?? EMPTY;
  const pct = ts.total > 0 ? Math.round((ts.learned / ts.total) * 100) : 0;
  return (
    <div className="topic-block">
      <div className="topic-head" onClick={() => setOpen((o) => !o)}>
        <span className="t-icon">{topic.icon}</span>
        <div className="t-info">
          <div className="t-name">{topic.label}</div>
          <div className="t-bar-wrap">
            <div className="t-bar" style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="t-meta">
          {ts.due > 0 ? <span style={{ color: "#c03030" }}>🔴{ts.due}</span> : `${pct}%`}
        </div>
        <span className="t-arrow">{open ? "⌄" : "›"}</span>
      </div>
      {open && (
        <div className="topic-lessons">
          {topic.lessons.map((l) => (
            <LessonRow
              key={l.lessonKey}
              topicKey={topic.topicKey}
              lesson={l}
              srs={srs}
              onOpen={onOpenLesson}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicsTab({
  course,
  srs,
  onOpenLesson,
}: {
  course: Course;
  srs: SrsState;
  onOpenLesson: (topicKey: string, lesson: LessonView) => void;
}) {
  return (
    <div className="topics-list">
      {course.topics.map((t) => (
        <TopicBlock key={t.topicKey} topic={t} srs={srs} onOpenLesson={onOpenLesson} />
      ))}
    </div>
  );
}
