// Helpers shared by every frame: canvas scaling, URL options, and the small
// pieces of markup (banner, info bar, avatar, puzzle icon) that repeat.

import { puzzleIcon, puzzleName } from "./puzzles.js";

export const params = new URLSearchParams(location.search);
export const LOGO = new URL("../assets/logo.png", import.meta.url).href;

const KEY_COLOURS = { green: "#00ff00", magenta: "#ff00ff", blue: "#0000ff" };

// Fit the 1920x1080 canvas to whatever window it is shown in, and apply the
// URL options every frame understands:
//   ?bg=green|magenta|blue   chroma colour behind/through the frame (post editing)
//   ?bg=none                 solid frames: drop the patterned background
//   ?still=1                 no animation (for exporting stills)
export function initStage() {
  const stage = document.querySelector(".stage");
  const bg = params.get("bg");
  if (KEY_COLOURS[bg]) {
    document.documentElement.style.setProperty("--key", KEY_COLOURS[bg]);
    if (!stage.classList.contains("solid")) document.body.style.background = KEY_COLOURS[bg];
  }
  if (bg === "none") stage.classList.add("no-bg");
  if (params.has("still")) document.body.classList.add("still");

  const fit = () => {
    const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * scale) / 2}px, ${(innerHeight - 1080 * scale) / 2}px) scale(${scale})`;
    // In a browser window that is not 16:9, fill the spare space with black.
    const exact = Math.abs(innerWidth / innerHeight - 16 / 9) < 0.01;
    document.body.classList.toggle("letterbox", !exact && stage.classList.contains("solid") && bg !== "none");
  };
  addEventListener("resize", fit);
  fit();
  return stage;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Replace an element's contents only when they changed, so animations do not
// restart every time some unrelated part of the state is edited.
//
// Inside the markup, give a value that should "pop" when it changes
// data-k="a-name" data-v="its value". Only the values that really changed
// animate; everything else redraws silently.
export function paint(target, html) {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el || el.__html === html) return;
  const first = el.__html === undefined;
  const before = new Map([...el.querySelectorAll("[data-k]")].map((n) => [n.dataset.k, n.dataset.v]));
  el.innerHTML = html;
  el.__html = html;
  if (!first) {
    for (const n of el.querySelectorAll("[data-k]")) {
      if (before.get(n.dataset.k) !== n.dataset.v) n.classList.add("pop");
    }
  }
  fit(el);
}

// Shrink text marked data-fit until it fits the width of its box.
//   data-fit="line"  one line, never wraps
//   data-fit="wrap"  may wrap; shrinks only if a single word is too long
export function fit(root = document) {
  for (const el of root.querySelectorAll("[data-fit]")) {
    el.style.fontSize = "";
    const base = parseFloat(getComputedStyle(el).fontSize);
    let size = base;
    while (el.scrollWidth > el.clientWidth + 1 && size > base * 0.4) {
      size *= 0.95;
      el.style.fontSize = `${size}px`;
    }
  }
}
document.fonts?.ready.then(() => fit());   // measure again once Poppins has loaded

// ---------- Looking things up in the state ----------

// A "side" of a match can be a team or a single competitor.
export function entity(state, id) {
  const team = state.teams?.[id];
  if (team) {
    return {
      kind: "team", id, name: team.name, tag: team.tag || "", photo: team.logo || "",
      detail: team.motto || "",
      members: (team.members || []).map((m) => state.competitors?.[m]).filter(Boolean),
    };
  }
  const person = state.competitors?.[id];
  if (person) {
    const own = Object.values(state.teams || {}).find((t) => (t.members || []).includes(id));
    return {
      kind: "person", id, name: person.name, tag: "", photo: person.photo || "",
      detail: person.wcaId || "", team: own?.name || "", members: [],
    };
  }
  return { kind: "none", id, name: "TBD", tag: "", photo: "", detail: "", members: [] };
}

// Which competitor or team a page shows right now (kind = "competitor" or
// "team"). Normally the one the operator picked. With auto-scroll on, the
// pages step through everyone in roster order, starting from that pick. The
// step is worked out from the clock, so every screen changes together and
// nothing has to be sent each time.
//   state.program.cycle[kind] = { seconds: 8, since: <time it was switched on> }
export function shownId(state, kind, now = Date.now()) {
  const chosen = state.program?.[kind];
  const ids = Object.keys((kind === "team" ? state.teams : state.competitors) || {});
  const cycle = state.program?.cycle?.[kind];
  const seconds = Number(cycle?.seconds) || 0;
  if (!seconds || ids.length < 2) return chosen;
  const steps = Math.max(0, Math.floor((now - (Number(cycle.since) || 0)) / (seconds * 1000)));
  return ids[(Math.max(0, ids.indexOf(chosen)) + steps) % ids.length];
}

export function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
}

// A label for tight spaces: the tag, a short name as it is, else initials.
export function shortName(thing) {
  return thing.tag || (String(thing.name).length <= 12 ? thing.name : initials(thing.name));
}

// ---------- Markup ----------

// Photos may be a full URL or a path inside this project ("assets/photos/x.jpg").
export function asset(path) {
  return /^(https?:|data:|\/)/.test(path) ? path : new URL(`../${path}`, import.meta.url).href;
}

export function avatar(thing, size = 120, cls = "") {
  const inner = thing.photo
    ? `<img src="${esc(asset(thing.photo))}" alt="">`
    : esc(thing.tag || initials(thing.name));
  return `<div class="avatar ${cls}" style="width:${size}px;font-size:${Math.round(size * 0.36)}px">${inner}</div>`;
}

export function puzzle(id, size = 80, cls = "") {
  return `<span class="puzzle ${cls}" style="width:${size}px;height:${size}px">${puzzleIcon(id)}</span>`;
}

export function banner(title, subtitle = "") {
  return `<img class="logo" src="${LOGO}" alt="">
    <div class="strip"></div>
    <div class="bar"><span data-fit="line">${esc(title)}</span></div>
    ${subtitle ? `<div class="subbar"><span data-fit="line">${esc(subtitle)}</span></div>` : ""}`;
}

// Markup for falling confetti (styled in theme.css). The pieces are placed
// from a fixed sequence, not Math.random, so every screen showing a frame
// looks the same, and the markup is identical each time it is asked for.
const COLOURS = ["#fae203", "#ecc13c", "#eae6a3", "#c8961e"];
const CONFETTI = `<div class="confetti">${Array.from({ length: 46 }, (_, i) => {
  const spread = (i * 0.618034) % 1, other = (i * 0.414214) % 1;
  return `<i style="left:${(spread * 100).toFixed(1)}%;--s:${8 + Math.round(other * 12)}px;--c:${COLOURS[i % 4]};` +
    `--t:${(4.5 + other * 4).toFixed(2)}s;--d:${(-spread * 8 + (i % 3)).toFixed(2)}s;--r:${i % 2 ? 320 : -280}deg"></i>`;
}).join("")}</div>`;
export const confetti = () => CONFETTI;

// Footer bar: one line of big gold text over the pale strip.
export function infobar(big, cls = "") {
  return `<div class="row">
      <div class="big ${cls}" data-fit="line">${esc(big)}</div>
    </div>
    <div class="strip"></div>`;
}

// The default footer most solid frames use: the event name. With the footer
// strip switched on (Settings > Footer strip) it takes turns with the extra
// lines typed there. Which line is up is worked out from the clock, so every
// screen changes together.
//   state.settings.ticker = { on: true, seconds: 10, lines: ["...", "..."] }
function footerLine(state) {
  const title = state.event?.title || "";
  const ticker = state.settings?.ticker;
  const lines = ticker?.on ? [title, ...(ticker.lines || [])].filter(Boolean) : [];
  if (lines.length < 2) return { text: title, cls: "" };
  const step = Math.max(3, Number(ticker.seconds) || 10) * 1000;
  return { text: lines[Math.floor(Date.now() / step) % lines.length], cls: "turn" };
}

let footerState = null, footerTimer = 0;
export function eventInfobar(state) {
  footerState = state;
  // A page that draws this footer keeps it turning by itself from then on.
  footerTimer ||= params.has("still") ? 1 : setInterval(() => paint(".infobar", eventInfobar(footerState)), 500);
  const { text, cls } = footerLine(state);
  return infobar(text, cls);
}

export { puzzleIcon, puzzleName };
