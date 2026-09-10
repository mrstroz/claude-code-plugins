# Test data: setups, the ledger, cleanup

A scenario that creates a record and a re-run that creates it again are how a QA database fills with "test view 3" through "test view 41". The runner's answer is small: data is prepared by named setups, every record made is written to a ledger with the run's id, and cleanup removes what the ledger lists — nothing more.

## Run id

Every execution gets a run id, `20260910-103212-9f3a` (date, time, four hex digits). It is `${runId}` in every template of the scenario file and `QA_RUN_ID` in the environment of `shell` steps. Put it in the name of everything the run creates — `"QA ${runId} villas"` — so a record says where it came from without anybody opening a file, and a query can find exactly the rows of this run (`WHERE name LIKE 'QA 20260910-103212-9f3a %'`).

## Setups

```json
"setups": {
  "version": "seed-2026-09",
  "villaSeed": {
    "prepare": [
      { "http": { "method": "POST", "url": "/api/views", "json": { "name": "QA ${runId} villas" }, "expectStatus": 201, "name": "villas",
                  "record": { "kind": "view", "id": "json.id", "cleanup": { "http": { "method": "DELETE", "url": "/api/views/${id}" } } } } },
      { "sql":  { "query": "INSERT INTO properties (ref, type, owner_id) VALUES (?, 'villa', 1)", "params": ["QA-${runId}-1"],
                  "record": { "kind": "properties", "id": "insertId", "cleanup": { "sql": { "query": "DELETE FROM properties WHERE id = ? AND ref LIKE 'QA-%'", "params": ["${id}"] } } } } },
      { "shell": { "command": "php yii fixture/load qa-villas --interactive=0",
                   "record": { "kind": "fixture", "id": "stdout", "cleanup": { "shell": "php yii fixture/unload qa-villas --interactive=0" } } } }
    ],
    "cleanup": [ { "shell": "php yii cache/flush-all" } ]
  }
}
```

A scenario declares `"uses": ["villaSeed"]`. The setup runs once per run, immediately before the first scenario that uses it, and its records go into the ledger as they are made. Under `--only 07` the setup still runs, so a single scenario re-runs on fresh data without the six scenarios before it — which is why short flows with a shared setup beat one long chain. A setup that fails blocks every scenario that uses it (`blockedBy: "setup:villaSeed"`); nothing runs on data that is not there.

Three kinds of step, and a step is exactly one of them:

- **`http`** — `fetch` against `--base-url` (or an absolute URL): `method`, `url`, `json` or `body`, `headers`, `expectStatus` (without it any non-2xx is a failure). Headers may use `${env.QA_API_TOKEN}`, read from the shell and never written anywhere. `"session": "browser"` sends the QA window's cookies, so a request runs as the logged-in user — Playwright driver only, since only it has the window. `name` stores the response (`{ status, ok, url, method, json | text }`) for `${name.json.id}` in later steps and scenarios
- **`sql`** — a statement through the configured database with `params`. Only with `withDB: true` and `db.writes: true` in `qa.config.json`; both are the user saying, in two places, that the run may write. The result carries `insertId` and `changes`
- **`shell`** — a project command (`php yii fixture/load …`, `npm run seed -- --run=$QA_RUN_ID`), a string or `{ "command", "cwd", "env", "timeout" }`. Its stdout is the result (`json` when it parses)

`record` on a step says what it created: `kind` (free text: a table, a collection, a fixture name), `id` — a path into the step's result (`"json.id"`, `"insertId"`, `"stdout"`) — and `cleanup`, one http / sql / shell step with `${id}` and `${runId}` available. A record without `cleanup` is listed as left behind.

A scenario that creates data through the UI records it the same way, with `leaves`:

```json
"leaves": [{ "kind": "view", "id": "${newId}", "cleanup": { "http": { "method": "DELETE", "url": "/api/views/${id}" } } }]
```

appended to the ledger the moment the id can be read — after the step that stores `${newId}`, not after the last step — so a scenario that saves, reads the id and then errors on the next click still leaves its record where cleanup finds it. An id that never resolved is listed on the entry as `leavesUnrecorded`.

## The ledger

`runs/<runId>/records.json`:

```json
{ "runId": "20260910-103212-9f3a", "prepared": ["villaSeed"],
  "records": [{ "runId": "20260910-103212-9f3a", "at": "…", "setup": "villaSeed", "kind": "view", "id": 42, "via": "http", "cleanup": { "http": { "method": "DELETE", "url": "/api/views/${id}" } } }],
  "cleaned": [{ "index": 0, "at": "…" }], "failures": [] }
```

Every record is written the moment it exists, not at the end, so a setup that fails on its third step still leaves the first two where cleanup will find them.

## Cleanup

At the end of the run — after the last scenario, after an error, and after Ctrl-C (the runner finishes the current scenario, then cleans up; a second Ctrl-C leaves at once and says the data may still be there) — the runner walks the ledger backwards and runs each record's cleanup step, then each prepared setup's `cleanup` block in reverse order. It touches only what the ledger lists: no truncate, no reset, no "delete everything named QA". A record whose cleanup fails is recorded under `failures` with the error and the walk continues; the runner prints the count and `run.json` keeps it, so the report can list what is still there.

`--keep-data` skips cleanup and records `data.kept: true` — for looking at the rows behind a FAIL. The report has to say so under Test data, and `check-evidence.js` refuses one that does not. Later:

```bash
node …/run-scenarios.mjs --cleanup --run 20260910-103212-9f3a
```

removes what that run's ledger says it created, using the base URL the run recorded. A cleanup step with `"session": "browser"` needs the QA window: the command attaches to it when it is open and stops with the way out (`--open`, log in, run again) when it is not — a window started now would have no session. The same holds for `--prepare`. `--prepare --run <id> [--setups a,b]` runs setups into a run's ledger without a browser, for a run driven by hand.

What cleanup does not do: it does not roll anything back. The runner opens no transaction and assumes none covers the application's writes — the app wrote through its own connection, and the only way to undo that is the explicit cleanup step. Shared rows, other people's records and the schema are never touched, because nothing in the ledger names them.

## Setups without a database

Nothing here needs `withDB`. An `http` setup against the app's own API, or a `shell` setup calling the project's fixture loader, prepares data for a UI-only run; `sql` is the one kind that needs the database, and it is refused without it. Prefer the app's API or loader anyway: rows written straight into a table skip the app's validation and hooks, and a scenario on such data can pass on a state the app itself can never produce.
