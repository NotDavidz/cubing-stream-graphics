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

Other options: `--port 9000` to use another port, and `--state data/finals.json`
to keep a separate state file (one per event, for example).

## The frames

All frames are 1920x1080.

| Frame | Kind | What it is |
| --- | --- | --- |
| `frames/program.html` | either | One source that shows whichever page the operator picks under "On screen now" |
| `frames/intermission.html` | solid | Starting soon / be right back, optional countdown |
| `frames/versus.html` | solid | Two teams or two competitors, with the match score. The side that wins the match is outlined, lifted and showered with confetti |
| `frames/pickban.html` | solid | Puzzle pool; sides take turns banning and picking until three remain |
| `frames/bracket.html` | solid | Single elimination, double elimination or Swiss |
| `frames/competitor.html` | solid | One person: WCA ID, team, personal bests per puzzle |
| `frames/team.html` | solid | One team and its members |
| `frames/victory.html` | solid | Event champion: the team or person who won the whole event |
| `frames/cam-versus.html` | hollow | Two camera windows, score bar, +2 / DNF alerts |
| `frames/cam-solo.html` | hollow | Thin frame around one camera, with the event bulge and score |
| `frames/scorebug.html` | hollow | The score bar with solver times, penalties and the match win, to lay over any footage |

**Solid** frames stand on their own. **Hollow** frames are transparent where the
camera goes.

## The control panel

| Tab | What it is for |
| --- | --- |
| **Live** | Choose what is on screen and run it. Only the controls for the chosen page are shown: the score for Versus, one camera for One camera, the person picker for Competitor, and so on. |
| **Bracket** | The entrant list and every match result. |
| **People & teams** | The roster: names, photos, personal bests, team members. |
| **Settings** | Choices made once per event: teams or players, bracket format, pick & ban pool, how pages change, event name. |
| **Links & data** | Frame links to paste into OBS, export / import, reset. |

On the Live tab, click a page's **name** to open its controls and see it in the
small preview without putting it on screen; press **Show** to put it on screen.
That way a page can be set up before viewers see it.

## Three ways to use the frames

**Live in OBS.** Add a *Browser* source, paste a frame link (the "Links & data"
tab has copy buttons), set it to 1920 x 1080. Put hollow frames above the camera
sources. For `cam-versus`, the camera windows are at `52,262` and `968,262`,
each `900 x 506`.

The simplest setup is one Browser source with `frames/program.html`. Pages then
change from the Live tab, with a sweep, a fade or a plain cut (Settings > Screen).

**Projected in the room.** Open `frames/program.html` in a browser on the
projector and press F11. Switch pages from the control panel.

**Post editing.** Two options:

- Stills with real transparency: set things up in the control panel, then run
  `python tools/export_stills.py`. PNGs land in `exports/`.
- Moving overlays: add `?bg=green` to a frame link (also `magenta` or `blue`),
  record it, and chroma-key it in your editor.

Other link options: `?still=1` turns animation off, `?bg=none` removes the
patterned background from a solid frame, `?id=c1` pins the competitor or team
page to one entry, `?slot=a` / `?slot=b` pins a one-camera frame to a camera,
`?pos=bottom` pins the score bug to the bottom.

## How it is put together

```
server.py                 serves the files, holds the state, pushes changes to frames
data/default-state.json   sample data and the shape of the state
data/state.json           the live state (created when you run; not committed)

shared/theme.css          colours, fonts, banner, panels: the whole look
shared/scenes.js          the list of frames (the one place a frame is registered)
shared/store.js           keeps every frame in sync with the server
shared/ui.js              helpers every frame uses (scaling, banner, avatar, ...)
shared/match.js           match logic: wins needed, leader, winner
shared/bracket.js         bracket and Swiss logic, including byes
shared/pickban.js         pick and ban logic
shared/puzzles.js         puzzle list
shared/puzzle-icons.js    the official WCA event icons (generated, do not edit)
shared/camera.*           shared parts of the hollow frames, and the status list

frames/*.html             one file per frame: its layout, style and render function
frames/program.html       shows the chosen frame, and animates the change

control/control.js        wiring: tabs, saving fields, running actions
control/kit.js            the building blocks tabs are made of (field, switch, box, ...)
control/tabs/*.js         one file per tab: what it shows and what its buttons do

tools/export_stills.py    PNG export for editors
tools/update_icons.py     fetches the WCA icons into shared/puzzle-icons.js
```

There is one state object. The control panel changes it; frames draw it. A
frame is a function from state to HTML, so nothing can get out of step. Logic
that both a frame and the control panel need (who has won, who has a bye) lives
in `shared/`, never in either of them.

## Changing things

- **Colours and fonts:** the tokens at the top of `shared/theme.css`.
- **Logo:** replace `assets/logo.png` with another transparent PNG. It is drawn
  120 pixels tall, standing on the pale strip.
- **Photos:** put files in `assets/photos/` and enter `assets/photos/name.jpg`
  for the person in the control panel. No photo shows initials instead.
- **A new puzzle or club event:** add a line to `PUZZLES` in `shared/puzzles.js`,
  then run `python tools/update_icons.py` to fetch its icon. An event with no
  official icon can borrow one: `icon: "333"`. If the gaps in the new icon look
  wide next to the others, give it a `grow` number (10 to 30 is typical).
- **A new camera alert** (like +2 or DNF): add a line to `STATUSES` in
  `shared/camera.js`. The button appears in the control panel by itself.
- **A new frame:** copy the closest file in `frames/`, change its render
  function, and add one line to `SCENES` in `shared/scenes.js`. It then appears
  in the Program source, the frame list, the Live tab and the link list. To give
  it controls on the Live tab, add an entry to `PANELS` in
  `control/tabs/live.js`. (Add it to `FRAMES` in `tools/export_stills.py` too.)
- **A new control:** in the tab's file under `control/tabs/`, use the helpers
  from `control/kit.js`. `field("Label", "state.path")` is a text box that saves
  itself; `seg("Label", "state.path", [[value, "Text"], ...])` is a switch;
  `btn("Text", "actionName")` is a button that runs `actionName` from that tab's
  `actions`.
- **A new setting:** add its default to `data/default-state.json` and a control
  to `control/tabs/settings.js`. State files saved before the setting existed
  pick up the default when the server starts.
- **A new tab:** write `control/tabs/yours.js` exporting
  `{ id, title, render(), actions }` and add it to `TABS` in `control/control.js`.
- **A new page change:** add a function to `TRANSITIONS` in `frames/program.html`
  and its name to the switch in `control/tabs/settings.js`.
- **Text that might be too long for its box:** add `data-fit="line"` (one line)
  or `data-fit="wrap"` to the element and it shrinks to fit.
- **A value that should pop when it changes** (a score, a time): add
  `data-k="some-name" data-v="the value"`. Only values that changed animate.

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

- Puzzle icons use the official WCA event icon shapes from
  [cubing/icons](https://github.com/cubing/icons) (MIT licence). They are shown
  filling the box with thin gaps, as on the club posters: each piece is
  thickened a little and the margin trimmed. The amount per puzzle is `grow`
  in `shared/puzzles.js`. FTO also has its four faces moved closer together
  (`ADJUST` in `tools/update_icons.py`).
- Winning a match and winning the event are shown differently. A match win
  is celebrated on the Versus page by itself, as soon as a side has the wins it
  needs (switch it off under Settings > Match). The Champion page is for the
  winner of the whole event and is shown by the operator.
- Auto-scroll (Live tab, on the Competitor and Team pages) steps through the
  whole roster at a set pace. Every screen works the step out from the clock,
  so they change together as long as the computers' clocks agree.
- A +2 / DNF / win can clear itself after a few seconds (Live tab, next to the
  cameras). The control panel does the clearing, so keep it open.
- A bracket match put on the scoreboard with **Play** can have its final score
  written back with **Save to bracket** on the Live tab.
- Fonts load from Google Fonts, so the stream PC needs internet (it falls back
  to a system font without it).
- Byes are handled automatically when the entrant count is not a power of two:
  the top seeds skip the first round and are drawn straight into the next one.
- A 32-entrant bracket fits, but the text is small. Up to 24 entrants (8 byes)
  reads comfortably.
- Single elimination has a third place match between the two losing
  semifinalists, drawn under the final. Switch it off under Settings > Bracket.
- Double elimination has no bracket-reset match, and reads best with up to 8 entrants.
- The "Best of" number (Live tab, next to the score) decides the wins needed
  (first to 3 in a best of 5) and the wording on the score bar.
- The score bug carries more than the score: a time, +2 or DNF set on camera A
  hangs under the left side of the bar and camera B under the right, the middle
  shows "Match point" or "Decider", and the winner's half of the bar turns
  bright when the match is won.
- Solve history (Live > Solves, with the Score bug or Two cameras page open):
  type both times on the cameras, press **Record solve**, and the faster side
  gets the point. +2 adds two seconds; DNF and DNS lose to any time. The last
  six solves are listed under the score bug. It is kept in `match.solves`.
- Footer strip (Settings, off by default): extra lines such as sponsors or
  socials take turns with the event name in the footer of full pages.
- Only one copy of the server can run on a port. If it says the port is in
  use, it is already running in another window.
