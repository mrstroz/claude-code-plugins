# withDB: checking the database next to the UI

"The row appears in the list" is not the same claim as "the row was saved", and a UI that reads from a cache, a soft-deleted row that still renders, or a tenant id that went in wrong are all invisible from the screen. `withDB` adds a second source of evidence to a scenario: read-only queries whose results are asserted the same way UI reads are, recorded with `source: "db"`, and reported separately.

It is an option of the same run, chosen once at the start; UI-only runs need no database, no driver and no configuration.

## The question, and where the answer lives

In the start-up questions (SKILL.md step 1): *"Check the saved data in the local database as well as the UI?"* — **UI only** (default) or **UI + local database (withDB)**. The answer is written into the scenario file as `"withDB": true|false`; a re-run reads it from there and does not ask again unless the user changes it. Every `db` step and `sql` fixture is a validation error without it, so a file cannot be half in one mode.

## Configuration

`docs/qa/qa.config.json` — project level, next to the task directories, committed with the reports, and therefore **holding no secret**:

```json
{
  "db": {
    "engine": "mysql",
    "docker": { "service": "db" },
    "database": "app",
    "user": "app",
    "passwordFrom": "container-env:MYSQL_PASSWORD",
    "readOnly": true,
    "writes": false,
    "mask": ["email", "phone"],
    "probe": { "url": "/properties", "ready": "#app-ready", "js": "document.querySelectorAll('tbody tr').length", "query": "SELECT COUNT(*) AS n FROM properties WHERE deleted_at IS NULL", "path": "0.n" }
  }
}
```

- `engine`: `mysql` / `mariadb` (through the running container) or `sqlite` (`"file": "./var/app.db"`, no container). Other engines: see the contract below
- `docker`: `{ "service": "db" }` finds the running container by its compose label (`project` narrows it when two stacks run), or `{ "container": "name" }` names it outright
- `passwordFrom`: a pointer, never a value — `container-env:VAR` reads the variable from the running container (the compose file already gave it the password), `env:VAR` reads this shell. The runner refuses a config with `password`, `dsn`, `url` or `connectionString` in it
- `writes`: `true` lets `sql` fixture steps write. Scenario steps are read-only whatever this says
- `mask`: columns replaced with `***` before any row reaches the results file or a caption
- `probe`: one value the UI and the database both know, for `--db-check`

`--db-discover` reads the `docker-compose*.yml` files in the task directory and the project, and `docker ps`, and prints a skeleton per database service — engine from the image, database and user from the service's environment, the password as a `container-env:` pointer, whether an adapter exists here, and whether the container is running. Fill in what it could not read, add the probe, save.

## Confirming it is the right database

A connection that works proves nothing about the app under test: `docker ps` on a developer machine lists five databases. Before the first withDB run:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --db-check
```

connects, prints engine / container / database / user (never the password), opens the probe URL in the QA window, reads the probe's `js` there and the probe's `query` in the database, and says AGREE or DISAGREE. The result goes into the report's opening paragraph. Without a probe the command says so and the user has to confirm the app reads this database; write which of the two happened. On DISAGREE do not run withDB — a PASS against the wrong database is worse than no check.

## Steps and checks

With `withDB: true` the scenario file gains one step and one source:

```json
{ "db": { "name": "before", "query": "SELECT COUNT(*) AS n FROM views WHERE owner_id = ?", "params": ["${tenant}"] } }
{ "db": { "name": "row", "query": "SELECT id, name, owner_id, deleted_at FROM views WHERE name = ?", "params": ["QA ${runId} villas"], "one": true } }
{ "expect": { "name": "row", "path": "owner_id", "equals": "${tenant}", "desc": "the row belongs to the tenant that saved it" } }
{ "expect": { "db": { "query": "SELECT COUNT(*) AS n FROM views WHERE name = ?", "params": ["QA ${runId} villas"] }, "path": "0.n", "equals": 1, "within": 3000, "desc": "exactly one such row, written within 3 s" } }
```

`params` are bound by the server, never pasted into the query; the query text is a constant. Rows come back as objects, values as the engine renders them (MySQL: strings; `"as": "number"` where it matters, though `equals: 1` against `"1"` holds anyway). `one: true` stores the first row or `null`. `within` on a `db` check polls the query — for the asynchronous write, the queue, the trigger — and records how long it waited.

Patterns the run usually needs, each an ordinary read plus an assertion whose expected value comes from the requirement or the setup, not from the UI:

| To show | Read | Assert |
| --- | --- | --- |
| a save happened, once | `COUNT(*)` by the run-specific name | `equals: 1` |
| the record is the one on screen | the row by name; the id read from the DOM | `row.id equals ${newId}` |
| fields, owner, tenant, relations | the row; a `JOIN` or a second query for the relation | each field against the value the setup or the requirement fixed |
| nothing was written on cancel / rejected form | `COUNT(*)` by the name that was typed | `equals: 0` |
| an update took | the row after the action | the changed field equals the new value, the untouched one still equals the old |
| a delete took (hard or soft) | the row | `null`, or `deleted_at notEquals null` and the list no longer shows it |
| the list is right under filter / permission / sort / pagination | the ids the query with the same conditions returns (`WHERE type = 'villa' AND owner_id = ? AND deleted_at IS NULL ORDER BY … LIMIT …`) | the ids on screen `equals` that list — content and completeness |

The last row is where "UI equals DB" is legitimate: the database is queried *with the conditions the requirement states*, so the assertion is "the screen shows what the rules select", not "the screen shows what happens to be there". A scenario that reads unfiltered rows and compares them with an unfiltered screen has checked that two views of the same wrong value agree. Read the state **before** the action when the assertion is about a change: `before` and `after` as two reads, and `after.n equals ${before.n}` plus one.

## What the results record

Each expect carries `source`: `ui` (a `js` read), `db`, `http` (an `awaitResponse`), or the source of the stored value it read. The report lists UI and DB evidence on separate lines under a finding and says in its opening which database was checked. A scenario whose database read fails — connection lost, query error — is an `error`, not a FAIL and not a UI-only PASS; the run itself stops before the browser when the database is unreachable at the start, with a message about the database. "The data is wrong" (a FAIL with `source: db`) and "the check could not be made" (an error, or the run not started) are two different sentences in the report.

## The adapter contract

`scripts/lib/db.mjs` opens the engine and owns the rules — the read-only guard, the writes flag, masking, secret resolution — so an adapter is small:

```js
export function open({ …config }) {
  return {
    engine: "name",
    describe: () => ({ engine, host, database, user }),   // printed and recorded; no secret
    async query(sql, params, { write }) { … return rows; }, // plain objects; for a write, [{ insertId, changes }].
                                                             // With write: false the CONNECTION has to refuse a write
                                                             // (query_only, a read-only transaction), not a keyword check
    close() {},
  };
}
```

Two exist: `db-sqlite.mjs` (`node:sqlite`, built into Node 22, used by the runner's tests) and `db-mysql-docker.mjs`, which runs the `mysql` client inside the container — `docker exec -i -e MYSQL_PWD <container> mysql --xml` with the password in the exec'd process's environment, not in argv — and binds parameters server-side (`SET @p0 = …; PREPARE … ; EXECUTE … USING @p0`). No driver is installed; the container that runs the database has its client. **Postgres and MongoDB have no adapter here.** Adding one is one file that meets the contract (for Postgres, `psql` in the container with `\copy`/`json_agg`; for Mongo, `mongosh --eval` with a JSON filter) and one branch in `openDb`; until then `--db-discover` says "NO adapter here" for such a service and a withDB run against it does not start.

## Rules the runner enforces

- scenario steps only read, and the connection enforces it, not a keyword check: SQLite runs with `PRAGMA query_only` on except inside a fixture write, MySQL sets `SESSION TRANSACTION READ ONLY` before every read, so a `WITH … UPDATE … RETURNING` that starts with a read keyword fails with a read-only error instead of changing the row. The keyword refusal (`SELECT` / `SHOW` / `DESCRIBE` / `EXPLAIN` / `WITH`) is only the early, readable message
- fixture writes need `writes: true` in the config **and** a `sql` step in `setups`; a `db` step in a scenario cannot write
- no password, DSN or connection string in `qa.config.json`, `scenarios.json`, `results.json` or the report; the `run.db` block in `results.json` records engine, container, database and user
- masked columns never leave the adapter
- `--db "SELECT …" --params '[…]'` runs one read-only query from the shell for reconnaissance; a write through it is refused the same way
