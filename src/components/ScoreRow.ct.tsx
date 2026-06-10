import { test, expect } from "@playwright/experimental-ct-react";
import { ScoreRow } from "./ScoreRow";

test("shows three cells — Верно / Заданий / Точность — and no «К повтору»", async ({ mount }) => {
  const component = await mount(<ScoreRow correct={3} total={4} />);
  await expect(component).toHaveClass(/m-stats/);
  await expect(component.locator(".m-stat")).toHaveCount(3);
  await expect(component).toContainText("Верно");
  await expect(component).toContainText("Заданий");
  await expect(component).toContainText("75%");
  await expect(component).toContainText("Точность");
  await expect(component).not.toContainText("К повтору");
});

test("falls back to a dash for accuracy when there are no answers", async ({ mount }) => {
  const component = await mount(<ScoreRow correct={0} total={0} />);
  await expect(component).toContainText("—");
});
