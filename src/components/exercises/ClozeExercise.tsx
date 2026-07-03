import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { AnswerResult, TopicSentenceView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { normWord } from "../../lib/text";
import { hotkeyIndex } from "../../lib/hotkeys";
import { speakAuto } from "../../lib/speech";
import { hapticOk, hapticErr } from "../../lib/haptics";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { ResultFeedback, RetryBox, NextButton } from "../Feedback";

// Cloze-упражнение раздела «Построение предложений»: в предложении темы спрятано
// целевое слово (sentence.blank), пользователь ВЫБИРАЕТ его из вариантов. Как и
// SentenceBuilder, прогресс SRS не двигает — только счёт сессии (onAnswered без
// recordAnswer). Дистракторы — другие blank-слова той же темы (pool), поэтому
// однотипны цели. Две попытки, затем правильный ответ раскрывается.

const KEYS = ["A", "B", "C", "D"];

// Сравнение без регистра/диакритики/хвостовой пунктуации (normWord из lib/text):
// токен в words может нести пунктуацию ("Olá!"), а blank/варианты чистые ("Olá").

export function ClozeExercise({
  sentence,
  pool,
  isLast,
  onAnswered,
  onNext,
}: {
  sentence: TopicSentenceView;
  pool: string[]; // все blank-слова темы — источник дистракторов
  isLast: boolean;
  onAnswered: (result: AnswerResult) => void;
  onNext: () => void;
}) {
  // Позиция пропуска: первый токен words, совпавший с blank (нормализованно).
  const blankIdx = useMemo(
    () => sentence.words.findIndex((w) => normWord(w) === normWord(sentence.blank)),
    [sentence],
  );
  // Варианты: цель + до 3 дистракторов из пула (другие blank-и темы), исключая
  // совпадающие с целью по норме (чтобы не было двух правильных).
  const options = useMemo(() => {
    const distractors = shuffle(pool.filter((p) => normWord(p) !== normWord(sentence.blank))).slice(0, 3);
    return shuffle([sentence.blank, ...distractors]);
  }, [sentence, pool]);

  const [wrongPicked, setWrongPicked] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState(0);
  const [resolved, setResolved] = useState<{ ok: boolean } | null>(null);
  const pendingRef = useRef(false);

  const isCorrectOpt = (o: string) => normWord(o) === normWord(sentence.blank);

  function finish(ok: boolean, firstTry: boolean) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    if (ok) hapticOk();
    else hapticErr();
    speakAuto(sentence.answer);
    onAnswered({ mode: "sentence", correct: ok, firstTry });
    setResolved({ ok });
  }

  function choose(o: string) {
    if (resolved || pendingRef.current) return;
    const first = tries === 0;
    if (isCorrectOpt(o)) {
      finish(true, first);
    } else {
      setWrongPicked((prev) => new Set(prev).add(o));
      if (tries < 1) {
        hapticErr();
        setTries(1);
      } else finish(false, false);
    }
  }

  const onHotkey = useEffectEvent((e: KeyboardEvent) => {
    if (resolved || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const i = hotkeyIndex(e.key, e.code, options.length);
    if (i < 0 || i >= options.length) return;
    const o = options[i];
    if (wrongPicked.has(o)) return;
    e.preventDefault();
    choose(o);
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onHotkey(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function optClass(o: string): string {
    if (resolved) {
      if (isCorrectOpt(o)) return "m-opt correct";
      if (wrongPicked.has(o)) return "m-opt wrong";
      return "m-opt";
    }
    return wrongPicked.has(o) ? "m-opt wrong" : "m-opt";
  }

  // blank обязан быть среди words (гарантирует content.test, norm идентичен).
  // Guard на случай, если инвариант всё же обойдён: прячем первый токен, а не
  // рвём предложение отрицательным slice.
  const gapIdx = blankIdx >= 0 ? blankIdx : 0;
  const before = sentence.words.slice(0, gapIdx).join(" ");
  const after = sentence.words.slice(gapIdx + 1).join(" ");

  return (
    <div className="m-card">
      <div className="m-q-head">
        <span className="m-q-kind">Выберите пропущенное слово</span>
        <Badge tag="cross" />
      </div>
      <div className="m-q-text sentence" lang="pt-PT">
        {before} <span className="m-cloze-gap">＿＿＿</span> {after}
      </div>
      <div className="m-q-prompt">{sentence.ru}</div>
      <div className="m-opts">
        {options.map((o, i) => (
          <button
            key={o}
            className={optClass(o)}
            disabled={resolved !== null || wrongPicked.has(o)}
            onClick={() => choose(o)}
          >
            <span className="m-opt-key" aria-hidden="true">{KEYS[i]}</span>
            <span className="m-opt-label" lang="pt-PT">{o}</span>
            <span className="m-opt-mark">
              <Icon name={isCorrectOpt(o) ? "check" : "x"} size={20} />
            </span>
          </button>
        ))}
      </div>
      {!resolved && tries > 0 && (
        <RetryBox>
          <b>Не совсем!</b> Ещё одна попытка.
        </RetryBox>
      )}
      {resolved && (
        <>
          <ResultFeedback ok={resolved.ok}>
            <b>{resolved.ok ? "Верно!" : "Правильно:"}</b>{" "}
            <span className="m-fb-pt" lang="pt-PT">{sentence.answer}</span>
            <div className="m-fb-sub">{sentence.ru}</div>
          </ResultFeedback>
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
