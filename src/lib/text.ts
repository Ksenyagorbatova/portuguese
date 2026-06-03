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

export function variantsMatch(input: string, correctPt: string): boolean {
  const inp = normStr(input);
  return correctPt
    .split("/")
    .map((v) => normStr(v.trim()))
    .some((v) => inp === v);
}

// Sentence-builder comparison (ignores punctuation/case/extra spaces).
export function sentenceMatch(user: string, correct: string): boolean {
  const norm = (s: string) =>
    s.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?,]/g, "");
  return norm(user) === norm(correct);
}
