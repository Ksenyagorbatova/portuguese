import { useState } from "react";
import type { LessonView, WordView } from "../lib/types";
import { speak } from "../lib/speech";

function FlipCard({ word }: { word: WordView }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className={"flip-card" + (flipped ? " flipped" : "")}
      onClick={() => {
        setFlipped((f) => !f);
        speak(word.pt);
      }}
    >
      <div className="flip-inner">
        <div className="flip-front">
          <div className="fc-pt">{word.pt}</div>
          <div className="fc-hint">🔊 нажми</div>
        </div>
        <div className="flip-back">
          <div className="fc-ru">{word.ru}</div>
          {word.note && <div className="fc-note">{word.note}</div>}
          <div
            className="fc-replay"
            onClick={(e) => {
              e.stopPropagation();
              speak(word.pt);
            }}
          >
            🔊 ещё раз
          </div>
        </div>
      </div>
    </div>
  );
}

export function Theory({ lesson, onBegin }: { lesson: LessonView; onBegin: () => void }) {
  const t = lesson.theory;
  return (
    <div className="card theory-card">
      <div className="theory-label">📖 Изучаем</div>
      <div className="theory-title">{lesson.label}</div>
      <div className="theory-intro">{t.intro}</div>
      <div className="theory-tip">{t.tip}</div>
      <div className="theory-hint">
        🔊 Нажми на карточку — услышишь произношение и увидишь перевод
      </div>
      {t.sections.map((sec, i) => (
        <div className="theory-sec" key={i}>
          <div className="sec-head">{sec.heading}</div>
          <div className="flip-grid">
            {lesson.words
              .filter((w) => sec.words.includes(w.pt))
              .map((w) => (
                <FlipCard key={w.pt} word={w} />
              ))}
          </div>
        </div>
      ))}
      <button className="big-btn" onClick={onBegin}>
        Начать практику →
      </button>
    </div>
  );
}
