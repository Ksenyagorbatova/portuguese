import { test, expect } from "@playwright/experimental-ct-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Boom } from "../test/mocks/Boom";

test("ошибка рендера ребёнка → fallback на русском с кнопкой «Перезагрузить»", async ({
  mount,
}) => {
  const component = await mount(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  await expect(component.getByText("Что-то пошло не так.")).toBeVisible();
  await expect(component.getByRole("button", { name: "Перезагрузить" })).toBeVisible();
});

test("без ошибки рендерит детей как есть", async ({ mount }) => {
  const component = await mount(
    <ErrorBoundary>
      <div>живой контент</div>
    </ErrorBoundary>,
  );
  await expect(component.getByText("живой контент")).toBeVisible();
  await expect(component.getByText("Что-то пошло не так.")).toHaveCount(0);
});
