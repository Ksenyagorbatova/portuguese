import { describe, it, expect } from "vitest";
import { deaccent, normStr, normWord, variantsMatch, sentenceMatch } from "./text";

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

describe("variantsMatch — punctuation is optional", () => {
  // Literal punctuated `pt` entries from convex/content.ts (lesson words).
  it("accepts input without trailing ?/!/. for real content words", () => {
    expect(variantsMatch("como se chama", "Como se chama?")).toBe(true);
    expect(variantsMatch("prazer", "Prazer!")).toBe(true);
    expect(variantsMatch("como esta", "Como está?")).toBe(true);
    expect(variantsMatch("estou bem", "Estou bem.")).toBe(true);
    expect(variantsMatch("nao percebo", "Não percebo.")).toBe(true);
    expect(variantsMatch("pode repetir", "Pode repetir?")).toBe(true);
    expect(variantsMatch("nao falo bem portugues", "Não falo bem português.")).toBe(true);
    expect(variantsMatch("preciso de ajuda", "Preciso de ajuda.")).toBe(true);
    expect(variantsMatch("quanto custa", "Quanto custa?")).toBe(true);
    expect(variantsMatch("de onde e", "De onde é?")).toBe(true);
  });
  it("accepts input without ellipses (... in content)", () => {
    expect(variantsMatch("chamo-me", "Chamo-me...")).toBe(true);
    expect(variantsMatch("como se diz", "Como se diz...?")).toBe(true);
    expect(variantsMatch("onde e", "Onde é...?")).toBe(true); // theory phrase
  });
  it("accepts input without mid-phrase commas", () => {
    expect(variantsMatch("mais devagar por favor", "Mais devagar, por favor.")).toBe(true);
    expect(variantsMatch("a conta por favor", "A conta, por favor.")).toBe(true);
  });
  it("keeps the hyphen significant alongside punctuation stripping", () => {
    expect(variantsMatch("pode ajudar-me", "Pode ajudar-me?")).toBe(true);
    expect(variantsMatch("pode ajudar me", "Pode ajudar-me?")).toBe(false);
    expect(variantsMatch("bem-vindo", "bem-vindo")).toBe(true);
    expect(variantsMatch("bem vindo", "bem-vindo")).toBe(false);
  });
  it("still accepts input typed WITH the punctuation", () => {
    expect(variantsMatch("como se chama?", "Como se chama?")).toBe(true);
    expect(variantsMatch("Estou bem.", "Estou bem.")).toBe(true);
    expect(variantsMatch("chamo-me...", "Chamo-me...")).toBe(true);
    expect(variantsMatch("Mais devagar, por favor.", "Mais devagar, por favor.")).toBe(true);
  });
  it("keeps accent-insensitivity and digits", () => {
    expect(variantsMatch("ate logo", "até logo")).toBe(true);
    expect(variantsMatch("sao 2 euros", "são 2 euros")).toBe(true);
  });
  it("does not over-accept wrong answers", () => {
    expect(variantsMatch("como esta", "Como se chama?")).toBe(false);
    expect(variantsMatch("pode ajudar-me", "Pode repetir?")).toBe(false);
    expect(variantsMatch("", "Prazer!")).toBe(false);
    expect(variantsMatch("?", "Prazer!")).toBe(false);
  });
});

describe("variantsMatch — full slash label", () => {
  it("accepts the whole label as shown to the user", () => {
    expect(variantsMatch("um / uma", "um / uma")).toBe(true);
    expect(variantsMatch("um/uma", "um / uma")).toBe(true);
    expect(variantsMatch("dois / duas", "dois / duas")).toBe(true);
    expect(variantsMatch("obrigado / obrigada", "obrigado / obrigada")).toBe(true);
  });
  it("still accepts each variant on its own", () => {
    expect(variantsMatch("um", "um / uma")).toBe(true);
    expect(variantsMatch("uma", "um / uma")).toBe(true);
  });
  it("rejects a mixed-up label", () => {
    expect(variantsMatch("uma / um", "um / uma")).toBe(false);
    expect(variantsMatch("um / duas", "um / uma")).toBe(false);
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

describe("normWord (cloze blank ↔ токен предложения)", () => {
  it("нечувствителен к регистру, диакритике и хвостовой пунктуации", () => {
    expect(normWord("Obrigada.")).toBe("obrigada");
    expect(normWord("Desculpe,")).toBe("desculpe");
    expect(normWord("amanhã!")).toBe("amanha");
  });
  it("чистый blank совпадает с токеном, несущим пунктуацию", () => {
    expect(normWord("Olá")).toBe(normWord("Olá!"));
    expect(normWord("isto")).toBe(normWord("isto?"));
  });
  it("различает разные слова", () => {
    expect(normWord("meu") === normWord("minha")).toBe(false);
  });
});
