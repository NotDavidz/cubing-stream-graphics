// Settings tab: the choices made once per event (or once per round), kept
// here so the Live tab holds only what changes during play.

import { store } from "../../shared/store.js";
import { PUZZLES } from "../../shared/puzzles.js";
import { defaultSequence } from "../../shared/pickban.js";
import { esc, puzzleName } from "../../shared/ui.js";
import { S, field, number, btn, seg, segAct, box, row, hint, people, teams, matchMode } from "../kit.js";

export default {
  id: "settings",
  title: "Settings",

  render() {
    const pool = S.pickban?.pool || [];
    return box("Event", `
        ${row(field("Event name", "event.title"), field("Season / subtitle", "event.subtitle"))}
        ${row(field("Location", "event.location"),
          field("Format wording", "event.format", `placeholder="Automatic: Best of ${esc(S.match?.bestOf || 1)}"`))}
        ${hint("Round and puzzle change during the event, so they are on the Live tab.")}`)

      + box("Match", `
        ${segAct("Who plays", "matchMode", [["team", "Team v team"], ["solo", "Player v player"]], matchMode())}
        ${row(number("Best of", "match.bestOf", `min="1" step="2" style="width:110px"`))}
        ${seg("Score on camera frames", "match.show", [[true, "Shown"], [false, "Hidden"]], true)}
        ${hint("Player v player: the two cameras follow the two players automatically.")}`)

      + box("Bracket", `
        ${seg("Format", "bracket.format", [["single", "Single elimination"], ["double", "Double elimination"], ["swiss", "Swiss"]], "single")}
        ${row(field("Page title", "bracket.title"))}
        ${hint("Entrants and results are on the Bracket tab. Double elimination reads best with up to 8 entrants.")}`)

      + box("Screen", `
        ${seg("Changing page", "settings.transition", [["sweep", "Sweep"], ["fade", "Fade"], ["cut", "Cut"]], "sweep")}
        ${seg("Score bug", "program.bugPos", [["top", "Top"], ["bottom", "Bottom"]], "top")}
        ${seg("Clear +2 / DNF / win after", "settings.autoClear", [[0, "Never"], [5, "5 s"], [10, "10 s"], [20, "20 s"]], 0)}
        ${hint("The page change applies to the Program source. Clearing is done by this control panel, so keep it open.")}`)

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
