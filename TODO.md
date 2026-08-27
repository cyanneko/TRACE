# TRACE Development TODO

> Active build checklist for the 16-hour MVP iteration.

## Working Rules

- Keep the main user loop runnable after every iteration.
- Before each new iteration, tag and push the current `main` revision so the previous UI can be restored directly.
- Make one focused commit per iteration and push it to `origin/main` immediately.
- Do not execute contacts, calendar, or memory writes before explicit confirmation.
- Never commit or bundle provider keys; BYOK values may exist only at runtime.
- Use fixture mode for deterministic tests; never silently present fixture output as a real model result.
- Preserve unrelated local changes. In particular, the current local edit to `docs/IMPLEMENTATION_DRAFT.md` is outside these iterations.

## Definition of MVP

- A user can select a chat screenshot and add optional context.
- TRACE returns grounded conversation context and editable action cards.
- The four supported actions are create meeting, update meeting, create contact, and update contact.
- Confirmation triggers an executor and produces an auditable result.
- Confirmed facts become structured memory; rejected or failed actions do not.
- Insights are generated only after confirmation and cite current evidence or active memory.
- The complete flow runs in WSL through Expo Web with explicit demo adapters.
- The architecture provides native adapters for final iOS contact/calendar validation.

## Iteration 0 - Delivery Map

Status: completed

- [x] Freeze the WSL-first, iOS-final architecture.
- [x] Define iteration boundaries and completion checks.
- [x] Record the current environment issue: WSL has no Linux Node.js binary.
- [x] Commit and push this TODO.

Verification:

```bash
git diff --check
git status --short
```

Commit: `a6d884e`

## Iteration 1 - Workspace and Contracts

Status: completed

- [x] Install or activate a Linux Node.js LTS runtime inside WSL.
- [x] Create an npm workspace for `apps/mobile`, `apps/api`, and `packages/contracts`.
- [x] Scaffold the Expo app with Web support and the product name TRACE.
- [x] Scaffold the TypeScript API with `/health`.
- [x] Define Zod schemas for thread context, action cards, tool results, memory, and insights.
- [x] Add root development, typecheck, and test scripts.

Completion check:

```bash
npm install
npm run typecheck
npm test
```

Commit: `4926018`

## Iteration 2 - Agent Analysis API

Status: completed

- [x] Add a provider boundary with fixture, DeepSeek, GLM, Doubao, and custom OpenAI-compatible configurations.
- [x] Accept a screenshot, optional note, compact contact index, memory, and timezone.
- [x] Implement `/v1/analyze` with JSON validation and one repair attempt.
- [x] Return conversation context, evidence, uncertainties, contact matches, and action cards.
- [x] Add meeting, new-contact, update-contact, and no-action fixtures.
- [x] Ensure uploaded screenshots are not persisted or logged by the API.

Completion check:

```bash
npm run test --workspace @trace/api
npm run dev:api
curl http://localhost:8787/health
```

Commit: `8ff8ae2`

## Iteration 3 - WSL Web Capture and Review

Status: completed

- [x] Build the Capture screen with image selection, preview, and optional note.
- [x] Add a Web fixture contact source.
- [x] Connect the real and fixture analysis modes.
- [x] Build conversation summary, evidence, and uncertainty states.
- [x] Build editable/selectable action cards for all three action types.
- [x] Add loading, retry, malformed-output, no-action, and empty-input states.
- [x] Clearly display Fixture mode when deterministic analysis is active.

Completion check:

```bash
npm run dev:web
npm run typecheck
```

Manual check: upload a fixture screenshot and reach review without browser console errors.

Commit: `51da811`

## Iteration 4 - Execution, Memory, and Insights

Status: completed

- [x] Add the confirmation state boundary and execution reducer states.
- [x] Implement Web `DemoActionExecutor` with idempotent local action events.
- [x] Implement Web memory persistence with local storage.
- [x] Add deterministic memory writes from successful confirmed actions.
- [x] Implement supersede and delete behavior.
- [x] Implement `/v1/insights` and its grounded policy response.
- [x] Show execution results, evidence-backed insights, suggested messages, and memory updates.
- [x] Demonstrate a second run retrieving memory from the first run.

Completion check:

```bash
npm test
npm run typecheck
```

Manual check: rejected actions cause no writes; repeated confirmation causes no duplicates.

Commit: `9de1719`

## Iteration 5 - iOS Boundary and Handoff

Status: completed

- [x] Add platform-specific `ContactSource`, `ActionExecutor`, and `MemoryRepository` modules.
- [x] Add the native contacts implementation.
- [x] Add the native SQLite implementation with a Web localStorage adapter.
- [x] Prepare the native calendar implementation for an EAS development build.
- [x] Add permission descriptions and capability checks.
- [x] Add automated contract, memory-policy, reducer, API, and browser smoke tests.
- [x] Verify the Web flow at an iPhone-sized viewport.
- [x] Write environment setup, provider configuration, fixture mode, WSL, Expo Go, and EAS notes.
- [x] Record known limitations honestly.

Completion check:

```bash
npm run check
npm run build:web
```

Manual check: complete the demo twice from a clean browser profile using the README only.

Commit: `feat(ios): add native adapters and delivery handoff`

## Iteration 6 - Open BYOK Provider Settings

Status: completed

- [x] Add in-app selection for local default, Fixture, DeepSeek, GLM, Doubao, and Custom.
- [x] Expose model, base URL, image payload, image detail, and JSON compatibility controls.
- [x] Persist BYOK settings only on the current device: browser localStorage on Web and iOS Keychain on native.
- [x] Attach provider configuration per analysis request without changing shared server state.
- [x] Redact provider credentials from API logging paths and never return them in responses.
- [x] Restrict custom production relay hosts while leaving local open-source development configurable.
- [x] Verify settings and the existing agent loop in desktop and iPhone-sized browsers.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
```

Commit: `feat(settings): add local BYOK vision providers`

## Iteration 7 - DeepSeek Vision Reliability

Status: completed

- [x] Diagnose the browser timeout against live API timings without reading or logging the user's key.
- [x] Disable DeepSeek thinking mode for deterministic structured extraction.
- [x] Raise the output budget and align model, analysis, and client timeout boundaries.
- [x] Return specific provider-timeout and truncated-output errors.
- [x] Add provider payload, timeout, truncation, and route regression tests.
- [x] Run the full check, browser smoke test, and production builds.
- [x] Commit and push the fix to `origin/main`.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
```

Commit: `fix(provider): harden DeepSeek vision analysis`

## Iteration 8 - Expandable Active Memory Context

Status: completed

- [x] Keep full active memory records available on the capture screen.
- [x] Add an accessible expand and collapse control to the memory context summary.
- [x] Show each memory's type, summary, source evidence count, and confidence.
- [x] Share memory presentation rules with the execution result screen.
- [x] Add mobile-width browser coverage for expand, collapse, and overflow behavior.
- [x] Run the full check and Web/iOS production bundles.
- [x] Commit and push the iteration to `origin/main`.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(memory): add expandable context details`

## Iteration 9 - Compact App Capture Screen

Status: completed

- [x] Preserve Iteration 8 as the remote tag `iteration-8-expandable-memory` before editing.
- [x] Replace the introductory hero copy with a single `New thread` title.
- [x] Reduce the empty upload control to `Choose screenshot` only.
- [x] Reveal additional context, memory, Fixture controls, and analysis actions only after image selection.
- [x] Remove filename, dimensions, format help, and other nonessential capture copy.
- [x] Increase the primary capture, input, memory, Fixture, and action typography.
- [x] Add browser coverage for the progressive disclosure behavior.
- [x] Run the full check and Web/iOS production bundles.
- [x] Commit and push the iteration to `origin/main`.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(capture): simplify the app entry screen`

## Iteration 10 - Analyze and Memory Tabs

Status: completed

- [x] Preserve Iteration 9 as the remote tag `iteration-9-compact-capture` before editing.
- [x] Add persistent bottom Analyze and Memory tabs.
- [x] Preserve the current capture, review, or result state while switching tabs.
- [x] Move active memory summaries, provenance, confidence, and deletion into a dedicated Memory screen.
- [x] Show active memory count in the Memory tab and a focused empty state when none exist.
- [x] Remove duplicate memory UI from Capture and Result screens.
- [x] Verify tab state, new-memory labels, deletion, and mobile overflow in Playwright.
- [x] Run the full check and Web/iOS production bundles.
- [x] Commit and push the iteration to `origin/main`.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(navigation): add analyze and memory tabs`

## Iteration 11 - Entity Memory Contracts

Status: completed

- [x] Remove the three-card limit from analysis and confirmed-action contracts.
- [x] Add `update_meeting` with typed field changes.
- [x] Allow minimal create-contact actions with empty optional identity fields.
- [x] Add action-scoped Memory Proposals that remain inert before execution.
- [x] Define local ContactRecord, MeetingRecord, EntityMemory, and draft states.
- [x] Add update-meeting and four-action Fixture scenarios.
- [x] Update existing consumers to handle the fourth action type without breaking the runnable flow.
- [x] Add schema and route regression tests for drafts, meeting updates, and more than three cards.

Completion check:

```bash
npm run typecheck
npm test
```

Commit: `feat(contracts): add entity memory and meeting updates`

## Iteration 12 - Local Entity Repositories

Status: completed

- [x] Add a shared repository contract for contacts, meetings, and entity-owned Memory.
- [x] Persist empty contact and meeting drafts in versioned Web storage.
- [x] Add user-owned Memory create, edit, soft-delete, and owner validation.
- [x] Add non-destructive migration from Web `trace.memories.v1` data.
- [x] Add native SQLite tables, indexes, migration markers, and repository implementation.
- [x] Preserve legacy SQLite and localStorage records for rollback.
- [x] Add locale contact sorting and derived meeting state ordering.
- [x] Cover drafts, CRUD, migration, sorting, and time boundaries with tests.

Completion check:

```bash
npm run typecheck
npm test --workspace @trace/mobile
```

Commit: `feat(memory): add local entity repositories`

## Iteration 13 - Confirmed Action Entity Commits

Status: completed

- [x] Add an execution coordinator that commits local entity state only after tool success.
- [x] Resolve local contact and meeting IDs to native external IDs before updates.
- [x] Implement typed native meeting updates for title, time, timezone, location, link, and notes.
- [x] Keep meeting participant changes as local contact relationships.
- [x] Commit action-created entities and Memory Proposals idempotently by `runId:actionId`.
- [x] Preserve the external result when a local commit needs retrying.
- [x] Request full calendar access required to read and update existing events.
- [x] Cover success, failure, retry, meeting participants, and duplicate prevention with tests.

Completion check:

```bash
npm run typecheck
npm test
npm run build:web
```

Commit: `feat(execution): commit successful actions to entity memory`

## Iteration 14 - Entity-Grounded Vision Planning

Status: completed

- [x] Add existing meetings and entity-owned Memory to the analysis contract.
- [x] Add Demo and native iOS meeting sources with a bounded calendar window.
- [x] Merge local entity IDs with current system contact and calendar context.
- [x] Remove the three-action Prompt limit and request every distinct grounded action.
- [x] Add direct-interaction rules for minimal new-contact proposals.
- [x] Add update-meeting matching, participant, ambiguity, and Memory Proposal rules.
- [x] Preserve legacy request Memory while clients transition to entity-owned Memory.
- [x] Add Prompt and context-merge regression tests.

Completion check:

```bash
npm run typecheck
npm test
```

Commit: `feat(agent): ground analysis in meeting and entity memory`

## Iteration 15 - Meetings, Analyze, and Contacts

Status: completed

- [x] Preserve Iteration 14 as `iteration-14-entity-grounded-analysis` before shipping the new UI.
- [x] Replace the two-tab navigation with Meetings, primary Analyze, and Contacts tabs.
- [x] Add alphabetized contact list, local empty drafts, editable details, self-contact support, and deletion.
- [x] Add time-sorted meeting list with emphasized ongoing meetings and muted ended meetings.
- [x] Add meeting details, local empty drafts, participant add/remove controls, and contact-detail navigation.
- [x] Add editable, entity-owned Memory sections to every contact and meeting.
- [x] Synchronize Demo/iOS summaries into stable local entity IDs without overwriting TRACE-owned edits.
- [x] Refresh entity state only after confirmed tool execution or explicit user edits.
- [x] Update Playwright coverage for three-tab navigation, participant changes, contact jumps, and Memory CRUD.
- [x] Verify desktop and iPhone-width layouts in WSL browsers.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
```

Commit: `feat(memory): add meeting and contact workspaces`

## Iteration 16 - Cross-Provider Output Recovery

Status: completed

- [x] Preserve Iteration 15 as `iteration-15-meeting-contact-workspaces` before editing.
- [x] Accept JSON wrapped in Markdown fences or provider reasoning text.
- [x] Normalize valid ISO timestamps with timezone offsets into UTC `Z` timestamps.
- [x] Normalize null or omitted optional contact and meeting fields without inventing identity data.
- [x] Feed safe validation paths into the model's repair request.
- [x] Return the first safe validation path to the app when repair still fails.
- [x] Keep model output, screenshots, and provider keys out of validation logs.
- [x] Add parser, Prompt, and route regressions for provider compatibility.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
```

Commit: `fix(provider): recover common structured output variants`

## Iteration 17 - Dependent Contact and Meeting Flow

Status: completed

- [x] Preserve Iteration 16 as `iteration-16-provider-output-recovery` before editing.
- [x] Accept either a screenshot or a written conversation description as analysis input.
- [x] Keep additional context hidden until a screenshot is selected.
- [x] Center the empty New Thread composer and animate it upward once input begins.
- [x] Confirm and execute contact actions before dependent meeting actions.
- [x] Link uniquely matched contacts created in the first stage into meetings confirmed in the second stage.
- [x] Replace raw meeting timestamps with native/Web date-time controls in action cards and meeting details.
- [x] Reconcile preserved external participant IDs to local contacts so Maya no longer appears as unknown.
- [x] Replace one-at-a-time participant adding with a scrollable contact checklist that supports repeated toggling.
- [x] Add a description-only Contact + meeting Fixture and cover staged linking in Playwright.
- [x] Verify mobile layouts for capture, meeting actions, date fields, and participant editing in WSL Chromium.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(workflow): link contact and meeting confirmations`

## Iteration 18 - Screenshot Removal and Provider Recovery

Status: completed

- [x] Preserve Iteration 17 as `iteration-17-dependent-contact-meeting-flow` before editing.
- [x] Split screenshot controls into explicit replace and remove buttons.
- [x] Preserve entered context when an image is removed so it becomes the primary description.
- [x] Normalize null or empty unmatched participant `contactId` values by omitting the field.
- [x] Tell vision providers to omit unmatched participant IDs instead of returning null.
- [x] Clear a stale Analyzer offline state after any reachable analyze or insight API response.
- [x] Keep the offline state only for an actually unreachable API.
- [x] Add parser and browser regressions for the reported provider response and health-state recovery.
- [x] Verify the two screenshot controls at iPhone width in WSL Chromium.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `fix(capture): remove screenshots and recover participant matches`

## Iteration 19 - Self Contact and Meeting Participants

Status: completed

- [x] Preserve Iteration 18 as `iteration-18-screenshot-removal-provider-recovery` before editing.
- [x] Mark the user's own contact explicitly with `isSelf` in analysis context and action cards.
- [x] Allow the agent to propose a minimal editable self contact when a meeting includes the user.
- [x] Confirm contact actions before meeting actions and resolve `Me`, `我`, and grounded names only after successful writes.
- [x] Link both newly created and existing contacts into create-meeting and update-meeting actions.
- [x] Keep only one action-created contact marked as self while preserving older contact records.
- [x] Expose pending participant names for review and editing before confirmation.
- [x] Reconcile external contact IDs with local UUIDs so earlier meeting memory remains available to later contact insights.
- [x] Add a deterministic Me + HR Fixture and browser coverage for two contacts joining one meeting.
- [x] Verify the contact and meeting review stages at iPhone width in WSL Chromium.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(agent): model and link self participants`

## Iteration 20 - Sequential Agent Planning and Review Feedback

Status: completed

- [x] Preserve Iteration 19 as `iteration-19-self-participant-linking` before editing.
- [x] Split model planning into explicit `contacts` and `meetings` request scopes.
- [x] Always stop at contact review first, including the zero-card state, so the user can correct missed identities.
- [x] Mark the user's thread identity with `isSelf` and conservatively recover a missing self card from grounded self-introduction evidence.
- [x] Write confirmed contacts before requesting meeting actions with the refreshed local contact index.
- [x] Merge both passes under one workflow run without action or evidence ID collisions.
- [x] Add editable written feedback and scoped retry controls to both review stages.
- [x] Preserve confirmed contacts when meeting planning fails and retry only the meeting pass.
- [x] Verify that the meeting request contains the newly saved self contact and stage feedback.
- [x] Cover zero-contact continuation, two-pass participant linking, failed-pass recovery, and mobile overflow in Playwright.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(agent): sequence contact and meeting planning`

## Iteration 21 - Meeting Participant Review

Status: completed

- [x] Preserve Iteration 20 as `iteration-20-sequential-agent-planning` before editing.
- [x] Keep participants visible when a meeting pass returns contact IDs instead of duplicate names.
- [x] Resolve saved contact IDs to readable names in meeting action cards.
- [x] Let users add or remove existing contacts with a repeated-toggle checklist.
- [x] Keep only genuinely unmatched participant names in an editable text field.
- [x] Apply the same participant editor to create-meeting and update-meeting cards.
- [x] Cover ID-only and name-only meeting responses plus repeated participant toggles in Playwright.
- [x] Canonicalize external contact IDs before execution so saved meetings keep local links.
- [x] Verify mobile layout, Web build, and iOS export before publishing.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `fix(meetings): preserve and edit linked participants`

## Iteration 22 - Compact Composer and Provider Dropdown

Status: completed

- [x] Preserve Iteration 21 as `iteration-21-meeting-participant-review` before editing.
- [x] Center the empty New thread title and composer as one compact group.
- [x] Rename the description prompt to `Describe something` and center its empty state.
- [x] Keep the empty description area to roughly half the composer height.
- [x] Expand description input to the full composer after typing and restore the empty layout after clearing.
- [x] Remove the visible Fixture scenario selector and Fixture provider option.
- [x] Keep deterministic fixtures accessible only through an internal browser-test query.
- [x] Replace Provider tiles with a downward-opening single-select menu.
- [x] Discard legacy locally saved Fixture provider settings.
- [x] Verify empty, active, reset, and Provider dropdown states at iPhone width.
- [x] Run all tests, Web build, and iOS export before publishing.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `feat(capture): compact composer and provider selection`

## Iteration 23 - Smaller Composer and Empty Meeting Recovery

Status: completed

- [x] Preserve Iteration 22 as `iteration-22-compact-composer-provider-dropdown` before editing.
- [x] Reduce the empty `Describe something` area from roughly one half to roughly one third of the composer.
- [x] Give the screenshot chooser the reclaimed space without changing the outer composer height.
- [x] Keep the full-height typing state and clear-to-reset behavior unchanged.
- [x] Stop treating a valid but empty meeting-model response as automatic workflow completion.
- [x] Keep confirmed contacts while showing an explicit empty meeting review state.
- [x] Let the user revise only the meeting pass or explicitly finish with confirmed contacts.
- [x] Require grounded but incomplete meeting intent to produce an editable meeting card.
- [x] Cover empty meeting recovery and the explicit finish choice in Playwright.
- [x] Verify the smaller empty and reset states at iPhone width.
- [x] Run regression checks and publish the iteration.

Completion check:

```bash
npm run check
npm run test:e2e
npm run build:web
npx expo export --platform ios
```

Commit: `fix(workflow): recover empty meeting plans`

## Deferred Beyond MVP

- Authentication and multi-user sync.
- Cloud contact and memory storage.
- Embeddings or vector retrieval.
- Share extension, notifications, and background jobs.
- TestFlight/App Store release automation.
- Autonomous or unconfirmed side effects.
