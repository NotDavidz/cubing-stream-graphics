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

// Footer bar: big gold text | white rule | two small white lines.
export function infobar(big, line1, line2) {
  return `<div class="row">
      <div class="big" data-fit="line">${esc(big)}</div>
      <div class="rule"></div>
      <div class="small"><b>${esc(line1)}</b>${esc(line2)}</div>
    </div>
    <div class="strip"></div>`;
}

// "Best of 5", worked out from the match unless the operator typed their own
// wording under Settings. A typed "Best of N" is treated as left over from
// an earlier match, so it can never disagree with the score.
export function formatLabel(state) {
  const typed = String(state.event?.format || "").trim();
  return typed && !/^best of \d+$/i.test(typed) ? typed : `Best of ${Math.max(1, Number(state.match?.bestOf) || 1)}`;
}

// The default footer most solid frames use.
export function eventInfobar(state) {
  const e = state.event || {};
  return infobar(e.title || "", [e.round, puzzleName(e.puzzle, true)].filter(Boolean).join(" · "),
    [formatLabel(state), e.location].filter(Boolean).join(" · "));
}

export { puzzleIcon, puzzleName };
