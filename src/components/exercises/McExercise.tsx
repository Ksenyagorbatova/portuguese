import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { AnswerResult, BadgeTag, CardFields, Course, WordView } from "../../lib/types";
import { shuffle } from "../../lib/shuffle";
import { getWrong } from "../../lib/wrongOptions";
import { localDay } from "../../lib/day";
import { nextDueLabel, wKey } from "../../lib/srs";
import { predictCardAfterAnswer } from "../../lib/srsPredict";
import { speak, speakSmart } from "../../lib/speech";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { WordFeedback, RetryBox, NextButton } from "../Feedback";

// dueLabel: null — ответ сервера ещё не пришёл (или мутация упала), Feedback
// покажет «—»; saveFailed — мутация отвергнута, ответ в расписание не попал.
type Resolved = { ok: boolean; dueLabel: string | null; saveFailed?: boolean };

const KEYS = ["A", "B", "C", "D", "E"];

// Хоткей → индекс опции: «1»–«5» и латинские A–E (любой регистр) по e.key.
// Для нелатинских раскладок (RU: физическая A печатает «ф») — ФОЛЛБЭК по
// физической позиции e.code (KeyA–KeyE), именно фоллбэк, не замена: e.code
// позиционный, и когда e.key — другая латинская буква (на AZERTY физическая
// KeyA печатает «q»), это осознанный ввод другой буквы — фоллбэк не стреляет.
function hotkeyIndex(key: string, code: string): number {
  if (/^[1-5]$/.test(key)) return key.charCodeAt(0) - "1".charCodeAt(0);
  if (/^[a-eA-E]$/.test(key)) return key.toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
  if (!/^[a-zA-Z]$/.test(key) && /^Key[A-E]$/.test(code)) {
    return code.charCodeAt(3) - "A".charCodeAt(0);
  }
  return -1;
}

export function McExercise({
  word,
  mode,
  tag,
  card,
  course,
  isLast,
  onAnswered,
  onNext,
}: {
  word: WordView;
  mode: "pt_ru" | "ru_pt";
  tag: BadgeTag;
  card: CardFields | undefined;
  course: Course;
  isLast: boolean;
  onAnswered: (result: AnswerResult) => void;
  onNext: () => void;
}) {
  const recordAnswer = useMutation(api.progress.recordAnswer);
  const options = useMemo(() => shuffle([word, ...getWrong(course, word)]), [word, course]);
  const [wrongPicked, setWrongPicked] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState(0);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  // Синхронный guard от двойного ответа: проверка по state (resolved) не
  // закрывает окно между событием и применением обновления — ref выставляется
  // ДО любой асинхронщины, и повторный клик/диспатч не даёт второго finish().
  const pendingRef = useRef(false);

  const label = (o: WordView) => (mode === "pt_ru" ? o.ru : o.pt);
  const isCorrectOpt = (o: WordView) => o.pt === word.pt;

  function finish(quality: 0 | 1 | 2, ok: boolean) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    speak(word.pt);
    onAnswered({ mode: "mc", correct: quality >= 1, firstTry: quality === 2 });
    // UI резолвим сразу, НЕ дожидаясь сети (Convex при разрыве держит мутацию
    // в очереди — промис может висеть неограниченно долго). Метка «следующий
    // повтор» считается мгновенно зеркалом планировщика (srsPredict, пин-тест
    // сверяет с сервером) — без «—» → «завтра»-дёргания после roundtrip'а.
    setResolved({ ok, dueLabel: nextDueLabel(predictCardAfterAnswer(card, quality, "mc")) });
    void recordAnswer({
      lessonKey: word.lessonKey,
      pt: word.pt,
      quality,
      mode: "mc",
      clientDay: localDay(),
    }).then(
      // Сервер — истина: при расхождении (устаревший card-проп) тихо поправим.
      (res) =>
        setResolved((prev) => {
          const dueLabel = nextDueLabel(res.card);
          return prev && prev.dueLabel === dueLabel ? prev : { ok, dueLabel };
        }),
      // Мутация отвергнута — расписание НЕ изменилось, предсказание ложно:
      // честные «—» и пометка о несохранённом ответе.
      () => setResolved({ ok, dueLabel: null, saveFailed: true }),
    );
  }

  function choose(o: WordView) {
    if (resolved || pendingRef.current) return;
    const first = tries === 0;
    if (isCorrectOpt(o)) {
      finish(first ? 2 : 1, true);
    } else {
      setWrongPicked((prev) => new Set(prev).add(o.pt));
      if (tries < 1) setTries(1);
      else finish(0, false);
    }
  }

  // Хоткеи: 1–5 / A–E выбирают опцию, пока ответ не дан. useEffectEvent читает
  // свежие resolved/wrongPicked/options без переподписки слушателя.
  const onHotkey = useEffectEvent((e: KeyboardEvent) => {
    if (resolved || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const t = e.target as HTMLElement | null;
    // Не перехватываем набор текста (на будущее — в MC своих инпутов нет).
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const i = hotkeyIndex(e.key, e.code);
    if (i < 0 || i >= options.length) return;
    const o = options[i];
    if (wrongPicked.has(o.pt)) return; // опция уже disabled после промаха
    e.preventDefault();
    choose(o);
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onHotkey(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function optClass(o: WordView): string {
    if (resolved) {
      if (isCorrectOpt(o)) return "m-opt correct";
      if (wrongPicked.has(o.pt)) return "m-opt wrong";
      return "m-opt";
    }
    return wrongPicked.has(o.pt) ? "m-opt wrong" : "m-opt";
  }

  const question = mode === "pt_ru" ? word.pt : word.ru;
  const prompt = mode === "pt_ru" ? "Что это значит по-русски?" : "Как это по-португальски?";

  return (
    <div className="m-card">
      <div className="m-q-head">
        <span className="m-q-kind">
          {mode === "pt_ru" ? "Выберите перевод" : "Выберите по-португальски"}
        </span>
        <Badge tag={tag} />
      </div>
      <div className="m-q-row">
        {/* В pt→ru вопрос — португальский: размечаем для скринридеров. */}
        <div className="m-q-text" lang={mode === "pt_ru" ? "pt-PT" : undefined}>
          {question}
        </div>
        {mode === "pt_ru" && (
          <button
            className="m-audio"
            onClick={() => speakSmart(word.pt)}
            aria-label="Прослушать (второй тап — медленно)"
            title="Прослушать (второй тап — медленно)"
          >
            <Icon name="volume" />
          </button>
        )}
      </div>
      {/* 💡-заметку ДО ответа не показываем — она спойлерит ответ (заметка
          часто содержит перевод/подсказку). После ответа она остаётся в
          WordFeedback, в теории — на обороте флип-карты. */}
      {/* Строку показываем только для реально просроченных (due) слов: при
          досрочной практике («Тренировать все слова») дата будущего повтора —
          шум. После ответа расписание всё равно показывает Feedback. */}
      {tag === "due" && (
        <div className="m-q-srs">
          <Icon name="clock" /> следующий повтор: {nextDueLabel(card)}
        </div>
      )}
      <div className="m-q-prompt">{prompt}</div>
      <div className="m-opts">
        {options.map((o, i) => (
          <button
            // wKey: в контенте есть дубли pt в разных уроках — один pt не уникален.
            key={wKey(o.lessonKey, o.pt)}
            className={optClass(o)}
            disabled={resolved !== null || wrongPicked.has(o.pt)}
            onClick={() => choose(o)}
          >
            <span className="m-opt-key" aria-hidden="true">{KEYS[i]}</span>
            {/* В ru→pt опции — португальские. */}
            <span className="m-opt-label" lang={mode === "ru_pt" ? "pt-PT" : undefined}>
              {label(o)}
            </span>
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
          <WordFeedback
            ok={resolved.ok}
            word={word}
            dueLabel={resolved.dueLabel}
            saveFailed={resolved.saveFailed}
          />
          <NextButton isLast={isLast} onClick={onNext} />
        </>
      )}
    </div>
  );
}
