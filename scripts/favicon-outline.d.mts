// Type declarations for favicon-outline.mjs so favicon-outline.test.ts
// type-checks under tsconfig.test.json without allowJs (as png.d.mts).
export const FAVICON_PATH: string;
export const FONT_PATH: string;
export function glyphPathData(fontBuffer: Uint8Array): string;
export function outlineFavicon(svg: string, fontBuffer: Uint8Array): string;
