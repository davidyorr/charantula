# AGENTS.md

Charantula is a desktop app (Electron + SolidJS) for organizing stories without spoilers. A reader records characters, tags, and events as they progress, and anything tied to a later chapter stays hidden until they reach it.

## Commands

- `npm run dev`: Vite dev server (Electron main + renderer)
- `npm run dev:project`: same, with `VITE_AUTO_LOAD_PROJECT=true` to skip the project picker
- `npm run build`: `vite build`
- `npm run typecheck`: `tsc --build --noEmit` (type-checks both main and renderer)
- `npm run lint`: ESLint
- `npm run format:fix`: Prettier (write). `format:check` to verify only
- `npm run db:generate`: `drizzle-kit generate` — generates a new SQL migration file in `./drizzle/` from schema changes
- `npm test`: builds first, then runs Playwright

Before considering a task done, run `npm run format:fix`, `npm run lint`, `npm run typecheck`, and `npm run build`. Run relevant tests for behavior changes; run `npm test` for the full end-to-end suite when feasible. Review the final diff for unintended changes.

## Stack

Electron, SolidJS, Vite, TypeScript, Drizzle ORM on better-sqlite3, Kobalte for UI primitives, lucide-solid for icons, Playwright for tests.

For SolidJS conventions (reactivity, state management, component types), see [Application Architecture](docs/architecture/application.md).

UI primitives are wrapped Kobalte components; reuse the existing wrappers.

## Architecture

Charantula uses an Electron main/preload/renderer architecture. The main process owns database access and application-level operations; the renderer handles the UI and application state. Communication between processes happens exclusively through the typed preload API (`window.api`).

See [Application Architecture](docs/architecture/application.md) for details on process boundaries, IPC, renderer organization, state management, and project lifecycle.

### Adding or changing an IPC method

1. Add the method to `IpcApi` in `src/shared/ipc.ts`, plus a `Create*` / `Update*` DTO if it accepts a record. Row types there are derived from the Drizzle schema; never hand-write them.
2. Add the matching `ipcRenderer.invoke("<namespace>:<method>", ...)` line in `src/preload/preload.ts`.
3. Implement it in that namespace's file in `src/main/handlers/`.
4. Registration is automatic: `registerIpcHandlers()` in `src/main/registerHandlers.ts` derives the channel name from the object keys. A namespace may also carry plain values that preload supplies itself (`settings.initial`, `platform.pathSeparator`); those are not callable and must not be registered.

## Global settings

App-wide preferences live in `userData/settings.json`, owned by `src/main/settings.ts`, deliberately not in the project database. See [Application Architecture](docs/architecture/application.md) for the reasoning and for how the value reaches the renderer.

- A `null` setting means "follow the system", and only the renderer resolves it.
- `settings:boot` is the only synchronous IPC channel. Everything else stays async `invoke`.
- To add a setting: extend `Settings` / `UpdateSettingsInput` in `src/shared/ipc.ts`, give it a default and validation in `src/main/settings.ts`, then add its control to a page in `src/renderer/features/settings/`.

## Domain model

Hierarchy: Project > Collection > Chapter > Event, with Characters and Tags scoped to the whole Project. The full model — ordering, reader progression, and how each field is gated — is in [Database Architecture](docs/architecture/database.md). Read it before touching reader-visible data.

- **Spoiler safety is the core invariant of this app.** Decide how any new reader-visible field is gated before writing code.
- Resolving linear chapter position happens in the main process, never in the renderer.
- `events.contentJson` is a JSON array of rich-text nodes and `contentPlain` is its plain-text mirror, so update both together.

## Database conventions

`src/db/schema.ts` is the source of truth for table definitions. Primary-key, timestamp, foreign-key, and constraint conventions are described in [Database Architecture](docs/architecture/database.md).

- **Schema changes:** edit `src/db/schema.ts`, then run `npm run db:generate -- --name <meaningful_name>` to generate a new migration. One migration per change.

## Code style

- Use `@/` imports for everything. The only exception are CSS modules in the same directory (e.g. `import styles from "./EditPage.module.css";`).
- Remove unused locals/parameters; prefix intentionally unused parameters with `_`.

Follow surrounding code conventions, including section-divider comments. Add explanatory comments only when they clarify non-obvious decisions, constraints, or intent that cannot be readily understood from the code itself. Don't add comments that merely restate what the code does.

CSS Modules use `.module.css`; nest pseudo-classes and attribute selectors. Global styles belong in `.global.css` files.

**Event handlers:** Name handlers `handle` + action + triggering event in PascalCase (e.g. `handleContinueClick`, `handleInputChange`, `handleFormSubmit`). Include the triggering event to distinguish handlers for the same action. Never call one event handler from another — extract shared logic into a separate function that each handler calls directly.

## Testing

- End-to-end tests live in `e2e/`. Run all tests: `npm test`. Run a single test: `npx playwright test -g "<test name>"`.
- Tests launch the built app via `@playwright/test`'s `_electron` module (pointing at `dist/main/main.js`).
- Native dialogs are mocked via `electronApp.evaluate()` to inject fake file-picker responses.

## Boundaries

- Ask before adding a dependency. Versions in `package.json` are pinned exactly (no `^`), so keep it that way.
- Do not edit generated files (`dist/`, `drizzle/*.sql`, `playwright-report/`) or applied migrations.
- Do not bypass the IPC layer by importing `better-sqlite3` or Drizzle into renderer code.
