// Pieces shared by the hollow (camera) frames.

import { esc, entity, avatar, puzzle } from "./ui.js";
import { matchInfo } from "./match.js";

// Everything the operator can flash on a camera. `tone` picks the look:
// "alert" = red glowing frame, "good" = bright yellow frame.
// Add a line here and it appears in the control panel automatically.
export const STATUSES = {
  none:  { label: "",     button: "Clear" },
  plus2: { label: "+2",   button: "+2",   tone: "alert" },
  dnf:   { label: "DNF",  button: "DNF",  tone: "alert" },
  dns:   { label: "DNS",  button: "DNS",  tone: "alert" },
  win:   { label: "WIN",  button: "Win",  tone: "good" },
  pb:    { label: "PB",   button: "PB",   tone: "good" },
};

export function camInfo(state, slot) {
  const cam = state.cameras?.[slot] || {};
  const status = STATUSES[cam.status] || STATUSES.none;
  return { cam, status, who: entity(state, cam.competitor) };
}

// Class list for a .cam element.
export function camClass(state, slot) {
  const { status } = camInfo(state, slot);
  return `cam ${slot} ${status.tone || ""}`;
}

export function burst(state, slot) {
  const { status } = camInfo(state, slot);
  return status.label ? `<div class="burst pop">${esc(status.label)}</div>` : "";
}

export function scoreBar(state) {
  const m = matchInfo(state), e = state.event || {};
  const show = m.showScore;
  // Once the match is won, the winner's half lights up and the other dims.
  const team = (side) => `<div class="team ${side} ${m.cheer ? (m.cheer === side ? "won" : "lost") : ""}">${
    avatar(m[side], 62)}<span data-fit="line">${esc(m[side].name)}</span></div>`;
  const num = (side, score) => (show
    ? `<div class="num ${side} ${m.cheer === side ? "won" : ""}" data-k="${side}" data-v="${score}">${score}</div>` : "<span></span>");
  return `
    ${team("a")}${num("a", m.scoreA)}
    <div class="mid">${puzzle(e.puzzle, 46)}<div><span data-fit="line">${esc(e.round || "")}</span><span data-fit="line">Best of ${m.bestOf}</span></div></div>
    ${num("b", m.scoreB)}${team("b")}`;
}

// The patterned backdrop with rectangular holes cut out for the cameras.
// holes = [{ x, y, w, h }] in canvas pixels.
export function backdrop(holes) {
  const cut = holes.map((r) => `M${r.x} ${r.y}v${r.h}h${r.w}v${-r.h}z`).join("");
  return `<svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;left:0;top:0">
    <defs><pattern id="tri" width="170" height="270" patternUnits="userSpaceOnUse">
      <rect width="170" height="270" fill="#1b1b1b"/>
      <path d="M12 10h56l-28 50z M97 195h56l-28-50z" fill="#2a2a2a"/></pattern></defs>
    <path fill="url(#tri)" fill-rule="evenodd" d="M0 0h1920v1080H0z${cut}"/>
    <path d="M0 138v22L320 0h-44z" fill="#fae203"/><path d="M0 172v34L412 0h-68z" fill="#ecc13c"/>
    <g transform="translate(1500 870)"><path d="M420 38V4L8 210h68z" fill="#ecc13c"/><path d="M420 72V50L100 210h44z" fill="#eae6a3"/></g>
  </svg>`;
}
