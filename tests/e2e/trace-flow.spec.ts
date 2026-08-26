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

  await page.getByText("Analyze another thread", { exact: true }).click();
  await expect(page.getByText("1 active memory ready")).toBeVisible();
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
