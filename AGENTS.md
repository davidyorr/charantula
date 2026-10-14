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

Solid components do not re-run. Do not destructure props, and read signals by calling them (`count()`), or reactivity breaks.

Shared state lives in `src/renderer/shared/projectStore.ts`: `createResource` for async data fetched via `window.api`, `createMemo` for derived values, `createSignal` for local state. Feature stores (e.g. `editorStore`) use `createStore` from Solid. Components use `type Component` from `solid-js` rather than typed function props.

UI primitives are wrapped Kobalte components; reuse the existing wrappers.

## Architecture

```
src/shared/ipc.ts             IPC contract (IpcApi type, row types, DTOs) — source of truth for main/renderer boundary
src/main/main.ts              Electron main entry: registers handlers via registerIpcHandlers()
src/main/registerHandlers.ts  dynamic ipcMain.handle() dispatcher (namespace:method convention)
src/main/handlers/*.ts        one handler file per IpcApi namespace
src/main/db.ts                single SQLite connection per project; applies drizzle migrations at runtime
src/preload/preload.ts        exposes window.api matching IpcApi exactly
src/renderer/                 SolidJS UI
src/renderer/features/        feature modules (editor, timeline, welcome, settings)
src/renderer/shared/          shared components and stores
src/renderer/theme/           theming
src/db/schema.ts              Drizzle schema (source of truth for table shapes)
```

- The renderer never touches the database. All data access goes through `window.api`.
- Each Project is one SQLite file (`*.charantula`) stored in the project directory.

### Adding or changing an IPC method

1. Update the `IpcApi` type in `src/shared/ipc.ts` first (this drives types everywhere).
2. Implement the handler(s) in `src/main/handlers/<namespace>.ts`.
3. Register them in `src/main/main.ts` by passing the handler object to `registerIpcHandlers()`.
4. Expose it in `src/preload/preload.ts` (add the method to the `api` object).
5. Call it from the renderer via `window.api.<namespace>.<method>(...)`.

Row types in `src/shared/ipc.ts` are derived from the Drizzle schema with `InferSelectModel` / `InferInsertModel`. Do not hand-write row types. Only DTOs and the `IpcApi` surface are hand-written.

DTO conventions:

- `id`, `createdAt`, `updatedAt` are server-generated and never appear in a DTO.
- `sortOrder` is optional on create. When omitted, the handler appends at the end (max + 1).
- Update DTOs are `Partial` (patch semantics) and exclude `sortOrder` and parent keys. Reordering and moving have dedicated methods.
- Reordering is one batch call applied in a single transaction.

## Domain model

Hierarchy: Project > Collection > Chapter > Event.

- Viewing order is a three-level chain: `collection.sortOrder`, then `chapter.sortOrder`, then `event.sortOrder`. A `sortOrder` is only meaningful within its parent, so never compare them across parents.
- Characters and Tags are scoped to the whole Project, not to a Collection.
- **Spoiler safety is the core invariant of this app.**
  - Character `synopsis` and `imagePath` are ungated and curated by hand. They must only contain facts true from the character's first appearance. Anything spoilery belongs on an Event.
  - Aliases and character tags are gated per row by `introducedInChapterId` (`null` = always visible).
  - Reader-facing reads (e.g. `characters.getForReader`) filter by `progressChapterId`. `null` means the reader finished everything. Resolving linear position happens in the main process, never in the renderer.
  - When adding any new reader-visible field, decide how it is gated before writing code.
- `events.contentJson` is a JSON array of rich-text nodes. `contentPlain` is a plain-text mirror kept in sync by the app layer, so update both together.

## Database conventions

- Primary keys are text UUIDs via `$defaultFn(() => randomUUID())`. Join tables use composite primary keys.
- Entity tables have `createdAt` / `updatedAt` (unix timestamps, `updatedAt` uses `$onUpdate`).
- Every `sortOrder` column has a `>= 0` CHECK constraint.
- Foreign keys declare an explicit `onDelete` (`cascade`, or `set null` for the `introducedInChapterId` columns).
- `metadata` table is a special single-row table (integer PK = 1, CHECK enforces it).
- **Schema changes:** Edit `src/db/schema.ts`, then run `npm run db:generate -- --name <meaningful_name>` to generate a new migration. Never manually edit generated migrations or modify existing migrations; use a new migration for every schema change.
- **Runtime:** `src/main/db.ts` automatically applies pending migrations from `./drizzle/` in development and the bundled `drizzle/` directory in production.
- SQLite WAL mode is enabled; foreign keys are enforced (`PRAGMA foreign_keys = ON`).

## Code style

Enforced by tooling:

- Use braces for all `if`/`else` statements and loops.
- Use `@/` imports, never parent-relative imports.
- Use `Array<T>`, not `T[]`; use `type`, not `interface` (except in `.d.ts` files).
- No enums, namespaces, or constructor parameter properties (`erasableSyntaxOnly`).
- Respect `exactOptionalPropertyTypes`; omit absent optional keys or explicitly allow `undefined`.
- Remove unused locals/parameters; prefix intentionally unused parameters with `_`.
- Follow `prettier.config.ts` for tabs, import ordering, and formatting. Run `npm run format:fix`.

Follow surrounding code conventions, including section-divider comments and explanatory comments for non-obvious decisions.

CSS Modules use `.module.css`; nest pseudo-classes and attribute selectors. Global styles belong in `.global.css` files.

**Event handlers:** Name handlers `handle` + action + triggering event in PascalCase (e.g. `handleContinueClick`, `handleInputChange`, `handleFormSubmit`). Include the triggering event to distinguish handlers for the same action.

## Testing

- End-to-end tests live in `e2e/`. Run all tests: `npm test`. Run a single test: `npx playwright test -g "<test name>"`.
- Tests launch the built app via `@playwright/test`'s `_electron` module (pointing at `dist/main/main.js`).
- Native dialogs are mocked via `electronApp.evaluate()` to inject fake file-picker responses.

## Boundaries

- Ask before adding a dependency. Versions in `package.json` are pinned exactly (no `^`), so keep it that way.
- Do not edit generated files (`dist/`, `drizzle/*.sql`, `playwright-report/`) or applied migrations.
- Do not bypass the IPC layer by importing `better-sqlite3` or Drizzle into renderer code.
