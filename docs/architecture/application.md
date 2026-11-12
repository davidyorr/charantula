# Application Architecture

Charantula is an Electron desktop application with a SolidJS renderer. The application uses a multi-process architecture: the Electron main process owns application-level operations and database access, while the renderer handles the user interface and application state.

## Process Architecture

The application is divided into three layers:

| Layer        | Responsibilities                                                                |
| ------------ | ------------------------------------------------------------------------------- |
| Main process | Application lifecycle, IPC handlers, filesystem access, and database operations |
| Preload      | Exposes a controlled, typed API to the renderer                                 |
| Renderer     | User interface, user interactions, and application state                        |

The renderer must not access Electron or Node.js APIs directly. Communication with the main process happens exclusively through the preload API.

### Main Process

The main process is responsible for operations that require access to Electron, Node.js, or persistent storage.

Responsibilities include:

- Managing the Electron application lifecycle.
- Opening and managing project databases.
- Performing database queries and mutations.
- Storing global application settings.
- Accessing the filesystem.
- Registering and executing IPC handlers.

Global settings are app-level preferences rather than story data, so they live in `settings.json` under Electron's `userData` path instead of in a project database, which also makes them readable with no project open. `src/main/settings.ts` owns that file: it holds the defaults and validates every value on both read and write, since the file is hand-editable. `src/main/recentProjects.ts` follows the same pattern for recent projects.

A third file in that directory, `application-state.json`, records how the app was last used rather than what the user prefers: window geometry, and per project the edit view's panel state (which entity was open and which nodes were expanded, keyed by absolute project directory). It is machine-written and merged on write, so saving one project cannot drop another's. It is not story data either, so it stays out of the portable project folder -- which also means it is keyed by path, and moving a project folder starts that project's panel state fresh.

A `null` setting means "follow the system" and is resolved only by the renderer. If the main process resolved it, the operating system's choice at that moment would be frozen into the file.

Database access is restricted to the main process. The renderer must never import or use Drizzle ORM or better-sqlite3.

### Preload

The preload script exposes the application's API to the renderer through `window.api`.

The API is defined by the `IpcApi` type in `src/shared/ipc.ts`. The preload implementation must match this contract.

The preload layer acts as the boundary between the renderer and main process. It exposes application operations without giving the renderer direct access to Electron or Node.js APIs.

### Renderer

The renderer is responsible for presenting application data and handling user interactions.

Responsibilities include:

- Rendering the user interface.
- Managing local and shared application state.
- Loading data through `window.api`.
- Handling user interactions and coordinating application operations.
- Presenting data returned by the main process.

The renderer does not own persistence logic. Database operations are requested through IPC.

## IPC Architecture

Inter-process communication is the only mechanism through which the renderer accesses main-process functionality.

The communication flow is:

```text
Renderer
|
| window.api.namespace.method()
v
Preload
|
| ipcRenderer.invoke()
v
Main Process
|
| ipcMain.handle()
v
IPC Handler
|
| Drizzle ORM
v
SQLite Database
```

### IPC Contract

`src/shared/ipc.ts` is the source of truth for the IPC API.

It contains:

- `IpcApi`: The typed contract exposed to the renderer.
- Database row types derived from the Drizzle schema.
- DTOs used for creating and updating records.

Row types should be derived from the Drizzle schema rather than maintained independently.

### Handler Organization

IPC methods are organized by namespace, with one handler file per namespace in `src/main/handlers/`.

The main process registers handler objects through `registerIpcHandlers()` in `src/main/registerHandlers.ts`. Only callable contract members are registered; a namespace may also carry plain values that preload supplies itself, such as `settings.initial` and `platform.pathSeparator`.

The preload script exposes corresponding methods through `window.api`.

All IPC is asynchronous `invoke` / `handle` apart from one boot channel: `settings:boot` answers a single synchronous read from preload so the renderer can apply the stored theme on its first frame. `registerSettingsBoot()` registers it, and must run before the window is created.

This keeps the IPC contract, handler implementations, and renderer-facing API organized around the same namespaces.

See [AGENTS.md](../AGENTS.md) for the procedure for adding or changing an IPC method.

## Renderer Architecture

The renderer is organized primarily by feature, with shared functionality separated from feature-specific implementations.

### Directory Organization

| Directory                | Responsibility                                           |
| ------------------------ | -------------------------------------------------------- |
| `src/renderer/features/` | Feature-specific UI, logic, and state                    |
| `src/renderer/shared/`   | Shared components, utilities, and application-wide state |
| `src/renderer/theme/`    | Application theming and styling                          |
| `src/shared/`            | Types and contracts shared across processes              |
| `src/db/`                | Database schema definitions                              |

Feature modules should own functionality specific to their domain. Functionality that is genuinely shared across features belongs in `src/renderer/shared/`.

### State Management

Shared application state lives in `src/renderer/shared/projectStore.ts`.

Global settings are the exception: the main process owns the value (see Main Process), and `src/renderer/theme/ThemeProvider.tsx` holds the reactive theme derived from it, seeded from `window.api.settings.initial` and written back on change.

Feature-specific state can live in feature stores. For example, the editor uses `editorStore`.

SolidJS primitives are used according to their intended responsibilities:

- `createResource`: Asynchronous data loading, including data fetched through `window.api`.
- `createMemo`: Derived and computed state.
- `createSignal`: Local reactive state.
- `createStore`: Structured state, particularly within feature-specific stores.

Prefer keeping state close to the feature that owns it. Promote state to a shared store when it genuinely needs to be accessed across features.

### SolidJS Reactivity

SolidJS components execute once to establish their reactive computations. They do not re-render in the same way React components do.

Consequently:

- Do not destructure component props.
- Read signals by calling them.
- Preserve reactive access to props and store values.
- Use SolidJS primitives rather than introducing unnecessary manual synchronization.

See [AGENTS.md](../AGENTS.md) for code-style conventions.

## Project and Database Lifecycle

Each Charantula Project is backed by its own SQLite database file, and the main process owns the connection to the currently opened one. The renderer never manages connections or databases; it interacts with the opened project through the shared project store and the IPC API.

See [Database Architecture](database.md) for the file layout, SQLite configuration, and migration lifecycle.

## Key Architectural Constraints

The following constraints are fundamental to the application architecture:

1. **Database access belongs exclusively to the main process.** The renderer must use IPC for all persistent data access.
2. **The IPC contract is shared.** The `IpcApi` type defines the API exposed through the preload script.
3. **The preload is the renderer's only bridge to the main process.** Do not expose unrestricted Electron or Node.js APIs.
4. **Features should remain modular.** Feature-specific functionality belongs in its feature module; genuinely shared functionality belongs in shared directories.
5. **State should have clear ownership.** Avoid duplicating shared application state inside individual features.
6. **Preserve SolidJS reactivity.** Do not apply React patterns that break SolidJS's reactive model.
