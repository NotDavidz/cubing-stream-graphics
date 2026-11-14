// Bracket logic, with no drawing in it. Used by the bracket frame and by the
// control panel, so both always agree on who plays whom.
//
// The state only stores the entrant list (in seed order) and one result per
// match id. Everything else, including who advances, is worked out here.
//
//   state.bracket.results["W1-1"] = { sa: 3, sb: 1, winner: "a" }
//
// Byes: when the entrant count is not a power of two, the top seeds have no
// first-round opponent. Their first-round "match" is a walkover: it is marked
// walkover: true so nothing draws it, and the seed simply appears in the next
// round, waiting for an opponent.

const BYE = { bye: true, name: "BYE" };

// Standard seeding: 1 plays the lowest seed, and the top two can only meet in the final.
function seedOrder(size) {
  let order = [0];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n - 1 - s]);
  }
  return order;
}

function roundTitle(matchesInRound, prefix = "") {
  if (prefix) return prefix;
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semifinals";
  if (matchesInRound === 4) return "Quarterfinals";
  return `Round of ${matchesInRound * 2}`;
}

// The match for third place between the two losing semifinalists. Single
// elimination only, and only once there are four entrants to have semifinals.
export const THIRD = "3RD";
export function hasThirdPlace(bracket = {}) {
  return bracket.format !== "double" && bracket.format !== "swiss"
    && bracket.thirdPlace !== false && (bracket.entrants || []).length >= 4;
}

// format: "single" or "double". options.thirdPlace adds the third place match
// to a single elimination bracket. Returns
//   { sections: [{ title, rounds: [{ title, matches: [match] }], third? }] }
// where match = { id, a, b, sa, sb, won, winner, loser, walkover, feeders }
// and a/b = { name, seed?, bye?, pending? }.
//   won       "a" | "b" | ""
//   walkover  one side is a bye, so there is nothing to play or draw
//   feeders   [id | null, id | null]: the match whose winner fills slot a / b
export function buildElimination(format, entrants, results = {}, options = {}) {
  const count = Math.max(entrants.length, format === "double" ? 4 : 2);
  const size = 2 ** Math.ceil(Math.log2(count));
  const wbRounds = Math.log2(size);
  const defs = {};       // match id -> [slotA, slotB], each { seed } or { from, take }

  const order = seedOrder(size);
  const wb = [];
  for (let r = 1; r <= wbRounds; r++) {
    const ids = [];
    for (let i = 1; i <= size / 2 ** r; i++) {
      const id = `W${r}-${i}`;
      defs[id] = r === 1
        ? [{ seed: order[2 * i - 2] }, { seed: order[2 * i - 1] }]
        : [{ from: `W${r - 1}-${2 * i - 1}`, take: "winner" }, { from: `W${r - 1}-${2 * i}`, take: "winner" }];
      ids.push(id);
    }
    wb.push(ids);
  }

  const lb = [];
  if (format === "double") {
    let n = size / 4;
    for (let j = 1; j <= 2 * (wbRounds - 1); j++) {
      const ids = [];
      if (j > 1 && j % 2 === 1) n /= 2;
      for (let i = 1; i <= n; i++) {
        const id = `L${j}-${i}`;
        if (j === 1) {
          defs[id] = [{ from: `W1-${2 * i - 1}`, take: "loser" }, { from: `W1-${2 * i}`, take: "loser" }];
        } else if (j % 2 === 0) {
          // Winners-bracket losers drop in, mirrored to delay rematches.
          defs[id] = [{ from: `L${j - 1}-${i}`, take: "winner" }, { from: `W${j / 2 + 1}-${n + 1 - i}`, take: "loser" }];
        } else {
          defs[id] = [{ from: `L${j - 1}-${2 * i - 1}`, take: "winner" }, { from: `L${j - 1}-${2 * i}`, take: "winner" }];
        }
        ids.push(id);
      }
      lb.push(ids);
    }
    defs.GF = [{ from: `W${wbRounds}-1`, take: "winner" }, { from: `L${lb.length}-1`, take: "winner" }];
  }

  const cache = {};
  const slot = (def) => {
    if ("seed" in def) return entrants[def.seed] ? { name: entrants[def.seed], seed: def.seed + 1 } : BYE;
    return solve(def.from)[def.take];
  };
  function solve(id) {
    if (cache[id]) return cache[id];
    const [a, b] = defs[id].map(slot);
    const res = results[id] || {};
    const pending = { pending: true, name: "" };
    let winner = pending, loser = pending, won = "";
    if (a.bye || b.bye) {
      winner = a.bye ? b : a; loser = BYE;          // a bye advances the other side
      won = a.bye && b.bye ? "" : a.bye ? "b" : "a";
      if (winner.pending) won = "";
    } else if (res.winner && !a.pending && !b.pending) {
      won = res.winner;
      winner = won === "a" ? a : b;
      loser = won === "a" ? b : a;
    }
    return (cache[id] = {
      id, a, b, sa: res.sa ?? "", sb: res.sb ?? "", won, winner, loser,
      walkover: Boolean(a.bye || b.bye),
      feeders: defs[id].map((def) => (def.take === "winner" ? def.from : null)),
    });
  }

  const toRounds = (list, title) => list.map((ids, i) => ({
    title: title ? `${title} ${i + 1}` : roundTitle(ids.length),
    matches: ids.map(solve),
  }));

  if (format !== "double") {
    const section = { title: "", rounds: toRounds(wb) };
    if (options.thirdPlace && wbRounds >= 2) {
      const semis = wb[wbRounds - 2];
      defs[THIRD] = semis.map((id) => ({ from: id, take: "loser" }));
      section.third = solve(THIRD);
    }
    return { sections: [section] };
  }
  const winners = toRounds(wb, "Winners R");
  winners.push({ title: "Grand Final", matches: [solve("GF")] });
  return {
    sections: [
      { title: "Winners Bracket", rounds: winners },
      { title: "Losers Bracket", rounds: toRounds(lb, "Losers R") },
    ],
  };
}

// ---------- Swiss ----------
// rounds = [[{ a, b, sa, sb, winner }]]   (b === "" means a bye for a)

export function swissStandings(entrants, rounds = []) {
  const table = new Map(entrants.map((name, i) => [name, { name, seed: i + 1, wins: 0, losses: 0, diff: 0, played: [] }]));
  for (const round of rounds) for (const m of round) {
    const a = table.get(m.a), b = table.get(m.b);
    if (a && !m.b) { a.wins++; a.hadBye = true; continue; }
    if (!a || !b) continue;
    a.played.push(b.name); b.played.push(a.name);
    if (!m.winner) continue;
    const d = (Number(m.sa) || 0) - (Number(m.sb) || 0);
    a.diff += d; b.diff -= d;
    (m.winner === "a" ? a : b).wins++;
    (m.winner === "a" ? b : a).losses++;
  }
  return [...table.values()].sort((x, y) => y.wins - x.wins || y.diff - x.diff || x.seed - y.seed);
}

// Pair the next round: best record first, avoiding rematches where possible.
export function swissPair(entrants, rounds = []) {
  const pool = swissStandings(entrants, rounds);
  const pairs = [];
  if (pool.length % 2) {
    // Lowest-ranked player who has not had a bye yet sits out.
    let i = pool.length - 1;
    while (i > 0 && pool[i].hadBye) i--;
    const [rest] = pool.splice(i, 1);
    pairs.push({ a: rest.name, b: "", sa: "", sb: "", winner: "a" });
  }
  while (pool.length) {
    const a = pool.shift();
    let i = pool.findIndex((p) => !a.played.includes(p.name));
    if (i < 0) i = 0;
    const [b] = pool.splice(i, 1);
    pairs.unshift({ a: a.name, b: b.name, sa: "", sb: "", winner: "" });
  }
  // Top table first, bye last.
  const byes = pairs.filter((p) => !p.b);
  return [...pairs.filter((p) => p.b).reverse(), ...byes];
}
