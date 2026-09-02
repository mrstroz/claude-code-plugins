/*
 * Screenshot annotation overlay for browser QA runs.
 *
 * This file is not executed locally. Read it and paste its contents into
 * mcp__claude-in-chrome__javascript_tool — the Chrome MCP has no other way to
 * load a file into the page. Re-inject after any full reload; the page context
 * is thrown away along with everything defined on it.
 *
 * Defines two globals:
 *   __ann(opts)              draws the caption card, outlines and callouts
 *   __at(selector, shotW)    converts an element's centre into screenshot pixels
 */
(() => {
  const CARD_ID = "__ann_card";
  const PIN_CLASS = "__ann_pin";
  const HL_ATTR = "data-ann-hl";

  const COLORS = { pass: "#22C55E", fail: "#EF4444", check: "#F59E0B" };

  function statusOf(ok) {
    if (ok === false) return { label: "FAIL", color: COLORS.fail };
    if (ok === null || ok === undefined) return { label: "CHECK", color: COLORS.check };
    return { label: "PASS", color: COLORS.pass };
  }

  function clear() {
    document.getElementById(CARD_ID)?.remove();
    document.querySelectorAll("." + PIN_CLASS).forEach((el) => el.remove());
    document.querySelectorAll("[" + HL_ATTR + "]").forEach((el) => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.removeAttribute(HL_ATTR);
    });
  }

  function highlight(selectors) {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.outline = "3px solid #E11D48";
        el.style.outlineOffset = "2px";
        el.setAttribute(HL_ATTR, "1");
      });
    });
  }

  function pin([selector, text, dx = 0, dy = 0]) {
    const el = document.querySelector(selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const label = document.createElement("div");
    label.className = PIN_CLASS;
    label.textContent = text;
    label.style.cssText =
      "position:fixed;z-index:2147483646;background:#FDE047;color:#111;" +
      "font:600 12px/1.3 Inter,system-ui,sans-serif;padding:3px 7px;border-radius:6px;" +
      "border:1px solid #A16207;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:300px;";
    // Default to the right of the element; flip left when that would run off screen.
    let left = rect.right + 8 + dx;
    if (left > window.innerWidth - 220) left = Math.max(4, rect.left - 230);
    label.style.left = left + "px";
    label.style.top = Math.max(2, rect.top - 2 + dy) + "px";
    document.body.appendChild(label);
  }

  /**
   * @param {object}   o
   * @param {string}   o.n     scenario number, e.g. "07" — keep it zero-padded so it
   *                           sorts the same way the screenshot files do
   * @param {string}   o.t     short title: what this scenario tests
   * @param {string}   o.d     one or two sentences of detail; inline HTML is allowed
   * @param {boolean|null} o.ok  true PASS / false FAIL / null CHECK (not verifiable)
   * @param {boolean}  o.top   put the card at the top when the bottom of the screen
   *                           is part of what the scenario is showing
   * @param {string[]} o.hl    selectors to outline in red
   * @param {Array}    o.pins  [selector, text, dx?, dy?] callouts
   */
  window.__ann = function (o) {
    clear();
    const { label, color } = statusOf(o.ok);
    highlight(o.hl || []);
    (o.pins || []).forEach(pin);

    const card = document.createElement("div");
    card.id = CARD_ID;
    card.style.cssText =
      "position:fixed;z-index:2147483647;left:16px;" +
      (o.top ? "top:16px;" : "bottom:16px;") +
      "max-width:680px;background:rgba(17,24,39,.96);color:#fff;" +
      "font:13px/1.5 Inter,system-ui,sans-serif;padding:12px 14px;border-radius:10px;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.35);border-left:5px solid " + color;
    // Header parts carry no markup, so build them as text nodes — a scenario
    // title containing "<" should read as "<", not disappear into a tag.
    const head = document.createElement("div");
    head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:6px";
    const badge = document.createElement("span");
    badge.style.cssText =
      "background:#3B529F;padding:2px 8px;border-radius:6px;font-weight:700;letter-spacing:.5px";
    badge.textContent = "SC " + o.n;
    const title = document.createElement("span");
    title.style.fontWeight = "700";
    title.textContent = o.t;
    const status = document.createElement("span");
    status.style.cssText =
      "margin-left:auto;background:" +
      color +
      ";color:#06210f;padding:2px 8px;border-radius:6px;font-weight:800";
    status.textContent = label;
    head.append(badge, title, status);

    // `d` is deliberately HTML: <b> around the value that decides pass/fail is
    // what makes the caption readable at thumbnail size. It is written by the
    // model running the test, not by the page under test.
    const body = document.createElement("div");
    body.style.opacity = ".92";
    body.innerHTML = o.d;

    card.append(head, body);
    document.body.appendChild(card);
    return "ann:" + o.n + ":" + label;
  };

  /**
   * The screenshot the computer tool returns is usually smaller than the CSS
   * viewport, so a getBoundingClientRect() value clicked verbatim lands in the
   * wrong place. Pass the width reported by the last screenshot and this returns
   * the element's centre in that same coordinate space.
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
