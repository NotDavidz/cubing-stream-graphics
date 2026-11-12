// Pick and ban logic, shared by the frame and the control panel.
//
//   state.pickban = {
//     pool:     ["333", "222", ...],            the puzzles on the table
//     sequence: ["a:ban", "b:ban", "a:pick"...] whose turn it is, in order
//     actions:  [{ event, side, type }]         what has happened so far
//   }
// Whatever is untouched when the sequence runs out becomes the decider.

// Two picks (one each), ban everything else but one decider.
// 7 puzzles: ban ban pick pick ban ban, leaving 3 to play.
export function defaultSequence(poolSize, first = "a") {
  const bans = Math.max(poolSize - 3, 0);
  const early = Math.min(bans, 2);
  const types = [...Array(early).fill("ban"), "pick", "pick", ...Array(bans - early).fill("ban")]
    .slice(0, Math.max(poolSize - 1, 0));
  const other = first === "a" ? "b" : "a";
  return types.map((type, i) => `${i % 2 ? other : first}:${type}`);
}

export function pickbanStatus(pb = {}) {
  const pool = pb.pool || [], sequence = pb.sequence || [], actions = pb.actions || [];
  const taken = Object.fromEntries(actions.map((a) => [a.event, a]));
  const done = actions.length >= sequence.length;
  const [side, type] = done ? [] : sequence[actions.length].split(":");
  const cards = pool.map((event) => {
    const action = taken[event];
    if (action) return { event, status: action.type === "ban" ? "banned" : "picked", side: action.side };
    return { event, status: done ? "decider" : "open", side: "" };
  });
  return {
    cards, done,
    next: done ? null : { side, type },
    // The puzzles that will be played, in order: picks first, then the decider.
    playing: [...actions.filter((a) => a.type === "pick").map((a) => a.event),
      ...(done ? cards.filter((c) => c.status === "decider").map((c) => c.event) : [])],
  };
}
