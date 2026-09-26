import { test, expect } from "@playwright/experimental-ct-react";

// iOS-оболочка (Capacitor, contentInset "never") рисует WebView под статус-баром,
// «островом» и home indicator: отступы оболочки .m-app обязаны включать
// safe-area-инсеты, иначе шапка уезжает под «остров», а низ — под индикатор.
// В десктопном Chromium env(safe-area-inset-*) = 0, поэтому проверяем сами
// правила в CSSOM (то, что реально применит WKWebView).
//
// Все style-правила (включая вложенные в @media) с селектором на `prefix`:
// текст запрошенных свойств. Шорткаты `padding`/`background` с var() не
// раскладываются на лонгхенды в CSSOM — читаем их текст целиком. Функция
// сериализуется в страницу (page.evaluate) — без замыканий на внешнее.
function collectRules({ prefix, props }: { prefix: string; props: string[] }) {
  const out: Array<Record<string, string>> = [];
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && r.selectorText.startsWith(prefix)) {
        const row: Record<string, string> = { selector: r.selectorText };
        for (const p of props) row[p] = r.style.getPropertyValue(p);
        out.push(row);
      } else if (r instanceof CSSGroupingRule) {
        walk(r.cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
  return out;
}

const APP_PADDINGS = { prefix: ".m-app", props: ["padding", "padding-top", "padding-bottom"] };

test("the app shell pads its top by the safe-area inset (status bar / Dynamic Island)", async ({
  mount,
  page,
}) => {
  await mount(<div className="m-app">x</div>);
  const rules = await page.evaluate(collectRules, APP_PADDINGS);
  // Правила, задающие верхний отступ: базовое + компактное ≤480px (шорткат).
  const settingTop = rules.filter((r) => r.padding !== "" || r["padding-top"] !== "");
  expect(settingTop.length).toBeGreaterThanOrEqual(2);
  for (const r of settingTop) {
    expect(r.padding || r["padding-top"], r.selector).toContain("safe-area-inset-top");
  }
});

test("every bottom padding of the app shell keeps the home-indicator inset (incl. in-session)", async ({
  mount,
  page,
}) => {
  await mount(<div className="m-app">x</div>);
  const rules = await page.evaluate(collectRules, APP_PADDINGS);
  // Базовое, ≤480px и «чистое поле» сессии (.m-app:has(.m-session)).
  const settingBottom = rules.filter((r) => r.padding !== "" || r["padding-bottom"] !== "");
  expect(settingBottom.length).toBeGreaterThanOrEqual(3);
  for (const r of settingBottom) {
    expect(r["padding-bottom"] || r.padding, r.selector).toContain("safe-area-inset-bottom");
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
  const rules = await page.evaluate(collectRules, {
    prefix: "body::before",
    props: ["height", "background", "z-index", "pointer-events"],
  });
  const computed = await page.evaluate(() => {
    const cs = getComputedStyle(document.body, "::before");
    return { position: cs.position, top: cs.top };
  });
  const backdrop = { rules, ...computed };
  expect(backdrop.rules).toHaveLength(1);
  const [rule] = backdrop.rules;
  expect(rule.height).toContain("safe-area-inset-top");
  expect(rule.background).toContain("var(--page)");
  expect(Number(rule["z-index"])).toBeLessThan(50); // под .m-dialog-overlay
  expect(rule["pointer-events"]).toBe("none");
  expect(backdrop.position).toBe("fixed");
  expect(backdrop.top).toBe("0px");
});
