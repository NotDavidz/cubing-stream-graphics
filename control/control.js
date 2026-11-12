// Operator control panel.
//
// How it works: every input carries data-path="some.state.path" and is saved
// when it changes; every button carries data-act="actionName" and runs the
// matching function in ACTIONS. Each tab is one function that returns HTML.
// To add a control, add markup to a tab and (for buttons) an entry in ACTIONS.

import { store, getPath } from "../shared/store.js";
import { esc, puzzleIcon, puzzleName } from "../shared/ui.js";
import { PUZZLES } from "../shared/puzzles.js";
import { STATUSES } from "../shared/camera.js";
import { pickbanStatus, defaultSequence } from "../shared/pickban.js";
import { buildElimination, swissPair } from "../shared/bracket.js";

const app = document.querySelector("#app");
let S = null;                                  // latest state
let tab = location.hash.slice(1) || "live";

const SCENES = [
  ["intermission", "Intermission"], ["versus", "Versus"], ["pickban", "Pick & ban"], ["bracket", "Bracket"],
  ["competitor", "Competitor"], ["team", "Team"], ["cam-versus", "Cameras: head to head"],
  ["cam-solo", "Camera: single"], ["scorebug", "Score bug only"],
];

const FRAMES = [
  ["program.html", "Program", "Shows whatever is chosen under \"On screen now\""],
  ["versus.html", "Versus", "Solid"], ["pickban.html", "Pick & ban", "Solid"], ["bracket.html", "Bracket", "Solid"],
  ["competitor.html", "Competitor", "Solid. Add ?id=c1 to pin one person"],
  ["team.html", "Team", "Solid. Add ?id=t1 to pin one team"],
  ["intermission.html", "Intermission", "Solid"],
  ["cam-versus.html", "Cameras: head to head", "Hollow, two camera windows"],
  ["cam-solo.html?slot=a", "Camera A frame", "Hollow, full-size frame"],
  ["cam-solo.html?slot=b", "Camera B frame", "Hollow, full-size frame"],
  ["scorebug.html", "Score bug", "Hollow, score bar only. ?pos=bottom"],
];

// ---------- Small markup helpers ----------

const val = (path) => getPath(S, path) ?? "";
const field = (label, path, attrs = "") =>
  `<label>${label}<input data-path="${esc(path)}" value="${esc(val(path))}" ${attrs}></label>`;
const number = (label, path) => field(label, path, `type="number" data-type="number" min="0"`);
const select = (label, path, options, attrs = "") =>
  `<label>${label}<select data-path="${esc(path)}" ${attrs}>${options.map(([v, t]) =>
    `<option value="${esc(v)}" ${String(val(path)) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const btn = (text, act, arg = "", cls = "") =>
  `<button data-act="${act}" data-arg="${esc(arg)}" class="${cls}">${text}</button>`;
const box = (title, body, cls = "") => `<section class="box ${cls}"><h2>${title}</h2>${body}</section>`;

const puzzleOptions = () => Object.keys(PUZZLES).map((id) => [id, puzzleName(id)]);
const people = () => Object.entries(S.competitors || {});
const teams = () => Object.entries(S.teams || {});
const sideOptions = () => [...teams().map(([id, t]) => [id, `Team: ${t.name}`]), ...people().map(([id, p]) => [id, p.name])];
const nameOf = (id) => S.teams?.[id]?.name || S.competitors?.[id]?.name || "—";
const newId = (prefix) => prefix + Date.now().toString(36);

// ---------- Tabs ----------

const TABS = {
  live: ["Live", () => {
    const m = S.match || {};
    const cams = ["a", "b"].map((slot) => {
      const current = S.cameras?.[slot]?.status || "none";
      return box(`Camera ${slot.toUpperCase()}`, `
        <div class="r">${select("Competitor", `cameras.${slot}.competitor`, people().map(([id, p]) => [id, p.name]))}
          ${field("Time shown", `cameras.${slot}.time`, `placeholder="e.g. 8.14"`)}</div>
        <div class="r">${Object.entries(STATUSES).map(([id, st]) =>
          btn(st.button, "status", `${slot}:${id}`, `big ${id === current && id !== "none" ? (st.tone === "alert" ? "alert" : "on") : ""}`)).join("")}</div>`);
    }).join("");

    return box("On screen now", `
        <div class="r">${SCENES.map(([id, name]) => btn(name, "scene", id, S.program?.scene === id ? "on" : "")).join("")}</div>
        <p class="hint">Switches the <b>Program</b> source. Frames added to OBS on their own are not affected.</p>`, "wide")
      + box("Match score", `
        <div class="score">
          <div><div class="who">${esc(nameOf(m.a))}</div><div class="n">${esc(m.scoreA ?? 0)}</div>
            <div class="r" style="justify-content:center">${btn("−", "score", "scoreA:-1", "big")}${btn("+", "score", "scoreA:1", "big primary")}</div></div>
          <div>${btn("Swap", "swapSides")}<br><br>${btn("Reset", "resetScore")}</div>
          <div><div class="who">${esc(nameOf(m.b))}</div><div class="n">${esc(m.scoreB ?? 0)}</div>
            <div class="r" style="justify-content:center">${btn("−", "score", "scoreB:-1", "big")}${btn("+", "score", "scoreB:1", "big primary")}</div></div>
        </div>
        <div class="r">${select("Side A", "match.a", sideOptions())}${select("Side B", "match.b", sideOptions())}</div>
        <div class="r">${number("Best of", "match.bestOf")}
          <label class="check"><input type="checkbox" data-path="match.show" ${m.show !== false ? "checked" : ""}>Show score on camera frames</label></div>`)
      + cams
      + box("Clear camera status", `
        <div class="r"><label>After a +2 / DNF / win pops up<select id="autoclear">
          ${[[0, "Keep it until I press Clear"], [5, "Clear after 5 seconds"], [10, "Clear after 10 seconds"], [20, "Clear after 20 seconds"]]
            .map(([v, t]) => `<option value="${v}" ${autoClear() === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>`)
      + box("Event details", `
        <div class="r">${field("Event name", "event.title")}${field("Season / subtitle", "event.subtitle")}</div>
        <div class="r">${field("Round", "event.round")}${select("Puzzle", "event.puzzle", puzzleOptions())}</div>
        <div class="r">${field("Format", "event.format")}${field("Location", "event.location")}</div>`)
      + box("Intermission page", `
        <div class="r">${field("Title", "intermission.title")}${field("Countdown to", "intermission.countdownTo", `placeholder="18:00, or leave empty"`)}</div>
        ${field("Message", "intermission.message")}
        <div class="r">${["Starting Soon", "Be Right Back", "Thanks for Watching"].map((t) => btn(t, "interTitle", t)).join("")}</div>`);
  }],

  pickban: ["Pick & ban", () => {
    const pb = S.pickban || {};
    const status = pickbanStatus(pb);
    const sides = { a: nameOf(S.match?.a), b: nameOf(S.match?.b) };
    const next = status.next;
    return box("Pick & ban", `
        <p><b>${next ? `${esc(sides[next.side])} to ${next.type.toUpperCase()}` : `Locked in: ${status.playing.map((e) => esc(puzzleName(e, true))).join(", ")}`}</b>
          ${next ? " — click the puzzle they choose." : ""}</p>
        <div class="pool">${status.cards.map((c) =>
          `<button class="pz ${c.status}" data-act="pbChoose" data-arg="${esc(c.event)}" ${c.status === "open" ? "" : "disabled"}>
            <span class="puzzle">${puzzleIcon(c.event)}</span>${esc(puzzleName(c.event, true))}
            ${c.status === "open" ? "" : ` · ${c.status}${c.side ? " " + c.side.toUpperCase() : ""}`}</button>`).join("")}</div>
        <div class="r">${btn("Undo last", "pbUndo")}${btn("Start over", "pbReset")}${btn("Show pick & ban page", "scene", "pickban", "primary")}</div>`, "wide")
      + box("Puzzle pool", `
        <p class="hint">Tick 5 to 7 puzzles. Changing the pool restarts the pick & ban.</p>
        <div class="pool">${Object.keys(PUZZLES).map((id) =>
          `<label class="check"><input type="checkbox" data-act="pbPool" data-arg="${id}" ${(pb.pool || []).includes(id) ? "checked" : ""}>${esc(puzzleName(id, true))}</label>`).join("")}</div>`)
      + box("Turn order", `
        <p class="hint">Side and action for each turn, in order. Whatever is left untouched at the end is the decider.</p>
        ${field("Order", "pickban.sequence", `data-type="csv"`)}
        <div class="r">${btn("Standard order, A first", "pbSequence", "a")}${btn("Standard order, B first", "pbSequence", "b")}</div>`);
  }],

  bracket: ["Bracket", () => {
    const b = S.bracket || {};
    const setup = box("Bracket setup", `
        <div class="r">${select("Format", "bracket.format", [["single", "Single elimination"], ["double", "Double elimination"], ["swiss", "Swiss"]])}
          ${field("Page title", "bracket.title")}</div>
        <label>Entrants, one per line, best seed first
          <textarea data-path="bracket.entrants" data-type="lines">${esc((b.entrants || []).join("\n"))}</textarea></label>
        <div class="r">${btn("Use team names", "entrantsFrom", "teams")}${btn("Use competitor names", "entrantsFrom", "competitors")}
          ${btn("Clear all results", "bracketReset", "", "alert")}</div>
        <p class="hint">Changing entrants or format after results are in can move people around. Clear results if it looks wrong.</p>`);

    const row = (id, a, b2, base, won) => `<div class="m">
        <span class="id">${esc(id)}</span><span class="nm r2">${esc(a)}</span>
        <input data-path="${base}.sa" value="${esc(val(`${base}.sa`))}"><input data-path="${base}.sb" value="${esc(val(`${base}.sb`))}">
        <span class="nm">${esc(b2)}</span>
        <span class="r">${btn("A wins", "winner", `${base}:a`, won === "a" ? "on" : "")}${btn("B wins", "winner", `${base}:b`, won === "b" ? "on" : "")}</span>
      </div>`;

    let results;
    if (b.format === "swiss") {
      const rounds = b.swissRounds || [];
      results = box("Swiss rounds", `
        <div class="r">${btn("Pair next round", "swissNext", "", "primary")}${btn("Delete last round", "swissUndo")}</div>
        <p class="hint">Finish every match in a round before pairing the next one. The page shows the newest round.</p>
        ${rounds.map((round, r) => `<h3>Round ${r + 1}</h3>` + round.map((m, i) =>
          m.b ? row(`${r + 1}.${i + 1}`, m.a, m.b, `bracket.swissRounds.${r}.${i}`, m.winner)
              : `<div class="m"><span class="id">bye</span><span class="nm r2">${esc(m.a)}</span></div>`).join("")).reverse().join("")}`, "wide");
    } else {
      const built = buildElimination(b.format, b.entrants || [], b.results || {});
      results = box("Results", built.sections.map((sec) =>
        (sec.title ? `<h3>${esc(sec.title)}</h3>` : "") + sec.rounds.map((round) =>
          `<h3>${esc(round.title)}</h3>` + round.matches.map((m) =>
            m.a.bye || m.b.bye ? "" :
            m.a.pending || m.b.pending ? `<div class="m"><span class="id">${m.id}</span><span class="nm r2 hint">waiting</span></div>` :
            row(m.id, m.a.name, m.b.name, `bracket.results.${m.id}`, m.won)).join("")).join("")).join(""), "wide");
    }
    return setup + results;
  }],

  people: ["People & teams", () => {
    const person = ([id, p]) => `<div class="person">
        <div class="r">${field("Name", `competitors.${id}.name`)}${field("WCA ID", `competitors.${id}.wcaId`)}</div>
        <div class="r">${field("Program", `competitors.${id}.program`)}${select("Main event", `competitors.${id}.mainEvent`, puzzleOptions())}</div>
        <div class="r">${field("Photo (URL, or assets/photos/file.jpg)", `competitors.${id}.photo`)}${field("One-line bio", `competitors.${id}.bio`)}</div>
        ${Object.keys(p.events || {}).map((ev) => `<div class="r">
          <span style="width:110px;font-weight:700">${esc(puzzleName(ev, true))}</span>
          ${field("Single", `competitors.${id}.events.${ev}.single`)}${field("Average", `competitors.${id}.events.${ev}.average`)}
          ${btn("✕", "delPath", `competitors.${id}.events.${ev}`, "quiet")}</div>`).join("")}
        <div class="r">
          <select data-act="addEvent" data-arg="${id}" style="width:auto"><option value="">+ Add a puzzle…</option>
            ${puzzleOptions().filter(([ev]) => !p.events?.[ev]).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select>
          ${btn("Show on competitor page", "showCompetitor", id)}${btn("Delete person", "delPerson", id, "quiet")}</div>
      </div>`;
    const team = ([id, t]) => `<div class="person">
        <div class="r">${field("Team name", `teams.${id}.name`)}${field("Short tag", `teams.${id}.tag`, `maxlength="4"`)}${field("Record", `teams.${id}.record`)}</div>
        <div class="r">${field("Motto", `teams.${id}.motto`)}${field("Logo (URL or path)", `teams.${id}.logo`)}</div>
        <div class="pool">${people().map(([pid, p]) =>
          `<label class="check"><input type="checkbox" data-act="member" data-arg="${id}:${pid}" ${(t.members || []).includes(pid) ? "checked" : ""}>${esc(p.name)}</label>`).join("")}</div>
        <div class="r">${btn("Show on team page", "showTeam", id)}${btn("Delete team", "delPath", `teams.${id}`, "quiet")}</div>
      </div>`;
    return box("Teams", teams().map(team).join("") + `<div class="r">${btn("+ Add team", "addTeam", "", "primary")}</div>`)
      + box("Competitors", people().map(person).join("") + `<div class="r">${btn("+ Add competitor", "addPerson", "", "primary")}</div>`);
  }],

  setup: ["Setup & links", () => {
    const base = new URL("../frames/", location.href).href;
    return box("Frame links", `
        <p class="hint">In OBS: add a <b>Browser</b> source, paste a link, set width 1920 and height 1080. Hollow frames go above your camera sources.
          Add <code>?bg=green</code> for a chroma-key background in post editing (use <code>&amp;bg=green</code> if the link already has a <code>?</code>).</p>
        ${FRAMES.map(([file, name, note]) => `<div class="url"><b>${name}</b><code>${base}${file}</code>
          ${btn("Copy", "copy", base + file)}<a href="${base}${file}" target="_blank">Open</a></div><p class="hint">${note}</p>`).join("")}`, "wide")
      + box("Save and load", `
        <p class="hint">Everything you enter is saved automatically in <code>data/state.json</code>. Export a copy before an event, or to reuse a roster.</p>
        <div class="r">${btn("Export to file", "export", "", "primary")}<label>Import from file<input type="file" id="import" accept=".json"></label></div>
        <div class="r">${btn("Reset everything to the sample data", "resetAll", "", "alert")}</div>`);
  }],
};

// ---------- Actions ----------

const autoClear = () => Number(localStorage.getItem("uwcc-autoclear") || 0);
const clearTimers = {};

const ACTIONS = {
  scene: (id) => store.set("program.scene", id),
  score: (arg) => {
    const [key, delta] = arg.split(":");
    store.set(`match.${key}`, Math.max(0, (Number(S.match?.[key]) || 0) + Number(delta)));
  },
  resetScore: () => store.patch([{ path: "match.scoreA", value: 0 }, { path: "match.scoreB", value: 0 }]),
  swapSides: () => {
    const m = S.match || {};
    store.patch([{ path: "match.a", value: m.b }, { path: "match.b", value: m.a },
      { path: "match.scoreA", value: m.scoreB }, { path: "match.scoreB", value: m.scoreA }]);
  },
  status: (arg) => {
    const [slot, id] = arg.split(":");
    store.set(`cameras.${slot}.status`, id);
    clearTimeout(clearTimers[slot]);
    if (id !== "none" && autoClear()) {
      clearTimers[slot] = setTimeout(() => store.set(`cameras.${slot}.status`, "none"), autoClear() * 1000);
    }
  },
  interTitle: (title) => store.set("intermission.title", title),

  pbChoose: (event) => {
    const next = pickbanStatus(S.pickban).next;
    if (next) store.set("pickban.actions", [...(S.pickban.actions || []), { event, side: next.side, type: next.type }]);
  },
  pbUndo: () => store.set("pickban.actions", (S.pickban?.actions || []).slice(0, -1)),
  pbReset: () => store.set("pickban.actions", []),
  pbSequence: (first) => store.patch([
    { path: "pickban.sequence", value: defaultSequence((S.pickban?.pool || []).length, first) },
    { path: "pickban.actions", value: [] }]),
  pbPool: (id, el) => {
    const pool = Object.keys(PUZZLES).filter((p) => (p === id ? el.checked : (S.pickban?.pool || []).includes(p)));
    store.patch([{ path: "pickban.pool", value: pool },
      { path: "pickban.sequence", value: defaultSequence(pool.length) }, { path: "pickban.actions", value: [] }]);
  },

  winner: (arg) => {
    const [base, side] = arg.split(":");
    store.set(`${base}.winner`, getPath(S, `${base}.winner`) === side ? "" : side);
  },
  entrantsFrom: (kind) => store.set("bracket.entrants", Object.values(S[kind] || {}).map((x) => x.name)),
  bracketReset: () => confirm("Clear every bracket result?") &&
    store.patch([{ path: "bracket.results", value: {} }, { path: "bracket.swissRounds", value: [] }]),
  swissNext: () => store.set("bracket.swissRounds",
    [...(S.bracket.swissRounds || []), swissPair(S.bracket.entrants || [], S.bracket.swissRounds || [])]),
  swissUndo: () => confirm("Delete the newest Swiss round?") &&
    store.set("bracket.swissRounds", (S.bracket.swissRounds || []).slice(0, -1)),

  addPerson: () => store.set(`competitors.${newId("c")}`,
    { name: "New competitor", wcaId: "", program: "", bio: "", photo: "", mainEvent: "333", events: { "333": { single: "", average: "" } } }),
  addTeam: () => store.set(`teams.${newId("t")}`, { name: "New team", tag: "", logo: "", motto: "", record: "", members: [] }),
  addEvent: (id, el) => el.value && store.set(`competitors.${id}.events.${el.value}`, { single: "", average: "" }),
  delPath: (path) => store.set(path, null),
  delPerson: (id) => confirm(`Delete ${nameOf(id)}?`) && store.patch([
    { path: `competitors.${id}`, value: null },
    ...teams().filter(([, t]) => (t.members || []).includes(id))
      .map(([tid, t]) => ({ path: `teams.${tid}.members`, value: t.members.filter((m) => m !== id) }))]),
  member: (arg, el) => {
    const [tid, pid] = arg.split(":");
    const members = (S.teams[tid].members || []).filter((m) => m !== pid);
    store.set(`teams.${tid}.members`, el.checked ? [...members, pid] : members);
  },
  showCompetitor: (id) => store.patch([{ path: "program.competitor", value: id }, { path: "program.scene", value: "competitor" }]),
  showTeam: (id) => store.patch([{ path: "program.team", value: id }, { path: "program.scene", value: "team" }]),

  copy: (text, el) => navigator.clipboard.writeText(text).then(() => { el.textContent = "Copied"; }),
  export: () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }));
    a.download = "uw-cubing-overlay-state.json";
    a.click();
  },
  resetAll: () => confirm("Replace everything with the sample data? This cannot be undone.") && store.reset(),
};

// ---------- Wiring ----------

function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.dataset.type === "number") return Number(el.value) || 0;
  if (el.dataset.type === "lines") return el.value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (el.dataset.type === "csv") return el.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return el.value;
}

app.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "autoclear") return localStorage.setItem("uwcc-autoclear", el.value);
  if (el.id === "import") {
    return el.files[0]?.text().then((text) => store.replace(JSON.parse(text))).catch(() => alert("That file is not valid JSON."));
  }
  if (el.dataset.act) return ACTIONS[el.dataset.act](el.dataset.arg, el);
  if (el.dataset.path) store.set(el.dataset.path, readInput(el));
});

app.addEventListener("click", (e) => {
  const el = e.target.closest("button[data-act]");
  if (el) ACTIONS[el.dataset.act](el.dataset.arg, el);
});

// Redraw the tab, keeping the cursor where it was if a field is being edited.
function render() {
  if (!S) return;
  if (!TABS[tab]) tab = "live";
  const active = document.activeElement;
  const key = active?.dataset?.path;
  const keep = key && { value: active.value, start: active.selectionStart, end: active.selectionEnd };

  document.querySelector("#tabs").innerHTML = Object.entries(TABS).map(([id, [name]]) =>
    `<button data-tab="${id}" class="${id === tab ? "on" : ""}">${name}</button>`).join("");
  document.querySelector("#conn").textContent = store.online ? "Connected" : "No server: this browser only";
  app.innerHTML = TABS[tab][1]();

  if (keep) {
    const el = app.querySelector(`[data-path="${CSS.escape(key)}"]`);
    if (el && el.type !== "checkbox") {
      el.focus();
      if (el.tagName !== "SELECT") {
        el.value = keep.value;
        try { el.setSelectionRange(keep.start, keep.end); } catch { /* number inputs */ }
      }
    }
  }
}

document.querySelector("#tabs").addEventListener("click", (e) => {
  const id = e.target.dataset.tab;
  if (id) { tab = id; location.hash = id; render(); }
});

// Drawn on the next tick so that, when you Tab out of a field, the focus has
// already landed on the next field and can be kept there.
let queued = false;
store.subscribe((state) => {
  S = state;
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; render(); }, 0);
});
