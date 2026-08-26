import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const screenshotPath = path.resolve("apps/mobile/assets/icon.png");

async function uploadScreenshot(page: Page) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByLabel("Choose a chat screenshot").click();
  await (await chooserPromise).setFiles(screenshotPath);
}

async function uploadAndAnalyze(page: Page) {
  await uploadScreenshot(page);
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
    entities: JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}").memories?.length ?? 0,
    events: JSON.parse(localStorage.getItem("trace.demo.action-events.v1") ?? "[]").length,
    memories: JSON.parse(localStorage.getItem("trace.memories.v1") ?? "[]").length,
  }));
  expect(firstRun).toEqual({ entities: 1, events: 1, memories: 1 });

  await page.setViewportSize({ width: 390, height: 844 });
  const analyzeTab = page.getByRole("tab", { name: "Analyze" });
  const meetingsTab = page.getByRole("tab", { name: "Meetings" });
  const contactsTab = page.getByRole("tab", { name: "Contacts" });
  await expect(analyzeTab).toHaveAttribute("aria-selected", "true");
  await meetingsTab.click();
  await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
  await page.getByLabel("Open 与 Maya 的设计评审").first().click();
  await expect(page.getByText("Participants", { exact: true })).toBeVisible();
  await page.getByLabel("Remove Maya Chen").click();
  await expect(page.getByText("No participants.", { exact: true })).toBeVisible();
  await page.getByLabel("Add participant").click();
  await page.getByText("Maya Chen", { exact: true }).click();
  await page.getByLabel("Open Maya Chen").click();
  await expect(contactsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();

  await page.getByLabel("Add memory").click();
  await page.getByPlaceholder("Memory").fill("Prefers concise pre-read notes.");
  await page.getByLabel("Save memory").click();
  await expect(page.getByText("Prefers concise pre-read notes.", { exact: true })).toBeVisible();
  await page.getByLabel("Edit memory").click();
  await page.getByPlaceholder("Memory").fill("Prefers a concise pre-read before reviews.");
  await page.getByLabel("Save memory").click();
  await expect(page.getByText("Prefers a concise pre-read before reviews.", { exact: true })).toBeVisible();
  await page.getByLabel("Delete memory").click();
  await expect(page.getByText("Prefers a concise pre-read before reviews.", { exact: true })).toHaveCount(0);

  const entityWidths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(entityWidths.body).toBe(entityWidths.viewport);
  await analyzeTab.click();
  await expect(page.getByText("会前承诺比日历事件更值得跟进")).toBeVisible();

  await page.getByText("Analyze another thread", { exact: true }).click();
  await expect(page.getByText("New thread", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose screenshot", { exact: true })).toBeVisible();
  await expect(page.getByText("Additional context", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1 active memory ready")).toHaveCount(0);
  await expect(page.getByText("Fixture scenario", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze thread" })).toHaveCount(0);
  await uploadScreenshot(page);
  await expect(page.getByText("Additional context", { exact: true })).toBeVisible();
  await expect(page.getByText("1 active memory ready")).toHaveCount(0);
  await page.getByText("Contact update", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and execute" }).click();

  await expect(page.getByText("这条线程延续了之前的上下文")).toBeVisible();
  const secondRun = await page.evaluate(() => {
    const memories = JSON.parse(localStorage.getItem("trace.memories.v1") ?? "[]") as Array<{ status: string }>;
    const entities = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: unknown[];
      meetings?: unknown[];
      memories?: Array<{ status: string }>;
    };
    return {
      activeMemories: memories.filter((memory) => memory.status === "active").length,
      contacts: entities.contacts?.length ?? 0,
      entityMemories: entities.memories?.filter((memory) => memory.status === "active").length ?? 0,
      events: JSON.parse(localStorage.getItem("trace.demo.action-events.v1") ?? "[]").length,
      meetings: entities.meetings?.length ?? 0,
    };
  });
  expect(secondRun).toMatchObject({ activeMemories: 3, events: 2 });
  expect(secondRun.contacts).toBeGreaterThanOrEqual(2);
  expect(secondRun.meetings).toBeGreaterThanOrEqual(1);
  expect(secondRun.entityMemories).toBeGreaterThanOrEqual(2);
  await contactsTab.click();
  await page.waitForTimeout(300);
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();
  await expect(page.locator('input[value="Head of Product"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("mobile no-action state stays conservative and within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Contacts" }).click();
  await expect(page.getByText("People", { exact: true })).toBeVisible();
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Analyze" }).click();
  await expect(page.getByText("Turn a conversation into clear next steps")).toHaveCount(0);
  await expect(page.getByText("Additional context", { exact: true })).toHaveCount(0);
  await uploadScreenshot(page);
  await expect(page.getByText("Additional context", { exact: true })).toBeVisible();
  await page.getByText("None", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();

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
