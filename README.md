# TRACE

**Thread Reasoning, Action, Context & Execution**

TRACE is an iOS agent that turns chat screenshots into grounded, user-confirmed actions and useful relationship insights.

Users upload a chat screenshot and may add a short note. TRACE understands the conversation, connects it with existing contact context, proposes editable action cards, and executes only the actions the user confirms.

## MVP

- Understand a chat screenshot and optional user context.
- Propose action cards for creating meetings, creating contacts, and updating contacts.
- Keep the user in control through review, editing, confirmation, and rejection.
- Maintain structured, traceable memory rather than replaying an unbounded chat history.
- Generate evidence-backed insights, follow-ups, and suggested next steps after confirmation.
- Support `deepseek-v4-flash-vision-exp` as the primary test model, with a provider boundary for fallbacks.

## Product Loop

```text
Screenshot + note
       |
       v
Conversation understanding
       |
       v
Contact grounding + action planning
       |
       v
Editable action cards
       |
       v
User confirmation
       |
       v
Execution + memory curation + insights
```

## Status

The implementation is being scoped as a 48-hour Expo/React Native MVP with a TypeScript API and Postgres-backed structured memory.

See [the implementation draft](docs/IMPLEMENTATION_DRAFT.md) for architecture, schemas, agent boundaries, memory policy, test strategy, and delivery plan.

## Development Direction

- iOS client: Expo React Native + TypeScript
- Agent/API: Node.js + TypeScript + Zod
- Model providers: DeepSeek Vision first, OpenAI-compatible fallback
- Data: Postgres/Supabase Storage
- iOS builds from WSL: EAS Build, with real-device testing through Expo

## Privacy Principle

TRACE treats screenshots and contact context as sensitive data. Actions require explicit confirmation, memory remains inspectable and correctable, and server-side credentials never ship in the mobile bundle.
