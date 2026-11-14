// Links & data tab: the frame links to paste into OBS, and save / load.

import { store } from "../../shared/store.js";
import { SCENES } from "../../shared/scenes.js";
import { esc } from "../../shared/ui.js";
import { S, btn, box, row, hint } from "../kit.js";

// Copying needs a secure page; over plain http on the network, fall back to
// the old selection trick.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export default {
  id: "links",
  title: "Links & data",

  render() {
    const base = new URL("../frames/", location.href).href;
    const link = (file, name, note) => `<div class="url"><b>${esc(name)}</b><code>${esc(base + file)}</code>
        ${btn("Copy", "copy", base + file)}<a href="${esc(base + file)}" target="_blank" rel="noopener">Open</a></div>
        ${note ? hint(esc(note)) : ""}`;
    const group = (kind) => SCENES.filter((s) => s.kind === kind).map((s) =>
      link(`${s.id}.html`, s.name, s.note) + (s.variants || []).map(([query, name]) => link(`${s.id}.html${query}`, name, "")).join("")).join("");

    return box("Frame links", `
        ${hint(`In OBS: add a <b>Browser</b> source, paste a link, set width 1920 and height 1080. Hollow frames go above your camera sources.
          Add <code>?bg=green</code> for a chroma-key background in post editing (use <code>&amp;bg=green</code> if the link already has a <code>?</code>).`)}
        <h3>Switched from the Live tab</h3>
        ${link("program.html", "Program", "One source that shows whatever is chosen under \"On screen now\"")}
        <h3>Solid: shown on their own</h3>${group("solid")}
        <h3>Hollow: go over camera footage</h3>${group("hollow")}`, "wide")

      + box("Save and load", `
        ${hint("Everything you enter is saved automatically in <code>data/state.json</code>. Export a copy before an event, or to reuse a roster.")}
        ${row(btn("Export to file", "export", "", "primary"), `<label>Import from file<input type="file" data-act="import" accept=".json"></label>`)}
        ${row(btn("Reset everything to the sample data", "resetAll", "", "alert"))}`);
  },

  actions: {
    copy: (text, el) => copyText(text).then(() => { el.textContent = "Copied"; }),
    export() {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }));
      a.download = "uw-cubing-overlay-state.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: (_, el) => el.files[0]?.text()
      .then((text) => {
        const next = JSON.parse(text);
        if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("not a state file");
        return store.replace(next);
      })
      .catch(() => alert("That file is not a saved state (it must be the JSON from Export).")),
    resetAll: () => confirm("Replace everything with the sample data? This cannot be undone.") && store.reset(),
  },
};
