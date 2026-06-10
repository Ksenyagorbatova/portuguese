import { test, expect } from "@playwright/experimental-ct-react";
import { OfflineBanner } from "./OfflineBanner";
import type { HooksConfig } from "../../playwright/index";

// Состояние соединения подменяется стабом useConvexConnectionState
// (src/test/mocks/convexReact.ts) через hooksConfig — он применяется в
// beforeMount, т.е. гарантированно до первого рендера (см. playwright/index.tsx).

test("онлайн: баннер не рендерится", async ({ mount, page }) => {
  await mount(
    <div>
      <OfflineBanner />
    </div>,
  );
  await expect(page.locator(".m-offline")).toHaveCount(0);
});

test("офлайн: баннер «нет соединения» с обещанием автосохранения", async ({ mount }) => {
  const component = await mount<HooksConfig>(<OfflineBanner />, {
    hooksConfig: { connection: { isWebSocketConnected: false } },
  });
  await expect(component).toContainText("Нет соединения — ответы сохранятся");
});
