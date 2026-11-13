// Operator control panel: the wiring.
//
// Each tab lives in its own file under tabs/ and exports
//   { id, title, render(), actions, top()?, preview()? }
// render() returns the HTML of the tab; actions are the functions its
// buttons run (data-act="name"). To add a tab, write the file and add it to
// TABS below. The markup helpers are in kit.js.

import { store } from "../shared/store.js";
import { S, setState, onRedraw, opened } from "./kit.js";
import live from "./tabs/live.js";
import bracket from "./tabs/bracket.js";
import people from "./tabs/people.js";
import settings from "./tabs/settings.js";
import links from "./tabs/links.js";

const TABS = [live, bracket, people, settings, links];

const ACTIONS = {
  // data-arg='some.path=<json>' saves that value. Used by every switch.
  set(arg) {
    const at = arg.indexOf("=");
    store.set(arg.slice(0, at), JSON.parse(arg.slice(at + 1)));
  },
};
for (const tab of TABS) {
  for (const [name, fn] of Object.entries(tab.actions || {})) {
    if (ACTIONS[name]) console.warn(`Two tabs define the action "${name}"; the one in "${tab.id}" wins.`);
    ACTIONS[name] = fn;
  }
}

const $ = (sel) => document.querySelector(sel);
const app = $("#app"), top = $("#top"), onair = $("#onair");
const frame = $("#preview iframe");
let tabId = location.hash.slice(1) || TABS[0].id;

// ---------- Saving and actions ----------

function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.dataset.type === "number") return Number(el.value) || 0;
  if (el.dataset.type === "lines") return el.value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (el.dataset.type === "csv") return el.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return el.value;
}

const run = (el) => ACTIONS[el.dataset.act]?.(el.dataset.arg, el);

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.act) return run(el);
  if (el.dataset.path) store.set(el.dataset.path, readInput(el));
});

document.addEventListener("click", (e) => {
  const tab = e.target.closest("button[data-tab]");
  if (tab) { tabId = tab.dataset.tab; location.hash = tabId; return render(); }
  const el = e.target.closest("button[data-act]");
  if (el) run(el);
});

// Enter in a text field saves it straight away.
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input[data-path]")) e.target.blur();
});

// <details> does not bubble its toggle event, so listen on the way down.
app.addEventListener("toggle", (e) => {
  const key = e.target.dataset?.fold;
  if (key) opened[e.target.open ? "add" : "delete"](key);
}, true);

// ---------- Drawing ----------

// Redraw the tab, keeping the cursor where it was if a field is being edited.
function render() {
  if (!S) return;
  const tab = TABS.find((t) => t.id === tabId) || TABS[0];
  tabId = tab.id;

  const active = document.activeElement;
  const key = active?.dataset?.path;
  const keep = key && { value: active.value, start: active.selectionStart, end: active.selectionEnd };
  const button = active?.tagName === "BUTTON" && active.dataset.act
    ? `button[data-act="${active.dataset.act}"][data-arg="${CSS.escape(active.dataset.arg || "")}"]` : "";

  $("#tabs").innerHTML = TABS.map((t) =>
    `<button data-tab="${t.id}" class="${t.id === tabId ? "on" : ""}">${t.title}</button>`).join("");
  $("#conn").textContent = store.online ? "Connected" : "No server: this browser only";
  $("#conn").classList.toggle("off", !store.online);

  onair.hidden = !tab.top;
  top.innerHTML = tab.top?.() || "";
  app.innerHTML = tab.render();
  showPreview(tab.preview?.());

  if (keep) {
    const el = document.querySelector(`[data-path="${CSS.escape(key)}"]`);
    if (el && el.type !== "checkbox") {
      el.focus();
      if (el.tagName !== "SELECT") {
        el.value = keep.value;
        try { el.setSelectionRange(keep.start, keep.end); } catch { /* number inputs */ }
      }
    }
  }
  if (button) document.querySelector(button)?.focus();
}

// The preview is a real frame, so it is only reloaded when it has to show
// something else. Leaving the tab unloads it.
function showPreview(view) {
  const src = view ? new URL(view.src, location.href).href : "about:blank";
  if (frame.dataset.src !== src) {
    frame.dataset.src = src;
    frame.src = src;
  }
  $("#preview").classList.toggle("live", Boolean(view?.live));
  $("#preview .cap").textContent = view?.caption || "";
}

// Drawn on the next tick so that, when you Tab out of a field, the focus has
// already landed on the next field and can be kept there.
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; render(); }, 0);
}

onRedraw(schedule);
store.subscribe((state) => { setState(state); schedule(); });
