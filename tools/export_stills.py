#!/usr/bin/env python3
"""Save every frame as a 1920x1080 PNG, for use in a video editor.

Hollow frames are saved with real transparency where the camera goes, so they
can be dropped straight onto a video track. Set the state you want in the
control panel first, keep server.py running, then run:

    python tools/export_stills.py

Files are written to the "exports" folder. Uses Microsoft Edge or Chrome,
whichever is installed; nothing else is needed.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BASE = "http://localhost:8080/frames/"
FRAMES = ["versus", "pickban", "bracket", "competitor", "team", "intermission",
          "cam-versus", "cam-solo", "cam-solo?slot=b", "scorebug"]
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "msedge", "google-chrome", "chromium",
]


def find_browser():
    for candidate in BROWSERS:
        if Path(candidate).exists() or shutil.which(candidate):
            return candidate
    sys.exit("Could not find Edge or Chrome.")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else BASE
    browser = find_browser()
    out = Path(__file__).resolve().parent.parent / "exports"
    out.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as profile:
        for frame in FRAMES:
            name, _, query = frame.partition("?")
            url = f"{base}{name}.html?still=1" + (f"&{query}" if query else "")
            target = out / (frame.replace("?slot=", "-") + ".png")
            target.unlink(missing_ok=True)
            try:
                subprocess.run([
                    browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--user-data-dir={profile}", "--window-size=1920,1080",
                    "--default-background-color=00000000", "--virtual-time-budget=4000",
                    f"--screenshot={target}", url,
                ], check=False, timeout=40, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except subprocess.TimeoutExpired:
                pass
            print("saved" if target.exists() else "FAILED", target)


if __name__ == "__main__":
    main()
