import { test, expect } from "@playwright/experimental-ct-react";

// iOS-оболочка (Capacitor, contentInset "never") рисует WebView под статус-баром,
// «островом» и home indicator: отступы оболочки .m-app обязаны включать
// safe-area-инсеты, иначе шапка уезжает под «остров», а низ — под индикатор.
// В десктопном Chromium env(safe-area-inset-*) = 0, поэтому проверяем сами
// правила в CSSOM (то, что реально применит WKWebView). Шорткат `padding` с
// var() не раскладывается на лонгхенды в CSSOM — читаем его текст целиком.
function collectAppShellPaddings() {
  const out: Array<{ selector: string; padding: string; top: string; bottom: string }> = [];
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        if (r.selectorText.startsWith(".m-app")) {
          out.push({
            selector: r.selectorText,
            padding: r.style.getPropertyValue("padding"),
            top: r.style.getPropertyValue("padding-top"),
            bottom: r.style.getPropertyValue("padding-bottom"),
          });
        }
      } else if (r instanceof CSSGroupingRule) {
        walk(r.cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
  return out;
}

test("the app shell pads its top by the safe-area inset (status bar / Dynamic Island)", async ({
  mount,
  page,
}) => {
  await mount(<div className="m-app">x</div>);
  const rules = await page.evaluate(collectAppShellPaddings);
  // Правила, задающие верхний отступ: базовое + компактное ≤480px (шорткат).
  const settingTop = rules.filter((r) => r.padding !== "" || r.top !== "");
  expect(settingTop.length).toBeGreaterThanOrEqual(2);
  for (const r of settingTop) {
    expect(r.padding || r.top, r.selector).toContain("safe-area-inset-top");
  }
});

test("every bottom padding of the app shell keeps the home-indicator inset (incl. in-session)", async ({
  mount,
  page,
}) => {
  await mount(<div className="m-app">x</div>);
  const rules = await page.evaluate(collectAppShellPaddings);
  // Базовое, ≤480px и «чистое поле» сессии (.m-app:has(.m-session)).
  const settingBottom = rules.filter((r) => r.padding !== "" || r.bottom !== "");
  expect(settingBottom.length).toBeGreaterThanOrEqual(3);
  for (const r of settingBottom) {
    expect(r.bottom || r.padding, r.selector).toContain("safe-area-inset-bottom");
  }
});

// При прокрутке контент уходил под часы/«остров» (WebView под статус-баром):
// фиксированная непрозрачная подложка высотой safe-area-inset-top цвета страницы
// прячет его. Ниже модального оверлея (z 50), кликов не перехватывает.
test("an opaque status-bar backdrop covers the top inset while scrolling", async ({
  mount,
  page,
}) => {
  await mount(<div className="m-app">x</div>);
  const backdrop = await page.evaluate(() => {
    const found: Array<{ height: string; background: string; zIndex: string; events: string }> =
      [];
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSStyleRule && r.selectorText === "body::before") {
          found.push({
            height: r.style.getPropertyValue("height"),
            background: r.style.getPropertyValue("background"),
            zIndex: r.style.getPropertyValue("z-index"),
            events: r.style.getPropertyValue("pointer-events"),
          });
        } else if (r instanceof CSSGroupingRule) walk(r.cssRules);
      }
    };
    for (const s of Array.from(document.styleSheets)) walk(s.cssRules);
    const cs = getComputedStyle(document.body, "::before");
    return { rules: found, position: cs.position, top: cs.top };
  });
  expect(backdrop.rules).toHaveLength(1);
  const [rule] = backdrop.rules;
  expect(rule.height).toContain("safe-area-inset-top");
  expect(rule.background).toContain("var(--page)");
  expect(Number(rule.zIndex)).toBeLessThan(50); // под .m-dialog-overlay
  expect(rule.events).toBe("none");
  expect(backdrop.position).toBe("fixed");
  expect(backdrop.top).toBe("0px");
});
