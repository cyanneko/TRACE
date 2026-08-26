# TRACE Development TODO

> Active build checklist for the 16-hour MVP iteration.

## Working Rules

- Keep the main user loop runnable after every iteration.
- Make one focused commit per iteration and push it to `origin/main` immediately.
- Do not execute contacts, calendar, or memory writes before explicit confirmation.
- Keep DeepSeek keys and all server secrets outside the mobile bundle.
- Use fixture mode for deterministic tests; never silently present fixture output as a real model result.
- Preserve unrelated local changes. In particular, the current local edit to `docs/IMPLEMENTATION_DRAFT.md` is outside these iterations.

## Definition of MVP

- A user can select a chat screenshot and add optional context.
- TRACE returns grounded conversation context and editable action cards.
- The three supported actions are create meeting, create contact, and update contact.
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

Commit: `docs: add active development TODO`

## Iteration 1 - Workspace and Contracts

Status: pending

- [ ] Install or activate a Linux Node.js LTS runtime inside WSL.
- [ ] Create an npm workspace for `apps/mobile`, `apps/api`, and `packages/contracts`.
- [ ] Scaffold the Expo app with Web support and the product name TRACE.
- [ ] Scaffold the TypeScript API with `/health`.
- [ ] Define Zod schemas for thread context, action cards, tool results, memory, and insights.
- [ ] Add root development, typecheck, and test scripts.

Completion check:

```bash
npm install
npm run typecheck
npm test
```

Commit: pending

## Iteration 2 - Agent Analysis API

Status: pending

- [ ] Add `ModelProvider` with DeepSeek and fixture implementations.
- [ ] Accept a screenshot, optional note, compact contact index, memory, and timezone.
- [ ] Implement `/v1/analyze` with JSON validation and one repair attempt.
- [ ] Return conversation context, evidence, uncertainties, contact matches, and action cards.
- [ ] Add meeting, new-contact, update-contact, and no-action fixtures.
- [ ] Ensure uploaded screenshots are not persisted or logged by the API.

Completion check:

```bash
npm run test --workspace @trace/api
npm run dev:api
curl http://localhost:8787/health
```

Commit: pending

## Iteration 3 - WSL Web Capture and Review

Status: pending

- [ ] Build the Capture screen with image selection, preview, and optional note.
- [ ] Add a Web fixture contact source.
- [ ] Connect the real and fixture analysis modes.
- [ ] Build conversation summary, evidence, and uncertainty states.
- [ ] Build editable/selectable action cards for all three action types.
- [ ] Add loading, retry, malformed-output, no-action, and empty-input states.
- [ ] Clearly display Demo mode when fixture data or Web execution is active.

Completion check:

```bash
npm run dev:web
npm run typecheck
```

Manual check: upload a fixture screenshot and reach review without browser console errors.

Commit: pending

## Iteration 4 - Execution, Memory, and Insights

Status: pending

- [ ] Add the confirmation state boundary and execution reducer states.
- [ ] Implement Web `DemoActionExecutor` with idempotent local action events.
- [ ] Implement Web memory persistence with local storage.
- [ ] Add deterministic memory writes from successful confirmed actions.
- [ ] Implement supersede and delete behavior.
- [ ] Implement `/v1/insights` and its fixture response.
- [ ] Show execution results, evidence-backed insights, suggested messages, and memory updates.
- [ ] Demonstrate a second run retrieving memory from the first run.

Completion check:

```bash
npm test
npm run typecheck
```

Manual check: rejected actions cause no writes; repeated confirmation causes no duplicates.

Commit: pending

## Iteration 5 - iOS Boundary and Handoff

Status: pending

- [ ] Add platform-specific `ContactSource`, `ActionExecutor`, and `MemoryRepository` modules.
- [ ] Add the native contacts implementation.
- [ ] Add the native SQLite implementation or a documented safe fallback.
- [ ] Prepare the native calendar implementation for an EAS development build.
- [ ] Add permission descriptions and capability checks.
- [ ] Add automated contract, memory-policy, reducer, and API smoke tests.
- [ ] Verify the Web flow at an iPhone-sized viewport.
- [ ] Write environment setup, DeepSeek configuration, fixture mode, WSL, Expo Go, and EAS notes.
- [ ] Record known limitations honestly.

Completion check:

```bash
npm run check
npm run build:web
```

Manual check: complete the demo twice from a clean browser profile using the README only.

Commit: pending

## Deferred Beyond MVP

- Authentication and multi-user sync.
- Cloud contact and memory storage.
- Embeddings or vector retrieval.
- Share extension, notifications, and background jobs.
- TestFlight/App Store release automation.
- Autonomous or unconfirmed side effects.
