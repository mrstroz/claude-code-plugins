/*
 * The scenario loop: setups, preconditions, steps, checks, caption,
 * screenshot, one record per scenario written to disk as soon as it exists.
 * It takes a page object and never imports Playwright, so the runner's tests
 * can drive it with a fake page and no browser.
 *
 * What the loop owns:
 *   - a setup runs once per run, before the first scenario that uses it; when
 *     it fails, every scenario that uses it is blocked, not run on missing data
 *   - a dependency counts when its steps ran to the end in this run; error,
 *     blocked or not run blocks the dependant instead of letting it run on the
 *     wrong state
 *   - the verdict is the expect steps' — a step that threw is an error, which is
 *     not a result until somebody has said why
 *   - the results file and the index are rewritten after every scenario, so an
 *     interrupted run leaves a record of what ran, and cleanup runs whether the
 *     loop finished, threw or was asked to stop
 */
import path from "node:path";
import { fill, fillDeep, normalize, check, operand } from "./compare.mjs";
import { stepKind, numberOf, requiresOf, usesOf, hashOf, HASH_VERSION } from "./validate.mjs";
import { writeJsonAtomic, updateIndex, updateRun } from "./runs.mjs";
import { prepareSetup, cleanupRun } from "./fixtures.mjs";

// ---------------------------------------------------------------- selectors

/** A string is a Playwright selector; an object picks one of the getBy* locators. */
export function locate(page, target) {
  if (typeof target === "string") return page.locator(target);
  if (target && typeof target === "object") {
    if (target.role) return page.getByRole(target.role, { name: target.name, exact: target.exact });
    if (target.text !== undefined) return page.getByText(target.text, { exact: target.exact });
    if (target.label !== undefined) return page.getByLabel(target.label, { exact: target.exact });
    if (target.placeholder !== undefined) return page.getByPlaceholder(target.placeholder);
    if (target.testId !== undefined) return page.getByTestId(target.testId);
    if (target.selector) {
      let loc = page.locator(target.selector);
      if (target.nth !== undefined) loc = loc.nth(target.nth);
      return loc;
    }
  }
  throw new Error(`cannot locate ${JSON.stringify(target)}`);
}

export function resolveUrl(u, baseUrl) {
  return /^https?:\/\//.test(u) ? u : baseUrl + (u.startsWith("/") ? u : "/" + u);
}

// ------------------------------------------------------------------ steps

/**
 * After a navigation: the load event, then the app's own readiness condition
 * from the file's top-level `ready` — a selector that has to be visible or a
 * js expression that has to hold. No network-idle guess, and a timeout here
 * is an error of the step: "the app was not ready" is a fact worth recording,
 * not one to swallow.
 */
export async function awaitReady(page, ctx) {
  await page.waitForLoadState("load");
  const r = ctx.ready;
  if (!r) return;
  const t = { timeout: ctx.opts.timeout };
  if (typeof r === "string") return page.locator(r).first().waitFor({ state: "visible", ...t });
  if (r.js) return page.waitForFunction(r.js, null, t);
  if (r.selector) return page.locator(r.selector).first().waitFor({ state: "visible", ...t });
}

/** Register the response listener before the action; resolve it after. */
function responseWatcher(page, spec, ctx) {
  const url = fill(spec.url, ctx.values);
  const re = /^\/.*\/$/.test(url) ? new RegExp(url.slice(1, -1)) : null;
  const method = spec.method ? String(spec.method).toUpperCase() : null;
  const pred = (r) => {
    if (re ? !re.test(r.url()) : !r.url().includes(url)) return false;
    if (method && r.request().method().toUpperCase() !== method) return false;
    if (spec.status !== undefined && r.status() !== Number(spec.status)) return false;
    return true;
  };
  const timeout = Number(spec.timeout) || ctx.opts.timeout;
  const p = page.waitForResponse(pred, { timeout });
  p.catch(() => {}); // awaited below; this only keeps a rejection from being unhandled while the action runs
  return async () => {
    let res;
    try {
      res = await p;
    } catch (e) {
      throw new Error(`awaitResponse "${spec.name}": no ${method || "any"} response for ${url}${spec.status !== undefined ? ` with status ${spec.status}` : ""} within ${timeout} ms (${String(e.message).split("\n")[0]})`);
    }
    const out = { status: res.status(), ok: res.ok(), url: res.url(), method: res.request().method() };
    try {
      const text = await res.text();
      try { out.json = JSON.parse(text); } catch { out.text = text.slice(0, 2000); }
    } catch { /* body not available (redirect, aborted) */ }
    ctx.values[spec.name] = out;
    ctx.sources[spec.name] = "http";
  };
}

const STEP = {
  async goto(page, url, ctx) {
    await page.goto(resolveUrl(fill(url, ctx.values), ctx.opts.baseUrl), { waitUntil: "commit" });
    await awaitReady(page, ctx);
  },
  async reload(page, _v, ctx) {
    await page.reload({ waitUntil: "commit" });
    await awaitReady(page, ctx);
  },
  async click(page, target) { await locate(page, target).click(); },
  async dblclick(page, target) { await locate(page, target).dblclick(); },
  async hover(page, target) { await locate(page, target).hover(); },
  async fill(page, spec, ctx) { await locate(page, spec.selector ?? spec.target ?? spec).fill(fill(spec.value, ctx.values)); },
  async type(page, spec, ctx) { await locate(page, spec.selector ?? spec.target).pressSequentially(fill(spec.value, ctx.values)); },
  async select(page, spec, ctx) { await locate(page, spec.selector ?? spec.target).selectOption(fill(spec.value, ctx.values)); },
  async check(page, target) { await locate(page, target).check(); },
  async uncheck(page, target) { await locate(page, target).uncheck(); },
  async press(page, key, ctx, step) {
    if (step.selector) await locate(page, step.selector).press(key);
    else await page.keyboard.press(key);
  },
  async wait(page, what, ctx) {
    const t = ctx.opts.timeout;
    if (typeof what === "number") return page.waitForTimeout(what);
    if (typeof what === "string") {
      if (["load", "domcontentloaded"].includes(what)) return page.waitForLoadState(what);
      return page.locator(what).first().waitFor({ state: "visible", timeout: t });
    }
    if (what.loadState) return page.waitForLoadState(what.loadState, { timeout: t });
    if (what.url) return page.waitForURL(new RegExp(fill(what.url, ctx.values)), { timeout: t });
    if (what.js) return page.waitForFunction(what.js, null, { timeout: t });
    return locate(page, what).first().waitFor({ state: what.state || "visible", timeout: t });
  },
  async read(page, spec, ctx) {
    ctx.values[spec.name] = normalize(await page.evaluate(spec.js), spec.as);
    ctx.sources[spec.name] = "ui";
  },
  async db(page, spec, ctx) {
    const rows = await ctx.readers.db(spec, ctx.values);
    ctx.values[spec.name] = normalize(spec.one ? rows[0] ?? null : rows, spec.as);
    ctx.sources[spec.name] = "db";
  },
  async expect(page, spec, ctx) {
    ctx.sink.push(await check(spec, ctx.values, ctx.readers, ctx.sources));
  },
};

export async function runStep(page, step, ctx) {
  const kind = stepKind(step);
  if (!kind) throw new Error(`unknown step ${JSON.stringify(step)}`);
  const settle = step.awaitResponse ? responseWatcher(page, step.awaitResponse, ctx) : null;
  await STEP[kind](page, step[kind], ctx, step);
  if (settle) await settle();
}

/** The readers a check uses: the page for js, the adapter for db. */
export function readersFor(page, db) {
  return {
    js: (expr) => page.evaluate(expr),
    db: async (spec, values) => {
      if (!db) throw new Error(`database step but no database: the run was started without withDB, or qa.config.json has no db block`);
      const s = fillDeep(spec, values);
      return db.query(s.query, s.params || []);
    },
  };
}

// A drawer that closed 50 ms ago is still on screen mid-slide. Fast-forwarding
// CSS transitions at capture time is what makes "Apply closes the drawer" and
// the picture agree without every scenario carrying a 350 ms wait.
export const SHOT = (file) => ({ path: file, type: "jpeg", quality: 85, animations: "disabled" });

export async function caption(page, annotateSrc, o) {
  const ready = await page.evaluate(() => typeof window.__ann === "function").catch(() => false);
  if (!ready) await page.addScriptTag({ content: annotateSrc });
  const r = await page.evaluate((opts) => window.__ann(opts), o);
  return typeof r === "string" ? { tag: r, missing: [] } : r || { tag: null, missing: [] };
}

// ------------------------------------------------------------------ errors

/**
 * The whole error message, minus what differs between two runs of the same
 * failure: Playwright's retry counters and wait intervals.
 */
export function errorDetail(message) {
  const seen = new Set();
  const out = [];
  for (const raw of String(message).replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
    const line = raw.trimEnd().replace(/\b\d+ × /, "× ");
    if (!line.trim() || /^\s*-?\s*(retrying .*action|waiting \d+ms)\s*$/.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out.join("\n");
}

export const sameError = (a, b) => !!a && !!b && a.replace(/\d+ms/g, "Nms") === b.replace(/\d+ms/g, "Nms");

// -------------------------------------------------------------------- loop

const STATUS_TAG = { pass: "PASS ", fail: "FAIL ", check: "CHECK", error: "ERROR", blocked: "BLOCK" };

/**
 * Execute the selected scenarios. `ctx`:
 *   page, annotateSrc, taskDir, run ({ runId, dir, runFile }), doc, selected,
 *   opts ({ baseUrl, timeout, keepData }), db (adapter or null), ledger,
 *   fixtures (ctx for fixture steps), prevByN (index entries by number),
 *   abort ({ requested }), log(line), scope
 */
export async function executeScenarios(ctx) {
  const { page, taskDir, run, selected, opts, log = () => {} } = ctx;
  const doc = Array.isArray(ctx.doc) ? { scenarios: ctx.doc } : ctx.doc;
  const setups = doc.setups || {};
  const ready = doc.ready || null;
  const values = ctx.values || (ctx.values = {});
  const sources = ctx.sources || (ctx.sources = {});
  values.runId = run.runId;
  const readers = readersFor(page, ctx.db);
  const shotsDir = path.join(run.dir, "screenshots");
  const relShots = path.relative(taskDir, shotsDir) || "screenshots";
  const runResults = path.join(run.dir, "results.json");

  const results = [];
  const statusOf = new Map(); // this run only
  const prepared = new Set(ctx.ledger?.prepared || []);
  const setupFailed = new Map();
  let errored = 0;
  let interrupted = false;
  let thrown = null;

  const persist = () => {
    writeJsonAtomic(runResults, { runId: run.runId, driver: "playwright", startedAt: run.run?.startedAt, scenarios: results });
    updateIndex(taskDir, run.runId, results, { scope: ctx.scope || "all" });
  };

  // Console and network noise, reset per scenario.
  let noise = [];
  if (typeof page.on === "function") {
    page.on("console", (m) => { if (m.type() === "error") noise.push(`console.error: ${m.text()}`); });
    page.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => noise.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText || ""}`));
    page.on("response", (r) => { if (r.status() >= 400) noise.push(`http ${r.status()}: ${r.request().method()} ${r.url()}`); });
  }

  try {
    for (const sc of selected) {
      if (ctx.abort?.requested) { interrupted = true; break; }
      const n = numberOf(sc);
      const slug = sc.slug || "scenario";
      noise = [];
      const expects = [];
      const rec = {
        n, slug, title: sc.title, status: null, completed: false, at: new Date().toISOString(),
        runId: run.runId, stepsHash: hashOf(sc, setups), hashVersion: HASH_VERSION,
        requires: requiresOf(sc), uses: usesOf(sc), values: {}, expects, caption: null, screenshot: null, console: noise,
      };
      const p = ctx.prevByN?.get(n);
      if (sc.revision) {
        rec.revision = sc.revision;
        rec.revisionHash = p?.revision === sc.revision ? p.revisionHash || p.stepsHash : rec.stepsHash;
      }
      let stepAt = -1;
      const shot = path.join(shotsDir, `${n}-${slug}.jpg`);
      const errShot = path.join(shotsDir, `${n}-${slug}.error.jpg`);
      const rel = (f) => path.join(relShots, path.basename(f));
      const started = Date.now();
      const stepCtx = { values, sources, opts, readers, ready, sink: expects };
      await page.evaluate(() => window.__annClear?.()).catch(() => {});
      try {
        // Setups first: data before preconditions, since the preconditions
        // may be about that data.
        for (const u of usesOf(sc)) {
          if (prepared.has(u) || setupFailed.has(u)) continue;
          try {
            await prepareSetup(u, setups[u], ctx.fixtures);
            prepared.add(u);
            ctx.ledger?.markPrepared(u);
            log(`setup ${u} prepared`);
          } catch (e) {
            setupFailed.set(u, String(e.message).split("\n")[0]);
            log(`setup ${u} FAILED — ${setupFailed.get(u)}`);
          }
        }
        const badSetup = usesOf(sc).find((u) => setupFailed.has(u));
        const unfinished = requiresOf(sc).find((d) => statusOf.get(d)?.completed !== true);
        const given = [];
        if (!badSetup && !unfinished) for (const spec of sc.given || []) given.push(await check(spec, values, readers, sources));
        if (given.length) rec.given = given;
        const unmet = given.filter((g) => !g.passed);
        if (badSetup) {
          rec.status = "blocked";
          rec.blockedBy = `setup:${badSetup}`;
          rec.reason = `setup "${badSetup}" failed: ${setupFailed.get(badSetup)}`;
        } else if (unfinished) {
          const dep = statusOf.get(unfinished);
          rec.status = "blocked";
          rec.blockedBy = unfinished;
          rec.reason = dep ? `${unfinished} ${dep.status}: ${dep.error || dep.reason || ""}`.trim() : `${unfinished} did not run`;
        } else if (unmet.length) {
          rec.status = "blocked";
          rec.blockedBy = "given";
          rec.reason = unmet.map((g) => `${g.desc} (actual ${JSON.stringify(g.actual)}${g.reason ? `: ${g.reason}` : ""})`).join("; ");
        } else {
          const steps = sc.steps || [];
          // Data the scenario creates through the UI goes to the ledger the
          // moment its id can be read — not after the last step, because the
          // step after the save may be the one that throws, and a record
          // created before an error still has to be cleaned up.
          const pendingLeaves = [...(sc.leaves || [])];
          const recordLeaves = () => {
            for (const l of [...pendingLeaves]) {
              let id;
              try { id = operand(l.id, values); } catch { continue; }
              if (id === undefined || id === null) continue;
              ctx.ledger?.add({ scenario: n, kind: l.kind, id, via: "ui", cleanup: l.cleanup || null, note: l.note });
              pendingLeaves.splice(pendingLeaves.indexOf(l), 1);
            }
          };
          try {
            for (stepAt = 0; stepAt < steps.length; stepAt++) {
              await runStep(page, steps[stepAt], stepCtx);
              if (pendingLeaves.length) recordLeaves();
            }
          } finally {
            if (pendingLeaves.length) recordLeaves();
            if (pendingLeaves.length) rec.leavesUnrecorded = pendingLeaves.map((l) => l.id);
          }
          rec.completed = true;
          const ok = sc.manual ? null : expects.every((e) => e.passed);
          rec.status = ok === null ? "check" : ok ? "pass" : "fail";
          const cap = sc.caption || {};
          rec.caption = fill(cap.d || "", values);
          const diag = await caption(page, ctx.annotateSrc, {
            n, t: cap.t || sc.title || "", d: cap.d || "", v: values, ok,
            hl: cap.hl || [], target: cap.target ?? null, pins: cap.pins || [], top: cap.top === true ? true : cap.top === false ? false : undefined,
          });
          if (diag.missing?.length) rec.captionDiag = { missing: diag.missing };
          rec.screenshot = rel(shot);
          await page.screenshot(SHOT(shot));
        }
      } catch (e) {
        rec.status = "error";
        rec.error = String(e.message).split("\n")[0];
        rec.errorDetail = errorDetail(e.message);
        if (stepAt >= 0 && stepAt < (sc.steps || []).length) rec.failedStep = { index: stepAt, step: sc.steps[stepAt] };
        const sameFailure = p?.diagnosis && p.completed === false && p.stepsHash === rec.stepsHash && sameError(p.errorDetail, rec.errorDetail) && (p.failedStep?.index ?? -1) === (rec.failedStep?.index ?? -1);
        if (sameFailure) {
          rec.status = p.status;
          rec.diagnosis = p.diagnosis;
          rec.diagnosedAt = p.diagnosedAt;
          rec.diagnosisCarried = true;
          rec.screenshot = rel(shot);
        } else {
          errored++;
          rec.screenshot = rel(errShot);
        }
        await page.screenshot(SHOT(path.join(taskDir, rec.screenshot))).catch(() => { rec.screenshot = null; });
      }
      rec.values = Object.fromEntries([...new Set([...(sc.steps || []).flatMap((s) => [s.read?.name, s.db?.name, s.awaitResponse?.name]).filter(Boolean)])].map((k) => [k, values[k]]));
      rec.expects = expects.map((e) => ({ ...e }));
      rec.ms = Date.now() - started;
      results.push(rec);
      statusOf.set(n, rec);
      persist();
      const extra = rec.error ? ` — ${rec.error}`
        : rec.status === "blocked" ? ` — ${rec.blockedBy === "given" ? "precondition" : rec.blockedBy.startsWith("setup:") ? "setup" : "requires"}: ${rec.reason}`
        : rec.status === "fail" ? ` — ${expects.filter((e) => !e.passed).map((e) => `[${e.source}] ${e.desc} (actual ${JSON.stringify(e.actual)}${e.reason ? `: ${e.reason}` : ""})`).join("; ")}`
        : "";
      log(`${STATUS_TAG[rec.status] || rec.status} ${n} ${sc.title || slug}${extra}`);
      if (rec.captionDiag) log(`      ↳ caption: no element matched ${rec.captionDiag.missing.join(", ")} — the picture has no frame around the evidence`);
      if (rec.diagnosisCarried) log(`      ↳ same error as the diagnosed run; verdict ${rec.status} kept: ${rec.diagnosis}`);
    }
  } catch (e) {
    thrown = e;
  } finally {
    if (ctx.abort?.requested && results.length < selected.length) interrupted = true;
    let data = { records: ctx.ledger?.records.length || 0, cleaned: 0, skipped: 0, kept: false, failures: [] };
    if (ctx.ledger) {
      if (opts.keepData) {
        data.kept = true;
        log(`--keep-data: ${data.records} record(s) left in place for diagnosis; remove them later with --cleanup --run ${run.runId}`);
      } else {
        try {
          const c = await cleanupRun(ctx.fixtures, { setups });
          const { allFailures, ...c2 } = c;
          void allFailures;
          data = { ...data, ...c2 };
        } catch (e) {
          data.failures = [...data.failures, { error: e.message }];
        }
        if (data.failures.length) log(`cleanup: ${data.failures.length} failure(s) — see ${path.relative(taskDir, ctx.ledger.file)}`);
      }
    }
    const status = thrown ? "interrupted" : interrupted ? "interrupted" : "completed";
    updateRun(run.runFile, {
      status, finishedAt: new Date().toISOString(), pid: null,
      executed: results.map((r) => r.n), stoppedAfter: interrupted || thrown ? results[results.length - 1]?.n || null : undefined,
      error: thrown ? String(thrown.message).split("\n")[0] : undefined,
      counts: results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {}),
      data,
    });
    if (results.length) persist();
  }
  if (thrown) throw thrown;
  return { results, errored, interrupted };
}
