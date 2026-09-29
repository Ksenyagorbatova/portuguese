import { useEffect, useState } from "react";
import type { LessonView, WordView } from "../lib/types";
import { FLIP_HINT_KEY, useFadingHint } from "../lib/hints";
import { speakSmart } from "../lib/speech";
import { Icon } from "./Icon";
import { ActionBar } from "./Feedback";

function FlipCard({ word }: { word: WordView }) {
  const [flipped, setFlipped] = useState(false);
  return (
    // <button>, чтобы карточка переворачивалась и с клавиатуры (Enter/Space).
    // speakSmart: повторный тап по той же карточке в течение 4с — медленно.
    <button
      type="button"
      className={"m-flip" + (flipped ? " flipped" : "")}
      aria-pressed={flipped}
      onClick={() => {
        setFlipped((f) => !f);
        speakSmart(word.pt);
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
  // Sections retain their teaching order, but one screen shows at most four words.
  // Fall back to the lesson's words for older/empty section metadata.
  const groups = t.sections.length ? t.sections.map((section) => ({
    heading: section.heading,
    words: lesson.words.filter((word) => section.words.includes(word.pt)),
  })) : [{ heading: "Слова урока", words: lesson.words }];
  const pages = groups.flatMap((group) => {
    const chunks = [];
    for (let i = 0; i < group.words.length; i += 4) chunks.push({ heading: group.heading, words: group.words.slice(i, i + 4) });
    return chunks;
  });
  const [page, setPage] = useState(0);
  const current = pages[page];
  const last = page >= pages.length - 1;
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  // «Нажми на карточку…» гаснет, когда приём флипа уже усвоен.
  const showFlipHint = useFadingHint(FLIP_HINT_KEY);
  return (
    <div className="m-card m-theory">
      {onBack && (
        <button className="m-theory-back" onClick={onBack}>
          <Icon name="arrow-left" size={16} /> Назад
        </button>
      )}
      <div className="m-theory-eyebrow">
        <Icon name="book-open" /> Изучаем
      </div>
      <div className="m-theory-title">{lesson.label}</div>
      <details className="m-theory-details">
        <summary>Коротко об уроке</summary>
        <div className="m-theory-intro">{t.intro}</div>
        <div className="m-tip"><span className="m-tip-flag">🇵🇹</span><span>{t.tip}</span></div>
      </details>
      <div className="m-theory-step" role="status">{page + 1} / {Math.max(1, pages.length)} · {current?.heading ?? "Теория"}</div>
      {showFlipHint && (
        <div className="m-hint" style={{ marginBottom: 16 }}>
          <Icon name="volume" /> Нажми на карточку — услышишь произношение и увидишь перевод
        </div>
      )}
      <div className="m-flips" key={page}>
        {current?.words.map((word) => <FlipCard key={word.pt} word={word} />)}
      </div>
      <ActionBar>
        {page > 0 && <button className="m-btn m-btn--ghost" aria-label="Предыдущие слова" onClick={() => setPage(page - 1)}><Icon name="arrow-left" /></button>}
        <button className="m-btn m-btn--primary m-btn--block" onClick={last ? onBegin : () => setPage(page + 1)}>
          {last ? "Начать практику" : "Следующие слова"} <Icon name="arrow-right" size={18} />
        </button>
      </ActionBar>
    </div>
  );
}
