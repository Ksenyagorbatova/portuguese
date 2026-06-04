import { test, expect } from "@playwright/experimental-ct-react";
import { TabBar } from "./TabBar";

test("marks the active tab and reports tab switches", async ({ mount }) => {
  const picks: string[] = [];
  const component = await mount(<TabBar tab="review" onTab={(t) => picks.push(t)} />);

  await expect(component.getByRole("button", { name: /Повторение/ })).toHaveClass(/\bon\b/);
  await component.getByRole("button", { name: /Темы/ }).click();
  expect(picks).toEqual(["topics"]);
});
