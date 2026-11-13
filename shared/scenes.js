// The list of frames. This is the one place a frame is registered: the
// Program source, the frame list page, the control panel's "On screen now"
// buttons and its link list are all built from it.
//
// To add a frame: create frames/<id>.html and add a line here. To give it
// its own controls on the Live tab, add an entry to PANELS in
// control/tabs/live.js.
//
//   kind      "solid" stands on its own, "hollow" goes over camera footage
//   note      one line shown next to the link
//   variants  extra ready-made links: [query string, name]

export const SCENES = [
  { id: "intermission", name: "Intermission", kind: "solid", note: "Starting soon, be right back, countdown" },
  { id: "versus", name: "Versus", kind: "solid", note: "Two sides and the match score" },
  { id: "pickban", name: "Pick & ban", kind: "solid", note: "Puzzle pool with bans, picks and the decider" },
  { id: "bracket", name: "Bracket", kind: "solid", note: "Single elimination, double elimination or Swiss" },
  { id: "competitor", name: "Competitor", kind: "solid", note: "One person. Add ?id=c1 to pin one person" },
  { id: "team", name: "Team", kind: "solid", note: "One team and its members. Add ?id=t1 to pin one team" },
  { id: "victory", name: "Victory", kind: "solid", note: "The winning team or person" },
  { id: "cam-versus", name: "Two cameras", kind: "hollow", note: "Head to head: two camera windows and the score bar" },
  { id: "cam-solo", name: "One camera", kind: "hollow", note: "Thin frame around one camera",
    variants: [["?slot=a", "Camera A, pinned"], ["?slot=b", "Camera B, pinned"]] },
  { id: "scorebug", name: "Score bug", kind: "hollow", note: "Score bar only",
    variants: [["?pos=bottom", "Score bug, pinned to the bottom"]] },
];

export const DEFAULT_SCENE = "intermission";

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES.find((s) => s.id === DEFAULT_SCENE);
}
