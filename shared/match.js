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
export function matchInfo(state) {
  const m = state.match || {};
  const bestOf = Math.max(1, Number(m.bestOf) || 1);
  const scoreA = Number(m.scoreA) || 0, scoreB = Number(m.scoreB) || 0;
  const needed = winsNeeded(bestOf);
  const leader = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "";
  const winner = leader && Math.max(scoreA, scoreB) >= needed ? leader : "";
  return {
    a: entity(state, m.a), b: entity(state, m.b),
    scoreA, scoreB, bestOf, needed, leader, winner,
    showScore: m.show !== false,
  };
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
