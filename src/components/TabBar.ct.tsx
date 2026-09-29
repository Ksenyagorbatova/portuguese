import { test, expect } from "@playwright/experimental-ct-react";
import { TabBar, type Tab } from "./TabBar";

test.use({ viewport: { width: 375, height: 667 } });

test("all three sections are reachable at the bottom with a named current page", async ({ mount }) => {
  let picked: Tab = "review";
  const c = await mount(<TabBar tab="review" onTab={(tab) => { picked = tab; }} />);
  await expect(c).toHaveRole("navigation");
  await expect(c.getByRole("button", { name: "Сегодня" })).toHaveAttribute("aria-current", "page");
  for (const [name, value] of [["Курс", "topics"], ["Профиль", "profile"]] as const) {
    const button = c.getByRole("button", { name });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y).toBeGreaterThan(550);
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
    await button.click();
    expect(picked).toBe(value);
  }
});
