import { test, expect } from "@playwright/experimental-ct-react";
import { Badge } from "./Badge";

test("renders the 'due' variant", async ({ mount }) => {
  await expect(await mount(<Badge tag="due" />)).toContainText("повторить");
});

test("renders the 'new' variant", async ({ mount }) => {
  await expect(await mount(<Badge tag="new" />)).toContainText("новое");
});

test("renders the 'cross' variant", async ({ mount }) => {
  await expect(await mount(<Badge tag="cross" />)).toContainText("сочетание");
});

test("renders the 'review' variant for any other tag", async ({ mount }) => {
  await expect(await mount(<Badge tag="review" />)).toContainText("повторение");
});
