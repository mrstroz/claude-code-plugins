/*
 * Screenshot annotation overlay for browser QA runs.
 *
 * The Playwright runner injects this as an init script. With the Chrome
 * extension it is not executed locally: read it and paste its contents into
 * mcp__claude-in-chrome__javascript_tool, and re-inject after any full reload.
 *
 * Defines three globals:
 *   __ann(opts)              draws the caption card, the evidence frame, outlines and callouts
 *   __annClear()             removes them again
 *   __at(selector, shotW)    converts an element's centre into screenshot pixels
 *
 * Everything drawn is an element of its own, positioned over the page:
 * nothing here changes a style on the app's elements, and every overlay has
 * pointer-events: none, so a click aimed at what sits under it still lands.
 */
(() => {
  const ROOT_ID = "__ann_root";
  const COLORS = { pass: "#22C55E", fail: "#EF4444", check: "#F59E0B", frame: "#E11D48", target: "#DC2626" };
  const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

  function statusOf(ok) {
    if (ok === false) return { label: "FAIL", color: COLORS.fail };
    if (ok === null || ok === undefined) return { label: "CHECK", color: COLORS.check };
    return { label: "PASS", color: COLORS.pass };
  }

  function root() {
    let r = document.getElementById(ROOT_ID);
    if (!r) {
      r = document.createElement("div");
      r.id = ROOT_ID;
      r.setAttribute("aria-hidden", "true");
      r.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:" + FONT + ";";
      document.documentElement.appendChild(r);
    }
    return r;
  }

  /** Remove every overlay; the page's own styles were never touched. */
  function clear() {
    document.getElementById(ROOT_ID)?.remove();
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const show = (v) => (v === null || v === undefined ? String(v) : typeof v === "object" ? JSON.stringify(v) : String(v));

  /**
   * The caption is a template written by the model (<b>, <code> allowed) with
   * ${name} placeholders for values read from the app. The values are escaped
   * on the way in, so a record name containing "<script>" is a record name
   * containing "<script>" — the template's markup stays, the app's does not.
   */
  function render(template, values) {
    const dig = (v, p) => p.split(".").filter(Boolean).reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), v);
    return String(template || "").replace(/\$\{([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+)*)\}/g, (m, k, p) => (values && k in values ? esc(show(dig(values[k], p || ""))) : m));
  }

  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") return null;
    return r;
  }

  function frame(rect, { color = COLORS.frame, width = 3, label = null } = {}) {
    const box = document.createElement("div");
    box.className = "__ann_frame";
    box.style.cssText =
      "position:fixed;box-sizing:border-box;pointer-events:none;border:" + width + "px solid " + color + ";" +
      "border-radius:4px;box-shadow:0 0 0 2px rgba(255,255,255,.85), inset 0 0 0 2px rgba(255,255,255,.85);" +
      "left:" + (rect.left - width - 2) + "px;top:" + (rect.top - width - 2) + "px;" +
      "width:" + (rect.width + 2 * (width + 2)) + "px;height:" + (rect.height + 2 * (width + 2)) + "px;";
    root().appendChild(box);
    if (label) {
      const tag = document.createElement("div");
      tag.className = "__ann_frame_label";
      tag.textContent = label;
      tag.style.cssText =
        "position:fixed;pointer-events:none;background:" + color + ";color:#fff;font:700 13px/1.2 " + FONT + ";" +
        "padding:3px 8px;border-radius:5px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;";
      // Above the frame; below it when there is no room above.
      const top = rect.top - width - 2 - 24;
      tag.style.left = Math.max(4, rect.left - width - 2) + "px";
      tag.style.top = (top >= 2 ? top : rect.bottom + width + 6) + "px";
      root().appendChild(tag);
    }
    return box;
  }

  /** Outline every element a selector matches; returns the selectors that matched nothing. */
  function highlight(selectors, opts) {
    const missing = [];
    let first = null;
    for (const selector of selectors) {
      let els = [];
      try { els = [...document.querySelectorAll(selector)]; } catch { missing.push(selector); continue; }
      const rects = els.map(visibleRect).filter(Boolean);
      if (!rects.length) { missing.push(selector); continue; }
      rects.forEach((r, i) => { const f = frame(r, i === 0 ? opts : { color: opts.color, width: opts.width }); if (!first) first = r; void f; });
    }
    return { missing, first };
  }

  function pin([selector, text, dx = 0, dy = 0]) {
    let el = null;
    try { el = document.querySelector(selector); } catch { /* bad selector */ }
    if (!el) return selector;
    const rect = el.getBoundingClientRect();
    const label = document.createElement("div");
    label.className = "__ann_pin";
    label.textContent = text;
    label.style.cssText =
      "position:fixed;pointer-events:none;background:#FDE047;color:#111;" +
      "font:600 14px/1.3 " + FONT + ";padding:4px 8px;border-radius:6px;" +
      "border:1px solid #A16207;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:320px;";
    let left = rect.right + 8 + dx;
    if (left > window.innerWidth - 240) left = Math.max(4, rect.left - 250);
    label.style.left = left + "px";
    label.style.top = Math.max(2, rect.top - 2 + dy) + "px";
    root().appendChild(label);
    return null;
  }

  window.__annClear = clear;

  /**
   * @param {object}   o
   * @param {string}   o.n       scenario number, e.g. "07", zero-padded like the file name
   * @param {string}   o.t       short title: what this scenario tests
   * @param {string}   o.d       caption template; inline HTML allowed, ${name} filled from o.v
   * @param {object}   o.v       values read from the app, escaped when substituted
   * @param {boolean|null} o.ok  true PASS / false FAIL / null CHECK
   * @param {string|object} o.target  the element or region that proves the result: a selector,
   *                           { selector, label? }, or { none: "why nothing on screen proves it" }
   * @param {string[]} o.hl     further selectors to outline in red
   * @param {Array}    o.pins   [selector, text, dx?, dy?] callouts
   * @param {boolean}  o.top    force the card to the top; by default it moves there on its own
   *                           when the bottom-left corner would cover the target
   * @returns {{ tag: string, missing: string[] }}  selectors (target first) that matched nothing
   */
  window.__ann = function (o) {
    clear();
    const { label, color } = statusOf(o.ok);
    const missing = [];
    let targetRect = null;
    const t = o.target;
    if (typeof t === "string" || (t && typeof t === "object" && t.selector)) {
      const sel = typeof t === "string" ? t : t.selector;
      const r = highlight([sel], { color: COLORS.target, width: 3, label: (t && t.label) || "evidence" });
      if (r.missing.length) missing.push(sel);
      targetRect = r.first;
    }
    missing.push(...highlight(o.hl || [], { color: COLORS.frame, width: 3 }).missing);
    for (const p of o.pins || []) { const m = pin(p); if (m) missing.push(m); }

    const card = document.createElement("div");
    card.id = "__ann_card";
    card.style.cssText =
      "position:absolute;pointer-events:none;left:16px;max-width:720px;background:rgba(17,24,39,.96);color:#fff;" +
      "font:15px/1.45 " + FONT + ";padding:14px 16px;border-radius:10px;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.35);border-left:6px solid " + color;
    const head = document.createElement("div");
    head.style.cssText = "display:flex;gap:10px;align-items:center;margin-bottom:8px";
    const badge = document.createElement("span");
    badge.style.cssText = "background:#3B529F;padding:3px 9px;border-radius:6px;font-weight:700;letter-spacing:.5px;white-space:nowrap";
    badge.textContent = "SC " + o.n;
    const title = document.createElement("span");
    title.style.fontWeight = "700";
    title.textContent = o.t || "";
    const status = document.createElement("span");
    status.style.cssText = "margin-left:auto;background:" + color + ";color:#06210f;padding:3px 9px;border-radius:6px;font-weight:800;white-space:nowrap";
    status.textContent = label;
    head.append(badge, title, status);
    const body = document.createElement("div");
    body.style.opacity = ".94";
    body.innerHTML = render(o.d, o.v);
    card.append(head, body);
    if (missing.length) {
      const warn = document.createElement("div");
      warn.style.cssText = "margin-top:8px;color:#FCA5A5;font-size:13px";
      warn.textContent = "⚠ no element matched: " + missing.join(", ");
      card.appendChild(warn);
    } else if (t && typeof t === "object" && t.none) {
      const note = document.createElement("div");
      note.style.cssText = "margin-top:8px;color:#CBD5E1;font-size:13px";
      note.textContent = "no visual target: " + t.none;
      card.appendChild(note);
    }
    root().appendChild(card);

    // Bottom-left unless that would cover the evidence, or o.top says top.
    const h = card.getBoundingClientRect().height;
    const bottomTop = window.innerHeight - 16 - h;
    const covers = targetRect && targetRect.bottom > bottomTop - 8 && targetRect.left < 16 + card.getBoundingClientRect().width + 8;
    const atTop = o.top === true || (o.top !== false && covers);
    card.style.top = (atTop ? 16 : Math.max(8, bottomTop)) + "px";

    return { tag: "ann:" + o.n + ":" + label, missing };
  };

  /**
   * The screenshot the computer tool returns is usually smaller than the CSS
   * viewport; pass the width the last screenshot reported and this returns the
   * element's centre in that coordinate space.
   */
  window.__at = function (selector, shotWidth) {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = shotWidth / window.innerWidth;
    return { x: Math.round((r.x + r.width / 2) * s), y: Math.round((r.y + r.height / 2) * s) };
  };

  return "annotate-ready";
})();
