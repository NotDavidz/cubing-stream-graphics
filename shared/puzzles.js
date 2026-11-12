// Puzzle registry and icons.
//
// Icons are flat vector drawings in the style of the club posters: solid
// shapes separated by gaps, drawn in `currentColor` so CSS decides the colour.
// To add an event, add one line to PUZZLES. Reuse a drawing or write a new one.

let uid = 0;

// Solid shape with lines cut out of it (the gaps are truly transparent).
function cut(shape, lines, extra = "") {
  const id = `pz${++uid}`;
  return `<mask id="${id}"><rect width="100" height="100" fill="#000"/>` +
    `<g fill="#fff">${shape}</g><g stroke="#000" fill="none" stroke-linecap="butt">${lines}</g></mask>` +
    `<rect width="100" height="100" fill="currentColor" mask="url(#${id})"/>${extra}`;
}

function grid(n) {
  const gap = n > 5 ? 2 : n > 3 ? 3 : 4;
  const cell = (100 - gap * (n - 1)) / n;
  let out = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    out += `<rect x="${(c * (cell + gap)).toFixed(2)}" y="${(r * (cell + gap)).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
  }
  return `<g fill="currentColor">${out}</g>`;
}

// A grid with a small lettered corner badge, for variants such as OH and BLD.
function badged(n, text) {
  const w = 16 + text.length * 13;
  return grid(n) +
    `<rect x="${100 - w}" y="70" width="${w}" height="30" fill="#1b1b1b"/>` +
    `<text x="${100 - w / 2}" y="92" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="800" font-size="20" fill="currentColor">${text}</text>`;
}

const pyraminx = () => cut(
  `<polygon points="50,6 100,94 0,94"/>`,
  `<g stroke-width="3.5"><path d="M33.3 35.3h33.4M16.7 64.7h66.6M33.3 35.3 66.7 94M16.7 64.7 33.3 94M66.7 35.3 33.3 94M83.3 64.7 66.7 94"/></g>`);

const skewb = () => cut(
  `<rect width="100" height="100"/>`,
  `<path stroke-width="4.5" d="M50 0 100 50 50 100 0 50z"/>`);

const megaminx = () => {
  const pt = (r, i, off = -90) => {
    const a = (off + i * 72) * Math.PI / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`;
  };
  const outer = [0, 1, 2, 3, 4].map((i) => pt(52, i)).join(" ");
  const inner = [0, 1, 2, 3, 4].map((i) => pt(24, i, 90)).join(" ");
  const spokes = [0, 1, 2, 3, 4].map((i) => {
    const a = (90 + i * 72) * Math.PI / 180;
    return `M${pt(24, i, 90)} L${(50 + 60 * Math.cos(a)).toFixed(1)} ${(52 + 60 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return cut(`<polygon points="${outer}"/>`,
    `<g stroke-width="4"><polygon points="${inner}"/><path d="${spokes}"/></g>`);
};

const square1 = () => cut(
  `<rect width="100" height="100"/>`,
  `<path stroke-width="3.5" d="M33 0 67 100M67 0 33 100M0 33 100 67M0 67 100 33"/>`);

const clock = () => {
  let dots = "";
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    dots += `<circle cx="${16 + c * 34}" cy="${16 + r * 34}" r="14"/>`;
  }
  return `<g fill="currentColor">${dots}</g>`;
};

const fto = () => {
  // One triangular face, split into nine; repeated four times around the centre.
  const id = `pz${++uid}c`;
  const face = `<g clip-path="url(#${id})" stroke-width="2">` +
    `<path d="M0 16.7h100M0 33.3h100M33.3 0l50 50M66.7 0l50 50M66.7 0l-50 50M33.3 0l-50 50"/></g>`;
  const faces = [0, 90, 180, 270].map((a) => `<g transform="rotate(${a} 50 50)">${face}</g>`).join("");
  return `<clipPath id="${id}"><polygon points="0,0 100,0 50,50"/></clipPath>` + cut(
    `<rect width="100" height="100"/>`,
    `${faces}<path stroke-width="7" d="M0 0 100 100M100 0 0 100"/>`);
};

export const PUZZLES = {
  "222":    { name: "2x2",         draw: () => grid(2) },
  "333":    { name: "3x3",         draw: () => grid(3) },
  "444":    { name: "4x4",         draw: () => grid(4) },
  "555":    { name: "5x5",         draw: () => grid(5) },
  "666":    { name: "6x6",         draw: () => grid(6) },
  "777":    { name: "7x7",         draw: () => grid(7) },
  "333oh":  { name: "3x3 One-Handed", short: "3x3 OH",  draw: () => badged(3, "OH") },
  "333bf":  { name: "3x3 Blindfolded", short: "3x3 BLD", draw: () => badged(3, "BLD") },
  "333fm":  { name: "Fewest Moves", short: "FMC",       draw: () => badged(3, "FM") },
  "444bf":  { name: "4x4 Blindfolded", short: "4x4 BLD", draw: () => badged(4, "BLD") },
  "555bf":  { name: "5x5 Blindfolded", short: "5x5 BLD", draw: () => badged(5, "BLD") },
  "333mbf": { name: "Multi-Blind", short: "MBLD",       draw: () => badged(3, "MBLD") },
  "pyram":  { name: "Pyraminx",    draw: pyraminx },
  "skewb":  { name: "Skewb",       draw: skewb },
  "minx":   { name: "Megaminx",    draw: megaminx },
  "sq1":    { name: "Square 1",    draw: square1 },
  "clock":  { name: "Clock",       draw: clock },
  "fto":    { name: "FTO",         draw: fto },
};

export function puzzleName(id, short = false) {
  const p = PUZZLES[id];
  if (!p) return id || "";
  return (short && p.short) || p.name;
}

// Returns an <svg> string. Size it with CSS on the wrapping .puzzle element.
// Each icon is drawn once and reused: identical markup every time means a
// frame can tell that nothing changed and leave its animations alone.
const drawn = {};
export function puzzleIcon(id) {
  const key = PUZZLES[id] ? id : "333";
  return (drawn[key] ??= `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${PUZZLES[key].draw()}</svg>`);
}
