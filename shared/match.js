// Match logic, with no drawing in it: who is playing, who leads, who has won.
// Frames and the control panel both use this, so they always agree.

import { entity } from "./ui.js";

// Wins needed to take a series: 3 in a best of 5, 7 in a best of 13.
export function winsNeeded(bestOf) {
  return Math.floor(Math.max(1, Number(bestOf) || 1) / 2) + 1;
}

// Everything worth knowing about the current match.
//   leader  "a" | "b" | ""   whoever has more wins right now
//   winner  "a" | "b" | ""   set once a side has the wins it needs
//   cheer   the winner, unless celebrating is switched off (Settings > Match)
//   point   "a" | "b" | "both" | ""   who is one win away from taking the match
export function matchInfo(state) {
  const m = state.match || {};
  const bestOf = Math.max(1, Number(m.bestOf) || 1);
  const scoreA = Number(m.scoreA) || 0, scoreB = Number(m.scoreB) || 0;
  const needed = winsNeeded(bestOf);
  const leader = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "";
  const winner = leader && Math.max(scoreA, scoreB) >= needed ? leader : "";
  const near = (score) => !winner && needed > 1 && score === needed - 1;
  const point = near(scoreA) && near(scoreB) ? "both" : near(scoreA) ? "a" : near(scoreB) ? "b" : "";
  return {
    a: entity(state, m.a), b: entity(state, m.b),
    scoreA, scoreB, bestOf, needed, leader, winner, point,
    cheer: m.celebrate === false ? "" : winner,
    showScore: m.show !== false,
  };
}

// ---------- Solve history ----------
// state.match.solves = [{ a: "8.14", b: "10.02+", winner: "a" | "b" | "" }]
// One entry per solve, as recorded from the two cameras (Live > Solves).

// "8.14" or "1:02.33" -> seconds. NaN when it is not a time.
export function toSeconds(text) {
  const parts = String(text ?? "").trim().split(":");
  if (parts.some((p) => p === "" || isNaN(Number(p)))) return NaN;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

function clock(seconds) {
  const rest = (seconds % 60).toFixed(2);
  return seconds < 60 ? rest : `${Math.floor(seconds / 60)}:${rest.padStart(5, "0")}`;
}

// One side of a solve, from the time typed on its camera and the camera's
// status: +2 adds two seconds, DNF and DNS lose to any time.
//   { text: what to show, value: seconds to compare (NaN = nothing typed yet) }
export function solveResult(time, status) {
  if (status === "dnf" || status === "dns") return { text: status.toUpperCase(), value: Infinity };
  const seconds = toSeconds(time);
  if (isNaN(seconds)) return { text: "", value: NaN };
  return status === "plus2" ? { text: `${clock(seconds + 2)}+`, value: seconds + 2 } : { text: String(time).trim(), value: seconds };
}

// Who the victory frame celebrates. state.victory.winner is
//   "auto"      the match winner, or the leader if the match is not over
//   "a" / "b"   that side of the match
//   an id       any team or competitor (a season champion, for example)
// Returns { winner, loser, score: [winner's, loser's] } with winner = null
// when there is nobody to show yet (a tied match on "auto").
export function victoryInfo(state) {
  const pick = state.victory?.winner || "auto";
  const m = matchInfo(state);
  const side = pick === "auto" ? (m.winner || m.leader) : (pick === "a" || pick === "b") ? pick : "";
  if (side) {
    const other = side === "a" ? "b" : "a";
    const score = side === "a" ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
    return { winner: m[side], loser: m[other], score, side };
  }
  const chosen = entity(state, pick);
  return { winner: chosen.kind === "none" ? null : chosen, loser: null, score: null, side: "" };
}
