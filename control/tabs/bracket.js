// Bracket tab: who is in it, and the result of every match.
// The format (single / double / Swiss) is chosen under Settings.

import { store, getPath } from "../../shared/store.js";
import { buildElimination, swissPair } from "../../shared/bracket.js";
import { esc } from "../../shared/ui.js";
import { S, val, btn, box, row, hint, people, teams, matchMode, idByName } from "../kit.js";

const FORMATS = { single: "Single elimination", double: "Double elimination", swiss: "Swiss" };

// One match: two score boxes, a "won" button each side, and a shortcut that
// puts the two sides on the scoreboard when they are known teams or people.
function matchRow(id, a, b, base, won) {
  const ids = [idByName(a), idByName(b)];
  const known = ids[0] && ids[1] && Boolean(S.teams?.[ids[0]]) === Boolean(S.teams?.[ids[1]]);
  return `<div class="m">
      <span class="id">${esc(id)}</span><span class="nm r2">${esc(a)}</span>
      <input data-path="${base}.sa" value="${esc(val(`${base}.sa`))}" aria-label="Score, ${esc(a)}">
      <input data-path="${base}.sb" value="${esc(val(`${base}.sb`))}" aria-label="Score, ${esc(b)}">
      <span class="nm">${esc(b)}</span>
      <span class="r">${btn("◀ Won", "winner", `${base}:a`, won === "a" ? "on" : "")}${btn("Won ▶", "winner", `${base}:b`, won === "b" ? "on" : "")}
        ${known ? btn("Play", "loadMatch", ids.join(":"), "quiet", `title="Put these two on the scoreboard"`) : ""}</span>
    </div>`;
}

// The list of matches with their results. Also shown on the Live tab while
// the bracket is on screen.
export function resultsEditor() {
  const b = S.bracket || {};
  if (b.format === "swiss") {
    const rounds = b.swissRounds || [];
    return box("Swiss rounds", `
      ${row(btn("Pair next round", "swissNext", "", "primary"), btn("Delete last round", "swissUndo"))}
      ${hint("Finish every match in a round before pairing the next one. The page shows the newest round.")}
      ${rounds.map((round, r) => `<h3>Round ${r + 1}</h3>` + round.map((m, i) =>
        m.b ? matchRow(`${r + 1}.${i + 1}`, m.a, m.b, `bracket.swissRounds.${r}.${i}`, m.winner)
            : `<div class="m"><span class="id">bye</span><span class="nm r2">${esc(m.a)}</span></div>`).join("")).reverse().join("")}`, "wide");
  }
  const built = buildElimination(b.format, b.entrants || [], b.results || {});
  return box("Bracket results", built.sections.map((sec) =>
    (sec.title ? `<h3 class="gold">${esc(sec.title)}</h3>` : "") + sec.rounds.map((round) => {
      // Walkovers (byes) need no result, so they are not listed.
      const playable = round.matches.filter((m) => !m.walkover);
      if (!playable.length) return "";
      return `<h3>${esc(round.title)}</h3>` + playable.map((m) =>
        m.a.pending || m.b.pending
          ? `<div class="m"><span class="id">${m.id}</span><span class="nm r2 hint">${esc(m.a.pending ? "waiting" : m.a.name)}</span>
              <span></span><span></span><span class="nm hint">${esc(m.b.pending ? "waiting" : m.b.name)}</span></div>`
          : matchRow(m.id, m.a.name, m.b.name, `bracket.results.${m.id}`, m.won)).join("");
    }).join("")).join(""), "wide");
}

export default {
  id: "bracket",
  title: "Bracket",

  render() {
    const b = S.bracket || {};
    const count = (b.entrants || []).length;
    return box("Entrants", `
        ${hint(`Format: <b>${FORMATS[b.format] || FORMATS.single}</b>, ${count} entrants. Change the format under Settings.
          Top seeds get a bye when the count is not 4, 8, 16 or 32, and go straight into the next round.`)}
        <label>One per line, best seed first
          <textarea data-path="bracket.entrants" data-type="lines">${esc((b.entrants || []).join("\n"))}</textarea></label>
        ${row(btn("Use team names", "entrantsFrom", "teams", matchMode() === "team" ? "primary" : ""),
          btn("Use competitor names", "entrantsFrom", "competitors", matchMode() === "solo" ? "primary" : ""),
          btn("Clear all results", "bracketReset", "", "alert"))}
        ${hint("Changing entrants or format after results are in can move people around. Clear results if it looks wrong.")}`)
      + resultsEditor();
  },

  actions: {
    winner(arg) {
      const [base, side] = arg.split(":");
      store.set(`${base}.winner`, getPath(S, `${base}.winner`) === side ? "" : side);
    },
    entrantsFrom: (kind) => store.set("bracket.entrants", (kind === "teams" ? teams() : people()).map(([, x]) => x.name)),
    bracketReset: () => confirm("Clear every bracket result?") &&
      store.patch([{ path: "bracket.results", value: {} }, { path: "bracket.swissRounds", value: [] }]),
    swissNext: () => store.set("bracket.swissRounds",
      [...(S.bracket.swissRounds || []), swissPair(S.bracket.entrants || [], S.bracket.swissRounds || [])]),
    swissUndo: () => confirm("Delete the newest Swiss round?") &&
      store.set("bracket.swissRounds", (S.bracket.swissRounds || []).slice(0, -1)),

    // Put a bracket match on the scoreboard, with the score back at 0 - 0.
    loadMatch(arg) {
      const [a, b] = arg.split(":");
      const solo = !S.teams?.[a];
      store.patch([
        { path: "match.mode", value: solo ? "solo" : "team" },
        { path: "match.a", value: a }, { path: "match.b", value: b },
        { path: "match.scoreA", value: 0 }, { path: "match.scoreB", value: 0 },
        ...(solo ? [{ path: "cameras.a.competitor", value: a }, { path: "cameras.b.competitor", value: b }] : []),
      ]);
    },
  },
};
