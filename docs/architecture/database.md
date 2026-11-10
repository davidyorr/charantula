# Database Architecture

Charantula uses SQLite for persistent storage and Drizzle ORM for schema definition and database access. Each Project is stored in its own SQLite database file (`.charantula`).

The database is accessed exclusively from the Electron main process; see [Application Architecture](application.md) for the process boundary and the IPC API the renderer uses instead.

## Database Organization

### Project Databases

Each Project has its own SQLite database file, stored in the project directory.

- Database files use the `.charantula` extension.
- Each database contains all data belonging to that Project.
- A single SQLite connection is maintained per opened Project.
- Projects are independent and do not share database tables or connections.

The database connection is initialized in `src/main/db.ts` when a Project is opened.

### SQLite Configuration

The following SQLite settings are enabled:

- **WAL mode:** Enables write-ahead logging.
- **Foreign keys:** Enforced through `PRAGMA foreign_keys = ON`.

## Domain Model

The core story hierarchy is:

```text
Project
  |
  +-- Collection
  |     |
  |     +-- Chapter
  |           |
  |           +-- Event
  |           +-- Event
  |
  +-- Collection
  |     |
  |     +-- Chapter
  |           |
  |           +-- Event
  |
  +-- Character
  +-- Tag
```

Characters and Tags are scoped to the whole Project, not to a Collection.

Each entity is documented in its own file: TBD.

Events store rich-text content in `contentJson` (a JSON array of nodes) with a plain-text mirror in `contentPlain`. Both are kept in sync by the application layer.

## Ordering

The story's viewing order is determined by a three-level ordering hierarchy:

1. `collection.sortOrder`
2. `chapter.sortOrder`
3. `event.sortOrder`

Each `sortOrder` is meaningful only within its immediate parent.

To determine the overall story order, compare the parent ordering first, then the child ordering.

Never compare `sortOrder` values across different parents. For example, a Chapter's `sortOrder` cannot be compared directly with another Chapter's value unless both belong to the same Collection.

When creating a record without an explicit `sortOrder`, the handler appends it to the end of its parent's ordering by assigning `max(sortOrder) + 1`.

Reordering is performed through dedicated batch operations, which are transactional (see Transactions and Data Integrity).

## Spoiler Safety

**Spoiler safety is the core data invariant of Charantula.**

The database model must support revealing information progressively as the reader advances through a story.

Reader-facing queries must never expose information associated with chapters beyond the reader's current progress.

### Chapter Progression

Reader progress is represented by `progressChapterId`.

- A chapter ID identifies the reader's current progression point.
- `null` means the reader has completed the entire story.
- The main process is responsible for resolving the chapter's position in the overall story order.

Because Chapters belong to Collections, chapter progression must be evaluated using the full Collection → Chapter ordering hierarchy. Chapter `sortOrder` values alone are insufficient.

### Gated and Ungated Data

Not all information is subject to the same spoiler restrictions. Ungated fields (e.g. `synopsis`, `imagePath`) are editorially curated and always visible — they must contain only facts true from the entity's first appearance, so anything spoilery belongs on an Event instead. Gated fields use `introducedInChapterId` to control visibility per-row; character aliases and character tags are gated this way.

### `introducedInChapterId`

This field determines when an individual record or association becomes visible to the reader.

- A non-null value identifies the Chapter where the information is introduced.
- A null value means the information is always visible.

This allows information to be recorded ahead of the reader's progress without exposing future spoilers.

### Reader-Facing Queries

Reader-facing database operations must filter results according to `progressChapterId`.

For example, `characters.getForReader` must only return Characters and associated information that are visible at the reader's current progression point.

The main process resolves linear story position. The renderer must not independently calculate chapter progression or determine which records are visible.

Whenever a new reader-visible field or relationship is introduced, its spoiler behavior must be explicitly defined before implementation.

## Schema Conventions

The Drizzle schema in `src/db/schema.ts` is the source of truth for database table definitions.

### Primary Keys

- Primary keys are text UUIDs.
- UUIDs are generated using `$defaultFn(() => randomUUID())`.
- Join tables use composite primary keys, which also prevents duplicate associations.

### Timestamps

Entity tables include:

- `createdAt`: Record creation timestamp.
- `updatedAt`: Record modification timestamp.

Both use Unix timestamps.

`updatedAt` is set automatically by Drizzle's `$onUpdate` hook on `.update().set()` calls. It is an ORM-level convention, not a database-level trigger.

### Foreign Keys

All foreign keys must explicitly declare their deletion behavior.

Supported behaviors include:

- `cascade`: Deleting a parent also deletes dependent records.
- `set null`: Deleting a referenced Chapter removes the chapter association without deleting the associated record.

In particular, `introducedInChapterId` uses `set null` so deleting an introduction Chapter does not delete the associated alias or relationship. The resulting null value means the information becomes always visible, so this behavior should be considered carefully when deleting Chapters.

### Constraints

- Every `sortOrder` column has a CHECK constraint enforcing `sortOrder >= 0`.
- Foreign key enforcement is enabled in SQLite.

### Metadata

The `metadata` table is a special single-row table (integer PK = 1, CHECK enforced) that stores settings for this project only. Application-level settings, such as the theme, are deliberately not stored here; they belong to `userData/settings.json` (see [Application Architecture](application.md)).

## Migrations

Database schema changes are managed through Drizzle Kit migrations, generated from the schema described above.

### Generating Migrations

Every schema change gets its own new migration, and generated migrations are immutable once applied — never edit them. The generation command is documented in [AGENTS.md](../AGENTS.md).

Generated SQL migration files are stored in `./drizzle/` and committed alongside the schema change.

### Applying Migrations

Migrations are applied automatically when a Project database is opened.

`src/main/db.ts` uses Drizzle's migration functionality to apply pending migrations.

The application uses:

- The `./drizzle/` directory during development.
- The bundled `drizzle/` directory in production.

## Transactions and Data Integrity

- Batch reordering is applied in a single transaction.
- Related database mutations that must succeed or fail together should be transactional.
- Foreign key constraints enforce referential integrity.
- Application-level invariants are enforced by the appropriate database handler when they cannot be expressed through SQLite constraints.
