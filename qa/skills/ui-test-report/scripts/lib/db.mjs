/*
 * The database behind withDB. One small contract, two adapters, and the
 * safety rules in one place rather than in each adapter:
 *
 *   adapter = await openDb(config, { cwd, writes })
 *   adapter.engine            "mysql" | "sqlite"
 *   adapter.describe()        what to print and record — never a password
 *   adapter.query(sql, params, { write })  rows as plain objects
 *   adapter.close()
 *
 * Reads are the default and the only thing a scenario can do. The keyword
 * check here is the early, readable refusal; the enforcement is in the
 * adapter's connection — SQLite's `PRAGMA query_only`, MySQL's session
 * `TRANSACTION READ ONLY` — so a `WITH … UPDATE … RETURNING` that starts with
 * a read keyword still fails instead of changing the row. A fixture step with
 * writes: true in the config is the one caller that may write. Values that the
 * config lists under `mask` are replaced before they reach results.json.
 *
 * Connection details come from a config that holds no secret: the password is
 * a pointer — container-env:MYSQL_PASSWORD (read from the running container),
 * env:QA_DB_PASSWORD (read from this shell) — resolved at run time and kept
 * out of argv, logs and files.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const CONFIG_FILE = "qa.config.json";
const READ_RE = /^\s*(select|show|describe|desc|explain|with|pragma)\b/i;

export const isReadQuery = (sql) => READ_RE.test(String(sql));

/** qa.config.json next to the task directory or one level up (docs/qa/). */
export function findConfig(taskDir, explicit = null) {
  if (explicit) return path.resolve(explicit);
  for (const dir of [taskDir, path.dirname(taskDir)]) {
    const f = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

export function loadConfig(taskDir, explicit = null) {
  const file = findConfig(taskDir, explicit);
  if (!file) return { file: null, config: {} };
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${e.message})`);
  }
  for (const key of ["password", "connectionString", "dsn", "url"]) {
    if (config.db && config.db[key] !== undefined) throw new Error(`${file}: db.${key} must not be in the config — use "passwordFrom": "container-env:VAR" or "env:VAR"; the file is committed with the report`);
  }
  return { file, config };
}

function dockerExec(container, args, opts = {}) {
  return execFileSync("docker", ["exec", ...(opts.interactive ? ["-i"] : []), ...(opts.env || []).flatMap((e) => ["-e", e]), container, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    input: opts.input,
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
}

/** "container-env:VAR" | "env:VAR" → the value, without ever printing it. */
export function resolveSecret(spec, { container } = {}) {
  if (spec === undefined || spec === null || spec === "") return undefined;
  const m = String(spec).match(/^(env|container-env):([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!m) throw new Error(`passwordFrom must be "env:VAR" or "container-env:VAR", got ${JSON.stringify(spec)}`);
  if (m[1] === "env") {
    if (process.env[m[2]] === undefined) throw new Error(`passwordFrom env:${m[2]}: ${m[2]} is not set in this shell`);
    return process.env[m[2]];
  }
  if (!container) throw new Error(`passwordFrom container-env:${m[2]} needs db.docker.container`);
  const out = dockerExec(container, ["printenv", m[2]]).replace(/\n$/, "");
  return out;
}

/** The running container for a compose service, or the container named outright. */
export function resolveContainer(docker, cwd) {
  if (!docker) return null;
  if (docker.container) return docker.container;
  if (docker.service) {
    const args = ["ps", "--filter", `label=com.docker.compose.service=${docker.service}`, "--format", "{{.Names}}"];
    if (docker.project) args.push("--filter", `label=com.docker.compose.project=${docker.project}`);
    const names = execFileSync("docker", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim().split("\n").filter(Boolean);
    if (names.length === 1) return names[0];
    if (names.length === 0) throw new Error(`no running container for compose service "${docker.service}" — is the stack up?`);
    throw new Error(`several running containers for compose service "${docker.service}" (${names.join(", ")}); set db.docker.project or db.docker.container`);
  }
  return null;
}

/**
 * Open the configured database. `writes` is the fixture layer saying it may
 * write; the config's `writes: true` is the user saying the same — both are
 * needed for anything but a read.
 */
export async function openDb(dbConfig, { cwd = process.cwd(), writes = false } = {}) {
  if (!dbConfig || !dbConfig.engine) throw new Error(`no db.engine in ${CONFIG_FILE} — run --db-discover for a skeleton`);
  const mask = Array.isArray(dbConfig.mask) ? dbConfig.mask : [];
  const writesAllowed = writes && dbConfig.writes === true;
  let inner;
  if (dbConfig.engine === "sqlite") {
    const { open } = await import("./db-sqlite.mjs");
    inner = open({ file: path.resolve(cwd, dbConfig.file || ""), readOnly: !writesAllowed });
  } else if (dbConfig.engine === "mysql" || dbConfig.engine === "mariadb") {
    const { open } = await import("./db-mysql-docker.mjs");
    const container = resolveContainer(dbConfig.docker, cwd);
    if (!container) throw new Error(`db.docker.container or db.docker.service is required for ${dbConfig.engine} — the adapter runs the mysql client inside the container`);
    const password = resolveSecret(dbConfig.passwordFrom, { container });
    inner = open({ container, database: dbConfig.database, user: dbConfig.user || "root", password, readOnly: !writesAllowed });
  } else {
    throw new Error(`db.engine "${dbConfig.engine}" has no adapter here — sqlite and mysql are implemented; see references/database.md for the contract a new adapter has to meet`);
  }
  return {
    engine: inner.engine,
    readOnly: !writesAllowed,
    // Scenario steps only ever read; `fixtureWrites` says whether setups may write.
    describe: () => ({ ...inner.describe(), scenarioAccess: "read-only", fixtureWrites: writesAllowed, mask }),
    async query(sql, params = [], { write = false } = {}) {
      if (!isReadQuery(sql)) {
        if (!write) throw new Error(`refused: scenarios only read the database; "${String(sql).trim().slice(0, 60)}" is not a SELECT`);
        if (!writesAllowed) throw new Error(`refused: this statement writes and ${CONFIG_FILE} has no "writes": true under db`);
      }
      const rows = await inner.query(String(sql), params, { write: write && writesAllowed });
      return maskRows(rows, mask);
    },
    close: () => inner.close(),
  };
}

/** Replace listed columns before the rows reach results or values. */
export function maskRows(rows, mask) {
  if (!mask.length || !Array.isArray(rows)) return rows;
  const set = new Set(mask);
  return rows.map((row) => (row && typeof row === "object" ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, set.has(k) && v !== null && v !== undefined ? "***" : v])) : row));
}

// ------------------------------------------------------------ discovery

const ENGINE_OF_IMAGE = [
  [/mysql|percona/i, "mysql"],
  [/mariadb/i, "mariadb"],
  [/postgres/i, "postgres"],
  [/mongo/i, "mongo"],
];

function composeConfig(file, cwd) {
  try {
    const out = execFileSync("docker", ["compose", "-f", file, "config", "--format", "json"], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString();
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * Look at docker-compose files and running containers and propose a db block.
 * Nothing is written: the model shows the candidates, asks what is missing,
 * and the user's answer becomes qa.config.json.
 */
export function discoverDb({ cwd = process.cwd() } = {}) {
  const candidates = [];
  const files = fs.readdirSync(cwd).filter((f) => /^(docker-)?compose(\..*)?\.ya?ml$/.test(f));
  for (const f of files) {
    const cfg = composeConfig(f, cwd);
    if (!cfg?.services) continue;
    for (const [service, svc] of Object.entries(cfg.services)) {
      const engine = ENGINE_OF_IMAGE.find(([re]) => re.test(svc.image || ""))?.[1];
      if (!engine) continue;
      const env = svc.environment || {};
      const pick = (...keys) => keys.map((k) => env[k]).find((v) => v !== undefined);
      const passwordVar = ["MYSQL_PASSWORD", "MARIADB_PASSWORD", "POSTGRES_PASSWORD", "MONGO_INITDB_ROOT_PASSWORD", "MYSQL_ROOT_PASSWORD", "MARIADB_ROOT_PASSWORD"].find((k) => env[k] !== undefined);
      const user = pick("MYSQL_USER", "MARIADB_USER", "POSTGRES_USER", "MONGO_INITDB_ROOT_USERNAME") || (passwordVar && /ROOT/.test(passwordVar) ? "root" : undefined);
      candidates.push({
        source: f,
        engine,
        image: svc.image,
        implemented: engine === "mysql" || engine === "mariadb",
        db: {
          engine,
          docker: { service, project: cfg.name },
          database: pick("MYSQL_DATABASE", "MARIADB_DATABASE", "POSTGRES_DB", "MONGO_INITDB_DATABASE"),
          user,
          passwordFrom: passwordVar ? `container-env:${passwordVar}` : "env:QA_DB_PASSWORD",
          readOnly: true,
          writes: false,
          mask: [],
        },
      });
    }
  }
  let running = [];
  try {
    running = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Image}}\t{{.Label \"com.docker.compose.service\"}}\t{{.Label \"com.docker.compose.project\"}}"], { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim().split("\n").filter(Boolean)
      .map((l) => l.split("\t"))
      .map(([name, image, service, project]) => ({ name, image, service: service || null, project: project || null, engine: ENGINE_OF_IMAGE.find(([re]) => re.test(image))?.[1] || null }))
      .filter((c) => c.engine);
  } catch { /* no docker */ }
  for (const c of candidates) {
    const match = running.find((r) => r.service === c.db.docker.service && (!c.db.docker.project || r.project === c.db.docker.project));
    c.running = match ? match.name : null;
  }
  return { candidates, running };
}
