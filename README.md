# TRACE

**Thread Reasoning, Action, Context & Execution**

TRACE is an iOS-first agent that turns a chat screenshot into grounded, user-confirmed actions and useful relationship insights. The current MVP runs end to end in WSL through Expo Web, with native iOS adapters ready for a development build.

## Why This Is An Agent

TRACE is not a thin chat-completions screen. It has an explicit loop with separate trust boundaries:

```text
Contact pass     screenshot + note + compact contact/memory context
Confirmation     user edits, selects, comments on, or rejects contact actions
Meeting pass     confirmed contacts become model context for meeting actions
Confirmation     user edits, selects, comments on, or rejects meeting actions
Execution        idempotent calendar/contact tools
Memory policy    successful facts only, with supersede/delete/audit states
Insight          evidence- and memory-backed help after execution
```

The model can propose actions, but it cannot execute them. Only validated cards that remain selected at confirmation cross the write boundary.

## MVP Features

- Screenshot selection and optional context on Web and iOS.
- Editable action cards for meeting creation/update and contact creation/update.
- Meeting cards resolve local or external contact IDs to names and use an existing-contact checklist for participants.
- Per-stage written feedback and scoped retries without repeating confirmed writes.
- DeepSeek, GLM, Doubao, and custom OpenAI-compatible vision providers.
- A compact Provider dropdown with device-local BYOK settings.
- Idempotent Web demo actions and native iOS Contacts/Calendar implementations.
- Inspectable structured memory with active, superseded, and deleted states.
- Post-confirmation insights, next steps, and suggested messages with grounding references.
- A two-run flow where memory from one thread informs the next.

## Repository

```text
apps/api                  Stateless localhost inference adapter for WSL Web
apps/mobile               Expo React Native application
packages/contracts        Shared Zod request, action, memory, and insight schemas
tests/e2e                 Playwright browser acceptance tests
TODO.md                   Iteration history and delivery checklist
```

## Quick Start In WSL

Requirements:

- Node.js 22.x
- npm 10.x
- WSL 2 or Linux

Install and verify:

```bash
nvm use
npm install
npm run check
```

Start the fixture API in one terminal:

```bash
npm run dev:api
```

Start Expo Web in another terminal:

```bash
npm run dev:web
```

Open `http://localhost:8081`, open Settings, and configure DeepSeek, GLM, Doubao, Custom, or a live local default. The normal app does not expose the deterministic Fixture provider; it remains an internal browser-test adapter only.

## Vision Providers

TRACE uses an open-source BYOK model. Open the settings icon in the app, expand the Provider dropdown, choose DeepSeek, GLM, Doubao, or Custom, then enter the provider key and compatibility options. The selection belongs only to the running app:

- Web saves the key in that browser profile's localStorage; iOS saves it in the device Keychain.
- TRACE never writes BYOK settings to its API process, SQLite memory, source files, or a cloud account.
- Selecting `Local default` and saving removes the stored provider key.
- Each analysis request carries its own provider configuration, so one user cannot change another user's model.
- The key and screenshot are sent to the selected model vendor during analysis. Review that vendor's data policy before using real conversations.
- Contact and meeting planning are separate model passes. Revising either stage makes another request only for that stage.

WSL Web sends the request through the stateless localhost adapter on port `8787` because arbitrary vendor endpoints may not accept browser-origin requests. This is a local development compatibility process, not a hosted account or configuration service. Do not save a real key in a shared browser profile.

The local adapter can also have an optional environment fallback for headless tests:

```bash
cp .env.example apps/api/.env
```

Then set one default provider:

| `VISION_PROVIDER` | Default base URL | Default model | Image payload |
| --- | --- | --- | --- |
| `deepseek` | `https://api.deepseek.com` | `deepseek-v4-flash-vision-exp` | data URL |
| `glm` | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.6v-flash` | raw base64 |
| `doubao` | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-2-0-lite-260215` | data URL |
| `custom` | required | required | configurable |

Example:

```dotenv
VISION_PROVIDER=deepseek
VISION_API_KEY=your_server_side_key
```

Every preset can be overridden without code changes:

```dotenv
VISION_BASE_URL=https://provider.example.com/v1
VISION_MODEL=provider-model-id
VISION_IMAGE_FORMAT=data-url
VISION_IMAGE_DETAIL=high
VISION_JSON_MODE=false
VISION_CUSTOM_ID=my-provider
```

Compatibility controls:

- `VISION_IMAGE_FORMAT`: `data-url` or `base64`.
- `VISION_IMAGE_DETAIL`: `auto`, `high`, `low`, or `none`.
- `VISION_JSON_MODE`: enable only when the endpoint supports OpenAI JSON response format.
- The adapter validates every response against shared contracts and makes one schema-repair attempt.
- In a public production relay, built-in vendor hosts are allowed by default; add vetted custom hosts with `VISION_USER_HOST_ALLOWLIST`.

Model names and vendor behavior can change. Override the preset when testing a newer GLM, Doubao, DeepSeek, or another OpenAI-compatible vision endpoint.

## Local Adapter

The service listens on `0.0.0.0:8787` by default.

```text
GET  /health
POST /v1/analyze
POST /v1/insights
```

`/v1/analyze` receives a screenshot data URL, optional note, compact contact index, active memory, timezone, current time, and an optional per-request BYOK provider configuration. It never returns the key. It returns thread context, evidence, uncertainty, and up to three proposed actions.

`/v1/insights` is called only after confirmation and execution. It receives confirmed actions, tool results, current evidence, and active memory. Failed actions do not become memory or factual insights.

For a standalone local process:

```bash
npm run build --workspace @trace/contracts
npm run build --workspace @trace/api
npm run start --workspace @trace/api
```

## Memory Policy

TRACE stores structured facts rather than replaying an unlimited chat transcript.

- Only successful confirmed tool results can create memory.
- Every memory records its source run, action, evidence references, confidence, and timestamps.
- A new fact with the same contact/type/key supersedes the previous active fact.
- A semantically identical fact is not duplicated across runs.
- Delete creates a tombstone; it does not erase the audit trail.
- Only active memory is sent back as context on later runs.
- Screenshots are not logged or persisted by the API.

Web uses localStorage for the demo. Native iOS uses `trace.db` through `expo-sqlite` for both memory and action idempotency records.

## iOS Development Build

WSL cannot run Xcode or the iOS Simulator. It can still build an iOS development client in the EAS cloud and serve its JavaScript bundle.

1. Configure a reachable API URL for the phone:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Set `EXPO_PUBLIC_API_URL` to an HTTPS deployment or to a LAN address that the iPhone can reach. `127.0.0.1` on an iPhone means the phone itself.

2. Configure the EAS project from `apps/mobile`:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

3. Build the development client:

```bash
npx eas-cli@latest build --platform ios --profile development
```

4. Install the resulting build on the registered iPhone, then start Metro:

```bash
npm run dev:client -- --tunnel
```

The native build requests:

- Photo access only when selecting a screenshot.
- Contacts access to match participants and apply confirmed contact writes.
- Write-only Calendar access to add confirmed events without reading calendar history.

`expo-calendar` in the installed SDK is not supported by Expo Go, so calendar execution must be tested in the development client. See [iOS handoff notes](docs/IOS_HANDOFF.md) for the platform mapping and test checklist.

## Tests

Unit and contract suite:

```bash
npm run check
```

Browser acceptance suite:

```bash
npx playwright install chromium
npm run test:e2e
```

Production Web bundle:

```bash
npm run build:web
```

Current automated coverage includes provider configuration, model-output repair, API routes, action contracts, execution idempotency, memory derivation/supersede/delete, reducer failure states, the two-run memory flow, ID-only and name-only participant linking, repeated participant toggles, and 390px review states.

## Privacy And Security

- Provider keys exist only in the API environment.
- Contact context is compacted before inference and capped by the contract.
- The API does not store screenshots, contacts, or memory.
- Side effects require a visible confirmation step.
- Memory can be inspected and deleted in the result UI.

The MVP API has no authentication and permissive development CORS. Do not expose it publicly without adding authentication, rate limiting, origin restrictions, encrypted transport, retention controls, and abuse protection.

## Known Limitations

- Native Contacts, Calendar, and SQLite adapters are typechecked and bundled, but still require physical-iPhone acceptance testing.
- No real vendor call is claimed unless a valid provider key is configured; fixture mode is the reproducible default.
- The Web executor writes local demo events, not operating-system contacts or calendars.
- Internal automated fixtures use Demo writes; native side effects require a configured remote provider.
- Calendar creation does not send invitations to participants.
- The ISO date/time editor is functional but not a production date-picker experience.
- Contact display-name replacement is conservative and may need locale-aware name handling.
- Native exactly-once execution has a small crash window between an OS write and recording its local idempotency event.
- Insights currently use a deterministic grounded policy engine after model perception; richer model-backed ranking is deferred.
- The current flow accepts one screenshot and one device-local user profile.

Planning artifacts remain in [TODO.md](TODO.md), [the 16-hour build draft](docs/16H_MVP_BUILD_DRAFT.md), and [the implementation draft](docs/IMPLEMENTATION_DRAFT.md).
