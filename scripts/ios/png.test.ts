import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePng, encodeRgbPng, toOpaqueRgb } from "./png.mjs";

// Минимальный PNG-кодек для scripts/ios/render-assets.mjs: скриншот Chromium
// (RGBA, адаптивные фильтры) → RGB без альфа-канала (иконку с альфой App Store
// отвергает). Тест собирает PNG вручную со ВСЕМИ пятью фильтрами строк.

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  // CRC декодер не проверяет — нули допустимы для теста.
  return Buffer.concat([len, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// RGBA-картинка width×height, строка y кодируется фильтром y % 5.
function filteredRgbaPng(width: number, height: number, px: (x: number, y: number) => number[]) {
  const bpp = 4;
  const stride = width * bpp;
  const rows: Buffer[] = [];
  const plain: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const cur = Buffer.from(Array.from({ length: width }, (_, x) => px(x, y)).flat());
    plain.push(cur);
    const prev = y ? plain[y - 1] : Buffer.alloc(stride);
    const f = y % 5;
    const out = Buffer.alloc(stride + 1);
    out[0] = f;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
      out[i + 1] = (cur[i] - pred) & 0xff;
    }
    rows.push(out);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { png, pixels: Buffer.concat(plain) };
}

const pattern = (x: number, y: number) => [(x * 37 + y * 11) & 0xff, (x * y) & 0xff, (x + 3 * y) & 0xff, 255];

describe("decodePng", () => {
  it("un-filters all five PNG row filters (None/Sub/Up/Average/Paeth)", () => {
    const { png, pixels } = filteredRgbaPng(7, 10, pattern);
    const img = decodePng(png);
    expect(img).toMatchObject({ width: 7, height: 10, bpp: 4 });
    expect(Buffer.compare(img.pixels, pixels)).toBe(0);
  });

  it("rejects non-PNG input", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/PNG/);
  });
});

describe("toOpaqueRgb", () => {
  it("drops the alpha channel of an opaque RGBA image", () => {
    const { png } = filteredRgbaPng(3, 2, pattern);
    const rgb = toOpaqueRgb(decodePng(png));
    expect(rgb.length).toBe(3 * 2 * 3);
    expect([...rgb.subarray(0, 3)]).toEqual(pattern(0, 0).slice(0, 3));
  });

  it("refuses translucent pixels instead of silently flattening them", () => {
    const { png } = filteredRgbaPng(2, 2, (x, y) => [10, 20, 30, x === 1 && y === 1 ? 128 : 255]);
    expect(() => toOpaqueRgb(decodePng(png))).toThrow(/transparent/);
  });
});

describe("encodeRgbPng", () => {
  it("writes an RGB PNG (colour type 2, no alpha) that decodes back to the same pixels", () => {
    const width = 5;
    const height = 4;
    const rgb = Buffer.from(
      Array.from({ length: width * height }, (_, i) => [i * 9, 255 - i, (i * 31) & 0xff]).flat(),
    );
    const png = encodeRgbPng(width, height, rgb);
    expect(png.subarray(0, 8)).toEqual(SIG);
    expect(png[8 + 4 + 4 + 9]).toBe(2); // IHDR colour type — RGB, без альфы
    const back = decodePng(png);
    expect(back).toMatchObject({ width, height, bpp: 3 });
    expect(Buffer.compare(back.pixels, rgb)).toBe(0);
  });
});
