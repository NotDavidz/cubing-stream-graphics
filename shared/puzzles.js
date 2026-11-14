// Puzzle registry and icons.
//
// The shapes are the official WCA event icons, kept in puzzle-icons.js. That
// file is generated: to add an event, add one line to PUZZLES and run
//     python tools/update_icons.py
// which fetches its icon. An event with no official icon can borrow one with
// icon: "333" (any id that has an icon).
//
// The WCA icons are drawn with wide gaps and a margin around them. Here they
// are shown the way the club posters draw puzzles: filling the box edge to
// edge, with thin gaps. The shapes themselves are not redrawn; each piece is
// only thickened a little (`grow`, in the icon's own units out of 500) so the
// gaps between pieces close up, and the margin is trimmed off.
//
//   grow  how much wider each piece becomes. Leave it out for no change.
//         Bigger closes the gaps more; too big and the pieces merge.

import { ICONS } from "./puzzle-icons.js";

export const PUZZLES = {
  "222":    { name: "2x2", grow: 41 },
  "333":    { name: "3x3", grow: 28 },
  "444":    { name: "4x4", grow: 20 },
  "555":    { name: "5x5", grow: 20 },
  "666":    { name: "6x6", grow: 14 },
  "777":    { name: "7x7", grow: 11 },
  "333oh":  { name: "3x3 One-Handed", short: "3x3 OH", grow: 10 },
  "333bf":  { name: "3x3 Blindfolded", short: "3x3 BLD", grow: 24 },
  "333fm":  { name: "Fewest Moves", short: "FMC", grow: 18 },
  "444bf":  { name: "4x4 Blindfolded", short: "4x4 BLD", grow: 18 },
  "555bf":  { name: "5x5 Blindfolded", short: "5x5 BLD", grow: 12 },
  "333mbf": { name: "Multi-Blind", short: "MBLD", grow: 14 },
  "pyram":  { name: "Pyraminx", grow: 4 },
  "skewb":  { name: "Skewb", grow: 4 },
  "minx":   { name: "Megaminx", grow: 6 },
  "sq1":    { name: "Square 1", grow: 10 },
  "clock":  { name: "Clock" },
  "fto":    { name: "FTO" },
};

export function puzzleName(id, short = false) {
  const p = PUZZLES[id];
  if (!p) return id || "";
  return (short && p.short) || p.name;
}

// The box that just holds an icon's shapes: square, centred on them, and
// `grow` larger so the thickened pieces still fit. Measured by the browser
// from the shapes themselves, so a new icon needs no numbers typed in.
function tightBox(icon, grow) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", icon.box);
  svg.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  svg.innerHTML = icon.body;
  document.body.append(svg);
  const b = svg.getBBox();
  svg.remove();
  if (!b.width || !b.height) return icon.box;
  const side = Math.max(b.width, b.height) + grow;
  return [b.x + b.width / 2 - side / 2, b.y + b.height / 2 - side / 2, side, side].map((n) => n.toFixed(1)).join(" ");
}

// Returns an <svg> string. Size it with CSS on the wrapping .puzzle element;
// it is drawn in the current text colour. Each icon is built once and reused:
// identical markup every time means a frame can tell that nothing changed and
// leave its animations alone.
const drawn = {};
export function puzzleIcon(id) {
  const key = PUZZLES[id]?.icon || (ICONS[id] ? id : "333");
  if (drawn[key]) return drawn[key];
  const icon = ICONS[key];
  const grow = PUZZLES[key]?.grow || 0;
  // An outline in the same colour is what thickens each piece. A width left
  // on a shape by the icon's author would override ours, so it is removed.
  const body = icon.body.replace(/\sstroke-width="[^"]*"/g, "");
  return (drawn[key] = `<svg viewBox="${tightBox(icon, grow)}" fill="currentColor" stroke="currentColor" stroke-width="${grow}" ` +
    `stroke-linejoin="miter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`);
}
