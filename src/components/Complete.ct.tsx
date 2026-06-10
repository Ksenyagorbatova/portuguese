import { test, expect } from "@playwright/experimental-ct-react";
import { Complete } from "./Complete";

test("celebrates a perfect score and restarts", async ({ mount }) => {
  let restarted = false;
  const component = await mount(
    <Complete
      correct={4}
      total={4}
      dueCountAll={0}
      nextLesson={null}
      onRestart={() => {
        restarted = true;
      }}
      onPickLesson={() => {}}
      onGoReview={() => {}}
    />,
  );

  await expect(component).toContainText("Сессия завершена!");
  await expect(component).toContainText("100%");
  await expect(component).toContainText("Все повторения сделаны");
  await component.getByRole("button", { name: "Ещё раз" }).click();
  expect(restarted).toBe(true);
});

test("surfaces pending reviews and routes to them", async ({ mount }) => {
  let wentReview = false;
  const component = await mount(
    <Complete
      correct={1}
      total={4}
      dueCountAll={5}
      nextLesson={null}
      onRestart={() => {}}
      onPickLesson={() => {}}
      onGoReview={() => {
        wentReview = true;
      }}
    />,
  );

  await expect(component).toContainText("Ещё 5 слов ждут повторения");
  await component.getByRole("button", { name: /К повторению/ }).click();
  expect(wentReview).toBe(true);
});

test("pluralizes the pending-review note: 1 слово ждёт / 2 слова ждут", async ({ mount }) => {
  const props = {
    correct: 1,
    total: 1,
    nextLesson: null,
    onRestart: () => {},
    onPickLesson: () => {},
    onGoReview: () => {},
  };
  const one = await mount(<Complete {...props} dueCountAll={1} />);
  await expect(one).toContainText("Ещё 1 слово ждёт повторения");

  await one.unmount();
  const few = await mount(<Complete {...props} dueCountAll={2} />);
  await expect(few).toContainText("Ещё 2 слова ждут повторения");
});
