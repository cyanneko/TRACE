# TRACE Development TODO

> Active build checklist for the 16-hour MVP iteration.

## Working Rules

- Keep the main user loop runnable after every iteration.
- Make one focused commit per iteration and push it to `origin/main` immediately.
- Do not execute contacts, calendar, or memory writes before explicit confirmation.
- Never commit or bundle provider keys; BYOK values may exist only at runtime.
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

## Deferred Beyond MVP

- Authentication and multi-user sync.
- Cloud contact and memory storage.
- Embeddings or vector retrieval.
- Share extension, notifications, and background jobs.
- TestFlight/App Store release automation.
- Autonomous or unconfirmed side effects.
