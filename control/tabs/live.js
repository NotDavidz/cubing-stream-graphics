// Live tab: choose what is on screen, and run it.
//
// The scene buttons along the top come from shared/scenes.js. Under them the
// tab shows only the controls that scene needs: PANELS maps a scene id to the
// boxes to draw. To give a new scene its controls, write a box function and
// add one line to PANELS.

import { store } from "../../shared/store.js";
import { SCENES, sceneById } from "../../shared/scenes.js";
import { matchInfo, victoryInfo, solveResult } from "../../shared/match.js";
import { STATUSES } from "../../shared/camera.js";
import { pickbanStatus, defaultSequence } from "../../shared/pickban.js";
import { esc, puzzleIcon, puzzleName, shownId } from "../../shared/ui.js";
import {
  S, redraw, field, number, select, picker, btn, seg, box, row, hint,
  people, teams, nameOf, matchMode, sideOptions, puzzleOptions,
} from "../kit.js";
import { resultsEditor } from "./bracket.js";

// The scene whose controls are open. It follows whatever goes on screen, but
// the operator can open another scene's controls first to get it ready.
let editing = "";
let lastOnAir = "";

const onAir = () => sceneById(S.program?.scene).id;
const current = () => (SCENES.some((s) => s.id === editing) ? editing : onAir());

// ---------- Boxes ----------

// The score seen at the last draw and when it last changed, so a number can
// pop when it changes. The mark stays for the length of the animation, which
// keeps the markup the same across the redraws that follow a click.
const lastScore = {}, changedAt = {};

// The two "who is playing" selects.
function sidePickers() {
  const kind = matchMode() === "solo" ? "player" : "team";
  return ["a", "b"].map((side) =>
    picker(`Side ${side.toUpperCase()} (${kind})`, "side", side, sideOptions(), S.match?.[side])).join("");
}

function scoreBox() {
  const m = matchInfo(S);
  const half = (side, key, score) => {
    if (lastScore[key] !== undefined && lastScore[key] !== score) changedAt[key] = Date.now();
    lastScore[key] = score;
    const changed = Date.now() - (changedAt[key] || 0) < 400;
    return `<div>
      <div class="who">${esc(m[side].name)}</div><div class="n ${changed ? "changed" : ""}">${score}</div>
      <div class="r centre">${btn("−", "score", `${key}:-1`, "big")}${btn("+", "score", `${key}:1`, "big primary")}</div></div>`;
  };
  return box("Match score", `
    <div class="score">
      ${half("a", "scoreA", m.scoreA)}
      <div class="mid"><span class="hint">Best of ${m.bestOf}<br>first to ${m.needed}</span>${btn("Swap sides", "swapSides")}${btn("Reset to 0 - 0", "resetScore")}</div>
      ${half("b", "scoreB", m.scoreB)}
    </div>
    ${row(sidePickers(), number("Best of", "match.bestOf", `min="1" step="2" style="width:90px"`))}
    ${m.winner ? `<div class="note"><span><b>${esc(m[m.winner].name)}</b> has won the match${m.cheer ? " and is highlighted on the Versus page and the score bar." : "."}</span>
      <span class="r">${S.match?.source ? btn("Save to bracket", "recordResult", "", "primary", `title="Write this score into the bracket match it was loaded from"`) : ""}
        ${btn("Show as event champion", "showVictory")}</span></div>` : ""}`);
}

const matchupBox = (title) => box(title, row(sidePickers()));

// What the two cameras show right now, read as one solve.
function currentSolve() {
  const [a, b] = ["a", "b"].map((slot) => solveResult(S.cameras?.[slot]?.time, S.cameras?.[slot]?.status));
  const ready = !isNaN(a.value) && !isNaN(b.value);
  return { a: a.text, b: b.text, ready, winner: !ready || a.value === b.value ? "" : a.value < b.value ? "a" : "b" };
}

// Solve history: one press takes the two times on the cameras, works out who
// was faster, gives them the point and adds the solve to the list.
function solvesBox() {
  const m = matchInfo(S), now = currentSolve(), solves = S.match?.solves || [];
  const who = (side) => (side ? esc(m[side].name) : "nobody (tie)");
  return box(`Solves · ${solves.length} recorded`, `
    <p>${now.ready ? `On the cameras: <b>${esc(now.a)}</b> v <b>${esc(now.b)}</b>, point to <b>${who(now.winner)}</b>.`
      : "Type both times on the cameras (or press DNF), then record the solve."}</p>
    ${row(btn("Record solve", "recordSolve", "", "primary", now.ready ? "" : "disabled"),
      btn("Clear times", "clearTimes"), btn("Undo last solve", "undoSolve", "", "", solves.length ? "" : "disabled"))}
    ${solves.map((s, i) => `<div class="m"><span class="id">${i + 1}</span><span class="nm r2">${esc(s.a)}</span>
      <span></span><span></span><span class="nm">${esc(s.b)}</span><span class="hint">${who(s.winner)}</span></div>`).reverse().join("")}
    ${hint("Camera A is side A. +2 adds two seconds; DNF and DNS lose to any time. The + and − buttons still change the score without touching this list.")}`);
}

// Who is in front of a camera. In a team match the two teams' members are
// listed first, since it is nearly always one of them.
function solverSelect(slot) {
  const chosen = S.cameras?.[slot]?.competitor;
  const options = (list) => list.map(([id, p]) => `<option value="${esc(id)}" ${id === chosen ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  let body;
  if (matchMode() === "team") {
    const sides = [S.match?.a, S.match?.b].map((id) => S.teams?.[id]).filter(Boolean);
    const listed = new Set(sides.flatMap((t) => t.members || []));
    const group = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${options(list)}</optgroup>` : "");
    body = sides.map((t) => group(t.name, people().filter(([id]) => (t.members || []).includes(id)))).join("")
      + group("Everyone else", people().filter(([id]) => !listed.has(id)));
  } else {
    body = options(people());
  }
  const missing = S.competitors?.[chosen] ? "" : `<option value="" selected disabled>— choose —</option>`;
  return `<label>Solver<select data-path="cameras.${slot}.competitor">${missing}${body}</select></label>`;
}

function cameraBox(slot, title = `Camera ${slot.toUpperCase()}`) {
  const cam = S.cameras?.[slot] || {};
  const status = cam.status || "none";
  return box(`${title} · ${esc(nameOf(cam.competitor))}`, `
    ${row(solverSelect(slot), field("Time shown", `cameras.${slot}.time`, `placeholder="e.g. 8.14"`))}
    ${row(...Object.entries(STATUSES).map(([id, st]) =>
      btn(st.button, "status", `${slot}:${id}`, `big ${id === status && id !== "none" ? (st.tone === "alert" ? "alert" : "on") : ""}`)))}`);
}

// How long a +2 / DNF / win stays up. This control panel does the clearing,
// so it has to stay open.
function alertsBox() {
  return box("Alerts", seg("+2 / DNF / win disappear", "settings.autoClear",
    [[0, "When I press Clear"], [5, "After 5 s"], [10, "After 10 s"], [20, "After 20 s"]], 0));
}

function soloCameraBox() {
  const slot = S.program?.camSlot === "b" ? "b" : "a";
  return box("Which camera", `
    ${seg("This frame follows", "program.camSlot", [["a", "Camera A"], ["b", "Camera B"]], "a")}
    ${hint("A One camera frame added to OBS with <code>?slot=a</code> or <code>?slot=b</code> in its link stays on that camera.")}`)
    + cameraBox(slot);
}

function bugBox() {
  return box("Score bug", seg("Position", "program.bugPos", [["top", "Top"], ["bottom", "Bottom"]], "top")
    + (matchMode() === "team" ? seg("Solver names under the bar", "program.bugSolvers", [[true, "Shown"], [false, "Hidden"]], true) : "")
    + seg("Solve history under the bar", "program.bugHistory", [[true, "Shown"], [false, "Hidden"]], true)
    + hint("A time, +2 or DNF set on a camera below hangs under that side of the bar: camera A on the left, camera B on the right."));
}

function pickbanBox() {
  const status = pickbanStatus(S.pickban);
  const sides = { a: nameOf(S.match?.a), b: nameOf(S.match?.b) };
  const next = status.next;
  return box("Pick & ban", `
    <p><b>${next ? `${esc(sides[next.side])} to ${next.type.toUpperCase()}` : `Locked in: ${status.playing.map((e) => esc(puzzleName(e, true))).join(", ")}`}</b>
      ${next ? " — click the puzzle they choose." : ""}</p>
    <div class="pool">${status.cards.map((c) =>
      `<button class="pz ${c.status}" data-act="pbChoose" data-arg="${esc(c.event)}" ${c.status === "open" && next ? "" : "disabled"}>
        <span class="puzzle">${puzzleIcon(c.event)}</span>${esc(puzzleName(c.event, true))}
        ${c.status === "open" ? "" : ` · ${c.status}${c.side ? ` (${esc(sides[c.side])})` : ""}`}</button>`).join("")}</div>
    ${row(btn("Undo last", "pbUndo"), btn(`Start over, ${esc(sides.a)} first`, "pbSequence", "a"), btn(`Start over, ${esc(sides.b)} first`, "pbSequence", "b"))}
    ${hint("The puzzle pool and the turn order are under Settings.")}`, "wide");
}

// Auto-scroll: the page steps through everyone by itself, starting from the
// one that is showing. Clicking a name jumps there and carries on from it.
const cycleSeconds = (kind) => Number(S.program?.cycle?.[kind]?.seconds) || 0;
const cycleSwitch = (kind) => `<div class="switch"><span>Auto-scroll through everyone</span><div class="seg">${
  [[0, "Off"], [5, "5 s"], [8, "8 s"], [12, "12 s"], [20, "20 s"]].map(([v, t]) =>
    btn(t, "cycle", `${kind}:${v}`, v === cycleSeconds(kind) ? "on" : "")).join("")}</div></div>`;

function personBox() {
  const teamOf = (id) => teams().find(([, t]) => (t.members || []).includes(id))?.[1].name || "";
  const showing = shownId(S, "competitor");
  return box("Who is on the competitor page", `
    ${cycleSwitch("competitor")}
    <div class="pool">${people().map(([id, p]) =>
      btn(`<b>${esc(p.name)}</b><small>${esc(teamOf(id) || p.wcaId || "")}</small>`, "pickCompetitor", id, `card ${showing === id ? "on" : ""}`)).join("")}</div>
    ${hint("Names, photos and personal bests are edited under People & teams.")}`, "wide");
}

function teamBox() {
  const showing = shownId(S, "team");
  return box("Which team is on the team page", `
    ${cycleSwitch("team")}
    <div class="pool">${teams().map(([id, t]) =>
      btn(`<b>${esc(t.name)}</b><small>${(t.members || []).length} members</small>`, "pickTeam", id, `card ${showing === id ? "on" : ""}`)).join("")}</div>
    ${hint("Team names, logos and members are edited under People & teams.")}`, "wide");
}

function intermissionBox() {
  const title = S.intermission?.title;
  return box("Intermission", `
    ${row(...["Starting Soon", "Be Right Back", "Up Next", "Thanks for Watching"].map((t) => btn(t, "interTitle", t, title === t ? "on" : "")))}
    ${row(field("Title", "intermission.title"), field("Message", "intermission.message"))}
    ${row(field("Countdown to", "intermission.countdownTo", `placeholder="18:00, or leave empty" style="width:170px"`),
      ...[5, 10, 15].map((min) => btn(`${min} min`, "countdown", min)), btn("No countdown", "countdown", 0, "quiet"))}`);
}

function victoryBox() {
  const pick = S.victory?.winner || "auto";
  const { winner } = victoryInfo(S);
  const title = S.victory?.title || "";
  const everyone = [...teams(), ...people()].map(([id, x]) => [id, x.name]);
  return box(`Event champion · ${esc(winner ? winner.name : "nobody yet")}`, `
    ${hint("For the winner of the whole event. A match win is shown on the Versus page by itself.")}
    <div class="switch"><span>Champion</span><div class="seg">
      ${btn("Match winner", "set", `victory.winner="auto"`, pick === "auto" ? "on" : "")}
      ${btn(esc(nameOf(S.match?.a)), "set", `victory.winner="a"`, pick === "a" ? "on" : "")}
      ${btn(esc(nameOf(S.match?.b)), "set", `victory.winner="b"`, pick === "b" ? "on" : "")}</div></div>
    ${row(`<label>Or anyone else (shown without a score)<select data-path="victory.winner">
        <option value="" disabled ${["auto", "a", "b"].includes(pick) ? "selected" : ""}>— choose —</option>${
        everyone.map(([id, name]) => `<option value="${esc(id)}" ${id === pick ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`)}
    ${row(...[["", "Automatic"], ["Champions", "Champions"], ["Champion", "Champion"], ["Winner", "Winner"]].map(([v, t]) =>
      btn(t, "set", `victory.title=${JSON.stringify(v)}`, title === v ? "on" : "")))}
    ${row(field("Banner title", "victory.title", `placeholder="Automatic: Champion / Champions"`), field("Line under the name", "victory.note", `placeholder="e.g. Undefeated all season"`))}`);
}

function roundBox() {
  const round = S.event?.round;
  return box("Round & puzzle", `
    ${row(field("Round", "event.round"), select("Puzzle", "event.puzzle", puzzleOptions()))}
    ${row(...["Group Stage", "Quarterfinal", "Semifinal", "Final"].map((t) => btn(t, "set", `event.round=${JSON.stringify(t)}`, round === t ? "on" : "")))}`);
}

// Scene id -> the boxes it needs, most used first.
const PANELS = {
  intermission: () => intermissionBox() + matchupBox("Up next"),
  versus: () => scoreBox(),
  pickban: () => pickbanBox(),
  bracket: () => resultsEditor(),
  competitor: () => personBox(),
  team: () => teamBox(),
  victory: () => victoryBox() + scoreBox(),
  "cam-versus": () => scoreBox() + cameraBox("a") + cameraBox("b") + solvesBox() + alertsBox(),
  "cam-solo": () => soloCameraBox() + alertsBox() + scoreBox(),
  scorebug: () => scoreBox() + cameraBox("a", "Left side · camera A") + cameraBox("b", "Right side · camera B") + solvesBox() + bugBox() + alertsBox(),
};

// ---------- The tab ----------

const clearTimers = {};

// Show this entry; with auto-scroll on, carry on from it.
function pick(kind, id) {
  const ops = [{ path: `program.${kind}`, value: id }];
  if (cycleSeconds(kind)) ops.push({ path: `program.cycle.${kind}.since`, value: Date.now() });
  store.patch(ops);
}

// While auto-scroll runs, redraw when it moves on so the lit name keeps up.
let lastShown = "";
setInterval(() => {
  if (!S || !(cycleSeconds("competitor") || cycleSeconds("team"))) return;
  if (!document.querySelector("button[data-act=cycle]")) return;     // the names are not on screen
  const shown = `${shownId(S, "competitor")} ${shownId(S, "team")}`;
  if (shown !== lastShown) { lastShown = shown; redraw(); }
}, 500);

export default {
  id: "live",
  title: "Live",

  // Drawn above the boxes, next to the preview.
  top() {
    if (onAir() !== lastOnAir) editing = lastOnAir = onAir();   // follow the screen
    return `<h2>On screen now</h2>
      <div class="scenes">${SCENES.map((s) => {
        const live = s.id === onAir();
        return `<div class="scene ${live ? "live" : ""} ${s.id === current() ? "sel" : ""}">
          ${btn(esc(s.name), "edit", s.id, "name", `title="Open the controls for ${esc(s.name)}"`)}
          ${btn(live ? "On air" : "Show", "scene", s.id, "go", `title="Put ${esc(s.name)} on screen"`)}</div>`;
      }).join("")}</div>
      ${hint("Click a name to open its controls and preview it. <b>Show</b> puts it on the Program source; frames added to OBS on their own are not affected.")}`;
  },

  render() {
    const scene = sceneById(current());
    const waiting = scene.id === onAir() ? "" : `<section class="box wide notice">
        <span><b>${esc(scene.name)}</b> is not on screen yet. Set it up below, then show it.</span>
        ${btn(`Show ${esc(scene.name)}`, "scene", scene.id, "primary")}</section>`;
    return waiting + (PANELS[scene.id]?.() || "") + roundBox();
  },

  // The preview shows the Program source, or the scene being set up.
  preview() {
    const scene = sceneById(current());
    return scene.id === onAir()
      ? { src: "../frames/program.html", caption: `On screen: ${scene.name}`, live: true }
      : { src: `../frames/${scene.id}.html`, caption: `Preview: ${scene.name} (not on screen)`, live: false };
  },

  actions: {
    edit(id) { editing = id; redraw(); },
    scene(id) { editing = id; store.set("program.scene", id); },

    score(arg) {
      const [key, delta] = arg.split(":");
      store.set(`match.${key}`, Math.max(0, (Number(S.match?.[key]) || 0) + Number(delta)));
    },
    resetScore: () => store.patch([{ path: "match.scoreA", value: 0 }, { path: "match.scoreB", value: 0 }, { path: "match.solves", value: [] }]),

    recordSolve() {
      const now = currentSolve();
      if (!now.ready) return;
      const ops = [{ path: "match.solves", value: [...(S.match?.solves || []), { a: now.a, b: now.b, winner: now.winner }] }];
      const key = now.winner && `score${now.winner.toUpperCase()}`;
      if (key) ops.push({ path: `match.${key}`, value: (Number(S.match?.[key]) || 0) + 1 });
      store.patch(ops);
    },
    // Takes the last solve off the list, and its point back.
    undoSolve() {
      const solves = S.match?.solves || [], last = solves[solves.length - 1];
      if (!last) return;
      const ops = [{ path: "match.solves", value: solves.slice(0, -1) }];
      const key = last.winner && `score${last.winner.toUpperCase()}`;
      if (key) ops.push({ path: `match.${key}`, value: Math.max(0, (Number(S.match?.[key]) || 0) - 1) });
      store.patch(ops);
    },
    clearTimes: () => store.patch(["a", "b"].flatMap((slot) =>
      [{ path: `cameras.${slot}.time`, value: "" }, { path: `cameras.${slot}.status`, value: "none" }])),
    swapSides() {
      // The cameras are left alone: they are pointed at people, not at sides.
      const m = S.match || {};
      store.patch([
        { path: "match.a", value: m.b }, { path: "match.b", value: m.a },
        { path: "match.scoreA", value: m.scoreB || 0 }, { path: "match.scoreB", value: m.scoreA || 0 },
        { path: "match.solves", value: (m.solves || []).map((s) => ({ a: s.b, b: s.a, winner: s.winner && (s.winner === "a" ? "b" : "a") })) },
      ]);
    },
    // In a player v player match the cameras follow the two players.
    side(side, el) {
      // A different side means this is no longer the bracket match that was loaded.
      const ops = [{ path: `match.${side}`, value: el.value }, { path: "match.source", value: null }, { path: "match.solves", value: [] }];
      if (matchMode() === "solo") ops.push({ path: `cameras.${side}.competitor`, value: el.value });
      store.patch(ops);
    },
    showVictory() {
      editing = "victory";
      store.patch([{ path: "victory.winner", value: "auto" }, { path: "program.scene", value: "victory" }]);
    },

    status(arg) {
      const [slot, id] = arg.split(":");
      const seconds = Number(S.settings?.autoClear) || 0;
      store.set(`cameras.${slot}.status`, id);
      clearTimeout(clearTimers[slot]);
      if (id !== "none" && seconds) {
        clearTimers[slot] = setTimeout(() => store.set(`cameras.${slot}.status`, "none"), seconds * 1000);
      }
    },

    interTitle: (title) => store.set("intermission.title", title),
    // A countdown some minutes from now, stored as a clock time.
    countdown(minutes) {
      const at = new Date(Date.now() + Number(minutes) * 60000);
      const two = (n) => String(n).padStart(2, "0");
      store.set("intermission.countdownTo", Number(minutes) ? `${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}` : "");
    },

    pbChoose(event) {
      const next = pickbanStatus(S.pickban).next;
      if (next) store.set("pickban.actions", [...(S.pickban.actions || []), { event, side: next.side, type: next.type }]);
    },
    pbUndo: () => store.set("pickban.actions", (S.pickban?.actions || []).slice(0, -1)),
    pbSequence: (first) => store.patch([
      { path: "pickban.sequence", value: defaultSequence((S.pickban?.pool || []).length, first) },
      { path: "pickban.actions", value: [] }]),

    pickCompetitor: (id) => pick("competitor", id),
    pickTeam: (id) => pick("team", id),
    // arg "competitor:8" = step every 8 seconds; 0 switches it off. Either way
    // the entry showing right now becomes the picked one, so nothing jumps.
    cycle(arg) {
      const [kind, seconds] = arg.split(":");
      store.patch([
        { path: `program.${kind}`, value: shownId(S, kind) },
        { path: `program.cycle.${kind}`, value: { seconds: Number(seconds), since: Date.now() } },
      ]);
    },

    // Write the score into the bracket match it was loaded from (the Play
    // button on the Bracket tab). Sides may have been swapped since.
    recordResult() {
      const m = matchInfo(S), source = S.match?.source;
      if (!source?.path || !m.winner) return;
      const straight = S.match.a === source.a;
      store.patch([
        { path: `${source.path}.sa`, value: straight ? m.scoreA : m.scoreB },
        { path: `${source.path}.sb`, value: straight ? m.scoreB : m.scoreA },
        { path: `${source.path}.winner`, value: (m.winner === "a") === straight ? "a" : "b" },
      ]);
    },
  },
};
