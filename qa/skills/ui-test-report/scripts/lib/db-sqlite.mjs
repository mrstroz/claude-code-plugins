/*
 * SQLite through node:sqlite (Node 22+, no package to install). The adapter
 * for an app that keeps its data in a file, and the one the runner's own tests
 * run on. Opened read-only unless the fixture layer asked for writes and the
 * config allows them; a write returns the row id it produced as `insertId`,
 * which is what a fixture's `record.id: "insertId"` reads.
 */
import { DatabaseSync } from "node:sqlite";

// node:sqlite prints an ExperimentalWarning on first use; it is stable enough
// for reads and the warning would land in every run's output otherwise.
const listeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name === "ExperimentalWarning" && /SQLite/.test(w.message)) return;
  for (const l of listeners) l(w);
});

export function open({ file, readOnly = true }) {
  if (!file) throw new Error(`sqlite needs db.file (path to the database file)`);
  const inMemory = file.endsWith(":memory:");
  const db = new DatabaseSync(inMemory ? ":memory:" : file, { readOnly: readOnly && !inMemory });
  // The connection itself refuses writes; a fixture write lifts that for one
  // statement and puts it back. A "WITH … UPDATE … RETURNING" that slips past
  // a keyword check fails here with SQLITE_READONLY instead of changing the row.
  db.exec("PRAGMA query_only = ON");
  return {
    engine: "sqlite",
    describe: () => ({ engine: "sqlite", file }),
    async query(sql, params = [], { write = false } = {}) {
      const stmt = db.prepare(sql);
      const args = params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
      if (write) {
        if (readOnly) throw new Error("sqlite adapter opened read-only; fixture writes need db.writes: true");
        db.exec("PRAGMA query_only = OFF");
        try {
          const r = stmt.run(...args);
          return [{ insertId: Number(r.lastInsertRowid), changes: Number(r.changes) }];
        } finally {
          db.exec("PRAGMA query_only = ON");
        }
      }
      return stmt.all(...args).map((r) => ({ ...r }));
    },
    close: () => db.close(),
    /** for tests and demos: run DDL/seed statements outside the guard */
    raw: (sql) => { db.exec("PRAGMA query_only = OFF"); try { db.exec(sql); } finally { db.exec("PRAGMA query_only = ON"); } },
  };
}
