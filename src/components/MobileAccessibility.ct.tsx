import { test, expect } from "@playwright/experimental-ct-react";
import { StrictMode } from "react";
import { ActionBar, WordFeedback, NextButton } from "./Feedback";

test.use({ viewport: { width: 320, height: 568 } });

test("action stays above the mobile browser keyboard and follows viewport panning", async ({ mount, page }) => {
  const c = await mount(<StrictMode><div>
    <input aria-label="Ответ" autoFocus />
    <ActionBar><button className="m-btn m-btn--primary m-btn--block">Проверить</button></ActionBar>
  </div></StrictMode>);
  const button = c.getByRole("button", { name: "Проверить" });
  const bottom = () => button.evaluate((el) => el.getBoundingClientRect().bottom);
  const initialBottom = await bottom();
  const initialViewport = await page.evaluate(() => window.innerHeight);
  const bottomPadding = initialViewport - initialBottom;

  // Desktop automation has no OS keyboard: reproduce Safari's visual viewport
  // shrinking while the layout viewport (and position: fixed) stays unchanged.
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: 280 },
      offsetTop: { configurable: true, value: 0 },
      scale: { configurable: true, value: 1 },
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect.poll(bottom).toBeCloseTo(280 - bottomPadding, 0);

  // Safari pans the visual viewport to reveal a focused field further down.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "offsetTop", { configurable: true, value: 60 });
    window.visualViewport!.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(bottom).toBeCloseTo(340 - bottomPadding, 0);

  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: window.innerHeight },
      offsetTop: { configurable: true, value: 0 },
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect.poll(bottom).toBeCloseTo(initialBottom, 0);

  // Pinch zoom is not a keyboard: leave the action at its normal layout edge.
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: 280 },
      scale: { configurable: true, value: 2 },
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect.poll(bottom).toBeCloseTo(initialBottom, 0);
});

test("action mounts above an already open keyboard", async ({ mount, page }) => {
  // Set this before mounting: no resize event will arrive for the new action.
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: 300 },
      offsetTop: { configurable: true, value: 20 },
      scale: { configurable: true, value: 1 },
    });
  });
  const c = await mount(<ActionBar>
    <button className="m-btn m-btn--primary m-btn--block">Проверить</button>
  </ActionBar>);
  const button = c.getByRole("button", { name: "Проверить" });
  const rect = await button.boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(20);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(320);
});

for (const theme of ["light", "dark"] as const) {
  test(`primary text has AA contrast in ${theme}, and feedback audio is easy to tap`, async ({ mount }) => {
    const c = await mount(<div data-theme={theme}>
      <WordFeedback ok word={{ lessonKey: "l1", pt: "obrigada", ru: "спасибо" }} dueLabel="завтра" />
      <NextButton isLast={false} onClick={() => {}} />
    </div>);
    const button = c.getByRole("button", { name: "Дальше", exact: true });
    const ratio = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      const luminance = (rgb: string) => {
        const values = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((n) => {
          const channel = n / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    const audio = await c.getByRole("button", { name: /Прослушать/ }).boundingBox();
    // Subpixel transform rounding during the feedback animation can yield 43.999996.
    expect(Math.round(audio!.width * 100) / 100).toBeGreaterThanOrEqual(44);
    expect(Math.round(audio!.height * 100) / 100).toBeGreaterThanOrEqual(44);
    const action = await button.boundingBox();
    expect(action!.x).toBeGreaterThanOrEqual(0);
    expect(action!.x + action!.width).toBeLessThanOrEqual(320);
  });
}
