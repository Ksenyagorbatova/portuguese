// Нажатая клавиша → индекс варианта ответа (0-based) или -1, для сеток из `count`
// вариантов (MC — до 5, cloze — 4). Поддерживает цифры «1»..«count» и латинские
// буквы A.. (любой регистр); для нелатинских раскладок (RU: физическая A печатает
// «ф») — ФОЛЛБЭК по физической позиции e.code (KeyA..). Фоллбэк стреляет только
// когда e.key НЕ латинская буква: на AZERTY физическая KeyA печатает «q» — это
// осознанный ввод другой буквы, подменять его позицией нельзя.
export function hotkeyIndex(key: string, code: string, count: number): number {
  if (/^[0-9]$/.test(key)) {
    const i = key.charCodeAt(0) - "1".charCodeAt(0);
    if (i >= 0 && i < count) return i;
  }
  if (/^[a-zA-Z]$/.test(key)) {
    const i = key.toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
    if (i >= 0 && i < count) return i;
  }
  if (!/^[a-zA-Z]$/.test(key) && /^Key[A-Z]$/.test(code)) {
    const i = code.charCodeAt(3) - "A".charCodeAt(0);
    if (i >= 0 && i < count) return i;
  }
  return -1;
}
