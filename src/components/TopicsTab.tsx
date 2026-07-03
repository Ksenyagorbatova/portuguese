import { useState } from "react";
import type { Course, LessonView, SrsState, Stat, TopicView } from "../lib/types";
import { Icon } from "./Icon";

const EMPTY: Stat = { total: 0, seen: 0, learned: 0, due: 0 };

function LessonRow({
  topicKey,
  lesson,
  srs,
  onOpen,
  onOpenTheory,
}: {
  topicKey: string;
  lesson: LessonView;
  srs: SrsState;
  onOpen: (topicKey: string, lesson: LessonView) => void;
  onOpenTheory: (topicKey: string, lesson: LessonView) => void;
}) {
  const ls = srs.lessonStats[lesson.lessonKey] ?? { ...EMPTY, total: lesson.words.length };
  const seen = srs.seenTheory.includes(lesson.lessonKey);
  return (
    // Не <button>: внутри строки живёт кнопка «Теория», а button-в-button
    // невалиден. role="button" + tabIndex дают клавиатурный доступ (Enter/Space).
    <div
      className="m-lesson"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(topicKey, lesson)}
      onKeyDown={(e) => {
        // Не перехватываем Enter/Space, прилетевшие с вложенной «Теории».
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(topicKey, lesson);
        }
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="m-lesson-name">{lesson.label}</div>
        <div className="m-lesson-meta">
          {ls.learned} из {ls.total} слов
          {!seen && (
            <span className="m-pill-new">
              <Icon name="book-open" size={11} /> новая
            </span>
          )}
        </div>
      </div>
      <div className="m-lesson-actions">
        <button
          className="m-lesson-theory"
          aria-label="Теория"
          title="Теория"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTheory(topicKey, lesson);
          }}
        >
          <Icon name="book-open" size={16} />
        </button>
        {ls.due > 0 ? (
          <span className="m-chip-due">
            <span className="m-dot" /> {ls.due}
          </span>
        ) : ls.learned === ls.total && ls.total > 0 ? (
          <span className="m-lesson-done">
            <Icon name="circle-check" />
          </span>
        ) : (
          <span className="m-chev">
            <Icon name="chevron-right" />
          </span>
        )}
      </div>
    </div>
  );
}

function TopicBlock({
  topic,
  srs,
  onOpenLesson,
  onOpenTheory,
  onOpenSentences,
  defaultOpen,
}: {
  topic: TopicView;
  srs: SrsState;
  onOpenLesson: (topicKey: string, lesson: LessonView) => void;
  onOpenTheory: (topicKey: string, lesson: LessonView) => void;
  onOpenSentences: (topicKey: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const ts = srs.topicStats[topic.topicKey] ?? EMPTY;
  const pct = ts.total > 0 ? Math.round((ts.learned / ts.total) * 100) : 0;
  return (
    <div className={"m-topic" + (open ? " open" : "")}>
      <button
        type="button"
        className="m-topic-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="m-topic-ico">{topic.icon}</div>
        <div className="m-topic-info">
          <div className="m-topic-name">{topic.label}</div>
          <div className="m-bar">
            <div className="m-bar-fill" style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="m-topic-right">
          {ts.due > 0 ? (
            <span className="m-chip-due">
              <span className="m-dot" /> {ts.due}
            </span>
          ) : pct === 100 ? (
            <span className="m-lesson-done">
              <Icon name="circle-check" />
            </span>
          ) : null}
          <span className="m-chev">
            <Icon name="chevron-right" />
          </span>
        </div>
      </button>
      {open && (
        <div className="m-lessons">
          {topic.lessons.map((l) => (
            <LessonRow
              key={l.lessonKey}
              topicKey={topic.topicKey}
              lesson={l}
              srs={srs}
              onOpen={onOpenLesson}
              onOpenTheory={onOpenTheory}
            />
          ))}
          {/* Раздел «Построение предложений» — доп. часть темы, всегда доступен
              (без теории и счётчика слов); только если у темы есть предложения. */}
          {topic.sentences.length > 0 && (
            <div
              className="m-lesson"
              role="button"
              tabIndex={0}
              onClick={() => onOpenSentences(topic.topicKey)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenSentences(topic.topicKey);
                }
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="m-lesson-name">
                  Часть {topic.lessons.length + 1} — Построение предложений
                </div>
                <div className="m-lesson-meta">Сборка фраз и пропущенные слова</div>
              </div>
              <div className="m-lesson-actions">
                <span className="m-chev">
                  <Icon name="chevron-right" />
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TopicsTab({
  course,
  srs,
  onOpenLesson,
  onOpenTheory,
  onOpenSentences,
}: {
  course: Course;
  srs: SrsState;
  onOpenLesson: (topicKey: string, lesson: LessonView) => void;
  onOpenTheory: (topicKey: string, lesson: LessonView) => void;
  onOpenSentences: (topicKey: string) => void;
}) {
  return (
    <div className="m-topics">
      {course.topics.map((t, i) => (
        <TopicBlock
          key={t.topicKey}
          topic={t}
          srs={srs}
          onOpenLesson={onOpenLesson}
          onOpenTheory={onOpenTheory}
          onOpenSentences={onOpenSentences}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
