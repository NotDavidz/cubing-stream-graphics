# UW Cubing Club stream graphics

Overlays and full-screen pages for UWaterloo Cubing Club event streams. An operator
changes scores, penalties, brackets and pick/bans in a control panel, and every
frame updates at once. Viewers only ever see the frames.

Everything is plain HTML, CSS and JavaScript drawn in code (no image editing, no
build step, nothing to install except Python, which the server uses).

## Start it

1. Double-click `start.bat` (or run `python server.py`).
2. The control panel opens at <http://localhost:8080/control/>.
3. The list of frames is at <http://localhost:8080/frames/>.

To run the control panel from a phone or a second laptop on the same network,
start with `python server.py --lan` and open the address it prints.

## The frames

All frames are 1920x1080.

| Frame | Kind | What it is |
| --- | --- | --- |
| `frames/program.html` | either | One source that shows whichever page the operator picks under "On screen now" |
| `frames/versus.html` | solid | Two teams or two competitors, with the match score |
| `frames/pickban.html` | solid | Puzzle pool; sides take turns banning and picking until three remain |
| `frames/bracket.html` | solid | Single elimination, double elimination or Swiss |
| `frames/competitor.html` | solid | One person: WCA ID, team, personal bests per puzzle |
| `frames/team.html` | solid | One team and its members |
| `frames/intermission.html` | solid | Starting soon / be right back, optional countdown |
| `frames/cam-versus.html` | hollow | Two camera windows, score bar, +2 / DNF alerts |
| `frames/cam-solo.html?slot=a` | hollow | Thin frame around one camera, with the event bulge and score |
| `frames/scorebug.html` | hollow | Just the score bar, to lay over any footage |

**Solid** frames stand on their own. **Hollow** frames are transparent where the
camera goes.

## Three ways to use them

**Live in OBS.** Add a *Browser* source, paste a frame link (the control panel's
"Setup & links" tab has copy buttons), set it to 1920 x 1080. Put hollow frames
above the camera sources. For `cam-versus`, the camera windows are at
`52,262` and `968,262`, each `900 x 506`.

**Projected in the room.** Open `frames/program.html` in a browser on the
projector and press F11. Switch pages from the control panel.

**Post editing.** Two options:

- Stills with real transparency: set things up in the control panel, then run
  `python tools/export_stills.py`. PNGs land in `exports/`.
- Moving overlays: add `?bg=green` to a frame link (also `magenta` or `blue`),
  record it, and chroma-key it in your editor.

Other link options: `?still=1` turns animation off, `?bg=none` removes the
patterned background from a solid frame, `?id=c1` pins the competitor or team
page to one entry, `?pos=bottom` moves the score bug.

## How it is put together

```
server.py            serves the files, holds the state, pushes changes to frames
data/default-state.json   sample data and the shape of the state
data/state.json      the live state (created when you run; not committed)
shared/theme.css     colours, fonts, banner, panels: the whole look
shared/store.js      keeps every frame in sync with the server
shared/ui.js         helpers every frame uses (scaling, banner, avatar, ...)
shared/puzzles.js    puzzle list and vector icons
shared/bracket.js    bracket and Swiss logic
shared/pickban.js    pick and ban logic
shared/camera.*      shared parts of the hollow frames, and the status list
frames/*.html        one file per frame: its layout, style and render function
control/             the operator panel
tools/export_stills.py   PNG export for editors
```

There is one state object. The control panel changes it; frames draw it. A
frame is a function from state to HTML, so nothing can get out of step.

## Changing things

- **Colours and fonts:** the tokens at the top of `shared/theme.css`.
- **Logo:** replace `assets/logo.png` (transparent PNG). The one included was
  lifted from a poster, so swap in the original artwork for a sharper result.
- **Photos:** put files in `assets/photos/` and enter `assets/photos/name.jpg`
  for the person in the control panel. No photo shows initials instead.
- **A new puzzle or club event:** add a line to `PUZZLES` in `shared/puzzles.js`.
- **A new camera alert** (like +2 or DNF): add a line to `STATUSES` in
  `shared/camera.js`. The button appears in the control panel by itself.
- **A new frame:** copy the closest file in `frames/`, change its render
  function, and add it to the lists in `frames/index.html`, `frames/program.html`
  and `control/control.js`.
- **Text that might be too long for its box:** add `data-fit="line"` (one line)
  or `data-fit="wrap"` to the element and it shrinks to fit.
- **A value that should pop when it changes** (a score, a time): add
  `data-k="some-name" data-v="the value"`. Only values that changed animate.
- **A new control:** inputs need `data-path="state.path"`, buttons need
  `data-act="name"` and a matching entry in `ACTIONS` in `control/control.js`.

## Design rules

Taken from the club posters; keep to them so new frames look like they belong.

- Near-black background with the dark triangle pattern, diagonal stripes in two corners.
- Logo on top of a thin pale strip, then a gold banner with heavy black capitals.
- Flat colour, square corners, no shadows or gradients. Poppins throughout.
- Yellow range for nearly everything: bright `#fae203`, gold `#ecc13c`, pale `#eae6a3`.
  Side A is gold, side B is pale.
- Red (`#e23b2e`) only for penalties and bans. The red glow is used only on a
  camera frame with a +2, DNF or DNS.

## Good to know

- Fonts load from Google Fonts, so the stream PC needs internet (it falls back
  to a system font without it).
- Double elimination has no bracket-reset match, and reads best with up to 8 entrants.
- Byes are handled automatically when the entrant count is not a power of two.
