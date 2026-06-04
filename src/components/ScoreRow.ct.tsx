import { test, expect } from "@playwright/experimental-ct-react";
import { ScoreRow } from "./ScoreRow";

test("shows counts and computed accuracy", async ({ mount }) => {
  const component = await mount(<ScoreRow correct={3} total={4} due={2} />);
  await expect(component).toContainText("75%");
  await expect(component).toContainText("Точность");
  await expect(component).toContainText("Верно");
});

test("shows a dash for accuracy before any answers", async ({ mount }) => {
  const component = await mount(<ScoreRow correct={0} total={0} due={0} />);
  await expect(component).toContainText("—");
});
