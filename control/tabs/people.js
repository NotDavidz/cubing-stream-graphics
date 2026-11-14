// People & teams tab: the roster. Everything a frame knows about a person or
// a team is entered here.

import { store } from "../../shared/store.js";
import { esc, puzzleName } from "../../shared/ui.js";
import { S, field, select, btn, box, row, fold, opened, people, teams, nameOf, newId, puzzleOptions } from "../kit.js";

const teamOf = (id) => teams().find(([, t]) => (t.members || []).includes(id))?.[1].name || "no team";

function person([id, p]) {
  const path = `competitors.${id}`;
  return fold(id, p.name, [p.wcaId, teamOf(id)].filter(Boolean).join(" · "), `
    ${row(field("Name", `${path}.name`), field("WCA ID", `${path}.wcaId`))}
    ${row(field("Program", `${path}.program`), select("Main event", `${path}.mainEvent`, puzzleOptions()))}
    ${row(field("Photo (URL, or assets/photos/file.jpg)", `${path}.photo`), field("One-line bio", `${path}.bio`))}
    ${Object.keys(p.events || {}).map((ev) => `<div class="r">
      <span class="ev">${esc(puzzleName(ev, true))}</span>
      ${field("Single", `${path}.events.${ev}.single`)}${field("Average", `${path}.events.${ev}.average`)}
      ${btn("✕", "delPath", `${path}.events.${ev}`, "quiet", `title="Remove ${esc(puzzleName(ev, true))}"`)}</div>`).join("")}
    <div class="r">
      <select data-act="addEvent" data-arg="${id}" style="width:auto"><option value="">+ Add a puzzle…</option>
        ${puzzleOptions().filter(([ev]) => !p.events?.[ev]).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select>
      ${btn("Show on competitor page", "showCompetitor", id)}${btn("Delete person", "delPerson", id, "quiet")}</div>`);
}

function team([id, t]) {
  const path = `teams.${id}`;
  return fold(id, t.name, `${(t.members || []).length} members`, `
    ${row(field("Team name", `${path}.name`), field("Short tag", `${path}.tag`, `maxlength="4"`), field("Record", `${path}.record`))}
    ${row(field("Motto", `${path}.motto`), field("Logo (URL or path)", `${path}.logo`))}
    <div class="pool">${people().map(([pid, p]) =>
      `<label class="check"><input type="checkbox" data-act="member" data-arg="${id}:${pid}" ${(t.members || []).includes(pid) ? "checked" : ""}>${esc(p.name)}</label>`).join("")}</div>
    ${row(btn("Show on team page", "showTeam", id), btn("Delete team", "delTeam", id, "quiet"))}`);
}

export default {
  id: "people",
  title: "People & teams",

  render: () => box("Teams", teams().map(team).join("") + row(btn("+ Add team", "addTeam", "", "primary")))
    + box("Competitors", people().map(person).join("") + row(btn("+ Add competitor", "addPerson", "", "primary"))),

  actions: {
    addPerson() {
      const id = newId("c");
      opened.add(id);
      store.set(`competitors.${id}`,
        { name: "New competitor", wcaId: "", program: "", bio: "", photo: "", mainEvent: "333", events: { "333": { single: "", average: "" } } });
    },
    addTeam() {
      const id = newId("t");
      opened.add(id);
      store.set(`teams.${id}`, { name: "New team", tag: "", logo: "", motto: "", record: "", members: [] });
    },
    delTeam: (id) => confirm(`Delete ${nameOf(id)}?`) && store.set(`teams.${id}`, null),
    delPerson: (id) => confirm(`Delete ${nameOf(id)}?`) && store.patch([
      { path: `competitors.${id}`, value: null },
      ...teams().filter(([, t]) => (t.members || []).includes(id))
        .map(([tid, t]) => ({ path: `teams.${tid}.members`, value: t.members.filter((m) => m !== id) }))]),
    addEvent: (id, el) => el.value && store.set(`competitors.${id}.events.${el.value}`, { single: "", average: "" }),
    delPath: (path) => store.set(path, null),
    member(arg, el) {
      const [tid, pid] = arg.split(":");
      const members = (S.teams[tid].members || []).filter((m) => m !== pid);
      store.set(`teams.${tid}.members`, el.checked ? [...members, pid] : members);
    },
    showCompetitor: (id) => store.patch([{ path: "program.competitor", value: id }, { path: "program.scene", value: "competitor" }]),
    showTeam: (id) => store.patch([{ path: "program.team", value: id }, { path: "program.scene", value: "team" }]),
  },
};
