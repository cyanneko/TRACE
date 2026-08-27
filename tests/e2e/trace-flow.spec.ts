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
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await expect(page.getByRole("button", { name: "Confirm meetings" })).toBeVisible();
}

test("confirmed actions persist memory and inform the next thread", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await uploadAndAnalyze(page);
  await page.getByRole("button", { name: "Confirm meetings" }).click();
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
  await page.getByLabel("Edit participants").click();
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
  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();

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

  await expect(page.getByText("No contact action found")).toBeVisible();
  await expect(page.getByLabel("Feedback for contacts analysis")).toBeVisible();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await expect(page.getByText("No grounded action found")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Confirm/ })).toHaveCount(0);
  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(widths.body).toBe(widths.viewport);
});

test("a selected screenshot can be removed without discarding its description", async ({ page }) => {
  await page.goto("/");
  await uploadScreenshot(page);
  await page.getByPlaceholder("Anything the screenshot leaves out?").fill("The interview is about Aihola.");

  await page.getByLabel("Remove chat screenshot").click();

  await expect(page.getByLabel("Replace chat screenshot")).toHaveCount(0);
  await expect(page.getByText("Additional context", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Describe the conversation")).toHaveValue("The interview is about Aihola.");
  await expect(page.getByRole("button", { name: "Analyze thread" })).toBeVisible();
});

test("description-only analysis confirms contacts before meetings and links participants", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByLabel("Describe the conversation");
  const initialBox = await composer.boundingBox();
  await composer.fill("林乔介绍了自己，并约我明天下午三点聊半小时合作方案。");
  await page.getByText("Contact + meeting", { exact: true }).click();
  await page.waitForTimeout(320);
  const activeBox = await composer.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(activeBox).not.toBeNull();
  expect(activeBox!.y).toBeLessThan(initialBox!.y);

  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("STEP 1 OF 2", { exact: true })).toBeVisible();
  await expect(page.getByText("创建联系人林乔", { exact: true })).toBeVisible();
  await expect(page.getByText("创建与林乔的合作沟通", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();
  await expect(page.getByText("STEP 2 OF 2", { exact: true })).toBeVisible();
  await expect(page.getByText("创建与林乔的合作沟通", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm meetings" }).click();
  await expect(page.getByText("Execution results", { exact: true })).toBeVisible();

  const linkedEntities = await page.evaluate(() => {
    const entities = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<{ displayName: string; id: string }>;
      meetings?: Array<{ participantContactIds: string[]; title: string }>;
    };
    const contact = entities.contacts?.find((item) => item.displayName === "林乔");
    const meeting = entities.meetings?.find((item) => item.title === "与林乔的合作沟通");
    return {
      contactId: contact?.id,
      participants: meeting?.participantContactIds,
    };
  });
  expect(linkedEntities.participants).toEqual([linkedEntities.contactId]);

  await page.getByRole("tab", { name: "Meetings" }).click();
  await page.getByLabel("Open 与林乔的合作沟通").click();
  await expect(page.getByText("林乔", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown contact", { exact: true })).toHaveCount(0);
});

test("self and HR contacts are confirmed before both join the meeting", async ({ page }) => {
  const passes: Array<{
    actionScope: string;
    contacts: Array<{ displayName: string; isSelf?: boolean }>;
    reviewFeedback: string;
  }> = [];
  page.on("request", (request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== "/v1/analyze") return;
    const body = request.postDataJSON() as {
      actionScope: string;
      contacts: Array<{ displayName: string; isSelf?: boolean }>;
      reviewFeedback: string;
    };
    passes.push({
      actionScope: body.actionScope,
      contacts: body.contacts,
      reviewFeedback: body.reviewFeedback,
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Describe the conversation")
    .fill("我叫 Kai。Lina HR 约我明天下午两点面试，请创建我们并把两个人都加入会议。");
  await page.getByText("Me + HR", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze thread" }).click();

  await expect(page.getByText("创建我的联系人", { exact: true })).toBeVisible();
  await expect(page.getByLabel("This contact is me: Kai")).toBeChecked();
  await page.getByLabel("Feedback for contacts analysis").fill("Keep Kai as my self contact.");
  const contactRevision = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/analyze") &&
      response.request().postDataJSON()?.reviewFeedback === "Keep Kai as my self contact.",
  );
  await page.getByRole("button", { name: "Revise contacts" }).click();
  await contactRevision;
  await expect(page.getByText("创建我的联系人", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();

  await expect(page.getByText("创建 HR 面试", { exact: true })).toBeVisible();
  await expect(page.locator('input[value="Me, Lina HR"]')).toBeVisible();
  expect(passes.slice(0, 3).map((pass) => pass.actionScope)).toEqual([
    "contacts",
    "contacts",
    "meetings",
  ]);
  expect(passes[1]?.reviewFeedback).toBe("Keep Kai as my self contact.");
  expect(passes[2]?.contacts).toContainEqual(expect.objectContaining({ displayName: "Kai", isSelf: true }));

  await page.getByLabel("Feedback for meetings analysis").fill("Keep both attendees in the interview.");
  const meetingRevision = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/analyze") &&
      response.request().postDataJSON()?.reviewFeedback === "Keep both attendees in the interview.",
  );
  await page.getByRole("button", { name: "Revise meetings" }).click();
  await meetingRevision;
  await expect(page.getByText("创建 HR 面试", { exact: true })).toBeVisible();
  expect(passes.at(-1)).toMatchObject({
    actionScope: "meetings",
    reviewFeedback: "Keep both attendees in the interview.",
  });
  const reviewWidths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(reviewWidths.body).toBe(reviewWidths.viewport);
  await page.getByRole("button", { name: "Confirm meetings" }).click();
  await expect(page.getByText("Execution results", { exact: true })).toBeVisible();

  const linked = await page.evaluate(() => {
    const entities = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<{ displayName: string; id: string; isSelf: boolean }>;
      meetings?: Array<{ participantContactIds: string[]; title: string }>;
    };
    const self = entities.contacts?.find((contact) => contact.isSelf);
    const hr = entities.contacts?.find((contact) => contact.displayName === "Lina HR");
    const meeting = entities.meetings?.find((item) => item.title === "与 Lina HR 的面试");
    return {
      hrId: hr?.id,
      participants: meeting?.participantContactIds,
      selfId: self?.id,
      selfName: self?.displayName,
    };
  });
  expect(linked.selfName).toBe("Kai");
  expect(linked.participants?.sort()).toEqual([linked.selfId, linked.hrId].sort());

  await page.getByRole("tab", { name: "Meetings" }).click();
  await page.getByLabel("Open 与 Lina HR 的面试").click();
  await expect(page.getByLabel("Open Kai")).toBeVisible();
  await expect(page.getByLabel("Open Lina HR")).toBeVisible();
});

test("a failed meeting pass keeps confirmed contacts and can be revised", async ({ page }) => {
  let failNextMeetingPass = true;
  await page.route("**/v1/analyze", async (route) => {
    const body = route.request().postDataJSON() as { actionScope?: string };
    if (body.actionScope === "meetings" && failNextMeetingPass) {
      failNextMeetingPass = false;
      await route.abort("connectionrefused");
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByLabel("Describe the conversation")
    .fill("我叫 Kai。Lina HR 约我明天下午两点面试。");
  await page.getByText("Me + HR", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();

  await expect(page.getByText("Meeting analysis needs another try", { exact: true })).toBeVisible();
  await expect(page.getByText(/Confirmed contacts were saved/)).toBeVisible();
  const contactsAfterFailure = await page.evaluate(() => {
    const entities = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<{ displayName: string; isSelf: boolean }>;
    };
    return entities.contacts?.filter((contact) =>
      contact.displayName === "Kai" || contact.displayName === "Lina HR"
    );
  });
  expect(contactsAfterFailure).toHaveLength(2);
  expect(contactsAfterFailure?.find((contact) => contact.displayName === "Kai")?.isSelf).toBe(true);

  await page.getByLabel("Feedback for meetings analysis").fill("Retry with Kai and Lina HR included.");
  await page.getByRole("button", { name: "Revise meetings" }).click();
  await expect(page.getByText("创建 HR 面试", { exact: true })).toBeVisible();
  const contactsAfterRetry = await page.evaluate(() => {
    const entities = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<{ displayName: string }>;
    };
    return entities.contacts?.filter((contact) =>
      contact.displayName === "Kai" || contact.displayName === "Lina HR"
    ).length;
  });
  expect(contactsAfterRetry).toBe(2);
});

test("a successful analysis clears a stale offline health indicator", async ({ page }) => {
  await page.route("**/health", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByText("Analyzer offline", { exact: true })).toBeVisible();

  await uploadScreenshot(page);
  await page.getByRole("button", { name: "Analyze thread" }).click();

  await expect(page.getByText("Confirm what TRACE understood", { exact: true })).toBeVisible();
  await expect(page.getByText("Analyzer offline", { exact: true })).toHaveCount(0);
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
