// Type declarations for page-colors.mjs so page-colors.test.ts type-checks under
// tsconfig.test.json without allowJs (same pattern as png.d.mts).
export interface PageColors {
  light: string;
  dark: string;
}
export function pageColors(css: string): PageColors;
export function readPageColors(indexCssPath: string): PageColors;
export function pageBackgroundColorset(colors: PageColors): string;
