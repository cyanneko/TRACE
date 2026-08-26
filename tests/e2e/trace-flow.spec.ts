import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const screenshotPath = path.resolve("apps/mobile/assets/icon.png");

async function uploadAndAnalyze(page: Page) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByLabel("Choose a chat screenshot").click();
  await (await chooserPromise).setFiles(screenshotPath);
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();
}

test("confirmed actions persist memory and inform the next thread", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await uploadAndAnalyze(page);
  await page.getByRole("button", { name: "Confirm and execute" }).click();
  await expect(page.getByText("会前承诺比日历事件更值得跟进")).toBeVisible();

  const firstRun = await page.evaluate(() => ({
    events: JSON.parse(localStorage.getItem("trace.demo.action-events.v1") ?? "[]").length,
    memories: JSON.parse(localStorage.getItem("trace.memories.v1") ?? "[]").length,
  }));
  expect(firstRun).toEqual({ events: 1, memories: 1 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Analyze another thread", { exact: true }).click();
  await expect(page.getByText("1 active memory ready")).toBeVisible();
  const memoryDisclosure = page.getByRole("button", { name: "Show 1 active memory" });
  await expect(memoryDisclosure).toHaveAttribute("aria-expanded", "false");
  await memoryDisclosure.click();
  await expect(page.getByRole("button", { name: "Hide 1 active memory" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByText("与 Maya 的设计评审", { exact: true })).toBeVisible();
  await expect(page.getByText("Open loop", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed action · 2 evidence references · 95% confidence")).toBeVisible();
  const expandedWidths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(expandedWidths.body).toBe(expandedWidths.viewport);
  await page.getByRole("button", { name: "Hide 1 active memory" }).click();
  await expect(page.getByText("与 Maya 的设计评审", { exact: true })).toHaveCount(0);
  await page.getByText("Update", { exact: true }).click();
  await uploadAndAnalyze(page);
  await page.getByRole("button", { name: "Confirm and execute" }).click();

  await expect(page.getByText("这条线程延续了之前的上下文")).toBeVisible();
  const secondRun = await page.evaluate(() => {
    const memories = JSON.parse(localStorage.getItem("trace.memories.v1") ?? "[]") as Array<{ status: string }>;
    return {
      activeMemories: memories.filter((memory) => memory.status === "active").length,
      events: JSON.parse(localStorage.getItem("trace.demo.action-events.v1") ?? "[]").length,
    };
  });
  expect(secondRun).toEqual({ activeMemories: 3, events: 2 });
  expect(pageErrors).toEqual([]);
});

test("mobile no-action state stays conservative and within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("No action", { exact: true }).click();
  await uploadAndAnalyze(page);

  await expect(page.getByText("No grounded action found")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm and execute" })).toHaveCount(0);
  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(widths.body).toBe(widths.viewport);
});

test("provider settings persist locally and can be cleared", async ({ page }) => {
  const localKey = "e2e-local-only-key";

  await page.goto("/");
  await page.getByLabel("Provider settings").click();
  await page.getByLabel("Use DeepSeek").click();
  await page.getByLabel("Vision provider API key").fill(localKey);
  await page.getByLabel("Vision model").fill("deepseek-test-vision");
  await page.getByRole("button", { name: "Save provider" }).click();

  await expect(page.getByText("deepseek · deepseek-test-vision")).toBeVisible();
  const storedValues = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(storedValues.local).toContain(localKey);
  expect(storedValues.session).not.toContain(localKey);

  await page.reload();
  await expect(page.getByText("deepseek · deepseek-test-vision")).toBeVisible();
  await page.getByLabel("Provider settings").click();
  await page.getByLabel("Use Local default").click();
  await page.getByRole("button", { name: "Save provider" }).click();
  await expect(page.getByText("fixture · trace-analyze-fixtures")).toBeVisible();
  const clearedStorage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(clearedStorage).not.toContain(localKey);
});
