#!/usr/bin/env python3
"""UW Cubing Club stream graphics server.

Zero dependencies (Python 3.8+ standard library only). It does three things:

  1. Serves the static files in this folder (frames, control panel, assets).
  2. Holds the single shared overlay state and saves it to data/state.json.
  3. Pushes every state change to all open frames over Server-Sent Events,
     so viewers see updates instantly and never see the control panel.

Run:   python server.py            (this computer only)
       python server.py --lan      (also reachable from phones/laptops on the network)
       python server.py --port 9000
       python server.py --state data/finals.json   (keep a separate state file)
"""
import argparse
import copy
import json
import os
import queue
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / "data" / "state.json"
DEFAULT_FILE = ROOT / "data" / "default-state.json"

# Sections that are plain option lists: missing options are filled in from the
# defaults. (Rosters and results are never touched.)
SETTING_SECTIONS = ("event", "program", "match", "settings", "victory", "intermission")

lock = threading.Lock()
state = {}
rev = 0
listeners = set()  # one queue.Queue per connected frame


def read_json_file(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def with_defaults(data):
    """Fill in top-level sections a state file from an older version lacks,
    so new frames and settings work without resetting anything."""
    defaults = read_json_file(DEFAULT_FILE) or {}
    for key, value in defaults.items():
        if key not in data:
            data[key] = value
        elif isinstance(value, dict) and isinstance(data[key], dict) and key in SETTING_SECTIONS:
            for inner, inner_value in value.items():
                data[key].setdefault(inner, inner_value)
    return data


def load_state():
    return with_defaults(read_json_file(STATE_FILE) or {})


def save_state():
    STATE_FILE.parent.mkdir(exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def set_path(root, path, value):
    """Set root["a"]["b"]["c"] = value for path "a.b.c". None deletes the key."""
    keys = path.split(".")
    node = root
    for key in keys[:-1]:
        if isinstance(node, list):
            node = node[int(key)]
        else:
            if not isinstance(node.get(key), (dict, list)):
                node[key] = {}
            node = node[key]
    last = keys[-1]
    if isinstance(node, list):
        index = int(last)
        if index == len(node):
            node.append(value)
        else:
            node[index] = value
    elif value is None:
        node.pop(last, None)
    else:
        node[last] = value


def snapshot():
    return json.dumps({"rev": rev, "state": state})


def commit():
    """Call with the lock held after changing state."""
    global rev
    rev += 1
    save_state()
    message = snapshot()
    for q in list(listeners):
        q.put(message)


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass  # keep the console quiet

    def end_headers(self):
        # Frames must always pick up the latest files while you are editing them.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, body, status=200):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/state":
            with lock:
                self.send_json(snapshot())
        elif path == "/api/events":
            self.stream_events()
        elif path == "/":
            self.send_response(302)
            self.send_header("Location", "/control/")
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        global state
        path = self.path.split("?")[0]
        try:
            body = self.read_json()
            with lock:
                if path == "/api/patch":
                    # body: [{"path": "match.scoreA", "value": 2}, ...]
                    draft = copy.deepcopy(state)
                    for op in body:
                        set_path(draft, op["path"], op.get("value"))
                    state = draft
                elif path == "/api/state":
                    if not isinstance(body, dict):
                        raise ValueError("state must be an object")
                    state = with_defaults(body)
                elif path == "/api/reset":
                    state = json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))
                else:
                    return self.send_json('{"error":"not found"}', 404)
                commit()
                self.send_json(json.dumps({"ok": True, "rev": rev}))
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as err:
            self.send_json(json.dumps({"error": str(err)}), 400)

    def stream_events(self):
        q = queue.Queue()
        with lock:
            listeners.add(q)
            first = snapshot()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(f"data: {first}\n\n".encode("utf-8"))
            self.wfile.flush()
            while True:
                try:
                    message = q.get(timeout=15)
                    self.wfile.write(f"data: {message}\n\n".encode("utf-8"))
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")  # keeps the connection alive
                self.wfile.flush()
        except (ConnectionError, OSError):
            pass
        finally:
            with lock:
                listeners.discard(q)
            self.close_connection = True


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return None


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows, address reuse lets a second copy start on the same port and
    # steal half the requests. Refuse to start instead.
    allow_reuse_address = os.name != "nt"


def main():
    global state, STATE_FILE
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--lan", action="store_true",
                        help="allow other devices on the network to connect")
    parser.add_argument("--state", type=Path, default=STATE_FILE,
                        help="state file to use (default: data/state.json)")
    args = parser.parse_args()

    STATE_FILE = args.state.resolve()
    state = load_state()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    try:
        server = Server((host, args.port), Handler)
    except OSError:
        raise SystemExit(f"Port {args.port} is already in use. The graphics server is probably "
                         f"running already; close it first, or pass --port with another number.")

    print("UW Cubing stream graphics are running.\n")
    print(f"  Control panel:  http://localhost:{args.port}/control/")
    print(f"  Frame list:     http://localhost:{args.port}/frames/")
    if args.lan and lan_address():
        print(f"  From another device: http://{lan_address()}:{args.port}/control/")
    print("\nLeave this window open during the stream. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
