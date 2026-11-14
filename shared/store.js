// The one shared overlay state, kept in sync across every open frame.
//
// With server.py running, changes are sent to the server and pushed to all
// frames (OBS, projector, other laptops) over Server-Sent Events.
// Without it (for example a static preview on GitHub Pages) the store falls
// back to localStorage + BroadcastChannel, which syncs tabs of one browser.
//
// A frame shown inside another page of this project (a scene inside the
// Program source, the preview inside the control panel) does not connect at
// all: it borrows the store of the page around it. That keeps a browser well
// under its limit of six connections per server.
//
// Usage:
//   store.subscribe(state => render(state));
//   store.set("match.scoreA", 2);
//   store.patch([{ path: "cameras.a.status", value: "plus2" }]);

const api = (name) => new URL(`../api/${name}`, import.meta.url);
const DEFAULTS = new URL("../data/default-state.json", import.meta.url);
const LOCAL_KEY = "uwcc-overlay-state";
const GLOBAL = "__uwccStore";

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

// ---------- The real store: talks to the server ----------

function createStore() {
  const listeners = new Set();
  let state = null;
  let online = false;
  let rev = -1;            // server revision of the state we hold
  let channel = null;
  let status = "ok";       // "lost" while the server cannot be reached

  function setStatus(next) {
    if (status === next) return;
    status = next;
    if (state) emit();
  }

  function emit() {
    for (const fn of listeners) {
      try { fn(state); } catch (err) { console.error(err); }
    }
  }

  async function post(name, body) {
    const res = await fetch(api(name), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  }

  // If the server refuses a change, drop our copy and take the server's.
  async function send(name, body) {
    try {
      await post(name, body);
      setStatus("ok");
    } catch (err) {
      console.error(err);
      await pull().then(() => setStatus("ok"), () => setStatus("lost"));
    }
  }

  async function pull() {
    const res = await fetch(api("state"));
    if (!res.ok) throw new Error("no server");
    ({ state, rev } = await res.json());
    emit();
  }

  function saveLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    channel?.postMessage(state);
  }

  async function start() {
    try {
      await pull();
      online = true;
      // ?still=1 is a one-off snapshot (still exports), so no live connection.
      if (new URLSearchParams(location.search).has("still")) return emit();
      const events = new EventSource(api("events"));
      events.onerror = () => setStatus("lost");      // it keeps retrying by itself
      events.onopen = () => setStatus("ok");
      events.onmessage = (e) => {
        const next = JSON.parse(e.data);
        if (next.rev === rev) return;      // the copy sent on connect; already drawn
        ({ state, rev } = next);
        emit();
      };
    } catch {
      const defaults = await (await fetch(DEFAULTS)).json();
      const saved = localStorage.getItem(LOCAL_KEY);
      state = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
      channel = new BroadcastChannel(LOCAL_KEY);
      channel.onmessage = (e) => { state = e.data; emit(); };
    }
    emit();
  }

  const store = {
    get state() { return state; },
    get online() { return online; },
    get status() { return status; },

    subscribe(fn) {
      listeners.add(fn);
      if (state) fn(state);
      return () => listeners.delete(fn);
    },

    patch(ops) {
      if (!state) return Promise.resolve();
      for (const op of ops) setPath(state, op.path, op.value ?? null);
      emit();
      return online ? send("patch", ops) : saveLocal();
    },

    set(path, value) { return this.patch([{ path, value }]); },

    replace(next) {
      state = next;
      emit();
      return online ? send("state", next) : saveLocal();
    },

    async reset() {
      if (online) return send("reset", {});
      return this.replace(await (await fetch(DEFAULTS)).json());
    },
  };

  start();
  return store;
}

// ---------- A borrowed store: a frame inside another page ----------

function hostStore() {
  try {
    return window.parent !== window ? window.parent[GLOBAL] || null : null;
  } catch {
    return null;             // the page around us is from somewhere else
  }
}

function borrow(host) {
  return {
    get state() { return host.state; },
    get online() { return host.online; },
    get status() { return host.status; },
    subscribe(fn) {
      const off = host.subscribe(fn);
      addEventListener("pagehide", off);     // stop listening once this frame is gone
      return off;
    },
    patch: (ops) => host.patch(ops),
    set: (path, value) => host.set(path, value),
    replace: (next) => host.replace(next),
    reset: () => host.reset(),
  };
}

const host = hostStore();
export const store = host ? borrow(host) : createStore();
window[GLOBAL] = store;
