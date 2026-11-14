// Settings tab: the choices made once per event (or once per round), kept
// here so the Live tab holds only what changes during play.

import { store } from "../../shared/store.js";
import { PUZZLES } from "../../shared/puzzles.js";
import { defaultSequence } from "../../shared/pickban.js";
import { esc, puzzleName } from "../../shared/ui.js";
import { S, field, btn, seg, segAct, box, row, hint, people, teams, matchMode } from "../kit.js";

export default {
  id: "settings",
  title: "Settings",

  render() {
    const pool = S.pickban?.pool || [];
    return box("Event", `
        ${row(field("Event name", "event.title"), field("Season / subtitle", "event.subtitle"))}
        ${hint("The event name is the footer of every full page.")}`)

      + box("Match", `
        ${segAct("Who plays", "matchMode", [["team", "Team v team"], ["solo", "Player v player"]], matchMode())}
        ${seg("Score on camera frames", "match.show", [[true, "Shown"], [false, "Hidden"]], true)}
        ${seg("Celebrate the match winner", "match.celebrate", [[true, "Yes"], [false, "No"]], true)}
        ${hint("Player v player: the two cameras follow the two players automatically. Best of, round and puzzle are on the Live tab.")}`)

      + box("Bracket", `
        ${seg("Format", "bracket.format", [["single", "Single elimination"], ["double", "Double elimination"], ["swiss", "Swiss"]], "single")}
        ${S.bracket?.format === "double" || S.bracket?.format === "swiss" ? ""
          : seg("Third place match", "bracket.thirdPlace", [[true, "Yes"], [false, "No"]], true)}
        ${row(field("Page title", "bracket.title"))}
        ${hint("Entrants and results are on the Bracket tab. Double elimination reads best with up to 8 entrants.")}`)

      + box("Screen", `
        ${seg("Changing page", "settings.transition", [["sweep", "Sweep"], ["fade", "Fade"], ["cut", "Cut"]], "sweep")}
        ${hint("Applies to the Program source.")}`)

      + box("Footer strip", `
        ${seg("Extra lines in the footer", "settings.ticker.on", [[false, "Off"], [true, "On"]], false)}
        ${S.settings?.ticker?.on ? `
          ${seg("Change every", "settings.ticker.seconds", [[6, "6 s"], [10, "10 s"], [15, "15 s"], [30, "30 s"]], 10)}
          <label>Lines, one per line (sponsors, socials, what is next)
            <textarea data-path="settings.ticker.lines" data-type="lines" style="min-height:90px">${esc((S.settings.ticker.lines || []).join("\n"))}</textarea></label>` : ""}
        ${hint("Off: the footer of every full page is the event name, as before. On: the event name takes turns with these lines.")}`)

      + box("Pick & ban", `
        <h3>Puzzle pool</h3>
        ${hint("Tick 5 to 7 puzzles. Changing the pool restarts the pick & ban.")}
        <div class="pool">${Object.keys(PUZZLES).map((id) =>
          `<label class="check"><input type="checkbox" data-act="pbPool" data-arg="${id}" ${pool.includes(id) ? "checked" : ""}>${esc(puzzleName(id, true))}</label>`).join("")}</div>
        <h3>Turn order</h3>
        ${hint("Side and action for each turn, for example <code>a:ban, b:ban, a:pick</code>. Whatever is left untouched at the end is the decider.")}
        ${field("Order", "pickban.sequence", `data-type="csv"`)}
        ${row(btn("Standard order, A first", "pbSequence", "a"), btn("Standard order, B first", "pbSequence", "b"))}`, "wide");
  },

  actions: {
    // Switching kind puts the first two teams (or players) on the two sides.
    matchMode(mode) {
      const ids = (mode === "solo" ? people() : teams()).map(([id]) => id);
      const a = ids.includes(S.match?.a) ? S.match.a : ids[0] || "";
      const b = ids.includes(S.match?.b) ? S.match.b : ids.find((id) => id !== a) || "";
      store.patch([
        { path: "match.mode", value: mode }, { path: "match.a", value: a }, { path: "match.b", value: b },
        { path: "match.source", value: null }, { path: "match.solves", value: [] },
        ...(mode === "solo" ? [{ path: "cameras.a.competitor", value: a }, { path: "cameras.b.competitor", value: b }] : []),
      ]);
    },
    pbPool(id, el) {
      const pool = Object.keys(PUZZLES).filter((p) => (p === id ? el.checked : (S.pickban?.pool || []).includes(p)));
      store.patch([{ path: "pickban.pool", value: pool },
        { path: "pickban.sequence", value: defaultSequence(pool.length) }, { path: "pickban.actions", value: [] }]);
    },
  },
};
