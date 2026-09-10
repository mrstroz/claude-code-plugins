/*
 * MySQL / MariaDB through the client inside the running container:
 *
 *   MYSQL_PWD=… docker exec -i -e MYSQL_PWD <container> mysql --xml --batch -u<user> <database>
 *
 * No driver to install and no port to publish — the container that runs the
 * database always has its own client. The password travels in the exec'd
 * process's environment, never in argv (where `ps` would show it) and never in
 * anything this adapter prints.
 *
 * Parameters go through the server, not through string concatenation into the
 * query: the statement text is prepared once as a constant, and the values
 * arrive as session variables —
 *
 *   SET @p0 = 'QA 20260910-103212-9f3a villas';
 *   PREPARE qa FROM 'SELECT id FROM views WHERE name = ?';
 *   EXECUTE qa USING @p0;
 *
 * so a value containing a quote is a value containing a quote. The literals
 * written into SET are escaped with MySQL's own rules; that is the whole
 * surface.
 *
 * Output is read with --xml rather than tab-separated text because XML is the
 * one format where NULL (xsi:nil="true") and the string "NULL" differ.
 *
 * Every read runs in a session set to TRANSACTION READ ONLY before the
 * statement, so the server refuses a write hidden behind a CTE; only a fixture
 * write (writes: true) omits that line.
 */
import { spawnSync } from "node:child_process";

const READ_ONLY_PREFIX = "SET SESSION TRANSACTION READ ONLY;\n";

export function escapeLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return "'" + s.replace(/[\0\b\t\n\r\x1a'"\\]/g, (c) => ({ "\0": "\\0", "\b": "\\b", "\t": "\\t", "\n": "\\n", "\r": "\\r", "\x1a": "\\Z", "'": "\\'", '"': '\\"', "\\": "\\\\" })[c]) + "'";
}

/** The script for one parametrised statement; the SQL itself is a literal. */
export function buildScript(sql, params, { write = false } = {}) {
  const sets = params.map((p, i) => `SET @p${i} = ${escapeLiteral(p)};`);
  const using = params.length ? ` USING ${params.map((_, i) => `@p${i}`).join(", ")}` : "";
  const lines = [
    ...(write ? [] : [READ_ONLY_PREFIX.trim()]),
    ...sets,
    `PREPARE qa_stmt FROM ${escapeLiteral(sql)};`,
    `EXECUTE qa_stmt${using};`,
    `DEALLOCATE PREPARE qa_stmt;`,
  ];
  if (write) lines.push(`SELECT LAST_INSERT_ID() AS insertId, ROW_COUNT() AS changes;`);
  return lines.join("\n") + "\n";
}

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);

/** Rows of the last result set in mysql --xml output. */
export function parseXml(xml) {
  const sets = [...xml.matchAll(/<resultset\b[^>]*>([\s\S]*?)<\/resultset>/g)];
  if (!sets.length) return [];
  const last = sets[sets.length - 1][1];
  const rows = [];
  for (const row of last.matchAll(/<row>([\s\S]*?)<\/row>/g)) {
    const obj = {};
    for (const f of row[1].matchAll(/<field name="([^"]*)"(\s+xsi:nil="true")?\s*(?:\/>|>([\s\S]*?)<\/field>)/g)) {
      obj[decode(f[1])] = f[2] ? null : decode(f[3] ?? "");
    }
    rows.push(obj);
  }
  return rows;
}

export function open({ container, database, user = "root", password, readOnly = true }) {
  if (!container) throw new Error("mysql adapter needs a container name");
  const run = (script) => {
    // `-e MYSQL_PWD` without a value: docker copies it from this process's
    // environment, so the password is in neither argv nor `ps`.
    const args = ["exec", "-i", "-e", "MYSQL_PWD", container, "mysql", "--xml", "--batch", "--silent", `-u${user}`];
    if (database) args.push(database);
    const r = spawnSync("docker", args, { input: script, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, MYSQL_PWD: password ?? "" } });
    if (r.error) throw new Error(`docker exec failed: ${r.error.message}`);
    if (r.status !== 0) {
      const msg = String(r.stderr || "").replace(/^mysql: \[Warning\].*$/gm, "").trim().split("\n")[0] || `mysql exited with ${r.status}`;
      throw new Error(`mysql (${container}${database ? "/" + database : ""}): ${msg}`);
    }
    return r.stdout;
  };
  return {
    engine: "mysql",
    describe: () => ({ engine: "mysql", container, database: database || null, user }),
    async query(sql, params = [], { write = false } = {}) {
      return parseXml(run(buildScript(sql, params, { write: write && !readOnly })));
    },
    close: () => {},
  };
}
