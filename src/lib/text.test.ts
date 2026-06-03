import { describe, it, expect } from "vitest";
import { deaccent, normStr, variantsMatch, sentenceMatch } from "./text";

describe("deaccent", () => {
  it("strips Portuguese accents and lowercases", () => {
    expect(deaccent("Não")).toBe("nao");
    expect(deaccent("coração")).toBe("coracao");
    expect(deaccent("AÇÚCAR")).toBe("acucar");
    expect(deaccent("avô")).toBe("avo");
  });
});

describe("normStr", () => {
  it("trims, lowercases, deaccents and collapses whitespace", () => {
    expect(normStr("  Olá,  mundo!  ")).toBe("ola, mundo!");
  });
  it("keeps allowed chars (slash, hyphen, dot)", () => {
    expect(normStr("a/b-c.d")).toBe("a/b-c.d");
  });
});

describe("variantsMatch", () => {
  it("matches ignoring accents, case and surrounding space", () => {
    expect(variantsMatch("nao", "não")).toBe(true);
    expect(variantsMatch("  OLÁ ", "olá")).toBe(true);
  });
  it("accepts any slash-separated variant", () => {
    expect(variantsMatch("obrigado", "obrigado / obrigada")).toBe(true);
    expect(variantsMatch("obrigada", "obrigado / obrigada")).toBe(true);
  });
  it("rejects a wrong answer", () => {
    expect(variantsMatch("adeus", "olá")).toBe(false);
  });
});

describe("sentenceMatch", () => {
  it("ignores punctuation, case and extra spaces", () => {
    expect(sentenceMatch("Bom dia!", "bom dia")).toBe(true);
    expect(sentenceMatch("Estou  bem.", "Estou bem")).toBe(true);
  });
  it("rejects a different sentence", () => {
    expect(sentenceMatch("boa noite", "bom dia")).toBe(false);
  });
});
