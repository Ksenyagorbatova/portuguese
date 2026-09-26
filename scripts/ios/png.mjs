// Минимальный PNG-кодек (8 бит, без интерлейса) для render-assets.mjs:
// скриншот Chromium (RGB/RGBA, адаптивные фильтры строк) → пиксели → RGB PNG
// без альфа-канала. Иконку с альфа-каналом App Store Connect отвергает, а
// Chromium пишет скриншоты с альфой даже на непрозрачном фоне. Без зависимостей:
// zlib из Node (crc32 — Node ≥ 22.2, проект на 24).
import { crc32, deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** @param {Buffer} buf */
export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("decodePng: not a PNG file");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bpp = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(
          `decodePng: unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`,
        );
      }
      bpp = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (!bpp) throw new Error("decodePng: PNG without IHDR");

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let pred;
      switch (filter) {
        case 0:
          pred = 0;
          break;
        case 1:
          pred = a;
          break;
        case 2:
          pred = b;
          break;
        case 3:
          pred = (a + b) >> 1;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default:
          throw new Error(`decodePng: bad filter ${filter} in row ${y}`);
      }
      cur[i] = (line[i] + pred) & 0xff;
    }
  }
  return { width, height, bpp, pixels };
}

/**
 * RGB-пиксели непрозрачной картинки. Полупрозрачный пиксель — ошибка, а не
 * молчаливое «сплющивание»: иконка обязана быть непрозрачной по построению.
 * @param {{ width: number, height: number, bpp: number, pixels: Buffer }} img
 */
export function toOpaqueRgb(img) {
  if (img.bpp === 3) return img.pixels;
  const n = img.width * img.height;
  const rgb = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    if (img.pixels[i * 4 + 3] !== 255) {
      throw new Error(`toOpaqueRgb: transparent pixel at index ${i}`);
    }
    rgb[i * 3] = img.pixels[i * 4];
    rgb[i * 3 + 1] = img.pixels[i * 4 + 1];
    rgb[i * 3 + 2] = img.pixels[i * 4 + 2];
  }
  return rgb;
}

/**
 * PNG, colour type 2 (RGB, 8 бит) — без альфа-канала.
 * @param {number} width @param {number} height @param {Buffer} rgb
 */
export function encodeRgbPng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // фильтр None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
