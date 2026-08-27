import { expect, test, type Page } from "@playwright/test";
import { USER_NOTE_EVIDENCE_ID } from "@trace/contracts";
import path from "node:path";

const screenshotPath = path.resolve("apps/mobile/assets/icon.png");

async function setTestFixture(page: Page, fixtureId: string) {
  await page.evaluate((nextFixtureId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("__trace_fixture", nextFixtureId);
    window.history.replaceState({}, "", url);
  }, fixtureId);
}

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

test("contact update cards edit and persist the complete structured contact profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?__trace_fixture=update-contact");
  await uploadScreenshot(page);
  await page.getByRole("button", { name: "Analyze thread" }).click();

  await expect(page.getByText("Editing Maya Chen", { exact: true })).toBeVisible();
  await page.getByLabel("Given name").fill("Maya");
  await page.getByLabel("Family name").fill("Chen");
  await page.getByLabel("Phone numbers").fill("+86 138 0000 1208\n+86 139 0000 2208");
  await page.getByLabel("Email addresses").fill("maya@example.com\nmaya@northstar.example");
  await expect(page.getByLabel("Notes")).toHaveCount(0);
  await page.getByLabel("This contact is me: Maya Chen").click();
  await expect(page.getByText("7 changed", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);

  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();
  await page.getByRole("button", { name: "Finish with contacts" }).click();

  const stored = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<Record<string, unknown>>;
      memories?: Array<{ ownerId: string; ownerType: string }>;
    };
    const contact = state.contacts?.find((item) => item.displayName === "Maya Chen");
    return {
      contact,
      ownedMemoryCount: state.memories?.filter(
        (memory) => memory.ownerType === "contact" && memory.ownerId === contact?.id,
      ).length,
    };
  });
  expect(stored.contact).toMatchObject({
    company: "Northstar",
    jobTitle: "Head of Product",
    givenName: "Maya",
    familyName: "Chen",
    phones: ["+86 138 0000 1208", "+86 139 0000 2208"],
    emails: ["maya@example.com", "maya@northstar.example"],
    isSelf: true,
  });
  expect(stored.contact).not.toHaveProperty("notes");
  expect(stored.ownedMemoryCount).toBe(1);
});

test("meeting update cards persist rescheduled time and every structured meeting field", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?__trace_fixture=update-meeting");
  await uploadScreenshot(page);
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();

  await expect(page.getByText("Editing 与 Maya 的设计评审", { exact: true })).toBeVisible();
  await expect(page.getByText("2 changed", { exact: true })).toBeVisible();
  await page.getByLabel("All-day meeting: 与 Maya 的设计评审").click();
  await page.getByLabel("Location").fill("Room 8");
  await page.getByLabel("Meeting link").fill("https://example.com/review");
  await expect(page.getByLabel("Notes")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Confirm meetings" }).click();

  const meeting = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      meetings?: Array<Record<string, unknown>>;
    };
    return state.meetings?.find((item) => item.title === "与 Maya 的设计评审");
  });
  expect(meeting).toMatchObject({
    startAt: "2026-08-28T08:00:00.000Z",
    endAt: "2026-08-28T08:30:00.000Z",
    allDay: true,
    location: "Room 8",
    meetingLink: "https://example.com/review",
  });
  expect(meeting).not.toHaveProperty("notes");
});

test("confirmed actions persist memory and inform the next thread", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?__trace_fixture=meeting");
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
  await setTestFixture(page, "update-contact");
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();
  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();
  await expect(page.getByText("No meeting action found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish with contacts" }).click();

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
  await page.goto("/?__trace_fixture=no-action");
  await page.getByRole("tab", { name: "Contacts" }).click();
  await expect(page.getByText("People", { exact: true })).toBeVisible();
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Analyze" }).click();
  await expect(page.getByText("Turn a conversation into clear next steps")).toHaveCount(0);
  await expect(page.getByText("Additional context", { exact: true })).toHaveCount(0);
  await uploadScreenshot(page);
  await expect(page.getByText("Additional context", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();

  await expect(page.getByText("No contact action found")).toBeVisible();
  await expect(page.getByLabel("Feedback for contacts analysis")).toBeVisible();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await expect(page.getByText("No contact or meeting write needed")).toBeVisible();
  await page.getByRole("button", { name: "Continue to insights" }).click();
  await expect(page.getByText("Analysis complete", { exact: true })).toBeVisible();
  await expect(page.getByText("No writes needed", { exact: true })).toBeVisible();
  await expect(page.getByText("Thread processed", { exact: true })).toBeVisible();
  await expect(page.getByText("Global memory unchanged", { exact: true })).toBeVisible();
  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(widths.body).toBe(widths.viewport);
});

test("a description-only request reaches insights and can update global memory without actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const description = "请记住：我希望所有会议后的跟进都保持简洁。";
  let insightRequest: {
    screenshotDataUrl?: string;
    note?: string;
    thread?: { evidence?: Array<{ id: string }> };
    confirmedActions?: unknown[];
    toolResults?: unknown[];
  } | null = null;

  await page.route("**/v1/insights", async (route) => {
    insightRequest = route.request().postDataJSON() as typeof insightRequest;
    const response = await route.fetch();
    const result = (await response.json()) as { globalMemoryOperations: unknown[] };
    result.globalMemoryOperations = [
      {
        type: "create",
        content: "Prefer concise follow-ups after every meeting.",
        evidenceRefs: [USER_NOTE_EVIDENCE_ID],
        confidence: 0.95,
      },
    ];
    await route.fulfill({ response, json: result });
  });

  await page.goto("/?__trace_fixture=no-action");
  await page.getByLabel("Describe something").fill(description);
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await page.getByRole("button", { name: "Continue to insights" }).click();

  await expect(page.getByText("Global memory updated", { exact: true })).toBeVisible();
  await expect(page.getByText("1 automatic change applied", { exact: true })).toBeVisible();
  expect(insightRequest).toMatchObject({
    note: description,
    confirmedActions: [],
    toolResults: [],
  });
  expect(insightRequest?.screenshotDataUrl).toBeUndefined();

  await page.getByRole("button", { name: "Analyze another thread" }).click();
  await page.getByLabel("Describe something").fill(description);
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await page.getByRole("button", { name: "Continue to insights" }).click();
  await expect(page.getByText("Global memory unchanged", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1 proposed change was already present or no longer applicable.", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Global memory" }).click();
  await expect(
    page.getByText("Prefer concise follow-ups after every meeting.", { exact: true }),
  ).toHaveCount(1);
  const persistedMemory = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      globalMemoryCommits?: unknown[];
      memories?: Array<{
        content: string;
        ownerType: string;
        source: string;
        sourceEvidenceRefs: string[];
      }>;
    };
    return {
      commits: state.globalMemoryCommits?.length ?? 0,
      memory: state.memories?.find(
        (memory) =>
          memory.ownerType === "global" &&
          memory.content === "Prefer concise follow-ups after every meeting.",
      ),
    };
  });
  expect(persistedMemory.commits).toBe(2);
  expect(persistedMemory.memory?.source).toBe("insight");
  expect(persistedMemory.memory?.sourceEvidenceRefs).toEqual([USER_NOTE_EVIDENCE_ID]);
});

test("global memory and settings use compact edge navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?__trace_fixture=no-action");

  const memoryTab = page.getByRole("tab", { name: "Global memory" });
  const meetingsTab = page.getByRole("tab", { name: "Meetings" });
  const analyzeTab = page.getByRole("tab", { name: "Analyze" });
  const contactsTab = page.getByRole("tab", { name: "Contacts" });
  const settingsTab = page.getByRole("tab", { name: "Provider settings" });
  const [memoryBox, meetingsBox, analyzeBox, contactsBox, settingsBox] = await Promise.all([
    memoryTab.boundingBox(),
    meetingsTab.boundingBox(),
    analyzeTab.boundingBox(),
    contactsTab.boundingBox(),
    settingsTab.boundingBox(),
  ]);

  expect(memoryBox).not.toBeNull();
  expect(meetingsBox).not.toBeNull();
  expect(analyzeBox).not.toBeNull();
  expect(contactsBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(memoryBox!.x).toBeLessThan(meetingsBox!.x);
  expect(meetingsBox!.x).toBeLessThan(analyzeBox!.x);
  expect(analyzeBox!.x).toBeLessThan(contactsBox!.x);
  expect(contactsBox!.x).toBeLessThan(settingsBox!.x);
  expect(memoryBox!.width).toBeLessThan(meetingsBox!.width);
  expect(settingsBox!.width).toBeLessThan(contactsBox!.width);

  await memoryTab.click();
  await expect(memoryTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Global memory", { exact: true })).toBeVisible();
  await page.getByLabel("Add memory").click();
  await expect(page.getByText(/^(Context|Preference|Commitment|Note)$/)).toHaveCount(0);
  await page.getByPlaceholder("Memory").fill("Prefer concise summaries across every thread.");
  await page.getByLabel("Save memory").click();
  await expect(page.getByText("Prefer concise summaries across every thread.", { exact: true })).toBeVisible();

  const storedMemory = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      memories?: Array<Record<string, unknown>>;
    };
    const memory = state.memories?.find((item) => item.ownerType === "global");
    return {
      content: memory?.content,
      hasKind: memory ? Object.hasOwn(memory, "kind") : false,
      ownerId: memory?.ownerId,
      ownerType: memory?.ownerType,
    };
  });
  expect(storedMemory).toEqual({
    content: "Prefer concise summaries across every thread.",
    hasKind: false,
    ownerId: "00000000-0000-4000-8000-000000000000",
    ownerType: "global",
  });

  await page.getByLabel("Edit memory").click();
  await page.getByPlaceholder("Memory").fill("Prefer short summaries across every thread.");
  await page.getByLabel("Save memory").click();
  await expect(page.getByText("Prefer short summaries across every thread.", { exact: true })).toBeVisible();

  await settingsTab.click();
  await expect(settingsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Vision provider", { exact: true })).toBeVisible();
  await memoryTab.click();
  await expect(page.getByText("Prefer short summaries across every thread.", { exact: true })).toBeVisible();
  await page.getByLabel("Delete memory").click();
  await expect(page.getByText("Prefer short summaries across every thread.", { exact: true })).toHaveCount(0);

  const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(widths.body).toBe(widths.viewport);
});

test("insights receive the full thread and all memory scopes before updating global memory", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let insightRequest: {
    screenshotDataUrl?: string;
    note?: string;
    thread?: { summary?: string; evidence?: Array<{ id: string }> };
    confirmedActions?: Array<{ id: string }>;
    toolResults?: Array<{ actionId: string; success: boolean }>;
    entityMemories?: Array<{ content: string; id: string; ownerType: string }>;
    contacts?: unknown[];
    meetings?: unknown[];
  } | null = null;
  await page.route("**/v1/insights", async (route) => {
    insightRequest = route.request().postDataJSON() as typeof insightRequest;
    const response = await route.fetch();
    const result = (await response.json()) as {
      globalMemoryOperations: unknown[];
      insights: Array<{
        body: string;
        evidenceRefs: string[];
        importance: "high" | "medium" | "low";
        memoryRefs: string[];
        nextStep?: string;
        suggestedMessage?: string;
        title: string;
      }>;
    };
    const evidenceId = insightRequest?.thread?.evidence?.[0]?.id;
    const styleMemory = insightRequest?.entityMemories?.find(
      (memory) => memory.ownerType === "global" && memory.content.includes("猫娘"),
    );
    if (result.insights[0] && styleMemory) {
      result.insights[0] = {
        ...result.insights[0],
        title: "会前准备要跟上喵",
        body: "Maya 已确认会议，记得按约准备新版方案喵。",
        memoryRefs: [styleMemory.id],
      };
    }
    result.globalMemoryOperations = [
      {
        type: "create",
        content: "Prefer concise follow-ups after important conversations.",
        evidenceRefs: [evidenceId],
        confidence: 0.94,
      },
    ];
    await route.fulfill({ response, json: result });
  });

  await page.goto("/?__trace_fixture=meeting");
  await page.getByRole("tab", { name: "Global memory" }).click();
  await page.getByLabel("Add memory").click();
  await page.getByPlaceholder("Memory").fill("洞察和建议使用自然的猫娘语气，在合适的句尾加喵。");
  await page.getByLabel("Save memory").click();

  await page.getByRole("tab", { name: "Contacts" }).click();
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();
  await page.getByLabel("Open Maya Chen").click();
  await page.getByLabel("Add memory").click();
  await page.getByPlaceholder("Memory").fill("Maya expects the deck before a review.");
  await page.getByLabel("Save memory").click();

  await page.getByRole("tab", { name: "Analyze" }).click();
  await uploadScreenshot(page);
  await page.getByPlaceholder("Anything the screenshot leaves out?").fill(
    "The recommendation should consider the full design-review context.",
  );
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Confirm what TRACE understood")).toBeVisible();
  await page.getByRole("button", { name: "Analyze meetings without contacts" }).click();
  await page.getByRole("button", { name: "Confirm meetings" }).click();

  await expect(page.getByText("会前准备要跟上喵", { exact: true })).toBeVisible();
  await expect(page.getByText("Maya 已确认会议，记得按约准备新版方案喵。", { exact: true })).toBeVisible();
  await expect(page.getByText("1 active memory reference(s)", { exact: true })).toBeVisible();
  await expect(page.getByText("Global memory updated", { exact: true })).toBeVisible();
  await expect(page.getByText("1 automatic change applied", { exact: true })).toBeVisible();
  expect(insightRequest).not.toBeNull();
  expect(insightRequest?.screenshotDataUrl).toMatch(/^data:image\//);
  expect(insightRequest?.note).toBe(
    "The recommendation should consider the full design-review context.",
  );
  expect(insightRequest?.thread?.summary).toContain("Maya");
  expect(insightRequest?.confirmedActions).toHaveLength(1);
  expect(insightRequest?.toolResults).toEqual([
    expect.objectContaining({ success: true }),
  ]);
  expect(new Set(insightRequest?.entityMemories?.map((memory) => memory.ownerType))).toEqual(
    new Set(["global", "contact", "meeting"]),
  );
  expect(insightRequest?.entityMemories).toContainEqual(
    expect.objectContaining({ ownerType: "global", content: expect.stringContaining("猫娘") }),
  );
  expect(insightRequest?.contacts?.length).toBeGreaterThan(0);
  expect(insightRequest?.meetings?.length).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Global memory" }).click();
  await expect(
    page.getByText("Prefer concise follow-ups after important conversations.", { exact: true }),
  ).toBeVisible();
  const persisted = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      globalMemoryCommits?: unknown[];
      memories?: Array<{ content: string; ownerType: string; source: string }>;
    };
    return {
      commits: state.globalMemoryCommits?.length ?? 0,
      generated: state.memories?.find(
        (memory) =>
          memory.ownerType === "global" &&
          memory.content === "Prefer concise follow-ups after important conversations.",
      ),
    };
  });
  expect(persisted.commits).toBe(1);
  expect(persisted.generated?.source).toBe("insight");
});

test("a selected screenshot can be removed without discarding its description", async ({ page }) => {
  await page.goto("/");
  await uploadScreenshot(page);
  await page.getByPlaceholder("Anything the screenshot leaves out?").fill("The interview is about Aihola.");

  await page.getByLabel("Remove chat screenshot").click();

  await expect(page.getByLabel("Replace chat screenshot")).toHaveCount(0);
  await expect(page.getByText("Additional context", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Describe something")).toHaveValue("The interview is about Aihola.");
  await expect(page.getByRole("button", { name: "Analyze thread" })).toBeVisible();
});

test("description-only analysis confirms contacts before meetings and links participants", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?__trace_fixture=contact-meeting");
  const title = page.getByText("New thread", { exact: true });
  const frame = page.getByLabel("Thread composer");
  const composer = page.getByLabel("Describe something");
  const initialTitleBox = await title.boundingBox();
  const initialFrameBox = await frame.boundingBox();
  const initialBox = await composer.boundingBox();
  expect(initialTitleBox).not.toBeNull();
  expect(initialFrameBox).not.toBeNull();
  expect(initialBox).not.toBeNull();
  expect(Math.abs(initialTitleBox!.x + initialTitleBox!.width / 2 - (initialFrameBox!.x + initialFrameBox!.width / 2))).toBeLessThan(2);
  expect(initialFrameBox!.y - (initialTitleBox!.y + initialTitleBox!.height)).toBeLessThanOrEqual(12);
  expect(initialBox!.height).toBeLessThan(initialFrameBox!.height * 0.45);

  await composer.fill("林乔介绍了自己，并约我明天下午三点聊半小时合作方案。");
  await page.waitForTimeout(320);
  const activeBox = await composer.boundingBox();
  const activeFrameBox = await frame.boundingBox();
  expect(activeBox).not.toBeNull();
  expect(activeFrameBox).not.toBeNull();
  expect(activeBox!.y).toBeLessThan(initialBox!.y);
  expect(activeBox!.height).toBeGreaterThan(activeFrameBox!.height * 0.9);
  await expect(page.getByLabel("Choose a chat screenshot")).toHaveCount(0);

  await composer.fill("");
  await page.waitForTimeout(320);
  const resetBox = await composer.boundingBox();
  const resetFrameBox = await frame.boundingBox();
  expect(resetBox).not.toBeNull();
  expect(resetFrameBox).not.toBeNull();
  expect(resetBox!.height).toBeLessThan(resetFrameBox!.height * 0.45);
  expect(resetFrameBox!.y).toBeGreaterThan(activeFrameBox!.y);
  await expect(page.getByLabel("Choose a chat screenshot")).toBeVisible();

  await composer.fill("林乔介绍了自己，并约我明天下午三点聊半小时合作方案。");

  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("STEP 1 OF 2", { exact: true })).toBeVisible();
  await expect(page.getByText("创建联系人林乔", { exact: true })).toBeVisible();
  await expect(page.getByText("创建与林乔的合作沟通", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();
  await expect(page.getByText("STEP 2 OF 2", { exact: true })).toBeVisible();
  await expect(page.getByText("创建与林乔的合作沟通", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Proposed meeting participants:/)).toContainText("林乔");
  await page.getByLabel("Edit proposed meeting participants").click();
  await expect(page.getByLabel("Remove 林乔 from proposed meeting")).toBeChecked();
  await page.getByLabel("Edit proposed meeting participants").click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  const passes: Array<{
    actionScope: string;
    contacts: Array<{ displayName: string; isSelf?: boolean }>;
    reviewFeedback: string;
  }> = [];
  await page.route("**/v1/analyze", async (route) => {
    const body = route.request().postDataJSON() as {
      actionScope: string;
      contacts: Array<{ displayName: string; id: string }>;
    };
    const response = await route.fetch();
    if (body.actionScope !== "meetings") {
      await route.fulfill({ response });
      return;
    }
    const result = (await response.json()) as {
      actionCards: Array<{
        type: string;
        payload: Record<string, unknown>;
      }>;
    };
    const participantContactIds = body.contacts
      .filter((contact) => contact.displayName === "Kai" || contact.displayName === "Lina HR")
      .map((contact) => contact.id);
    result.actionCards = result.actionCards.map((card) =>
      card.type === "create_meeting"
        ? {
            ...card,
            payload: {
              ...card.payload,
              participantContactIds,
              participantNames: [],
            },
          }
        : card,
    );
    await route.fulfill({ response, json: result });
  });
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
  await page.goto("/?__trace_fixture=self-meeting");
  await page
    .getByLabel("Describe something")
    .fill("我叫 Kai。Lina HR 约我明天下午两点面试，请创建我们并把两个人都加入会议。");
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
  await expect(page.getByLabel(/^Proposed meeting participants:/)).toContainText("Kai, Lina HR");
  await expect(page.getByLabel("Names not matched to contacts")).toHaveCount(0);
  await page.getByLabel("Edit proposed meeting participants").click();
  await expect(page.getByLabel("Remove Kai from proposed meeting")).toBeChecked();
  await expect(page.getByLabel("Remove Lina HR from proposed meeting")).toBeChecked();
  await page.getByLabel("Remove Kai from proposed meeting").click();
  await expect(page.getByLabel("Add Kai to proposed meeting")).not.toBeChecked();
  await page.getByLabel("Add Kai to proposed meeting").click();
  await expect(page.getByLabel("Remove Kai from proposed meeting")).toBeChecked();
  await page.getByLabel("Edit proposed meeting participants").click();
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
  await page.goto("/?__trace_fixture=self-meeting");
  await page
    .getByLabel("Describe something")
    .fill("我叫 Kai。Lina HR 约我明天下午两点面试。");
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

test("an empty meeting response waits for an explicit user decision", async ({ page }) => {
  await page.route("**/v1/analyze", async (route) => {
    const body = route.request().postDataJSON() as { actionScope?: string };
    const response = await route.fetch();
    if (body.actionScope !== "meetings") {
      await route.fulfill({ response });
      return;
    }

    const result = (await response.json()) as { actionCards: unknown[] };
    await route.fulfill({ response, json: { ...result, actionCards: [] } });
  });
  await page.goto("/?__trace_fixture=self-meeting");
  await page
    .getByLabel("Describe something")
    .fill("我叫 Kai。Lina HR 约我明天下午两点面试。");
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await page.getByRole("button", { name: "Confirm contacts and analyze meetings" }).click();

  await expect(page.getByText("STEP 2 OF 2", { exact: true })).toBeVisible();
  await expect(page.getByText("No meeting action found", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Feedback for meetings analysis")).toBeVisible();
  await expect(page.getByText("Execution results", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Finish with contacts" }).click();
  await expect(page.getByText("Execution results", { exact: true })).toBeVisible();

  const entities = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("trace.entities.v2") ?? "{}") as {
      contacts?: Array<{ displayName: string }>;
      meetings?: Array<{ title: string }>;
    };
    return {
      contacts: stored.contacts?.filter((contact) =>
        contact.displayName === "Kai" || contact.displayName === "Lina HR"
      ).length,
      meetings: stored.meetings?.filter((meeting) => meeting.title === "与 Lina HR 的面试").length ?? 0,
    };
  });
  expect(entities).toEqual({ contacts: 2, meetings: 0 });
});

test("a successful analysis clears a stale offline health indicator", async ({ page }) => {
  await page.route("**/health", (route) => route.abort("connectionrefused"));
  await page.goto("/?__trace_fixture=meeting");
  await expect(page.getByText("Analyzer offline", { exact: true })).toBeVisible();

  await uploadScreenshot(page);
  await page.getByRole("button", { name: "Analyze thread" }).click();

  await expect(page.getByText("Confirm what TRACE understood", { exact: true })).toBeVisible();
  await expect(page.getByText("Analyzer offline", { exact: true })).toHaveCount(0);
});

test("provider settings persist locally and can be cleared", async ({ page }) => {
  const localKey = "e2e-local-only-key";

  await page.goto("/");
  await expect(page.getByText("Set provider", { exact: true })).toBeVisible();
  await page.getByLabel("Describe something").fill("A provider is required for this thread.");
  await page.getByRole("button", { name: "Analyze thread" }).click();
  await expect(page.getByText("Vision provider", { exact: true })).toBeVisible();
  await page.getByLabel("Choose vision provider").click();
  await expect(page.getByLabel("Use Fixture")).toHaveCount(0);
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
  await page.getByLabel("Choose vision provider").click();
  await page.getByLabel("Use Local default").click();
  await page.getByRole("button", { name: "Save provider" }).click();
  await expect(page.getByText("Set provider", { exact: true })).toBeVisible();
  const clearedStorage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(clearedStorage).not.toContain(localKey);
});
