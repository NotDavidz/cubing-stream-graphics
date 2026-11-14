// Building blocks every tab of the control panel uses.
//
// The panel works on two conventions:
//   - an input with data-path="some.state.path" is saved when it changes
//   - a button (or select) with data-act="name" runs that action
// The helpers below produce that markup, so a tab is mostly a list of them.

import { getPath } from "../shared/store.js";
import { esc, puzzleName } from "../shared/ui.js";
import { PUZZLES } from "../shared/puzzles.js";

// The latest state. Importers always see the current value.
export let S = null;
export function setState(next) { S = next; }

// Tabs call redraw() after changing something that is not in the state
// (which scene's controls are open, for example).
let redrawFn = () => {};
export const redraw = () => redrawFn();
export function onRedraw(fn) { redrawFn = fn; }

// ---------- Markup ----------

export const val = (path) => getPath(S, path) ?? "";

export const field = (label, path, attrs = "") =>
  `<label>${label}<input data-path="${esc(path)}" value="${esc(val(path))}" ${attrs}></label>`;

export const number = (label, path, attrs = "") =>
  field(label, path, `type="number" data-type="number" min="0" ${attrs}`);

// options = [[value, text]]; "— choose —" is shown while nothing matches.
export function optionList(options, current) {
  current = String(current ?? "");
  const missing = options.some(([v]) => String(v) === current) ? "" : `<option value="" selected disabled>— choose —</option>`;
  return missing + options.map(([v, t]) =>
    `<option value="${esc(v)}" ${current === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("");
}

export const select = (label, path, options, attrs = "") =>
  `<label>${label}<select data-path="${esc(path)}" ${attrs}>${optionList(options, val(path))}</select></label>`;

// A select that runs an action instead of saving to a path.
export const picker = (label, act, arg, options, current) =>
  `<label>${label}<select data-act="${act}" data-arg="${esc(arg)}">${optionList(options, current)}</select></label>`;

export const btn = (text, act, arg = "", cls = "", attrs = "") =>
  `<button data-act="${act}" data-arg="${esc(arg)}" class="${cls}" ${attrs}>${text}</button>`;

// One-of-several switch that saves straight to a state path.
//   seg("Format", "bracket.format", [["single", "Single"], ["double", "Double"]])
export function seg(label, path, options, fallback) {
  const current = getPath(S, path) ?? fallback;
  return `<div class="switch"><span>${label}</span><div class="seg">${options.map(([v, t]) =>
    btn(esc(t), "set", `${path}=${JSON.stringify(v)}`, v === current ? "on" : "")).join("")}</div></div>`;
}

// The same look, for a switch that needs an action of its own.
export const segAct = (label, act, options, current) =>
  `<div class="switch"><span>${label}</span><div class="seg">${options.map(([v, t]) =>
    btn(esc(t), act, v, v === current ? "on" : "")).join("")}</div></div>`;

export const box = (title, body, cls = "") => `<section class="box ${cls}"><h2>${title}</h2>${body}</section>`;
export const row = (...parts) => `<div class="r">${parts.join("")}</div>`;
export const hint = (text) => `<p class="hint">${text}</p>`;

// A collapsible entry (one person, one team). Which ones are open is
// remembered here so they stay open while the panel redraws.
export const opened = new Set();
export const fold = (key, title, note, body) => `<details data-fold="${esc(key)}" ${opened.has(key) ? "open" : ""}>
    <summary><b>${esc(title)}</b><span>${esc(note)}</span></summary>${body}</details>`;

// ---------- Looking things up ----------

export const puzzleOptions = () => Object.keys(PUZZLES).map((id) => [id, puzzleName(id)]);
export const people = () => Object.entries(S.competitors || {});
export const teams = () => Object.entries(S.teams || {});
export const nameOf = (id) => S.teams?.[id]?.name || S.competitors?.[id]?.name || "—";
export const newId = (prefix) => prefix + Date.now().toString(36);

// A match is team v team or player v player, never a mix (Settings > Match).
export const matchMode = () => S.match?.mode || (S.competitors?.[S.match?.a] ? "solo" : "team");
export const sideOptions = () => (matchMode() === "solo" ? people() : teams()).map(([id, x]) => [id, x.name]);

// The team or competitor with this exact name (brackets store names, not ids).
export function idByName(name) {
  const wanted = String(name || "").trim().toLowerCase();
  return [...teams(), ...people()].find(([, x]) => String(x.name).trim().toLowerCase() === wanted)?.[0] || "";
}
