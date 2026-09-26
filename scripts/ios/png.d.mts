// Type declarations for png.mjs so png.test.ts type-checks under
// tsconfig.test.json without allowJs (same pattern as scripts/worktree.d.mts).
export interface DecodedPng {
  width: number;
  height: number;
  /** bytes per pixel: 3 (RGB) or 4 (RGBA) */
  bpp: number;
  pixels: Buffer;
}
export function decodePng(buf: Buffer): DecodedPng;
export function toOpaqueRgb(img: DecodedPng): Buffer;
export function encodeRgbPng(width: number, height: number, rgb: Buffer): Buffer;
