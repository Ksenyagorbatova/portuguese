import { useState } from "react";
import { TypeExercise } from "../components/exercises/TypeExercise";
import type { WordView } from "../lib/types";

// CT-харнесс перехода между карточками (Playwright CT не умеет компоненты,
// объявленные в тест-файле — прецедент Boom.tsx). Мини-модель Session:
// autoFocus-«Дальше» активируется браузером на keyDOWN Enter → следующая
// карточка (ввод) монтируется с autoFocus-инпутом ещё ДО отпускания клавиши —
// keyup того же физического нажатия прилетает в свежий инпут.
export function EnterTailHarness({ word }: { word: WordView }) {
  const [show, setShow] = useState(false);
  if (!show)
    return (
      <button autoFocus onClick={() => setShow(true)}>
        Дальше
      </button>
    );
  return (
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />
  );
}
