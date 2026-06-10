import type { CompleteHeading, NextStep, WordView } from "../lib/types";
import { pluralRu, wKey } from "../lib/srs";
import { REVIEW_DUE_LIMIT } from "../lib/queue";
import { speak } from "../lib/speech";
import { Icon } from "./Icon";

const HEADINGS: Record<CompleteHeading, string> = {
  topic: "Тема закрыта!",
  lesson: "Урок выучен!",
  session: "Сессия завершена!",
};

// Сколько строк разбора ошибок показываем; кнопка повтора берёт ВСЕ промахи.
const MISTAKES_SHOWN = 5;

export function Complete({
  correct,
  total,
  dueCountAll,
  heading,
  nextStep,
  mistakes,
  onRestart,
  onPickLesson,
  onGoReview,
  onGoTopics,
  onRetryMistakes,
}: {
  correct: number;
  total: number;
  dueCountAll: number;
  heading: CompleteHeading;
  nextStep: NextStep | null;
  mistakes: WordView[];
  onRestart: () => void;
  onPickLesson: (topicKey: string, lessonKey: string) => void;
  onGoReview: () => void;
  onGoTopics: () => void;
  onRetryMistakes: () => void;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const emoji = pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪";
  const n = mistakes.length;

  // Трамплин: primary-CTA по фактическому прогрессу. «Ещё раз» остаётся
  // ghost-вариантом, когда primary занят шагом вперёд; при «Продолжить урок»
  // он бы дублировал primary (то же действие) — не показываем.
  let primaryCta;
  if (nextStep?.kind === "continue") {
    primaryCta = (
      <button className="m-btn m-btn--primary m-btn--block m-btn--lg" onClick={onRestart}>
        Продолжить урок (ещё {nextStep.remaining}{" "}
        {pluralRu(nextStep.remaining, "слово", "слова", "слов")}){" "}
        <Icon name="arrow-right" size={18} />
      </button>
    );
  } else if (nextStep) {
    primaryCta = (
      <button
        className="m-btn m-btn--primary m-btn--block m-btn--lg"
        onClick={() => onPickLesson(nextStep.topicKey, nextStep.lessonKey)}
      >
        {nextStep.kind === "lesson" ? "Следующий урок: " : "Следующая тема: "}
        {nextStep.label} <Icon name="arrow-right" size={18} />
      </button>
    );
  } else {
    primaryCta = (
      <button className="m-btn m-btn--primary m-btn--block m-btn--lg" onClick={onRestart}>
        <Icon name="rotate-ccw" size={18} /> Ещё раз
      </button>
    );
  }

  return (
    <div className="m-card m-complete">
      <div className="m-complete-emoji">{emoji}</div>
      <div className="m-complete-title">{HEADINGS[heading]}</div>
      <div className="m-complete-score">
        Верно: <b>{correct}</b> из <b>{total}</b> ({pct}%)
      </div>
      {dueCountAll === 0 && (
        <div className="m-complete-note ok">
          <Icon name="circle-check" /> Все повторения сделаны!
        </div>
      )}
      {n > 0 && (
        <div className="m-mistakes">
          <div className="m-mist-head">Споткнулся на</div>
          {mistakes.slice(0, MISTAKES_SHOWN).map((w) => (
            <div className="m-mist-row" key={wKey(w.lessonKey, w.pt)}>
              <span className="m-mist-pt" lang="pt-PT">
                {w.pt}
              </span>
              <span className="m-mist-ru">— {w.ru}</span>
              <button
                className="m-mist-audio"
                onClick={() => speak(w.pt)}
                aria-label={`Прослушать ${w.pt}`}
                title="Прослушать"
              >
                <Icon name="volume" size={14} />
              </button>
            </div>
          ))}
          <button className="m-btn m-btn--primary m-btn--block m-mist-retry" onClick={onRetryMistakes}>
            <Icon name="rotate-ccw" size={18} />{" "}
            {n === 1
              ? "Повторить это слово"
              : `Повторить эти ${n} ${pluralRu(n, "слово", "слова", "слов")}`}
          </button>
        </div>
      )}
      <div className="m-complete-actions">
        {primaryCta}
        {nextStep && nextStep.kind !== "continue" && (
          <button className="m-btn m-btn--ghost m-btn--block" onClick={onRestart}>
            <Icon name="rotate-ccw" size={18} /> Ещё раз
          </button>
        )}
        {dueCountAll > 0 && (
          <button className="m-btn m-btn--ghost m-btn--block" onClick={onGoReview}>
            <Icon name="repeat" size={18} /> К повторению (
            {Math.min(dueCountAll, REVIEW_DUE_LIMIT)})
          </button>
        )}
        {/* Выход к списку тем — всегда последний, тише primary-трамплина. */}
        <button className="m-btn m-btn--ghost m-btn--block" onClick={onGoTopics}>
          <Icon name="book-open" size={18} /> К темам
        </button>
      </div>
    </div>
  );
}
