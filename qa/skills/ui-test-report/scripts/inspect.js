/*
 * Page inventory for writing scenarios: what can be clicked, filled or chosen,
 * what the tables hold, which dialog is open. Evaluated by run-scenarios.mjs
 * --inspect; the whole file is one expression so page.evaluate can take it.
 * Read it and paste it into javascript_tool to get the same picture through
 * the Chrome extension.
 *
 * The point is to write selectors and expected values from what the page
 * actually has — option values, header names, the ids in the rows — instead
 * of guessing them and fixing forty scenarios one error at a time.
 */
(() => {
  const CONTROLS = "a[href], button, input, select, textarea, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=option], [contenteditable=true]";
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const text = (el) => ((el && (el.innerText || el.textContent)) || "").trim().replace(/\s+/g, " ").slice(0, 60);
  // A <label> wrapping a <select> has the options in its text; drop the controls first.
  const labelText = (label) => {
    const copy = label.cloneNode(true);
    copy.querySelectorAll("input, select, textarea, button").forEach((c) => c.remove());
    return text(copy);
  };
  const nameOf = (el) =>
    el.getAttribute("aria-label") ||
    (el.labels && el.labels[0] && labelText(el.labels[0])) ||
    el.getAttribute("placeholder") ||
    el.getAttribute("title") ||
    (el.tagName === "SELECT" ? "" : text(el)) ||
    el.getAttribute("name") ||
    "";
  const roleOf = (el) =>
    el.getAttribute("role") ||
    { A: "link", BUTTON: "button", SELECT: "combobox", TEXTAREA: "textbox" }[el.tagName] ||
    (el.tagName === "INPUT" ? { checkbox: "checkbox", radio: "radio", submit: "button", button: "button" }[el.type] || "textbox" : el.tagName.toLowerCase());
  const sel = (el) => (el.id ? "#" + CSS.escape(el.id) : el.dataset && el.dataset.testid ? `[data-testid="${el.dataset.testid}"]` : null);
  const control = (el) => {
    const o = { role: roleOf(el), name: nameOf(el) };
    const s = sel(el);
    if (s) o.selector = s;
    if (el.tagName === "INPUT" && el.type && el.type !== "text") o.type = el.type;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") o.disabled = true;
    if (typeof el.checked === "boolean" && (el.type === "checkbox" || el.type === "radio")) o.checked = el.checked;
    if ((el.tagName === "INPUT" && el.type !== "password" && el.type !== "checkbox" && el.type !== "radio") || el.tagName === "TEXTAREA") o.value = String(el.value).slice(0, 60);
    return o;
  };
  const all = [...document.querySelectorAll(CONTROLS)];
  const shown = all.filter(visible);
  const dialogs = [...document.querySelectorAll("[role=dialog], [aria-modal=true], dialog[open]")].filter(visible).map((d) => ({
    selector: sel(d),
    name: d.getAttribute("aria-label") || text(d.querySelector("h1, h2, h3")) || "",
    controls: [...d.querySelectorAll(CONTROLS)].filter(visible).slice(0, 40).map(control),
  }));
  const selects = [...document.querySelectorAll("select")].filter(visible).map((el) => ({
    selector: sel(el) || (el.name ? `select[name="${el.name}"]` : "select"),
    name: nameOf(el),
    value: el.value,
    options: [...el.options].slice(0, 50).map((o) => ({ value: o.value, text: text(o) })),
  }));
  const tables = [...document.querySelectorAll("table")].filter(visible).map((t) => {
    const rows = [...t.querySelectorAll("tbody tr")];
    return {
      selector: sel(t),
      headers: [...t.querySelectorAll("thead th, thead td")].map(text),
      rows: rows.length,
      first: rows.slice(0, 5).map((r) => [...r.cells].map(text)),
    };
  });
  return {
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll("h1, h2, h3")].filter(visible).slice(0, 20).map(text),
    dialogs,
    controls: shown.slice(0, 200).map(control),
    selects,
    tables,
    counts: { controls: all.length, visible: shown.length },
  };
})()
