// Missing accents are tolerated in typing; explicitly different accents aren't.

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

// Answer normalization keeps accents and ignores punctuation/case/extra spaces.
// Hyphens stay significant ("bem-vindo"),
// digits and slashes are kept; slash spacing is canonicalized so the full
// label "um / uma" can be compared regardless of spaces around "/".
function normAnswer(s: string): string {
  return s.normalize("NFC").toLowerCase().trim()
    .replace(/[.!?,…]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

export type AnswerMatch = "exact" | "missing_accents" | "incorrect";

export function classifyAnswer(input: string, correctPt: string): AnswerMatch {
  const inp = normAnswer(input);
  if (!inp) return "incorrect";
  // The whole displayed label and each slash-separated form are valid.
  const expected = [correctPt, ...correctPt.split("/")].map(normAnswer);
  if (expected.includes(inp)) return "exact";
  const chars = [...inp];
  const missingOnly = expected.some((candidate) => {
    const target = [...candidate];
    return chars.length === target.length && chars.every((char, i) =>
      char === target[i] || (char === deaccent(char) && char === deaccent(target[i])),
    );
  });
  return missingOnly ? "missing_accents" : "incorrect";
}

export function variantsMatch(input: string, correctPt: string): boolean {
  return classifyAnswer(input, correctPt) !== "incorrect";
}

// Supplied choices are already correctly spelled: accents distinguish forms.
export function normToken(s: string): string {
  return normAnswer(s);
}

// Sentence-builder comparison (ignores punctuation/case/extra spaces).
export function sentenceMatch(user: string, correct: string): boolean {
  const norm = (s: string) =>
    s.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?,]/g, "");
  return norm(user) === norm(correct);
}

// Single-word/token normalization: case-, accent- and trailing-punctuation-
// insensitive, so a blank «Olá» matches the token «Olá!». For whole sentences
// use sentenceMatch. Kept for vocabulary normalization; choices use normToken.
export function normWord(s: string): string {
  return deaccent(s.trim()).replace(/[.!?,]/g, "");
}
