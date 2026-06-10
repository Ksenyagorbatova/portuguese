import { useState } from "react";
import type { LessonView, WordView } from "../lib/types";
import { speak } from "../lib/speech";
import { Icon } from "./Icon";

function FlipCard({ word }: { word: WordView }) {
  const [flipped, setFlipped] = useState(false);
  return (
    // <button>, чтобы карточка переворачивалась и с клавиатуры (Enter/Space).
    <button
      type="button"
      className={"m-flip" + (flipped ? " flipped" : "")}
      aria-pressed={flipped}
      onClick={() => {
        setFlipped((f) => !f);
        speak(word.pt);
      }}
    >
      <div className="m-flip-in">
        <div className="m-flip-f">
          <div className="m-flip-pt" lang="pt-PT">{word.pt}</div>
          <div className="m-flip-cue">
            <Icon name="volume" size={13} /> нажми
          </div>
        </div>
        <div className="m-flip-b">
          <div className="m-flip-ru">{word.ru}</div>
          {word.note && <div className="m-flip-note">{word.note}</div>}
        </div>
      </div>
    </button>
  );
}

export function Theory({
  lesson,
  onBegin,
  onBack,
}: {
  lesson: LessonView;
  onBegin: () => void;
  onBack?: () => void;
}) {
  const t = lesson.theory;
  return (
    <div className="m-card">
      {onBack && (
        <button className="m-theory-back" onClick={onBack}>
          <Icon name="arrow-left" size={16} /> Назад
        </button>
      )}
      <div className="m-theory-eyebrow">
        <Icon name="book-open" /> Изучаем
      </div>
      <div className="m-theory-title">{lesson.label}</div>
      <div className="m-theory-intro">{t.intro}</div>
      <div className="m-tip">
        <span className="m-tip-flag">🇵🇹</span>
        <span>{t.tip}</span>
      </div>
      <div className="m-hint" style={{ marginBottom: 16 }}>
        <Icon name="volume" /> Нажми на карточку — услышишь произношение и увидишь перевод
      </div>
      {t.sections.map((sec, i) => (
        <div className="m-sec" key={i}>
          <div className="m-sec-head">{sec.heading}</div>
          <div className="m-flips">
            {lesson.words
              .filter((w) => sec.words.includes(w.pt))
              .map((w) => (
                <FlipCard key={w.pt} word={w} />
              ))}
          </div>
        </div>
      ))}
      <button className="m-btn m-btn--primary m-btn--block m-btn--lg" onClick={onBegin}>
        Начать практику <Icon name="arrow-right" size={18} />
      </button>
    </div>
  );
}
