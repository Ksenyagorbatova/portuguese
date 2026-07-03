// Accent-insensitive answer matching for the type-in exercise.
// Ported verbatim from the original deaccent/normStr/variantsMatch.

// Combining diacritical marks U+0300–U+036F (built via RegExp to keep the
// source file pure ASCII — no literal combining characters).
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function deaccent(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

export function normStr(s: string): string {
  return deaccent(s.trim())
    .replace(/[^a-z0-9/\s\-.!?,]/g, "")
    .replace(/\s+/g, " ");
}

// Type-in answer normalization: on top of normStr, punctuation ([.!?,] and
// ellipses — "…" is already dropped by normStr, "..." by the class below) is
// optional, mirroring sentenceMatch. Hyphens stay significant ("bem-vindo"),
// digits and slashes are kept; slash spacing is canonicalized so the full
// label "um / uma" can be compared regardless of spaces around "/".
function normAnswer(s: string): string {
  return normStr(s)
    .replace(/[.!?,]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

export function variantsMatch(input: string, correctPt: string): boolean {
  const inp = normAnswer(input);
  // The user sees the label verbatim, so the whole "um / uma" is accepted too.
  if (inp === normAnswer(correctPt)) return true;
  return correctPt
    .split("/")
    .map((v) => normAnswer(v))
    .some((v) => inp === v);
}

// Sentence-builder comparison (ignores punctuation/case/extra spaces).
export function sentenceMatch(user: string, correct: string): boolean {
  const norm = (s: string) =>
    s.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?,]/g, "");
  return norm(user) === norm(correct);
}

// Single-word/token normalization: case-, accent- and trailing-punctuation-
// insensitive, so a blank «Olá» matches the token «Olá!». For whole sentences
// use sentenceMatch. (Cloze-упражнение и инвариант content.test сверяют по нему.)
export function normWord(s: string): string {
  return deaccent(s.trim()).replace(/[.!?,]/g, "");
}
