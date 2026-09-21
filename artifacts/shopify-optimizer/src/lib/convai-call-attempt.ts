// Ownership tracking for one ConvAI call attempt.
//
// A voice call owns several browser resources that are acquired at different
// times (AudioContext at click time, MediaStream after the permission prompt,
// WebSocket after the signed URL arrives, mic nodes on socket open). Any of
// those awaits can be overtaken by "Colgar", "Reintentar" or unmount. If the
// resource is then attached to shared refs, the stale attempt can tear down
// the replacement call or leave the microphone capturing after the modal is
// gone. Every resource is therefore handed to the attempt that requested it;
// an attempt that is no longer current releases what it receives immediately.

export interface AttemptSocket {
  onopen: unknown;
  onmessage: unknown;
  onerror: unknown;
  onclose: unknown;
  readonly readyState: number;
  close: () => void;
}

export interface AttemptStream {
  getTracks: () => Array<{ stop: () => void }>;
}

export interface AttemptAudioContext {
  readonly state: string;
  close: () => Promise<unknown>;
}

export interface AttemptNode {
  disconnect: () => void;
}

const WS_CLOSING = 2;
const WS_CLOSED = 3;

export interface CallAttempt {
  readonly id: number;
  /** True while this attempt is the live call and has not been disposed. */
  isActive: () => boolean;
  /** Take ownership; if the attempt is already over the context is closed now. */
  ownContext: <T extends AttemptAudioContext>(ctx: T) => T;
  /** Take ownership; if the attempt is already over the tracks are stopped now. */
  ownStream: <T extends AttemptStream>(stream: T) => T;
  /** Take ownership; if the attempt is already over the socket is closed now. */
  ownSocket: <T extends AttemptSocket>(ws: T) => T;
  /** Take ownership of audio graph nodes (mic source, processor, mute gain). */
  ownNodes: (...nodes: AttemptNode[]) => void;
  /** Register extra teardown (timers, etc.). Runs at once if already disposed. */
  onDispose: (fn: () => void) => void;
  /** Release everything. Idempotent. Socket handlers are detached before close. */
  dispose: () => void;
}

export interface CallAttemptRegistry {
  /** Dispose the current attempt (if any) and start a new one. */
  begin: () => CallAttempt;
  /** The live attempt, or null when no call is in progress. */
  current: () => CallAttempt | null;
  /** Dispose the current attempt (if any). */
  end: () => void;
}

function stopTracks(stream: AttemptStream): void {
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* already stopped */ }
  }
}

function closeSocket(ws: AttemptSocket): void {
  // Detach first: a close event from a socket we intentionally closed must
  // never be mistaken for the live call ending.
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  if (ws.readyState !== WS_CLOSED && ws.readyState !== WS_CLOSING) {
    try { ws.close(); } catch { /* already closed */ }
  }
}

function closeContext(ctx: AttemptAudioContext): void {
  if (ctx.state !== "closed") {
    try { void ctx.close().catch(() => {}); } catch { /* already closed */ }
  }
}

function createAttempt(id: number, isCurrent: () => boolean): CallAttempt {
  let disposed = false;
  let context: AttemptAudioContext | null = null;
  let stream: AttemptStream | null = null;
  let socket: AttemptSocket | null = null;
  const nodes: AttemptNode[] = [];
  const disposers: Array<() => void> = [];

  const isActive = () => !disposed && isCurrent();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const fn of disposers.splice(0)) {
      try { fn(); } catch { /* best effort */ }
    }
    if (socket) closeSocket(socket);
    socket = null;
    for (const node of nodes.splice(0)) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    if (stream) stopTracks(stream);
    stream = null;
    if (context) closeContext(context);
    context = null;
  };

  return {
    id,
    isActive,
    ownContext: (ctx) => {
      if (!isActive()) { closeContext(ctx); return ctx; }
      if (context && context !== ctx) closeContext(context);
      context = ctx;
      return ctx;
    },
    ownStream: (s) => {
      if (!isActive()) { stopTracks(s); return s; }
      if (stream && stream !== s) stopTracks(stream);
      stream = s;
      return s;
    },
    ownSocket: (ws) => {
      if (!isActive()) { closeSocket(ws); return ws; }
      if (socket && socket !== ws) closeSocket(socket);
      socket = ws;
      return ws;
    },
    ownNodes: (...incoming) => {
      if (!isActive()) {
        for (const node of incoming) { try { node.disconnect(); } catch { /* ignore */ } }
        return;
      }
      nodes.push(...incoming);
    },
    onDispose: (fn) => {
      if (!isActive()) { fn(); return; }
      disposers.push(fn);
    },
    dispose,
  };
}

export function createCallAttemptRegistry(): CallAttemptRegistry {
  let current: CallAttempt | null = null;
  let nextId = 1;
  return {
    begin: () => {
      current?.dispose();
      const id = nextId++;
      const attempt = createAttempt(id, () => current === attempt);
      current = attempt;
      return attempt;
    },
    current: () => current,
    end: () => {
      const attempt = current;
      current = null;
      attempt?.dispose();
    },
  };
}
