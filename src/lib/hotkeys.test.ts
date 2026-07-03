import { describe, it, expect } from "vitest";
import { hotkeyIndex } from "./hotkeys";

describe("hotkeyIndex", () => {
  it("цифры «1»..«count» → индекс 0-based", () => {
    expect(hotkeyIndex("1", "Digit1", 5)).toBe(0);
    expect(hotkeyIndex("5", "Digit5", 5)).toBe(4);
    expect(hotkeyIndex("4", "Digit4", 4)).toBe(3);
  });

  it("латинские буквы A.. любого регистра → индекс", () => {
    expect(hotkeyIndex("a", "KeyA", 5)).toBe(0);
    expect(hotkeyIndex("E", "KeyE", 5)).toBe(4);
    expect(hotkeyIndex("d", "KeyD", 4)).toBe(3);
  });

  it("за пределами count → -1", () => {
    expect(hotkeyIndex("5", "Digit5", 4)).toBe(-1); // 5-я цифра при 4 вариантах
    expect(hotkeyIndex("e", "KeyE", 4)).toBe(-1); // 5-я буква при 4 вариантах
    expect(hotkeyIndex("6", "Digit6", 5)).toBe(-1);
  });

  it("нелатинская раскладка: фоллбэк по физической позиции e.code (RU: KeyA печатает «ф»)", () => {
    expect(hotkeyIndex("ф", "KeyA", 5)).toBe(0);
    expect(hotkeyIndex("в", "KeyD", 4)).toBe(3);
  });

  it("фоллбэк НЕ стреляет, когда e.key — другая латинская буква (AZERTY KeyA → «q»)", () => {
    // q — осознанный ввод латинской буквы (позиция 16, за пределами count),
    // подменять её позицией KeyA нельзя.
    expect(hotkeyIndex("q", "KeyA", 5)).toBe(-1);
  });

  it("прочие клавиши → -1", () => {
    expect(hotkeyIndex("Enter", "Enter", 5)).toBe(-1);
    expect(hotkeyIndex(" ", "Space", 5)).toBe(-1);
  });
});
