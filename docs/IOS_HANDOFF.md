# TRACE iOS Handoff

## Platform Mapping

| Boundary | Expo Web | iOS development build |
| --- | --- | --- |
| `ContactSource` | deterministic demo contacts | `expo-contacts` summaries, capped at 200 |
| `ActionExecutor` | idempotent local demo events | Contacts patch/create and Calendar create |
| `MemoryRepository` | localStorage | `expo-sqlite` in `trace.db` |
| Screenshot picker | `expo-image-picker` Web input | iOS photo picker |

Metro resolves `src/platform/services.ts` on Web and `src/platform/services.native.ts` on iOS. Shared action, execution, memory, and insight contracts do not change by platform.

Fixture analysis is deliberately pinned to demo contacts, memory, and execution on every platform. This prevents deterministic IDs and sample data from reaching a real address book, calendar, or SQLite memory. Configure a non-fixture vision provider before native-write acceptance testing.

## WSL Reality

WSL is a good environment for the shared TypeScript code, API, Expo Web, fixture flows, unit tests, and EAS CLI. It cannot run Xcode or Apple's iOS Simulator.

Use this sequence:

1. Finish the full flow at `http://localhost:8081` in fixture mode.
2. Run `npm run check`, `npm run test:e2e`, and `npm run build:web`.
3. Create the iOS development build in EAS from `apps/mobile`.
4. Install it on a registered physical iPhone.
5. Point `EXPO_PUBLIC_API_URL` at an API address reachable from that phone.
6. Start Metro with `npx expo start --dev-client --tunnel` when LAN discovery is unreliable.

## Native Acceptance Checklist

- Deny Photos permission and confirm TRACE reports selection failure without crashing.
- Select PNG, JPEG, GIF, and WebP screenshots within the request-size limit.
- Deny Contacts permission and confirm screenshot analysis still runs with an empty contact index.
- Grant Contacts permission and verify participant IDs match the intended native contact.
- Confirm create-contact and inspect the resulting fields in Apple's Contacts app.
- Confirm update-contact and verify unspecified native fields remain unchanged.
- Deny Calendar permission and verify the tool result fails without creating memory.
- Grant write-only Calendar permission and confirm exactly one event is created.
- Press confirmation twice for the same run through a debug path and verify one native event record.
- Force-close and relaunch; verify active memory remains in SQLite.
- Delete memory and verify it disappears from active context while remaining as a deleted audit row.
- Run a second thread for the same contact and verify the previous open loop appears in insights.

## Permissions

The app config uses plugin-generated iOS usage descriptions:

- `NSPhotoLibraryUsageDescription`
- `NSContactsUsageDescription`
- `NSCalendarsWriteOnlyAccessUsageDescription`

Calendar access is write-only on iOS 17 and later. TRACE does not request Reminders access or full Calendar history access.

## EAS Notes

`apps/mobile/eas.json` contains development, preview, and production profiles. `eas build:configure` will associate the local app with an Expo project and may add the EAS project ID to app config.

Physical-device signing generally requires an Apple Developer account and device registration. Rebuild the development client whenever a native dependency or app config plugin changes. JavaScript-only changes can reuse the installed client.

## Release Blockers

Before TestFlight or App Store submission:

- Complete the physical-device checklist above.
- Add authentication, rate limits, restricted CORS, and production HTTPS to the API.
- Add user-facing privacy policy, retention language, and account/data deletion behavior.
- Replace raw ISO meeting inputs with native date/time controls.
- Add crash reporting without screenshot/contact payload capture.
- Review provider data processing terms for screenshots and contact context.
- Add locale-aware contact-name updates and calendar selection behavior.
