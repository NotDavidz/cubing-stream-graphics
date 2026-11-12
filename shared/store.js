// The one shared overlay state, kept in sync across every open frame.
//
// With server.py running, changes are sent to the server and pushed to all
// frames (OBS, projector, other laptops) over Server-Sent Events.
// Without it (for example a static preview on GitHub Pages) the store falls
// back to localStorage + BroadcastChannel, which syncs tabs of one browser.
//
// Usage:
//   store.subscribe(state => render(state));
//   store.set("match.scoreA", 2);
//   store.patch([{ path: "cameras.a.status", value: "plus2" }]);

const api = (name) => new URL(`../api/${name}`, import.meta.url);
const DEFAULTS = new URL("../data/default-state.json", import.meta.url);
const LOCAL_KEY = "uwcc-overlay-state";

const listeners = new Set();
let state = null;
let online = false;
let channel = null;

function emit() {
  for (const fn of listeners) fn(state);
}

// Same rules as set_path() in server.py: "a.b.0.c", null deletes a key.
export function setPath(root, path, value) {
  const keys = path.split(".");
  let node = root;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === null || typeof node[key] !== "object") node[key] = {};
    node = node[key];
  }
  const last = keys[keys.length - 1];
  if (value === null && !Array.isArray(node)) delete node[last];
  else node[last] = value;
}

export function getPath(root, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), root);
}

async function post(name, body) {
  const res = await fetch(api(name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  channel?.postMessage(state);
}

export const store = {
  get state() { return state; },
  get online() { return online; },

  subscribe(fn) {
    listeners.add(fn);
    if (state) fn(state);
    return () => listeners.delete(fn);
  },

  patch(ops) {
    for (const op of ops) setPath(state, op.path, op.value ?? null);
    emit();
    return online ? post("patch", ops) : saveLocal();
  },

  set(path, value) { return this.patch([{ path, value }]); },

  replace(next) {
    state = next;
    emit();
    return online ? post("state", next) : saveLocal();
  },

  async reset() {
    if (online) return post("reset", {});
    return this.replace(await (await fetch(DEFAULTS)).json());
  },
};

async function start() {
  try {
    const res = await fetch(api("state"));
    if (!res.ok) throw new Error("no server");
    state = (await res.json()).state;
    online = true;
    // ?still=1 is a one-off snapshot (still exports), so no live connection.
    if (new URLSearchParams(location.search).has("still")) return emit();
    const events = new EventSource(api("events"));
    events.onmessage = (e) => { state = JSON.parse(e.data).state; emit(); };
  } catch {
    const saved = localStorage.getItem(LOCAL_KEY);
    state = saved ? JSON.parse(saved) : await (await fetch(DEFAULTS)).json();
    channel = new BroadcastChannel(LOCAL_KEY);
    channel.onmessage = (e) => { state = e.data; emit(); };
  }
  emit();
}

start();
