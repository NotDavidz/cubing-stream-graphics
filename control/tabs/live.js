// Live tab: choose what is on screen, and run it.
//
// The scene buttons along the top come from shared/scenes.js. Under them the
// tab shows only the controls that scene needs: PANELS maps a scene id to the
// boxes to draw. To give a new scene its controls, write a box function and
// add one line to PANELS.

import { store } from "../../shared/store.js";
import { SCENES, sceneById } from "../../shared/scenes.js";
import { matchInfo, victoryInfo } from "../../shared/match.js";
import { STATUSES } from "../../shared/camera.js";
import { pickbanStatus, defaultSequence } from "../../shared/pickban.js";
import { esc, puzzleIcon, puzzleName } from "../../shared/ui.js";
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

function scoreBox() {
  const m = matchInfo(S);
  const half = (side, key, score) => `<div>
      <div class="who">${esc(m[side].name)}</div><div class="n">${score}</div>
      <div class="r centre">${btn("−", "score", `${key}:-1`, "big")}${btn("+", "score", `${key}:1`, "big primary")}</div></div>`;
  const kind = matchMode() === "solo" ? "player" : "team";
  return box("Match score", `
    <div class="score">
      ${half("a", "scoreA", m.scoreA)}
      <div class="mid"><span class="hint">Best of ${m.bestOf}<br>first to ${m.needed}</span>${btn("Swap sides", "swapSides")}${btn("Reset to 0 - 0", "resetScore")}</div>
      ${half("b", "scoreB", m.scoreB)}
    </div>
    ${m.winner ? `<div class="note"><span><b>${esc(m[m.winner].name)}</b> has won the match.</span>${btn("Show victory screen", "showVictory", "", "primary")}</div>` : ""}
    ${row(picker(`Side A (${kind})`, "side", "a", sideOptions(), S.match?.a), picker(`Side B (${kind})`, "side", "b", sideOptions(), S.match?.b),
      number("Best of", "match.bestOf", `min="1" step="2" style="width:90px"`))}`);
}

function matchupBox(title) {
  const kind = matchMode() === "solo" ? "player" : "team";
  return box(title, row(picker(`Side A (${kind})`, "side", "a", sideOptions(), S.match?.a),
    picker(`Side B (${kind})`, "side", "b", sideOptions(), S.match?.b)));
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

function soloCameraBox() {
  const slot = S.program?.camSlot === "b" ? "b" : "a";
  return box("Which camera", `
    ${seg("This frame follows", "program.camSlot", [["a", "Camera A"], ["b", "Camera B"]], "a")}
    ${hint("A One camera frame added to OBS with <code>?slot=a</code> or <code>?slot=b</code> in its link stays on that camera.")}`)
    + cameraBox(slot);
}

function bugBox() {
  return box("Score bug", seg("Position", "program.bugPos", [["top", "Top"], ["bottom", "Bottom"]], "top")
    + seg("Score", "match.show", [[true, "Shown"], [false, "Hidden"]], true));
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

function personBox() {
  const teamOf = (id) => teams().find(([, t]) => (t.members || []).includes(id))?.[1].name || "";
  return box("Who is on the competitor page", `
    <div class="pool">${people().map(([id, p]) =>
      btn(`<b>${esc(p.name)}</b><small>${esc(teamOf(id) || p.wcaId || "")}</small>`, "pickCompetitor", id, `card ${S.program?.competitor === id ? "on" : ""}`)).join("")}</div>
    ${hint("Names, photos and personal bests are edited under People & teams.")}`, "wide");
}

function teamBox() {
  return box("Which team is on the team page", `
    <div class="pool">${teams().map(([id, t]) =>
      btn(`<b>${esc(t.name)}</b><small>${(t.members || []).length} members</small>`, "pickTeam", id, `card ${S.program?.team === id ? "on" : ""}`)).join("")}</div>
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
  const title = S.victory?.title || "Winner";
  const everyone = [...teams(), ...people()].map(([id, x]) => [id, x.name]);
  return box(`Victory screen · ${esc(winner ? winner.name : "nobody yet")}`, `
    <div class="switch"><span>Winner</span><div class="seg">
      ${btn("Match winner", "set", `victory.winner="auto"`, pick === "auto" ? "on" : "")}
      ${btn(esc(nameOf(S.match?.a)), "set", `victory.winner="a"`, pick === "a" ? "on" : "")}
      ${btn(esc(nameOf(S.match?.b)), "set", `victory.winner="b"`, pick === "b" ? "on" : "")}</div></div>
    ${row(`<label>Or anyone else (shown without a score)<select data-path="victory.winner">
        <option value="" disabled ${["auto", "a", "b"].includes(pick) ? "selected" : ""}>— choose —</option>${
        everyone.map(([id, name]) => `<option value="${esc(id)}" ${id === pick ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`)}
    ${row(...["Winner", "Match Winner", "Champions"].map((t) => btn(t, "set", `victory.title=${JSON.stringify(t)}`, title === t ? "on" : "")))}
    ${row(field("Banner title", "victory.title", `placeholder="Winner"`), field("Line under the name", "victory.note", `placeholder="e.g. Fall 2026 champions"`))}`);
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
  "cam-versus": () => scoreBox() + cameraBox("a") + cameraBox("b"),
  "cam-solo": () => soloCameraBox() + scoreBox(),
  scorebug: () => bugBox() + scoreBox(),
};

// ---------- The tab ----------

const clearTimers = {};

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
    resetScore: () => store.patch([{ path: "match.scoreA", value: 0 }, { path: "match.scoreB", value: 0 }]),
    swapSides() {
      // The cameras are left alone: they are pointed at people, not at sides.
      const m = S.match || {};
      store.patch([
        { path: "match.a", value: m.b }, { path: "match.b", value: m.a },
        { path: "match.scoreA", value: m.scoreB || 0 }, { path: "match.scoreB", value: m.scoreA || 0 },
      ]);
    },
    // In a player v player match the cameras follow the two players.
    side(side, el) {
      const ops = [{ path: `match.${side}`, value: el.value }];
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

    pickCompetitor: (id) => store.set("program.competitor", id),
    pickTeam: (id) => store.set("program.team", id),
  },
};
